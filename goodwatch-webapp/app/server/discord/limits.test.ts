import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (specifier: string, context: unknown) => { url: string },
		): { url: string; shortCircuit?: boolean }
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (specifier === "~/utils/cache")
			return {
				url: "data:text/javascript,export const getRedisCluster=()=>null",
				shortCircuit: true,
			}
		return next(specifier, context)
	},
})
const { createRateLimiter } = await import("../rate-limit.server.ts")
const { discordWindows, takeDiscordLimit } = await import("./limits.server.ts")
test("Discord limits are per user and allow 30 interactions per minute", async () => {
	for (let i = 0; i < 30; i++)
		assert.equal((await takeDiscordLimit("one")).allowed, true)
	assert.equal((await takeDiscordLimit("one")).allowed, false)
	assert.equal((await takeDiscordLimit("two")).allowed, true)
})
test("500 per hour still applies when minute windows expire", async () => {
	let now = 0
	const limiter = createRateLimiter({ redis: () => null, now: () => now })
	for (let i = 0; i < 500; i++) {
		if (i % 30 === 0) now += 60_000
		assert.equal(
			(await limiter.take("discord", "one", discordWindows)).allowed,
			true,
		)
	}
	const verdict = await limiter.take("discord", "one", discordWindows)
	assert.equal(verdict.allowed, false)
	if (!verdict.allowed) assert.ok(verdict.retryAfterSeconds > 60)
})
