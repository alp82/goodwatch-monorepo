// Drives every cache outcome with a fake Redis client while preserving target behavior.
import assert from "node:assert/strict"
import { type Socket, createServer } from "node:net"
import { afterEach, beforeEach, test } from "node:test"
// Loaded before the alias hook, which rewrites relative imports.
import Redis from "ioredis"
import "../title-filter/test-alias.ts"
const {
	cached,
	cacheEntryKey,
	cacheInFlightCount,
	cachePhysicalTtlSeconds,
	cacheRefreshPauseCount,
	resetRefreshPausesForTest,
	resetCache,
	resetCacheConfirmed,
	serializeCacheEntry,
	setRedisClusterForTest,
	setRedisCommandTimeoutForTest,
	resetRedisFailureLogsForTest,
	REDIS_COMMAND_TIMEOUT_MS,
	redisOptions,
} = await import("../../utils/cache.ts")
const { renderMetrics, resetMetricsForTest } = await import(
	"./registry.server.ts"
)
// An empty REDIS_HOST skips connection startup, so fakes can be installed immediately.
const unhandled: unknown[] = []
const unhandledListener = (error: unknown) => unhandled.push(error)
beforeEach(() => {
	resetRefreshPausesForTest()
	unhandled.length = 0
	process.on("unhandledRejection", unhandledListener)
	resetMetricsForTest()
	resetRedisFailureLogsForTest()
})
afterEach(async () => {
	await tick()
	process.off("unhandledRejection", unhandledListener)
	assert.deepEqual(unhandled, [])
})
afterEach(() => setRedisCommandTimeoutForTest(null))
afterEach(() => assert.equal(cacheInFlightCount(), 0))

test("all cache results count once and only target execution records duration", async () => {
	for (const result of [
		"hit",
		"expired",
		"miss",
		"unavailable",
		"error",
		"bypass",
	]) {
		resetMetricsForTest()
		let reads = 0
		let calls = 0
		let writes = 0
		const data = { answer: 42 }
		setRedisClusterForTest(
			result === "unavailable"
				? null
				: {
						async get() {
							reads++
							if (result === "error") throw new Error("Read failed")
							return result === "hit" || result === "expired"
								? serializeCacheEntry(
										data,
										result === "expired" ? 0 : Date.now(),
									)
								: null
						},
						async setex() {
							writes++
						},
						async del() {
							return 0
						},
					},
		)
		const response = await cached({
			name: "related-movie-603",
			metricName: "related-movie",
			params: {},
			ttlMinutes: result === "bypass" ? 0 : 1,
			target: async () => {
				calls++
				return data
			},
		})
		assert.deepEqual(response, data)
		assert.equal(calls, result === "hit" ? 0 : 1)
		assert.equal(reads, result === "bypass" || result === "unavailable" ? 0 : 1)
		assert.equal(
			writes,
			result === "hit" || result === "bypass" || result === "unavailable"
				? 0
				: 1,
		)
		const output = renderMetrics()
		assert.ok(
			output.includes(
				`goodwatch_data_cache_requests_total{cache="related-movie",result="${result === "expired" ? "miss" : result}"} 1`,
			),
			result,
		)
		assert.equal(
			output.includes(
				'goodwatch_data_cache_miss_duration_seconds_count{cache="related-movie"} 1',
			),
			result !== "hit",
		)
		assert.ok(!output.includes('cache="related-movie-603"'))
	}
})
test("target failures still record duration and preserve the thrown error", async () => {
	setRedisClusterForTest(null)
	const error = new Error("Target failed")
	await assert.rejects(
		cached({
			name: "failing",
			params: {},
			ttlMinutes: 1,
			target: async () => {
				throw error
			},
		}),
		(caught) => caught === error,
	)
	assert.ok(
		renderMetrics().includes(
			'goodwatch_data_cache_miss_duration_seconds_count{cache="failing"} 1',
		),
	)
})
test("metricName bounds many distinct keys and both cache metrics cap at 100", async () => {
	setRedisClusterForTest(null)
	for (let i = 0; i < 110; i++)
		await cached({
			name: `dynamic-${i}`,
			metricName: "bounded",
			params: {},
			ttlMinutes: 0,
			target: async () => ({}),
		})
	assert.ok(
		renderMetrics().includes(
			'goodwatch_data_cache_requests_total{cache="bounded",result="bypass"} 110',
		),
	)
	assert.ok(!renderMetrics().includes("dynamic-"))
	resetMetricsForTest()
	for (let i = 0; i < 101; i++)
		await cached({
			name: `cap-${i}`,
			params: {},
			ttlMinutes: 0,
			target: async () => ({}),
		})
	for (const metric of [
		"goodwatch_data_cache_requests_total",
		"goodwatch_data_cache_miss_duration_seconds",
	])
		assert.ok(
			renderMetrics().includes(
				`goodwatch_metrics_dropped_label_sets_total{metric="${metric}"} 1`,
			),
		)
})

