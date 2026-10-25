// Delivery of the staff Discord post (docs/implementation/feedback/README.md, "Discord"), and the answer to its
// Details button.
//
// Two ways in, tried in this order:
// 1. The bot (DISCORD_BOT_TOKEN + DISCORD_FEEDBACK_FORUM_CHANNEL_ID): POST /channels/{forum}/threads. The bot owns
//    the message, so the post carries the staff-only Details button (and later #766's review buttons).
// 2. The webhook (DISCORD_FEEDBACK_WEBHOOK_URL) with ?with_components=true: a webhook the bot doesn't own may send only
//    non-interactive components, so the details sit in a spoilered line instead. Discord refuses files[n] next to
//    IS_COMPONENTS_V2 on a webhook, so a screenshot follows as its own message in the thread.
// Each request uses nativeFetch (undici) with a 10 second timeout; the polyfilled fetch crashed production on abort.
import { File, FormData } from "undici"
import type { Component } from "../discord/cards.ts"
import {
	type PostReport,
	SCREENSHOT_NAME,
	type StoredDetails,
	detailsMessage,
	duplicateComponents,
	ephemeralText,
	MESSAGE_FLAGS,
	reportComponents,
	threadName,
} from "./discord-post.ts"

type Env = Record<string, string | undefined>
export interface Receipt {
	id: string
	channel_id?: string
}
export interface Duplicate {
	count: number
	threadId: string | null
}
const TIMEOUT_MS = 10_000
const SNOWFLAKE = /^\d{17,20}$/

export const appOrigin = (env: Env) => env.APP_ORIGIN || "https://goodwatch.app"

function botTarget(env: Env) {
	const forum = env.DISCORD_FEEDBACK_FORUM_CHANNEL_ID?.trim()
	const token = env.DISCORD_BOT_TOKEN?.trim()
	return forum && token && SNOWFLAKE.test(forum) ? { forum, token } : null
}
function webhookTarget(env: Env) {
	if (!env.DISCORD_FEEDBACK_WEBHOOK_URL) return null
	const url = new URL(env.DISCORD_FEEDBACK_WEBHOOK_URL)
	if (
		url.protocol !== "https:" ||
		url.hostname !== "discord.com" ||
		!/^\/api(?:\/v\d+)?\/webhooks\//.test(url.pathname)
	)
		throw new Error("Invalid webhook URL")
	return url
}
/** True when at least one way to Discord is configured. */
export const discordConfigured = (env: Env) =>
	Boolean(botTarget(env) || env.DISCORD_FEEDBACK_WEBHOOK_URL)

function tagFor(env: Env, kind: string) {
	try {
		const tags = JSON.parse(env.DISCORD_FEEDBACK_TAG_IDS ?? "{}")
		if (/^\d{1,20}$/.test(tags[kind])) return String(tags[kind])
	} catch {
		/* optional */
	}
	return undefined
}

/** A JSON body, or multipart with payload_json and the screenshot as files[0]. */
function body(payload: Record<string, unknown>, screenshot?: string) {
	if (!screenshot)
		return {
			body: JSON.stringify(payload),
			headers: { "Content-Type": "application/json" } as Record<string, string>,
		}
	const form = new FormData()
	form.set(
		"payload_json",
		JSON.stringify({
			...payload,
			attachments: [{ id: 0, filename: SCREENSHOT_NAME }],
		}),
	)
	form.set(
		"files[0]",
		new File([Buffer.from(screenshot, "base64")], SCREENSHOT_NAME, {
			type: "image/webp",
		}),
	)
	return { body: form as unknown as BodyInit, headers: {} }
}
async function call<T>(
	send: typeof fetch,
	url: string,
	init: { body: BodyInit; headers: Record<string, string> },
	what: string,
): Promise<T> {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
	try {
		const response = await send(url, {
			method: "POST",
			headers: init.headers,
			body: init.body,
			signal: controller.signal,
		})
		if (!response.ok) {
			await response.arrayBuffer()
			throw new Error(`${what}: Discord answered ${response.status}`)
		}
		return (await response.json()) as T
	} finally {
		clearTimeout(timer)
	}
}

interface Context {
	origin: string
	memberHandle?: string | null
	threadPrefix?: string
}

async function viaBot(
	target: { forum: string; token: string },
	report: PostReport,
	env: Env,
	send: typeof fetch,
	context: Context,
	duplicate?: Duplicate,
): Promise<Receipt> {
	const auth = { Authorization: `Bot ${target.token}` }
	const message = (components: Component[]) => ({
		flags: MESSAGE_FLAGS,
		components,
		allowed_mentions: { parse: [] },
	})
	if (duplicate) {
		if (!duplicate.threadId || !SNOWFLAKE.test(duplicate.threadId))
			throw new Error("Duplicate report has no Discord thread")
		const request = body(
			message(
				duplicateComponents(report, duplicate.count, {
					...context,
					screenshotInline: true,
				}),
			),
			report.screenshot,
		)
		const result = await call<{ id?: string; channel_id?: string }>(
			send,
			`https://discord.com/api/v10/channels/${duplicate.threadId}/messages`,
			{ body: request.body, headers: { ...request.headers, ...auth } },
			"bot reply",
		)
		if (!result.id) throw new Error("Missing Discord receipt")
		return { id: result.id, channel_id: result.channel_id }
	}
	const tag = tagFor(env, report.kind)
	const request = body(
		{
			name: threadName(report, context.threadPrefix),
			...(tag ? { applied_tags: [tag] } : {}),
			message: message(
				reportComponents(report, {
					...context,
					interactive: true,
					screenshotInline: true,
				}),
			),
		},
		report.screenshot,
	)
	// The answer is the thread (a channel) with its starter message nested.
	const thread = await call<{ id?: string; message?: { id?: string } }>(
		send,
		`https://discord.com/api/v10/channels/${target.forum}/threads`,
		{ body: request.body, headers: { ...request.headers, ...auth } },
		"bot post",
	)
	if (!thread.id) throw new Error("Missing Discord receipt")
	return { id: thread.message?.id ?? thread.id, channel_id: thread.id }
}

