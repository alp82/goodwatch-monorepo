import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
const { saveDiscoverState, loadDiscoverState, DISCOVER_TTL } = await import(
	"./discover-state.server.ts"
)
import { listCustomId } from "./custom-id.ts"
const stored = new Map<string, string>()
const calls: unknown[][] = []
Object.assign(globalThis, {
	__discordStateRedis: {
		set: async (...args: [string, string, string, number]) => {
			calls.push(args)
			stored.set(args[0], args[1])
		},
		get: async (key: string) => stored.get(key) ?? null,
	},
})
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: { parentURL?: string },
			next: (specifier: string, context: { parentURL?: string }) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (
			context.parentURL?.endsWith("/discord/discover-state.server.ts") &&
			specifier === "../../utils/cache"
		)
			return {
				url: "data:text/javascript,export const getRedisCluster=()=>globalThis.__discordStateRedis; export const withRedisDeadline=p=>{globalThis.__discordStateDeadlines=(globalThis.__discordStateDeadlines??0)+1;return p}",
				shortCircuit: true,
			}
		return next(specifier, context)
	},
})
test("long filter state uses a short Valkey key for one hour, with bounded paging IDs", async () => {
	const state = {
		country: "DE",
		args: {
			type: "show" as const,
			genres: ["Action & Adventure"],
			providers: [119],
			moods: ["funny" as const],
			order: "popularity" as const,
		},
	}
	const key = await saveDiscoverState(state)
	assert.match(key, /^k[a-f0-9]{18}$/)
	assert.equal(calls.length, 1)
	assert.deepEqual(calls[0].slice(2), ["EX", 3600])
	assert.equal(DISCOVER_TTL, 3600)
	assert.match(String(calls[0][0]), /^discord:discover:v1:/)
	assert.deepEqual(await loadDiscoverState(key), state)
	assert.equal(
		(globalThis as unknown as { __discordStateDeadlines: number })
			.__discordStateDeadlines,
		2,
	)
	assert.ok(listCustomId("discover-share", `${key}:999999`).length <= 100)
	stored.clear()
	assert.equal(await loadDiscoverState(key), null)
})
test("malformed state is treated as expired", async () => {
	for (const raw of [
		"{",
		"null",
		'{"country":"bad","args":{}}',
		'{"country":"DE"}',
	]) {
		const id = `i${Buffer.from(raw).toString("base64url")}`
		assert.equal(await loadDiscoverState(id), null)
	}
})

test("forged inline filters fail strict MCP validation", async () => {
	for (const args of [
		{ type: "bad" },
		{ moods: ["fake"] },
		{ order: "fake" },
		{ x: 1 },
		{ providers: [-1] },
	]) {
		const key =
			"i" +
			Buffer.from(JSON.stringify({ country: "DE", args })).toString("base64url")
		assert.ok(key.length <= 66)
		assert.equal(await loadDiscoverState(key), null)
	}
})
