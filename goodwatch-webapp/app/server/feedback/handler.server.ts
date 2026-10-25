// POST /api/feedback (#763, docs/implementation/feedback/README.md). One entry point for bug, idea, data and
// contact reports. Modelled on the wrong-title handler: same origin only, a body cap, a zod schema, a honeypot, a
// minimum time to submit, and a rate limit per address and per member. The report is stored first, then posted to
// the staff Discord forum, and emailed for contact messages and when Discord fails.
//
// - Storage failure (the table is missing, Crate is down) is soft: the report still goes to Discord and email, and
//   the failure is logged. 503 only when nothing accepted the report.
// - Delivery failure after the row is stored never fails the request.
import { createHash } from "node:crypto"
import sharp from "sharp"
import { File, FormData } from "undici"
import { nativeFetch } from "../native-fetch.server.ts"
import { readJsonLimited } from "../profile/request.server.ts"
import { clientAddress } from "../talked-about-now/rate-limit.server.ts"
import {
	type FeedbackInput,
	type FeedbackStatus,
	display,
	feedbackSchema,
	safePath,
} from "./schema.ts"

export interface Report {
	id: string
	kind: FeedbackInput["kind"]
	message: string
	email?: string
	data?: FeedbackInput["data"]
	metadata: Record<string, unknown>
	memberId: string | null
	screenshot?: string
	createdAt: number
	updatedAt: number | null
	handledBy: string | null
	correctionId: string | null
	status: FeedbackStatus
	dedupeKey: string | null
	duplicateCount: number
	hasScreenshot: boolean
}
export interface Screenshot {
	data: string
	contentType: string
	bytes: number
	createdAt: number
}
export type StoredReport =
	| { kind: "new" | "retry"; reportId: string }
	| {
			kind: "duplicate"
			reportId: string
			count: number
			threadId: string | null
			retry: boolean
	  }

/** Canonical field order and sorted identifier keys; only suggestions normalize strings. */
export function dedupeKey(input: FeedbackInput): string | null {
	if (input.kind !== "data" || !input.data) return null
	const { entityKind, ids, field, suggestedValue } = input.data
	return createHash("sha256")
		.update(
			JSON.stringify({
				entityKind,
				ids: Object.fromEntries(
					Object.keys(ids)
						.sort()
						// The schema accepts 603 and "603" for the same identifier.
						.map((key) => [key, String(ids[key])]),
				),
				field,
				// Omitted suggestions remain distinct from an explicit null.
				...(suggestedValue !== undefined
					? {
							suggestedValue:
								typeof suggestedValue === "string"
									? suggestedValue.trim().toLowerCase()
									: suggestedValue,
						}
					: {}),
			}),
		)
		.digest("hex")
}
export interface FeedbackStore {
	/** Accept a new report, merge an open data report, or recognize an accepted retry. */
	insert(report: Report): Promise<StoredReport>
	storeScreenshot(id: string, screenshot: Screenshot): Promise<void>
	discordId(
		id: string,
		messageId: string,
		threadId: string | null,
	): Promise<void>
	screenshot(id: string): Promise<Screenshot | null>
}
/** The shared limiter (app/server/rate-limit.server.ts): counted in Valkey, so every webapp instance shares it. */
export interface Limiter {
	take(
		name: string,
		client: string,
		windows: { limit: number; seconds: number }[],
	): Promise<{ allowed: boolean; retryAfterSeconds?: number }>
}
const HOUR = 3600
export const GUEST_LIMIT = { limit: 5, seconds: HOUR }
export const MEMBER_LIMIT = { limit: 20, seconds: HOUR }
export const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024
/** A 2 MiB screenshot in base64 plus the report's fields. */
export const MAX_BODY_BYTES = (MAX_SCREENSHOT_BYTES * 4) / 3 + 64000
const SCREENSHOT_FORMATS = ["png", "webp", "jpeg"]