function fakeRedis() {
	const store = new Map<string, string>()
	const writes: { key: string; ttl: number }[] = []
	let reads = 0
	let deletes = 0
	const client = {
		async get(key: string) {
			reads++
			return store.get(key) ?? null
		},
		async setex(key: string, ttl: number, value: string) {
			writes.push({ key, ttl })
			store.set(key, value)
		},
		async del(key: string) {
			deletes++
			return Number(store.delete(key))
		},
	}
	setRedisClusterForTest(client)
	return {
		store,
		writes,
		client,
		get reads() {
			return reads
		},
		get deletes() {
			return deletes
		},
	}
}

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (error: Error) => void
	const promise = new Promise<T>((yes, no) => {
		resolve = yes
		reject = no
	})
	return { promise, resolve, reject }
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
function count(cache: string, result: string, value: number, refresh = false) {
	assert.ok(
		renderMetrics().includes(
			`goodwatch_data_cache_${refresh ? "refreshes" : "requests"}_total{cache="${cache}",result="${result}"} ${value}\n`,
		),
		renderMetrics(),
	)
}
const options = { name: "catalog", params: {}, ttlMinutes: 1, staleMinutes: 2 }
function seedStale(redis: ReturnType<typeof fakeRedis>, name = options.name) {
	const key = cacheEntryKey(name, {})
	const value = serializeCacheEntry({ answer: "old" }, Date.now() - 90_000)
	redis.store.set(key, value)
	return { key, value }
}

test("100 cold callers run one target and joiners receive private copies", async () => {
	const redis = fakeRedis()
	const pending = deferred<{ nested: { answer: number } }>()
	let runs = 0
	const target = () => {
		runs++
		return pending.promise
	}
	const calls = Array.from({ length: 100 }, () =>
		cached({ ...options, target }),
	)
	await tick()
	assert.equal(runs, 1)
	assert.equal(cacheInFlightCount(), 1)
	assert.ok(renderMetrics().includes("goodwatch_data_cache_in_flight 1\n"))
	const data = { nested: { answer: 42 } }
	pending.resolve(data)
	const results = await Promise.all(calls)
	assert.equal(results[0], data)
	for (const result of results) assert.deepEqual(result, data)
	assert.equal(new Set(results).size, 100)
	assert.equal(new Set(results.map((result) => result.nested)).size, 100)
	count("catalog", "miss", 1)
	count("catalog", "joined", 99)
	assert.equal(redis.writes.length, 1)
})

test("stale lookups return immediately and one refresh stores a fresh value with extended TTL", async () => {
	const redis = fakeRedis()
	seedStale(redis)
	const pending = deferred<{ answer: string }>()
	let runs = 0
	const target = () => {
		runs++
		return pending.promise
	}
	const results = []
	for (let i = 0; i < 3; i++) results.push(await cached({ ...options, target }))
	assert.deepEqual(results[0], { answer: "old" })
	assert.equal(new Set(results).size, 3)
	assert.equal(runs, 1)
	assert.equal(redis.writes.length, 0)
	pending.resolve({ answer: "new" })
	await tick()
	assert.deepEqual(await cached({ ...options, target }), { answer: "new" })
	assert.equal(runs, 1)
	assert.equal(redis.writes[0].ttl, 180)
	count("catalog", "stale", 3)
	count("catalog", "hit", 1)
	count("catalog", "ok", 1, true)
})

