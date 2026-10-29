import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import "ioredis"
import "../title-filter/test-alias.ts"
import { CacheTestRedis } from "../../utils/cache-test-redis.ts"
import { EMPTY, readTitleSocial } from "./title-read.ts"
const { cached, cacheEntryKey, cacheResetMarkerKey, declareResettableCache, serializeCacheEntry, setRedisClusterForTest } = await import("../../utils/cache.ts")
const options = { name: "title-budget-test", params: { mediaType: "movie", tmdbId: 603, lanes: "" }, ttlMinutes: 5, staleMinutes: 5 }
const key = cacheEntryKey(options.name, options.params)
const item = { id: "post", source: "news" as const, url: "https://example.com/news", sourceId: null, author: "Writer", publishedAt: "2026-10-29", text: "News", image: null }
const value = { items: [item] }
let redis: CacheTestRedis
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
beforeEach(() => { redis = new CacheTestRedis(); setRedisClusterForTest(redis); declareResettableCache(options) })
afterEach(() => setRedisClusterForTest(null))
function read(target: () => Promise<typeof value>) {
	return readTitleSocial("movie:603", { items: () => cached({ ...options, target }), buzz: async () => ({}) })
}

test("a timed-out cold request continues filling the guarded per-title cache", async () => {
	let resolve!: (data: typeof value) => void
	const fill = new Promise<typeof value>((yes) => { resolve = yes })
	assert.deepEqual(await read(() => fill), EMPTY)
	resolve(value)
	await tick()
	assert.deepEqual(await read(async () => { throw Error("must hit cache") }), { ...value, buzz: null })
})

test("stale posts return during refresh, and a remote report prevents their resurrection", async () => {
	const entry = JSON.parse(serializeCacheEntry(value))
	entry.timestamp = Date.now() - 301_000
	redis.values.set(key, JSON.stringify(entry))
	let resolve!: (data: typeof value) => void
	const fill = new Promise<typeof value>((yes) => { resolve = yes })
	assert.deepEqual(await read(() => fill), { ...value, buzz: null })
	await tick()
	// The atomic effects of a report in another process: delete the value, replace its marker.
	redis.values.delete(key)
	redis.values.set(cacheResetMarkerKey(key), "remote-report")
	assert.deepEqual(await read(async () => ({ items: [] })), EMPTY)
	resolve(value)
	await tick()
	assert.deepEqual(await read(async () => { throw Error("must hit new cache") }), EMPTY)
})
