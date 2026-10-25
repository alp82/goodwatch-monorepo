import { createHash } from "node:crypto"
import sharp from "sharp"
import { FormData, File } from "undici"
import { nativeFetch } from "../native-fetch.server.ts"
import {
	createRateLimit,
	clientAddress,
} from "../talked-about-now/rate-limit.server.ts"
import { readJsonLimited } from "../profile/request.server.ts"
import {
	feedbackSchema,
	safePath,
	display,
	type FeedbackInput,
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
}
export interface FeedbackStore {
	/** Atomic INSERT ON CONFLICT DO NOTHING. False means a previously accepted retry. */
	insert(report: Report): Promise<boolean>
	discordId(
		id: string,
		messageId: string,
		threadId: string | null,
	): Promise<void>
	screenshot(id: string): Promise<string | null>
}
export function feedbackLimits() {
	return {
		guest: createRateLimit({ limit: 5, windowMs: 3600000 }),
		address: createRateLimit({ limit: 20, windowMs: 3600000 }),
		member: createRateLimit({ limit: 20, windowMs: 3600000 }),
	}
}
const limits = feedbackLimits()
const headers = {
	"Cache-Control": "private, no-store",
	"Content-Type": "application/json",
}
const answer = (status: number, body: unknown = null) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			...headers,
			...(status === 429 ? { "Retry-After": "3600" } : {}),
		},
	})
export interface Dependencies {
	store: FeedbackStore
	memberId(request: Request): Promise<string | null>
	email(report: Report): Promise<void>
	env?: Record<string, string | undefined>
	send?: typeof fetch
	limits?: ReturnType<typeof feedbackLimits>
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
		const body = await readJsonLimited(
			request,
			(2 * 1024 * 1024 * 4) / 3 + 64000,
		)
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
		const address = clientAddress(request)
		const limit = deps.limits ?? limits
		if (
			!(memberId
				? limit.address.take(address) && limit.member.take(memberId)
				: limit.guest.take(address))
		)
			return answer(429)
		let screenshot: string | undefined
		if (input.screenshot) {
			const bytes = Buffer.from(input.screenshot, "base64")
			if (bytes.length > 2 * 1024 * 1024) return answer(413)
			try {
				const image = sharp(bytes, {
					limitInputPixels: 16000000,
					failOn: "error",
					animated: false,
				})
				const info = await image.metadata()
				if (
					!["webp", "jpeg"].includes(info.format ?? "") ||
					(info.pages ?? 1) > 1
				)
					return answer(400)
				const webp = await image.rotate().webp({ quality: 82 }).toBuffer()
				if (webp.length > 2 * 1024 * 1024) return answer(413)
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
			buildCommit: env.GIT_COMMIT ?? env.SOURCE_COMMIT ?? "unknown",
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
		}
		if (!(await deps.store.insert(report))) return answer(200, { reportId: id })
		let delivered = false
		if (env.FEEDBACK_DISCORD_WEBHOOK_URL) {
			try {
				const result = await postDiscord(report, env, deps.send ?? nativeFetch)
				delivered = true
				await deps.store.discordId(id, result.id, result.channel_id ?? null)
			} catch {
				console.error("[feedback] Discord delivery or receipt storage failed", {
					reportId: id,
				})
			}
		}
		if (!delivered || report.kind === "contact") {
			try {
				await deps.email(report)
			} catch {
				console.error("[feedback] email delivery failed; report retained", {
					reportId: id,
				})
			}
		}
		return answer(200, { reportId: id })
	} catch {
		return answer(503)
	}
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
) {
	const url = new URL(env.FEEDBACK_DISCORD_WEBHOOK_URL!)
	if (
		url.protocol !== "https:" ||
		url.hostname !== "discord.com" ||
		!/^\/api(?:\/v\d+)?\/webhooks\//.test(url.pathname)
	)
		throw new Error("Invalid webhook URL")
	url.searchParams.set("wait", "true")
	let tag: string | undefined
	try {
		const tags = JSON.parse(env.FEEDBACK_DISCORD_TAG_IDS ?? "{}")
		if (/^\d{1,20}$/.test(tags[report.kind])) tag = tags[report.kind]
	} catch {
		/* optional */
	}
	const payload = {
		thread_name:
			`${report.kind}: ${display(report.message, 65) || report.id.slice(0, 12)}`.slice(
				0,
				100,
			),
		...(tag ? { applied_tags: [tag] } : {}),
		allowed_mentions: { parse: [] },
		embeds: [
			{
				title: `Feedback: ${report.kind}`,
				description: display(report.message, 3500),
				fields: [
					{ name: "Report", value: report.id },
					{
						name: "Member",
						value: report.memberId ? display(report.memberId, 100) : "Guest",
					},
					{
						name: "Context",
						value:
							display(JSON.stringify(report.metadata), 1000) || "Unavailable",
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
			},
		],
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
			throw new Error("Discord failed")
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
	const data = await store.screenshot(id)
	return data
		? new Response(Buffer.from(data, "base64"), {
				headers: {
					"Cache-Control": "private, no-store",
					"Content-Type": "image/webp",
					"X-Content-Type-Options": "nosniff",
					"Content-Security-Policy": "default-src 'none'",
				},
			})
		: new Response(null, { status: 404, headers })
}