test("a failed refresh preserves stale data and never causes an unhandled rejection", async (t) => {
	const redis = fakeRedis()
	const { key, value } = seedStale(redis)
	const pending = deferred<{ answer: string }>()
	const unhandled: unknown[] = []
	const listener = (error: unknown) => unhandled.push(error)
	process.on("unhandledRejection", listener)
	t.after(() => process.off("unhandledRejection", listener))
	const warn = t.mock.method(console, "warn", () => {})
	await cached({ ...options, target: () => pending.promise })
	pending.reject(new Error("Refresh failed"))
	await tick()
	assert.equal(cacheInFlightCount(), 0)
	assert.equal(redis.store.get(key), value)
	assert.equal(redis.writes.length, 0)
	count("catalog", "error", 1, true)
	assert.equal(warn.mock.callCount(), 1)
	assert.match(warn.mock.calls[0].arguments[0], /catalog.*Refresh failed/)
	const retry = deferred<{ answer: string }>()
	assert.deepEqual(await cached({ ...options, target: () => retry.promise }), {
		answer: "old",
	})
	assert.equal(redis.store.get(key), value)
	retry.resolve({ answer: "recovered" })
	await tick()
	assert.deepEqual(unhandled, [])
})

test("a cold target error reaches all ten callers and writes nothing", async () => {
	const redis = fakeRedis()
	const pending = deferred<{ answer: string }>()
	const error = new Error("Cold failure")
	let runs = 0
	const calls = Array.from({ length: 10 }, () =>
		cached({
			...options,
			target: () => {
				runs++
				return pending.promise
			},
		}),
	)
	const settled = Promise.allSettled(calls)
	await tick()
	pending.reject(error)
	for (const result of await settled) {
		assert.equal(result.status, "rejected")
		if (result.status === "rejected") assert.equal(result.reason, error)
	}
	assert.equal(runs, 1)
	assert.equal(redis.writes.length, 0)
	count("catalog", "miss", 1)
	count("catalog", "joined", 9)
	assert.equal(cacheRefreshPauseCount(), 0)
})

test("reset discards a pending background refresh without resurrecting its value", async () => {
	const redis = fakeRedis()
	const { key } = seedStale(redis)
	const pending = deferred<{ answer: string }>()
	await cached({ ...options, target: () => pending.promise })
	const deletion = resetCache(options)
	assert.equal(cacheInFlightCount(), 0)
	assert.equal(redis.deletes, 1)
	assert.equal(redis.store.has(key), false)
	await deletion
	pending.resolve({ answer: "old refresh" })
	await tick()
	assert.equal(redis.store.has(key), false)
	assert.equal(redis.writes.length, 0)
	count("catalog", "discarded", 1, true)
	assert.equal(cacheRefreshPauseCount(), 0)
})

test("reset detaches a cold run and a subsequent caller starts a new run", async () => {
	const redis = fakeRedis()
	const first = deferred<{ answer: string }>()
	const second = deferred<{ answer: string }>()
	let runs = 0
	const target = () => (++runs === 1 ? first.promise : second.promise)
	const oldCall = cached({ ...options, target })
	await tick()
	await resetCache(options)
	assert.equal(cacheInFlightCount(), 0)
	const newCall = cached({ ...options, target })
	await tick()
	assert.equal(runs, 2)
	first.resolve({ answer: "old" })
	await oldCall
	assert.equal(redis.writes.length, 0)
	assert.equal(cacheInFlightCount(), 1)
	second.resolve({ answer: "new" })
	assert.deepEqual(await newCall, { answer: "new" })
	assert.equal(redis.writes.length, 1)
})