async function viaWebhook(
	url: URL,
	report: PostReport,
	env: Env,
	send: typeof fetch,
	context: Context,
	duplicate?: Duplicate,
): Promise<Receipt> {
	url.searchParams.set("wait", "true")
	url.searchParams.set("with_components", "true")
	url.searchParams.delete("thread_id")
	if (duplicate) {
		if (!duplicate.threadId)
			throw new Error("Duplicate report has no Discord thread")
		url.searchParams.set("thread_id", duplicate.threadId)
	}
	const tag = tagFor(env, report.kind)
	const components = duplicate
		? duplicateComponents(report, duplicate.count, {
				...context,
				screenshotInline: false,
			})
		: reportComponents(report, {
				...context,
				interactive: false,
				screenshotInline: false,
			})
	const payload = {
		...(duplicate
			? {}
			: {
					thread_name: threadName(report, context.threadPrefix),
					...(tag ? { applied_tags: [tag] } : {}),
				}),
		flags: MESSAGE_FLAGS,
		components,
		allowed_mentions: { parse: [] },
	}
	const result = await call<{ id?: string; channel_id?: string }>(
		send,
		url.toString(),
		body(payload),
		"webhook post",
	)
	if (!result.id) throw new Error("Missing Discord receipt")
	const receipt = { id: result.id, channel_id: result.channel_id }
	if (report.screenshot && receipt.channel_id) {
		// Its own plain message in the thread; a failure here never fails the report.
		try {
			const follow = new URL(url)
			follow.searchParams.delete("with_components")
			follow.searchParams.set("thread_id", receipt.channel_id)
			await call(
				send,
				follow.toString(),
				body(
					{ content: "-# Screenshot", allowed_mentions: { parse: [] } },
					report.screenshot,
				),
				"webhook screenshot",
			)
		} catch (error) {
			console.error("[feedback] posting the screenshot to Discord failed", {
				reportId: report.id,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}
	return receipt
}

/**
 * Post a new report as a forum thread, or a duplicate as a reply in its thread. Tries the bot, then the webhook;
 * throws when every configured way failed, so the caller falls back to email.
 */
export async function postDiscord(
	report: PostReport,
	env: Env,
	send: typeof fetch,
	duplicate?: Duplicate,
	extra: { memberHandle?: string | null; threadPrefix?: string } = {},
): Promise<Receipt> {
	const context: Context = { origin: appOrigin(env), ...extra }
	const failures: string[] = []
	const bot = botTarget(env)
	if (bot) {
		try {
			return await viaBot(bot, report, env, send, context, duplicate)
		} catch (error) {
			failures.push(error instanceof Error ? error.message : String(error))
			console.error("[feedback] bot delivery failed; trying the webhook", {
				reportId: report.id,
				error: failures[0],
			})
		}
	}
	const webhook = webhookTarget(env)
	if (webhook) return viaWebhook(webhook, report, env, send, context, duplicate)
	throw new Error(failures[0] ?? "Discord is not configured")
}

// ---------- the Details button ----------

export interface DetailsInteraction {
	guild_id?: string
	member?: { user?: { id: string }; roles?: string[] }
	user?: { id: string }
}
const list = (value: string | undefined) =>
	(value ?? "")
		.split(",")
		.map((v) => v.trim())
		.filter((v) => SNOWFLAKE.test(v))
/**
 * Staff are Discord users in DISCORD_FEEDBACK_STAFF_USER_IDS, or server members holding a role in
 * DISCORD_FEEDBACK_STAFF_ROLE_IDS. Both empty denies everyone.
 */
export function isFeedbackStaff(interaction: DetailsInteraction, env: Env) {
	const user = interaction.member?.user?.id ?? interaction.user?.id
	if (user && list(env.DISCORD_FEEDBACK_STAFF_USER_IDS).includes(user))
		return true
	const roles = list(env.DISCORD_FEEDBACK_STAFF_ROLE_IDS)
	return Boolean(
		interaction.guild_id &&
			interaction.member?.roles?.some((role) => roles.includes(role)),
	)
}
/** The ephemeral answer to a Details press. Authorization precedes any storage read. */
export async function feedbackDetailsReply(
	interaction: DetailsInteraction,
	reportId: string,
	deps: { load: (id: string) => Promise<StoredDetails | null>; env: Env },
): Promise<{ data: ReturnType<typeof ephemeralText>; outcome: string }> {
	if (!isFeedbackStaff(interaction, deps.env))
		return {
			data: ephemeralText("Only GoodWatch staff can see report details."),
			outcome: "forbidden",
		}
	let report: StoredDetails | null
	try {
		report = await deps.load(reportId)
	} catch (error) {
		console.error("[feedback] reading report details failed", {
			reportId,
			error: error instanceof Error ? error.message : String(error),
		})
		return {
			data: ephemeralText("The report details couldn't be loaded. Try again."),
			outcome: "error",
		}
	}
	if (!report)
		return {
			data: ephemeralText(
				"This report isn't stored, so its details aren't available.",
			),
			outcome: "missing",
		}
	return { data: detailsMessage(report, appOrigin(deps.env)), outcome: "ok" }
}
