import assert from "node:assert/strict"
import { test } from "node:test"
import { discordRest } from "../rest.server.ts"
test("original response supplies IDs and public edits use bot auth while honoring retry_after", async () => {
	const calls: { path: string; init?: RequestInit }[] = [],
		sleeps: number[] = []
	let retries = 0
	const rest = discordRest({
		botToken: "bot",
		sleep: async (ms) => {
			sleeps.push(ms)
		},
		fetch: async (url, init) => {
			calls.push({ path: String(url), init })
			if (String(url).includes("/channels/") && retries++ === 0)
				return Response.json({ retry_after: 0.2 }, { status: 429 })
			return Response.json({ id: "message", channel_id: "channel" })
		},
	})
	assert.deepEqual(await rest.editOriginalMessage("app", "token", {}), {
		id: "message",
		channel_id: "channel",
	})
	assert.equal(
		(calls[0].init!.headers as Record<string, string>).Authorization,
		undefined,
	)
	await rest.editMessage("channel", "message", { flags: 32768 })
	assert.deepEqual(sleeps, [200])
	assert.ok(calls[1].path.endsWith("/channels/channel/messages/message"))
	assert.equal(
		(calls[1].init!.headers as Record<string, string>).Authorization,
		"Bot bot",
	)
	assert.equal(calls[1].init!.method, "PATCH")
})

test("message responses are consumed inside the timeout scope, including bot edits and failures", async () => {
	const responses: Response[] = []
	const rest = discordRest({
		botToken: "bot",
		fetch: async (_url, init) => {
			assert.ok(init?.signal instanceof AbortSignal)
			assert.equal(init.signal.aborted, false)
			const response = Response.json({ id: "message", channel_id: "channel" })
			responses.push(response)
			return response
		},
	})
	assert.deepEqual(await rest.getOriginalMessage("app", "token"), {
		id: "message",
		channel_id: "channel",
	})
	await rest.editOriginalMessage("app", "token", {})
	await rest.editMessage("channel", "message", {})
	assert.ok(responses.every((r) => r.bodyUsed))
	const failure = new Response("failed", { status: 500 })
	await assert.rejects(
		discordRest({ fetch: async () => failure }).editOriginalMessage(
			"app",
			"token",
			{},
		),
		/500/,
	)
	assert.equal(failure.bodyUsed, true)
})
