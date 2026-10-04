import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import "ioredis"
import "../server/title-filter/test-alias.ts"
import { CacheTestRedis } from "./cache-test-redis.ts"
const {
	cached,
	cacheEntryKey,
	cacheResetMarkerKey,
	declareResettableCache,
	resetCache,
	resetCacheConfirmed,
	pendingResetCount,
	resetPendingResetsForTest,
	setResetRetryMsForTest,
	setResetRunClockForTest,
	setRedisClusterForTest,
	serializeCacheEntry,
	cacheRefreshPauseCount,
	resetRefreshPausesForTest,
} = await import("./cache.ts")
const { renderMetrics, resetMetricsForTest } = await import(
	"../server/metrics/registry.server.ts"
)
const options = {
	name: "reset-test",
	ttlMinutes: 1,
	staleMinutes: 1,
	params: {},
}
const key = cacheEntryKey(options.name, {})
const marker = cacheResetMarkerKey(key)
let redis: CacheTestRedis
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((yes) => {
		resolve = yes
	})
	return { promise, resolve }
}
const lookup = (value = "new") =>
	cached({ ...options, target: async () => ({ value }) })
function event(name: string, count = 1) {
	assert.ok(
		renderMetrics().includes(
			`goodwatch_data_cache_reset_guard_total{cache="reset-test",event="${name}"} ${count}\n`,
		),
		renderMetrics(),
	)
}
beforeEach(() => {
	resetPendingResetsForTest()
	resetMetricsForTest()
	resetRefreshPausesForTest()
	declareResettableCache(options)
	redis = new CacheTestRedis()
	setRedisClusterForTest(redis)
})
afterEach(() => {
	resetPendingResetsForTest()
	setResetRetryMsForTest(null)
	setResetRunClockForTest(null)
	setRedisClusterForTest(null)
})
test("resets require declarations, reject braces, and disabled resets send nothing", async () => {
	for (const reset of [resetCache, resetCacheConfirmed])
		await assert.rejects(
			reset({ name: "undeclared", params: {} }),
			/undeclared.*declareResettableCache/,
		)
	assert.throws(
		() => declareResettableCache({ name: "bad{name}", ttlMinutes: 1 }),
		/braces/,
	)
	declareResettableCache({ ...options, ttlMinutes: 0 })
	assert.equal(await resetCache(options), 0)
	assert.equal(await resetCacheConfirmed(options), true)
	assert.deepEqual(redis.calls, [])
	declareResettableCache(options)
	await assert.rejects(
		cached({ ...options, ttlMinutes: 5, target: async () => ({}) }),
		/declared physical TTL/,
	)
})
test("unguarded commands remain GET and SETEX; guarded commands are MGET and scripts", async () => {
	const plain = {
		...options,
		name: "plain",
		target: async () => ({ value: 1 }),
	}
	await cached(plain)
	await cached(plain)
	assert.deepEqual(
		redis.calls.map((c) => c.command),
		["get", "setex", "get"],
	)
	redis.calls.length = 0
	await lookup()
	await lookup()
	await resetCache(options)
	assert.deepEqual(
		redis.calls.map((c) => c.command),
		["mget", "gwCacheStore", "mget", "gwCacheReset"],
	)
})
test("a marker changed by another process rejects a cold store but returns its data", async () => {
	const gate = deferred<{ value: string }>()
	const run = cached({ ...options, target: () => gate.promise })
	await tick()
	redis.values.set(marker, "other-process")
	gate.resolve({ value: "old" })
	assert.deepEqual(await run, { value: "old" })
	assert.equal(redis.values.has(key), false)
	event("store_rejected")
})
test("a rejected background store is discarded without pausing", async () => {
	redis.values.set(
		key,
		serializeCacheEntry({ value: "stale" }, Date.now() - 90_000),
	)
	const gate = deferred<{ value: string }>()
	assert.deepEqual(await cached({ ...options, target: () => gate.promise }), {
		value: "stale",
	})
	redis.values.set(marker, "reset")
	redis.values.delete(key)
	gate.resolve({ value: "old" })
	await tick()
	event("store_rejected")
	assert.match(
		renderMetrics(),
		/refreshes_total\{cache="reset-test",result="discarded"\} 1/,
	)
	assert.equal(cacheRefreshPauseCount(), 0)
	assert.equal(redis.values.has(key), false)
})
test("a different marker refuses joining and the replaced run cannot store", async () => {
	const gate = deferred<{ value: string }>()
	const old = cached({ ...options, target: () => gate.promise })
	await tick()
	redis.values.set(marker, "reset")
	assert.deepEqual(await lookup(), { value: "new" })
	gate.resolve({ value: "old" })
	await old
	event("join_refused")
	assert.equal(JSON.parse(redis.values.get(key) ?? "").data.value, "new")
	assert.equal(redis.writes.length, 1)
})
test("unknown markers and over-age runs skip storing", async () => {
	redis.mget = async () => {
		throw new Error("lookup failed")
	}
	await lookup()
	event("store_skipped")
	redis.mget = CacheTestRedis.prototype.mget
	let now = 0
	setResetRunClockForTest(() => now)
	await cached({
		...options,
		target: async () => {
			now = 270_000
			return {}
		},
	})
	event("store_skipped", 2)
	assert.equal(redis.writes.length, 0)
})
test("missing script methods are Redis failures, never unguarded fallbacks", async () => {
	setRedisClusterForTest({
		get: redis.get.bind(redis),
		setex: redis.setex.bind(redis),
		del: redis.del.bind(redis),
	})
	await lookup()
	assert.match(
		renderMetrics(),
		/requests_total\{cache="reset-test",result="error"\} 1/,
	)
	event("store_skipped")
	assert.equal(await resetCacheConfirmed(options), false)
	assert.deepEqual(redis.calls, [])
})
test("pending resets bypass Redis and the timer confirms a retry", async () => {
	setResetRetryMsForTest(10)
	redis.failDelete = true
	assert.equal(await resetCacheConfirmed(options), false)
	assert.equal(pendingResetCount(), 1)
	const commands = redis.calls.length
	assert.deepEqual(await lookup(), { value: "new" })
	assert.equal(redis.calls.length, commands)
	event("store_skipped")
	event("reset_unconfirmed")
	assert.match(
		renderMetrics(),
		/requests_total\{cache="reset-test",result="reset_pending"\} 1/,
	)
	redis.failDelete = false
	for (let i = 0; i < 50 && pendingResetCount(); i++)
		await new Promise((resolve) => setTimeout(resolve, 10))
	assert.equal(pendingResetCount(), 0)
	event("retry_confirmed")
})
test("lookups trigger due retries independently of the timer", async (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
	redis.failDelete = true
	await resetCacheConfirmed(options)
	redis.failDelete = false
	t.mock.timers.tick(5000)
	await lookup()
	await tick()
	assert.equal(pendingResetCount(), 0)
	event("retry_confirmed")
	assert.deepEqual(
		redis.calls.map((c) => c.command),
		["gwCacheReset", "gwCacheReset"],
	)
})
test("pending resets expire at marker TTL and remain bounded at 1000", async (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
	setRedisClusterForTest(null)
	for (let id = 0; id < 1001; id++)
		await resetCache({ ...options, params: { id } })
	assert.equal(pendingResetCount(), 1000)
	setRedisClusterForTest(redis)
	await cached({ ...options, params: { id: 0 }, target: async () => ({}) })
	assert.equal(redis.calls[0].command, "mget")
	t.mock.timers.tick(420_000)
	await cached({ ...options, params: { id: 1 }, target: async () => ({}) })
	assert.equal(pendingResetCount(), 999)
	assert.equal(redis.calls[2].command, "mget")
})

