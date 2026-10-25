import assert from "node:assert/strict"
import { mock, test } from "node:test"
import { postDiscord } from "./discord.server.ts"
import type { PostReport } from "./discord-post.ts"

const report: PostReport = {
	id: "ab".repeat(32),
	kind: "bug",
	message: "Search loses focus.",
	metadata: {},
	memberId: null,
	createdAt: 1800000000000,
	dedupeKey: null,
}
const env = {
	DISCORD_BOT_TOKEN: "test-bot-token",
	DISCORD_FEEDBACK_FORUM_CHANNEL_ID: "111111111111111111",
	DISCORD_FEEDBACK_WEBHOOK_URL: "https://discord.com/api/webhooks/1/test-token",
	DISCORD_FEEDBACK_TAG_IDS: '{"bug":"123"}',
}
const threadId = "222222222222222222"
const messageId = "333333333333333333"
const json = (value: unknown) => new Response(JSON.stringify(value))

test("forum creation uses documented starter fields; the edit converts it to V2", async () => {
	const send = mock.fn(
		async (_url: string | URL | Request, init?: RequestInit) =>
			init?.method === "PATCH"
				? json({ id: messageId })
				: json({ id: threadId, message: { id: messageId } }),
	)
	assert.deepEqual(await postDiscord(report, env, send as typeof fetch), {
		id: messageId,
		channel_id: threadId,
	})
	assert.equal(send.mock.callCount(), 2)
	const create = JSON.parse(send.mock.calls[0].arguments[1]!.body as string)
	assert.equal(create.message.flags, undefined)
	assert.equal(create.message.components, undefined)
	assert.deepEqual(create.message.allowed_mentions, { parse: [] })
	assert.deepEqual(create.applied_tags, ["123"])
	const [url, init] = send.mock.calls[1].arguments
	assert.equal(
		url,
		`https://discord.com/api/v10/channels/${threadId}/messages/${messageId}`,
	)
	assert.equal(init!.method, "PATCH")
	const edit = JSON.parse(init!.body as string)
	assert.equal(edit.content, null)
	assert.equal(edit.flags, 1 << 15)
	assert.deepEqual(edit.allowed_mentions, { parse: [] })
	assert.match(JSON.stringify(edit.components), /gw1:feedback-details:/)
	for (const call of send.mock.calls) assert.ok(call.arguments[1]?.signal)
})

test("a failed conversion falls back to a full webhook card in the already-created thread", async (t) => {
	t.mock.method(console, "error", () => {})
	const send = mock.fn(
		async (url: string | URL | Request, init?: RequestInit) => {
			if (init?.method === "PATCH")
				return new Response("Bad request", { status: 400 })
			return String(url).includes("/webhooks/")
				? json({ id: "444444444444444444", channel_id: threadId })
				: json({ id: threadId, message: { id: messageId } })
		},
	)
	const receipt = await postDiscord(report, env, send as typeof fetch)
	assert.equal(receipt.channel_id, threadId)
	assert.equal(send.mock.callCount(), 3)
	const [url, init] = send.mock.calls[2].arguments
	assert.equal(new URL(String(url)).searchParams.get("thread_id"), threadId)
	assert.equal(new URL(String(url)).searchParams.get("with_components"), "true")
	const card = JSON.parse(init!.body as string)
	assert.equal(card.thread_name, undefined)
	assert.equal(card.applied_tags, undefined)
	assert.equal(
		(init!.headers as Record<string, string>).Authorization,
		undefined,
	)
	const text = JSON.stringify(card)
	assert.match(text, /Search loses focus/)
	assert.doesNotMatch(text, /duplicate|custom_id/)
})

test("a failed conversion without a usable webhook rejects for the email fallback", async (t) => {
	t.mock.method(console, "error", () => {})
	const send = mock.fn(
		async (_url: string | URL | Request, init?: RequestInit) =>
			init?.method === "PATCH"
				? new Response("Forbidden", { status: 403 })
				: json({ id: threadId }),
	)
	await assert.rejects(
		postDiscord(
			report,
			{ ...env, DISCORD_FEEDBACK_WEBHOOK_URL: undefined },
			send as typeof fetch,
		),
	)
	assert.equal(send.mock.callCount(), 2)
})

test("screenshots upload on the message edit with message-level attachment metadata", async () => {
	const send = mock.fn(
		async (_url: string | URL | Request, _init?: RequestInit) =>
			json({ id: threadId }),
	)
	await postDiscord(
		{ ...report, screenshot: Buffer.from("webp").toString("base64") },
		env,
		send as typeof fetch,
	)
	const starter = JSON.parse(send.mock.calls[0].arguments[1]!.body as string)
	assert.equal(starter.attachments, undefined)
	assert.equal(starter.message.attachments, undefined)
	const form = send.mock.calls[1].arguments[1]!.body as unknown as {
		get(key: string): unknown
	}
	assert.ok(form.get("files[0]"))
	const payload = JSON.parse(form.get("payload_json") as string)
	assert.deepEqual(payload.attachments, [
		{ id: 0, filename: "screenshot.webp" },
	])
	assert.equal(payload.content, null)
	assert.match(
		JSON.stringify(payload.components),
		/attachment:\/\/screenshot.webp/,
	)
})

test("bot duplicate failure uses the original thread without creating another post", async (t) => {
	t.mock.method(console, "error", () => {})
	const send = mock.fn(
		async (url: string | URL | Request, _init?: RequestInit) =>
			String(url).includes("/channels/")
				? new Response("Forbidden", { status: 403 })
				: json({ id: messageId, channel_id: threadId }),
	)
	await postDiscord(report, env, send as typeof fetch, { count: 3, threadId })
	assert.equal(send.mock.callCount(), 2)
	const [url, init] = send.mock.calls[1].arguments
	assert.equal(new URL(String(url)).searchParams.get("thread_id"), threadId)
	const payload = JSON.parse(init!.body as string)
	assert.equal(payload.thread_name, undefined)
	assert.equal(payload.applied_tags, undefined)
	assert.match(JSON.stringify(payload.components), /\+1 duplicate/)
})