test("member caches never serve stale, use the logical TTL, and reload after reset", async () => {
	const redis = fakeRedis()
	const { key } = seedStale(redis)
	const pending = deferred<{ answer: string }>()
	let returned = false
	const call = cached({
		...options,
		staleMinutes: 0,
		target: () => pending.promise,
	}).then((data) => {
		returned = true
		return data
	})
	await tick()
	assert.equal(returned, false)
	pending.resolve({ answer: "current" })
	assert.deepEqual(await call, { answer: "current" })
	assert.equal(redis.writes[0].ttl, 60)
	count("catalog", "miss", 1)
	await resetCache(options)
	assert.equal(redis.store.has(key), false)
	assert.deepEqual(
		await cached({
			...options,
			staleMinutes: 0,
			target: async () => ({ answer: "after write" }),
		}),
		{ answer: "after write" },
	)
	count("catalog", "miss", 2)
})

test("different user params never share a target run or value", async () => {
	const redis = fakeRedis()
	const pending = deferred<void>()
	let runs = 0
	const target = async ({ userId }: { userId: number }) => {
		runs++
		await pending.promise
		return { userId }
	}
	const calls = [1, 2].map((userId) =>
		cached({ ...options, params: { userId }, target }),
	)
	await tick()
	assert.equal(runs, 2)
	pending.resolve()
	assert.deepEqual(await Promise.all(calls), [{ userId: 1 }, { userId: 2 }])
	assert.equal(redis.store.size, 2)
})

test("without Redis the target runs once and concurrent callers join", async () => {
	setRedisClusterForTest(null)
	const pending = deferred<{ answer: string }>()
	let runs = 0
	const target = () => {
		runs++
		return pending.promise
	}
	const calls = [cached({ ...options, target }), cached({ ...options, target })]
	await tick()
	assert.equal(runs, 1)
	pending.resolve({ answer: "uncached" })
	assert.deepEqual(await Promise.all(calls), [
		{ answer: "uncached" },
		{ answer: "uncached" },
	])
	count("catalog", "unavailable", 1)
	count("catalog", "joined", 1)
})

test("the default stale window is the smaller of the TTL and 60 minutes", async () => {
	const redis = fakeRedis()
	for (const ttlMinutes of [30, 1440])
		await cached({
			name: `ttl-${ttlMinutes}`,
			params: {},
			ttlMinutes,
			target: async () => ({}),
		})
	assert.deepEqual(
		redis.writes.map(({ ttl }) => ttl),
		[3600, 90000],
	)
})

test("only eight background refreshes run while a ninth key is served stale", async () => {
	const redis = fakeRedis()
	const pending = deferred<{ answer: string }>()
	let runs = 0
	for (let i = 0; i < 9; i++) {
		const name = `stale-${i}`
		seedStale(redis, name)
		assert.deepEqual(
			await cached({
				...options,
				name,
				target: () => {
					runs++
					return pending.promise
				},
			}),
			{ answer: "old" },
		)
	}
	assert.equal(runs, 8)
	assert.equal(cacheInFlightCount(), 8)
	pending.resolve({ answer: "new" })
	await tick()
	assert.equal(redis.writes.length, 8)
})

test("a run at least 30 seconds old is replaced and cannot overwrite the new run", async (t) => {
	const redis = fakeRedis()
	let now = Date.now()
	t.mock.method(Date, "now", () => now)
	const old = deferred<{ answer: string }>()
	const fresh = deferred<{ answer: string }>()
	const oldCall = cached({ ...options, target: () => old.promise })
	await tick()
	now += 30_000
	const newCall = cached({ ...options, target: () => fresh.promise })
	await tick()
	old.resolve({ answer: "old" })
	await oldCall
	assert.equal(redis.writes.length, 0)
	assert.equal(cacheInFlightCount(), 1)
	fresh.resolve({ answer: "new" })
	await newCall
	assert.equal(redis.writes.length, 1)
	count("catalog", "miss", 2)
})

test("the map caps at 1000 runs and overflow executes without caching", async () => {
	const redis = fakeRedis()
	const pending = deferred<{ answer: string }>()
	const calls = Array.from({ length: 1000 }, (_, id) =>
		cached({ ...options, params: { id }, target: () => pending.promise }),
	)
	await tick()
	assert.equal(cacheInFlightCount(), 1000)
	assert.deepEqual(
		await cached({
			...options,
			params: { id: 1000 },
			target: async () => ({ answer: "overflow" }),
		}),
		{ answer: "overflow" },
	)
	assert.equal(cacheInFlightCount(), 1000)
	assert.equal(redis.writes.length, 0)
	count("catalog", "miss", 1001)
	pending.resolve({ answer: "done" })
	await Promise.all(calls)
	assert.equal(redis.writes.length, 1000)
})