test("the timer retries at most twenty oldest entries per tick and drops expired entries", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setInterval"], now: Date.now() })
	setResetRetryMsForTest(100)
	redis.failDelete = true
	for (let id = 0; id < 25; id++)
		await resetCache({ ...options, params: { id } })
	redis.calls.length = 0
	redis.failDelete = false
	t.mock.timers.tick(100)
	await tick()
	assert.equal(redis.calls.length, 20)
	assert.equal(pendingResetCount(), 5)
	assert.deepEqual(
		redis.calls.map((call) => call.args[0]),
		Array.from({ length: 20 }, (_, id) => cacheEntryKey(options.name, { id })),
	)
	redis.failDelete = true
	t.mock.timers.tick(420_000)
	await tick()
	assert.equal(pendingResetCount(), 0)
	assert.equal(redis.calls.length, 20)
})

test("an older reset acknowledgement cannot clear a newer pending reset", async () => {
	const first = deferred<number>()
	let calls = 0
	redis.gwCacheReset = async () => {
		if (++calls === 1) return first.promise
		throw new Error("newer reset failed")
	}
	const older = resetCacheConfirmed(options)
	assert.equal(await resetCacheConfirmed(options), false)
	first.resolve(0)
	assert.equal(await older, true)
	assert.equal(pendingResetCount(), 1)
	const commands = redis.calls.length
	await lookup()
	assert.equal(redis.calls.length, commands)
})

test("every module that resets a cache also declares it", async () => {
	const { readFileSync, readdirSync } = await import("node:fs")
	const app = new URL("../", import.meta.url)
	const files = readdirSync(app, { recursive: true, encoding: "utf8" }).filter(
		(file) =>
			/\.tsx?$/.test(file) &&
			!/\.test\.ts$|cache-cross-process\.worker\.ts$|utils\/cache\.ts$/.test(
				file,
			),
	)
	const callers = files.filter((file) =>
		/\bresetCache(Confirmed)?\(/.test(readFileSync(new URL(file, app), "utf8")),
	)
	assert.ok(callers.length >= 4, callers.join(", "))
	for (const file of callers)
		assert.match(
			readFileSync(new URL(file, app), "utf8"),
			/\bdeclareResettableCache\(/,
			file,
		)
})
