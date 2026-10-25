// Staff forum delivery: bot first, then webhook. Technical details follow as a quiet first reply.
// Each request uses nativeFetch (undici) with a 10 second timeout.
import { File, FormData } from "undici"
import type { Component } from "../discord/cards.ts"
import {
	type PostReport,
	SCREENSHOT_NAME,
	detailsMessage,
	duplicateComponents,
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
	method: "POST" | "PATCH" = "POST",
): Promise<T> {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
	try {
		const response = await send(url, {
			method,
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

class BotEditFailure extends Error {
	readonly threadId: string
	readonly cause: unknown
	constructor(threadId: string, cause: unknown) {
		super("Bot starter conversion failed")
		this.cause = cause
		this.threadId = threadId
	}
}

async function postDetails(
	report: PostReport,
	send: typeof fetch,
	context: Context,
	url: string,
	headers: Record<string, string> = {},
) {
	try {
		const request = body(detailsMessage(report, context.origin))
		await call(
			send,
			url,
			{ body: request.body, headers: { ...request.headers, ...headers } },
			"details reply",
		)
	} catch (error) {
		console.error("[feedback] posting report details to Discord failed", {
			reportId: report.id,
			error: error instanceof Error ? error.message : String(error),
		})
	}
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
					interactive: true,
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
	// Validate/build the final card before creating anything. Upload only when editing the message.
	const edit = body(
		{
			...message(
				reportComponents(report, {
					...context,
					screenshotInline: true,
					interactive: true,
				}),
			),
			content: null,
		},
		report.screenshot,
	)
	const tag = tagFor(env, report.kind)
	const request = body({
		name: threadName(report, context.threadPrefix),
		...(tag ? { applied_tags: [tag] } : {}),
		message: {
			content: "Feedback report received. Details follow.",
			allowed_mentions: { parse: [] },
		},
	})
	const thread = await call<{ id?: string; message?: { id?: string } }>(
		send,
		`https://discord.com/api/v10/channels/${target.forum}/threads`,
		{ body: request.body, headers: { ...request.headers, ...auth } },
		"bot post",
	)
	if (!thread.id) throw new Error("Missing Discord receipt")
	const messageId = thread.message?.id ?? thread.id
	try {
		await call(
			send,
			`https://discord.com/api/v10/channels/${thread.id}/messages/${messageId}`,
			{ body: edit.body, headers: { ...edit.headers, ...auth } },
			"bot starter edit",
			"PATCH",
		)
	} catch (error) {
		// The forum post exists: fallback must reuse it instead of opening a second post.
		throw new BotEditFailure(thread.id, error)
	}
	await postDetails(
		report,
		send,
		context,
		`https://discord.com/api/v10/channels/${thread.id}/messages`,
		auth,
	)
	return { id: messageId, channel_id: thread.id }
}

async function viaWebhook(
	url: URL,
	report: PostReport,
	env: Env,
	send: typeof fetch,
	context: Context,
	duplicate?: Duplicate,
	existingThreadId?: string,
): Promise<Receipt> {
	url.searchParams.set("wait", "true")
	url.searchParams.set("with_components", "true")
	url.searchParams.delete("thread_id")
	if (duplicate) {
		if (!duplicate.threadId)
			throw new Error("Duplicate report has no Discord thread")
		url.searchParams.set("thread_id", duplicate.threadId)
	}
	if (existingThreadId) url.searchParams.set("thread_id", existingThreadId)
	const tag = tagFor(env, report.kind)
	const components = duplicate
		? duplicateComponents(report, duplicate.count, {
				...context,
				screenshotInline: false,
			})
		: reportComponents(report, {
				...context,
				screenshotInline: false,
			})
	const payload = {
		...(duplicate || existingThreadId
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
	if (!duplicate) {
		// A webhook receipt normally includes channel_id; conversion fallback already knows the thread.
		const threadId = receipt.channel_id ?? existingThreadId
		const follow = new URL(url)
		if (threadId) {
			follow.searchParams.set("thread_id", threadId)
			await postDetails(report, send, context, follow.toString())
		} else {
			console.error("[feedback] posting report details to Discord failed", {
				reportId: report.id,
				error: "Missing Discord thread receipt",
			})
		}
	}
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
	let existingThreadId: string | undefined
	const bot = botTarget(env)
	if (bot) {
		try {
			return await viaBot(bot, report, env, send, context, duplicate)
		} catch (error) {
			if (error instanceof BotEditFailure) existingThreadId = error.threadId
			failures.push(error instanceof Error ? error.message : String(error))
			console.error("[feedback] bot delivery failed; trying the webhook", {
				reportId: report.id,
				error: failures[0],
			})
		}
	}
	const webhook = webhookTarget(env)
	if (webhook)
		return viaWebhook(
			webhook,
			report,
			env,
			send,
			context,
			duplicate,
			existingThreadId,
		)
	throw new Error(failures[0] ?? "Discord is not configured")
}