test("negative and non-finite stale windows disable stale serving", async () => {
	const redis = fakeRedis()
	for (const staleMinutes of [
		-1,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
	]) {
		seedStale(redis)
		assert.deepEqual(
			await cached({
				...options,
				staleMinutes,
				target: async () => ({ answer: "current" }),
			}),
			{ answer: "current" },
		)
	}
	assert.deepEqual(
		redis.writes.map(({ ttl }) => ttl),
		[60, 60, 60, 60],
	)
	count("catalog", "miss", 4)
})

test("fractional physical lifetimes are rounded with a minimum of one second", async () => {
	const redis = fakeRedis()
	for (const ttlMinutes of [0.001, 0.027])
		await cached({
			...options,
			params: { ttlMinutes },
			ttlMinutes,
			staleMinutes: 0,
			target: async () => ({}),
		})
	assert.deepEqual(
		redis.writes.map(({ ttl }) => ttl),
		[1, 2],
	)
})

test("bypasses execute independently without Redis or registration", async () => {
	const redis = fakeRedis()
	const pending = deferred<{ answer: string }>()
	let runs = 0
	const calls = [0, -1].map((ttlMinutes) =>
		cached({
			...options,
			ttlMinutes,
			target: () => {
				runs++
				return pending.promise
			},
		}),
	)
	assert.equal(runs, 2)
	assert.equal(cacheInFlightCount(), 0)
	pending.resolve({ answer: "uncached" })
	await Promise.all(calls)
	assert.equal(redis.reads, 0)
	assert.equal(redis.writes.length, 0)
	count("catalog", "bypass", 2)
})

test("joiners fall back to the shared value when structuredClone cannot copy it", async () => {
	setRedisClusterForTest(null)
	const data = { method: () => 42 }
	const calls = Array.from({ length: 2 }, () =>
		cached({ ...options, target: async () => data }),
	)
	const results = await Promise.all(calls)
	assert.equal(results[0], data)
	assert.equal(results[1], data)
	count("catalog", "joined", 1)
})

test("background refresh metrics use metricName and cap label sets at 100", async () => {
	const redis = fakeRedis()
	for (let i = 0; i < 101; i++) {
		const name = `refresh-${i}`
		seedStale(redis, name)
		await cached({
			...options,
			name,
			metricName: `label-${i}`,
			target: async () => ({}),
		})
		await tick()
	}
	assert.ok(
		renderMetrics().includes(
			'goodwatch_metrics_dropped_label_sets_total{metric="goodwatch_data_cache_refreshes_total"} 1',
		),
	)
	assert.ok(!renderMetrics().includes('cache="refresh-'))
	count("label-0", "ok", 1, true)
})

const TEST_TIMEOUT_MS = 30
function assertDeadlineElapsed(start: number) {
	const elapsed = performance.now() - start
	// Node may fire a timer a millisecond early by this clock.
	assert.ok(elapsed >= TEST_TIMEOUT_MS - 5, `elapsed ${elapsed} ms`)
	assert.ok(elapsed < 800, `elapsed ${elapsed} ms`)
}

test("a stalled get falls through to one target run and records error only", async () => {
	const redis = fakeRedis()
	redis.client.get = () => new Promise(() => {})
	setRedisCommandTimeoutForTest(TEST_TIMEOUT_MS)
	let runs = 0
	const start = performance.now()
	assert.deepEqual(
		await cached({
			...options,
			target: async () => {
				runs++
				return { answer: 42 }
			},
		}),
		{ answer: 42 },
	)
	assertDeadlineElapsed(start)
	assert.equal(runs, 1)
	assert.equal(redis.writes.length, 1)
	const stored = redis.store.get(cacheEntryKey(options.name, {}))
	assert.ok(stored)
	assert.deepEqual(JSON.parse(stored).data, { answer: 42 })
	count("catalog", "error", 1)
	assert.ok(!renderMetrics().includes('result="miss"'))
	assert.ok(!renderMetrics().includes('result="unavailable"'))
})