const headers = {
	"Cache-Control": "private, no-store",
	"Content-Type": "application/json",
}
const answer = (
	status: number,
	body: unknown = null,
	extra: Record<string, string> = {},
) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { ...headers, ...extra },
	})

export interface Dependencies {
	store: FeedbackStore
	limiter: Limiter
	memberId(request: Request): Promise<string | null>
	email(report: Report): Promise<void>
	env?: Record<string, string | undefined>
	send?: typeof fetch
	now?: () => number
}
export async function handleFeedback(
	request: Request,
	deps: Dependencies,
): Promise<Response> {
	const env = deps.env ?? process.env
	if (request.method !== "POST")
		return new Response(null, {
			status: 405,
			headers: { ...headers, Allow: "POST" },
		})
	const origin =
		env.APP_ORIGIN ||
		(env.NODE_ENV === "production"
			? "https://goodwatch.app"
			: new URL(request.url).origin)
	if (
		request.headers.get("origin") !== origin ||
		![null, "same-origin"].includes(request.headers.get("sec-fetch-site"))
	)
		return answer(403)
	if (!request.headers.get("content-type")?.startsWith("application/json"))
		return answer(415)
	try {
		const body = await readJsonLimited(request, MAX_BODY_BYTES)
		if (!body.ok) return answer(body.problem === "too-large" ? 413 : 400)
		const parsed = feedbackSchema.safeParse(body.value)
		if (!parsed.success) return answer(400)
		const input = parsed.data
		const now = (deps.now ?? Date.now)()
		if (
			input.website ||
			now - input.startedAt < 2000 ||
			now - input.startedAt > 86400000
		)
			return answer(400)
		const memberId = await deps.memberId(request)
		// The limiter keys carry a hash, never the address itself.
		const address = createHash("sha256")
			.update(clientAddress(request))
			.digest("hex")
		const verdict = memberId
			? await firstRefusal(deps.limiter, [
					["feedback-member", memberId, MEMBER_LIMIT],
					["feedback-address", address, MEMBER_LIMIT],
				])
			: await deps.limiter.take("feedback-address", address, [GUEST_LIMIT])
		if (!verdict.allowed)
			return answer(429, null, {
				"Retry-After": String(verdict.retryAfterSeconds ?? HOUR),
			})
		let screenshot: string | undefined
		if (input.screenshot) {
			const bytes = Buffer.from(input.screenshot, "base64")
			if (bytes.length > MAX_SCREENSHOT_BYTES) return answer(413)
			try {
				const image = sharp(bytes, {
					limitInputPixels: 16000000,
					failOn: "error",
					animated: false,
				})
				const info = await image.metadata()
				if (
					!SCREENSHOT_FORMATS.includes(info.format ?? "") ||
					(info.pages ?? 1) > 1
				)
					return answer(400)
				const webp = await image.rotate().webp({ quality: 82 }).toBuffer()
				if (webp.length > MAX_SCREENSHOT_BYTES) return answer(413)
				screenshot = webp.toString("base64")
			} catch {
				return answer(400)
			}
		}
		const id = createHash("sha256")
			.update(
				JSON.stringify([
					memberId ? `member:${memberId}` : `guest:${address}`,
					input.idempotencyKey,
				]),
			)
			.digest("hex")
		const country = request.headers.get("cf-ipcountry")
		const metadata = {
			...input.metadata,
			url: safePath(input.metadata?.url ?? ""),
			userAgent: request.headers.get("user-agent")?.slice(0, 500),
			country: country && /^[A-Z]{2}$/.test(country) ? country : undefined,
			// Coolify supplies SOURCE_COMMIT at runtime (see list-exposure.server.ts).
			buildCommit: env.SOURCE_COMMIT || "unknown",
			receivedAt: new Date(now).toISOString(),
		}
		const report: Report = {
			id,
			kind: input.kind,
			message: input.message,
			email: input.email,
			data: input.data
				? {
						...input.data,
						sourceLink: input.data.sourceLink
							? sanitizeSource(input.data.sourceLink)
							: undefined,
					}
				: undefined,
			metadata,
			memberId,
			screenshot,
			createdAt: now,
			updatedAt: null,
			handledBy: null,
			correctionId: null,
			status: "new",
			dedupeKey: dedupeKey(input),
			duplicateCount: 1,
			hasScreenshot: false,
		}
		// Storage first, so that a retry finds its row. A failing store (the table is not there yet, Crate is down)
		// doesn't lose the report: it still goes to Discord and email, and the failure is logged.
		let stored = false
		let duplicate: Extract<StoredReport, { kind: "duplicate" }> | undefined
		try {
			const result = await deps.store.insert(report)
			if (
				result.kind === "retry" ||
				(result.kind === "duplicate" && result.retry)
			)
				return answer(200, { reportId: result.reportId })
			if (result.kind === "duplicate") duplicate = result
			stored = true
		} catch (error) {
			console.error("[feedback] storing the report failed; delivering anyway", {
				reportId: id,
				error: error instanceof Error ? error.message : String(error),
			})
		}
		if (stored && screenshot && !duplicate) {
			try {
				await deps.store.storeScreenshot(id, {
					data: screenshot,
					contentType: "image/webp",
					bytes: Buffer.byteLength(screenshot, "base64"),
					createdAt: now,
				})
				report.hasScreenshot = true
			} catch (error) {
				console.error("[feedback] storing the screenshot failed", {
					reportId: id,
					error: error instanceof Error ? error.message : String(error),
				})
			}
		}
		let delivered = false
		if (env.FEEDBACK_DISCORD_WEBHOOK_URL) {
			let receipt: Awaited<ReturnType<typeof postDiscord>> | undefined
			try {
				if (duplicate && !duplicate.threadId)
					throw new Error("Duplicate report has no Discord thread")
				receipt = await postDiscord(
					report,
					env,
					deps.send ?? nativeFetch,
					duplicate,
				)
				delivered = true
			} catch (error) {
				console.error("[feedback] Discord delivery failed", {
					reportId: id,
					error: error instanceof Error ? error.message : String(error),
				})
			}
			if (receipt && stored && !duplicate) {
				try {
					await deps.store.discordId(id, receipt.id, receipt.channel_id ?? null)
				} catch {
					console.error("[feedback] storing the Discord receipt failed", {
						reportId: id,
					})
				}
			}
		}
		let emailed = false
		if (!delivered || report.kind === "contact") {
			try {
				await deps.email(report)
				emailed = true
			} catch (error) {
				console.error("[feedback] email delivery failed", {
					reportId: id,
					error: error instanceof Error ? error.message : String(error),
				})
			}
		}
		if (!stored && !delivered && !emailed) return answer(503)
		return answer(200, { reportId: duplicate?.reportId ?? id })
	} catch (error) {
		console.error("[feedback] request failed", error)
		return answer(503)
	}
}
async function firstRefusal(
	limiter: Limiter,
	takes: [string, string, { limit: number; seconds: number }][],
) {
	for (const [name, client, window] of takes) {
		const verdict = await limiter.take(name, client, [window])
		if (!verdict.allowed) return verdict
	}
	return { allowed: true }
}
function sanitizeSource(value: string) {
	const url = new URL(value)
	url.username = ""
	url.password = ""
	url.hash = ""
	const path = safePath(value)
	return url.origin + path
}
export async function postDiscord(
	report: Report,
	env: Record<string, string | undefined>,
	send: typeof fetch,
	duplicate?: Extract<StoredReport, { kind: "duplicate" }>,
) {
	const url = new URL(env.FEEDBACK_DISCORD_WEBHOOK_URL!)
	if (
		url.protocol !== "https:" ||
		url.hostname !== "discord.com" ||
		!/^\/api(?:\/v\d+)?\/webhooks\//.test(url.pathname)
	)
		throw new Error("Invalid webhook URL")
	url.searchParams.set("wait", "true")
	url.searchParams.delete("thread_id")
	if (duplicate?.threadId) url.searchParams.set("thread_id", duplicate.threadId)
	let tag: string | undefined
	try {
		const tags = JSON.parse(env.FEEDBACK_DISCORD_TAG_IDS ?? "{}")
		if (/^\d{1,20}$/.test(tags[report.kind])) tag = tags[report.kind]
	} catch {
		/* optional */
	}
	// Discord limits: thread_name 100, embed title 256, description 4096, field value 1024, embed total 6000.
	const embed = {
		title: duplicate
			? `Duplicate ${duplicate.count}: ${report.kind}`
			: `Feedback: ${report.kind}`,
		description: display(report.message, 3500),
		fields: [
			{ name: "Report", value: report.id },
			{
				name: "Member",
				value: report.memberId ? display(report.memberId, 100) : "Guest",
			},
			{
				name: "Context",
				value: display(JSON.stringify(report.metadata), 1000) || "Unavailable",
			},
			...(report.data
				? [
						{
							name: "Data",
							value:
								display(JSON.stringify(report.data), 1000) || "Unavailable",
						},
					]
				: []),
		],
	}
	// A duplicate replies in the original thread. The key ignores message, current value, and source, so the
	// reply carries the new submission's evidence as its own embed instead of only the count.
	const payload = duplicate
		? {
				content: `Duplicate count increased to ${duplicate.count}.`,
				allowed_mentions: { parse: [] },
				embeds: [embed],
			}
		: {
				thread_name:
					`${report.kind}: ${display(report.message, 65) || report.id.slice(0, 12)}`.slice(
						0,
						100,
					),
				...(tag ? { applied_tags: [tag] } : {}),
				allowed_mentions: { parse: [] },
				embeds: [embed],
			}
	let body: BodyInit
	let requestHeaders: Record<string, string> = {}
	if (report.screenshot) {
		const form = new FormData()
		form.set("payload_json", JSON.stringify(payload))
		form.set(
			"files[0]",
			new File([Buffer.from(report.screenshot, "base64")], "screenshot.webp", {
				type: "image/webp",
			}),
		)
		body = form as unknown as BodyInit
	} else {
		body = JSON.stringify(payload)
		requestHeaders = { "Content-Type": "application/json" }
	}
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), 10000)
	try {
		const response = await send(url.toString(), {
			method: "POST",
			headers: requestHeaders,
			body,
			signal: controller.signal,
		})
		if (!response.ok) {
			await response.arrayBuffer()
			throw new Error(`Discord answered ${response.status}`)
		}
		const result = (await response.json()) as {
			id?: string
			channel_id?: string
		}
		if (!result.id) throw new Error("Missing Discord receipt")
		return { id: result.id, channel_id: result.channel_id }
	} finally {
		clearTimeout(timer)
	}
}
/** Authorization precedes storage access. Deny by default. */
export async function readScreenshot(
	id: string,
	staff: boolean,
	store: FeedbackStore,
) {
	if (!staff) return new Response(null, { status: 403, headers })
	if (!/^[a-f0-9]{64}$/.test(id))
		return new Response(null, { status: 404, headers })
	let data: Screenshot | null
	try {
		data = await store.screenshot(id)
	} catch (error) {
		console.error("[feedback] reading a screenshot failed", {
			reportId: id,
			error: error instanceof Error ? error.message : String(error),
		})
		return new Response(null, { status: 503, headers })
	}
	return data
		? new Response(Buffer.from(data.data, "base64"), {
				headers: {
					"Cache-Control": "private, no-store",
					"Content-Type": data.contentType,
					"X-Content-Type-Options": "nosniff",
					"Content-Security-Policy": "default-src 'none'",
				},
			})
		: new Response(null, { status: 404, headers })
}
