import { unlimitedRestBudget } from "../rest-test-budget.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { discordRest } from "../rest.server.ts"
test("every REST attempt, including retries, reserves the shared budget before sending", async () => {
	const events: string[] = []
	let reservations = 0
	let sends = 0
	const rest = discordRest({
		budget: {
			take: async () => {
				events.push("reserve")
				return reservations++ === 0 ? 1000 : 0
			},
			pause: async () => {},
		},
		sleep: async (ms) => {
			events.push(`sleep:${ms}`)
		},
		fetch: async () => {
			events.push("send")
			return ++sends === 1
				? Response.json({ retry_after: 0.1 }, { status: 429 })
				: new Response(null, { status: 204 })
		},
	})
	await rest.followup("app", "token", {})
	assert.deepEqual(events, [
		"reserve",
		"sleep:1000",
		"reserve",
		"send",
		"sleep:100",
		"reserve",
		"send",
	])
})

test("global 429s publish a shared cooldown even on the last failed retry", async () => {
	const cooldowns: number[] = []
	let attempts = 0
	const rest = discordRest({
		budget: {
			take: async () => {
				attempts++
				return 0
			},
			pause: async (ms) => {
				cooldowns.push(ms)
			},
		},
		sleep: async () => {},
		fetch: async () =>
			Response.json({ retry_after: 0.25, global: true }, { status: 429 }),
	})
	await assert.rejects(
		rest.followup("app", "token", {}),
		/Discord REST status 429/,
	)
	assert.equal(attempts, 3)
	assert.deepEqual(cooldowns, [250, 250, 250])
})

test("aborting a request interrupts its budget wait without sending", async () => {
	const abort = new AbortController()
	let sends = 0
	const rest = discordRest({
		budget: { take: async () => 60_000, pause: async () => {} },
		fetch: async () => {
			sends++
			return new Response(null, { status: 204 })
		},
	})
	const pending = rest.editOriginal("app", "token", {}, abort.signal)
	await new Promise<void>((resolve) => setImmediate(resolve))
	abort.abort()
	await assert.rejects(pending, { name: "AbortError" })
	assert.equal(sends, 0)
})

for (const retryAfter of [-1, "0.5", null])
	test(`invalid global retry delay ${retryAfter} cannot poison the shared cooldown`, async () => {
		let pauses = 0
		const rest = discordRest({
			budget: {
				take: async () => 0,
				pause: async () => {
					pauses++
				},
			},
			fetch: async () =>
				Response.json(
					{ retry_after: retryAfter, global: true },
					{ status: 429 },
				),
		})
		await assert.rejects(
			rest.followup("app", "token", {}),
			/Invalid Discord retry delay/,
		)
		assert.equal(pauses, 0)
	})

test("original response supplies IDs and public edits use bot auth while honoring retry_after", async () => {
	const calls: { path: string; init?: RequestInit }[] = [],
		sleeps: number[] = []
	let retries = 0
	const rest = discordRest({
		budget: unlimitedRestBudget,
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
		budget: unlimitedRestBudget,
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
		discordRest({
			budget: unlimitedRestBudget,
			fetch: async () => failure,
		}).editOriginalMessage("app", "token", {}),
		/500/,
	)
	assert.equal(failure.bodyUsed, true)
})