test("a stalled set returns the target value without an unhandled rejection", async (t) => {
	const redis = fakeRedis()
	redis.client.setex = () => new Promise(() => {})
	setRedisCommandTimeoutForTest(TEST_TIMEOUT_MS)
	const unhandled: unknown[] = []
	const listener = (error: unknown) => unhandled.push(error)
	process.on("unhandledRejection", listener)
	t.after(() => process.off("unhandledRejection", listener))
	const start = performance.now()
	assert.deepEqual(
		await cached({ ...options, target: async () => ({ answer: 42 }) }),
		{ answer: 42 },
	)
	assertDeadlineElapsed(start)
	await tick()
	assert.deepEqual(unhandled, [])
})

test("a stalled background write records a refresh error and preserves stale data", async () => {
	const redis = fakeRedis()
	const { key, value } = seedStale(redis)
	redis.client.setex = () => new Promise(() => {})
	setRedisCommandTimeoutForTest(TEST_TIMEOUT_MS)
	await cached({ ...options, target: async () => ({ answer: "new" }) })
	await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUT_MS + 20))
	count("catalog", "error", 1, true)
	assert.equal(redis.store.get(key), value)
})

test("a stalled del makes resetCache return zero within the deadline", async () => {
	const redis = fakeRedis()
	redis.client.del = () => new Promise(() => {})
	setRedisCommandTimeoutForTest(TEST_TIMEOUT_MS)
	const start = performance.now()
	assert.equal(await resetCache(options), 0)
	assertDeadlineElapsed(start)
})

test("a get rejecting after its deadline never causes an unhandled rejection", async (t) => {
	const redis = fakeRedis()
	const pending = deferred<string | null>()
	redis.client.get = () => pending.promise
	setRedisCommandTimeoutForTest(TEST_TIMEOUT_MS)
	const unhandled: unknown[] = []
	const listener = (error: unknown) => unhandled.push(error)
	process.on("unhandledRejection", listener)
	t.after(() => process.off("unhandledRejection", listener))
	await cached({ ...options, target: async () => ({ answer: 42 }) })
	pending.reject(new Error("Late failure"))
	await tick()
	assert.deepEqual(unhandled, [])
})

test("cache writes never call INFO", async (t) => {
	const redis = fakeRedis()
	const client = { ...redis.client, info: t.mock.fn(async () => "") }
	setRedisClusterForTest(client)
	await cached({ ...options, target: async () => ({ answer: 42 }) })
	assert.equal(redis.writes.length, 1)
	assert.equal(client.info.mock.callCount(), 0)
})

test("Redis options bound node commands and never reconnect the cluster", () => {
	assert.equal(REDIS_COMMAND_TIMEOUT_MS, 1000)
	assert.equal(
		redisOptions.redisOptions?.commandTimeout,
		REDIS_COMMAND_TIMEOUT_MS,
	)
	// A closed cluster ends and rejects its queued commands instead of holding them for a reconnect.
	assert.equal(redisOptions.clusterRetryStrategy?.(1), null)
	assert.equal(redisOptions.redisOptions?.maxRetriesPerRequest, 0)
	// Off would reject commands to a node that is still connecting.
	assert.notEqual(redisOptions.enableOfflineQueue, false)
})

test("ioredis times out a command against a silent TCP server", async () => {
	const sockets = new Set<Socket>()
	const server = createServer((socket) => {
		sockets.add(socket)
		socket.on("close", () => sockets.delete(socket))
	})
	let client: Redis | undefined
	try {
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject)
			server.listen(0, "127.0.0.1", resolve)
		})
		const address = server.address()
		assert.ok(address && typeof address !== "string")
		client = new Redis({
			host: "127.0.0.1",
			port: address.port,
			...redisOptions.redisOptions,
			commandTimeout: 50,
			lazyConnect: false,
		})
		client.on("error", () => {})
		const start = performance.now()
		await assert.rejects(client.get("silent"), /Command timed out/)
		assert.ok(performance.now() - start < 800)
	} finally {
		client?.disconnect()
		for (const socket of sockets) socket.destroy()
		if (server.listening)
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			)
	}
})

