import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import "./test-alias.ts"

// Replace every infrastructure dependency before importing the loader. No sockets or environment files.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: { resolve: Function; load: Function }): void
}
const cache = new Map<string, string>()
const reads: { sql: string; params: unknown[] }[] = []
const bridge = {
	cache: {
		get: async (key: string) => cache.get(key) ?? null,
		set: async (key: string, value: string) => {
			cache.set(key, value)
		},
	},
	query: async (sql: string, params: unknown[]) => {
		reads.push({ sql, params })
		return [{ tmdb_id: 1 }]
	},
}
// A unique global bridge is visible to the infrastructure stubs loaded by Node.
Object.assign(globalThis, { titleFilterTestBridge: bridge })
const stubs: Record<string, string> = {
	ioredis: "export default class Redis {}",
	"~/utils/cache":
		"export const getRedisCluster = () => globalThis.titleFilterTestBridge.cache",
	"~/utils/crate":
		"export const query = (...args) => globalThis.titleFilterTestBridge.query(...args)",
	"~/utils/qdrant":
		"export const MEDIA_COLLECTION = ''; export const recommend = () => { throw Error('unexpected recommend') }",
	"~/server/discover.server":
		"export const fingerprintFilterConditions = () => { throw Error('unexpected legacy filter') }",
	"./order.server": "export const MIN_VOTES = 1000",
}
registerHooks({
	resolve(specifier: string, context: unknown, next: Function) {
		return specifier in stubs
			? { url: `fixture:${specifier}`, shortCircuit: true }
			: next(specifier, context)
	},
	load(url: string, context: unknown, next: Function) {
		return url.startsWith("fixture:")
			? { format: "module", source: stubs[url.slice(8)], shortCircuit: true }
			: next(url, context)
	},
})
const { rangeScoreTitles } = await import("./id-sets.server.ts")
const { defaultFilterState } = await import("~/domain/filter-state")

test("runtime cache includes both predicates, supports episode-only filters and unrestricted kinds", async () => {
	const base = defaultFilterState({ onMyServices: false, notSeenYet: false })
	assert.equal(rangeScoreTitles(base, "runtime"), null)
	const before = cache.size
	await rangeScoreTitles({ ...base, runtime: { max: 120 } }, "runtime")
	await rangeScoreTitles(
		{ ...base, runtime: { max: 120 }, episodeRuntime: { max: 35 } },
		"runtime",
	)
	await rangeScoreTitles(
		{ ...base, runtime: { max: 120 }, episodeRuntime: null },
		"runtime",
	)
	await rangeScoreTitles({ ...base, episodeRuntime: { max: 35 } }, "runtime")
	assert.equal(cache.size - before, 4)
	assert.ok(
		reads.some(
			({ sql, params }) =>
				sql.includes("FROM show") &&
				sql.includes("episode_runtime[1] <= ?") &&
				params[0] === 35,
		),
	)
	assert.ok(
		reads.some(
			({ sql }) =>
				sql.includes("FROM movie") &&
				!sql.includes("runtime") &&
				!sql.includes("AND  LIMIT"),
		),
	)
	assert.ok(
		reads.some(
			({ sql }) =>
				sql.includes("FROM show") &&
				!sql.includes("episode_runtime") &&
				!sql.includes("AND  LIMIT"),
		),
	)
	const count = reads.length
	await rangeScoreTitles({ ...base, episodeRuntime: { max: 35 } }, "runtime")
	assert.equal(reads.length, count)
})