test("50 failing lookups log once and the next window reports suppressed failures", async (t) => {
	const redis = fakeRedis()
	redis.client.get = async () => {
		throw new Error("Read\nfailed")
	}
	let now = Date.now()
	t.mock.method(Date, "now", () => now)
	const warn = t.mock.method(console, "warn", () => {})
	for (let i = 0; i < 50; i++)
		await cached({ ...options, target: async () => ({}) })
	assert.equal(warn.mock.callCount(), 1)
	assert.deepEqual(warn.mock.calls[0].arguments, [
		"Redis get failed: Read failed (suppressed: 0)",
	])
	now += 10_000
	await cached({ ...options, target: async () => ({}) })
	assert.equal(warn.mock.callCount(), 2)
	assert.deepEqual(warn.mock.calls[1].arguments, [
		"Redis get failed: Read failed (suppressed: 49)",
	])
})

test("50 stale lookups retry a failing target only once per 30-second pause", async (t) => {
	const redis = fakeRedis()
	let now = Date.now()
	const start = now
	t.mock.method(Date, "now", () => now)
	t.mock.method(console, "warn", () => {})
	seedStale(redis)
	let runs = 0
	const target = async () => {
		runs++
		throw new Error("Backend unavailable")
	}
	for (let i = 0; i < 50; i++) {
		now = start + i * 500
		assert.deepEqual(await cached({ ...options, target }), { answer: "old" })
		await tick()
	}
	assert.equal(runs, 1)
	assert.equal(cacheRefreshPauseCount(), 1)
	count("catalog", "stale", 50)
	count("catalog", "error", 1, true)
	now = start + 30_001
	for (let i = 0; i < 10; i++) {
		assert.deepEqual(await cached({ ...options, target }), { answer: "old" })
		await tick()
		now += 500
	}
	assert.equal(runs, 2)
	count("catalog", "stale", 60)
	count("catalog", "error", 2, true)
})

test("a rejected background cache write pauses the key", async (t) => {
	const redis = fakeRedis()
	const { key, value } = seedStale(redis)
	t.mock.method(console, "warn", () => {})
	redis.client.setex = async () => {
		throw new Error("Write failed")
	}
	const target = t.mock.fn(async () => ({ answer: "new" }))
	for (let i = 0; i < 3; i++) {
		assert.deepEqual(await cached({ ...options, target }), { answer: "old" })
		await tick()
	}
	assert.equal(target.mock.callCount(), 1)
	assert.equal(cacheRefreshPauseCount(), 1)
	assert.equal(redis.store.get(key), value)
	count("catalog", "error", 1, true)
	count("catalog", "stale", 3)
})

test("a successful refresh after the pause clears it and later lookups hit", async (t) => {
	const redis = fakeRedis()
	let now = Date.now()
	t.mock.method(Date, "now", () => now)
	t.mock.method(console, "warn", () => {})
	seedStale(redis)
	let runs = 0
	const target = async () => {
		if (++runs === 1) throw new Error("Temporary failure")
		return { answer: "new" }
	}
	await cached({ ...options, target })
	await tick()
	assert.equal(cacheRefreshPauseCount(), 1)
	now += 30_000
	assert.deepEqual(await cached({ ...options, target }), { answer: "old" })
	await tick()
	assert.equal(cacheRefreshPauseCount(), 0)
	assert.deepEqual(await cached({ ...options, target }), { answer: "new" })
	assert.equal(runs, 2)
	count("catalog", "ok", 1, true)
	count("catalog", "hit", 1)
})

test("resetCache clears the pause and a reseeded stale value refreshes immediately", async (t) => {
	const redis = fakeRedis()
	seedStale(redis)
	t.mock.method(console, "warn", () => {})
	const target = t.mock.fn(async () => {
		throw new Error("Backend unavailable")
	})
	await cached({ ...options, target })
	await tick()
	assert.equal(cacheRefreshPauseCount(), 1)
	await resetCache(options)
	assert.equal(cacheRefreshPauseCount(), 0)
	seedStale(redis)
	await cached({ ...options, target })
	await tick()
	assert.equal(target.mock.callCount(), 2)
})

test("a pause does not block absent or expired cold lookups or change their errors", async (t) => {
	const redis = fakeRedis()
	t.mock.method(console, "warn", () => {})
	const error = new Error("Backend unavailable")
	for (const absent of [true, false]) {
		const { key } = seedStale(redis)
		await cached({
			...options,
			target: async () => {
				throw error
			},
		})
		await tick()
		assert.equal(cacheRefreshPauseCount(), 1)
		if (absent) redis.store.delete(key)
		else
			redis.store.set(
				key,
				serializeCacheEntry({ answer: "expired" }, Date.now() - 180_000),
			)
		await assert.rejects(
			cached({
				...options,
				target: async () => {
					throw error
				},
			}),
			(caught) => caught === error,
		)
		assert.deepEqual(
			await cached({ ...options, target: async () => ({ answer: "cold" }) }),
			{ answer: "cold" },
		)
		resetRefreshPausesForTest()
	}
	count("catalog", "miss", 4)
	count("catalog", "error", 2, true)
})

test("refresh pauses cap at 1000, evict the oldest, and drop expired entries first", async (t) => {
	const redis = fakeRedis()
	let now = Date.now()
	t.mock.method(Date, "now", () => now)
	t.mock.method(console, "warn", () => {})
	let runs = 0
	const fail = async (id: number) => {
		const params = { id }
		redis.store.set(
			cacheEntryKey(options.name, params),
			serializeCacheEntry({ answer: "old" }, now - 90_000),
		)
		await cached({
			...options,
			params,
			target: async () => {
				runs++
				throw new Error("Backend unavailable")
			},
		})
		await tick()
	}
	for (let id = 0; id < 1100; id++) {
		await fail(id)
		assert.ok(cacheRefreshPauseCount() <= 1000)
	}
	assert.equal(cacheRefreshPauseCount(), 1000)
	assert.equal(runs, 1100)
	await fail(100)
	assert.equal(runs, 1100)
	await fail(0)
	assert.equal(runs, 1101)
	resetRefreshPausesForTest()
	// Insert live pauses before older pauses: expiration must take priority over insertion order.
	now += 10_000
	for (let id = 0; id < 500; id++) await fail(id)
	now -= 10_000
	for (let id = 500; id < 1000; id++) await fail(id)
	now += 30_000
	assert.equal(cacheRefreshPauseCount(), 1000)
	await fail(1000)
	assert.equal(cacheRefreshPauseCount(), 501)
	const before = runs
	await fail(0)
	assert.equal(runs, before)
})

test("cachePhysicalTtlSeconds shares the default stale window and clamps invalid windows", () => {
	assert.equal(cachePhysicalTtlSeconds(1440), 90000)
	assert.equal(cachePhysicalTtlSeconds(30), 3600)
	assert.equal(cachePhysicalTtlSeconds(1440, 0), 86400)
	assert.equal(cachePhysicalTtlSeconds(0.001, 0), 1)
	assert.equal(cachePhysicalTtlSeconds(0.027, 0), 2)
	for (const stale of [
		-1,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
	])
		assert.equal(cachePhysicalTtlSeconds(1440, stale), 86400)
})

test("confirmed resets distinguish acknowledged deletion from unavailable Redis", async () => {
	const { RedisNodeDownError } = await import("../../utils/redis-breaker.ts")
	for (const outcome of [
		1,
		0,
		new Error("DEL failed"),
		new RedisNodeDownError("test-node"),
		null,
	]) {
		setRedisClusterForTest(
			outcome === null
				? null
				: {
						async get() {
							return null
						},
						async setex() {},
						async del() {
							if (outcome instanceof Error) throw outcome
							return outcome
						},
					},
		)
		assert.equal(
			await resetCacheConfirmed({ name: "confirmed-reset", params: {} }),
			typeof outcome === "number",
		)
	}
})
