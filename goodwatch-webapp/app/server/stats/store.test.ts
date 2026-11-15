import assert from "node:assert/strict"
import { test } from "node:test"
import {
	STATS_SNAPSHOT_VERSION,
	type StatsSnapshot,
} from "../../domain/stats/snapshot.ts"
import {
	FAILED_KEY,
	LOCK_KEY,
	MAX_AGE_MS,
	MAX_RETRY_MS,
	RETRY_MS,
	SNAPSHOT_KEY,
	type StatsRedis,
	WAIT_MS,
	statsSnapshotSource,
	statsStore,
} from "./store.ts"

const snapshot = (generatedAt: string) =>
	({ version: STATS_SNAPSHOT_VERSION, generatedAt }) as StatsSnapshot

function memoryRedis() {
	const values = new Map<string, string>()
	const redis: StatsRedis & { values: typeof values } = {
		values,
		async get(key) {
			return values.get(key) ?? null
		},
		async set(key: string, value: string, ..._rest: unknown[]) {
			if (_rest[2] === "NX" && values.has(key)) return null
			values.set(key, value)
			return "OK"
		},
		async eval(_script, _keys, key, token) {
			if (values.get(key) !== token) return 0
			values.delete(key)
			return 1
		},
		async del(key) {
			return values.delete(key) ? 1 : 0
		},
	}
	return redis
}

function setup({
	redis = memoryRedis(),
	compute = async () => snapshot("computed"),
	deadlineMs,
}: {
	redis?: ReturnType<typeof memoryRedis>
	compute?: (signal: AbortSignal) => Promise<StatsSnapshot>
	deadlineMs?: number
} = {}) {
	let clock = 1_000_000_000
	const errors: unknown[] = []
	let computations = 0
	const source = statsSnapshotSource({
		store: statsStore({ redis: () => redis, onError: (e) => errors.push(e) }),
		compute: (signal) => {
			computations++
			return compute(signal)
		},
		now: () => clock,
		wait: async () => {},
		deadlineMs,
		onError: (e) => errors.push(e),
	})
	return {
		source,
		redis,
		errors,
		computations: () => computations,
		advance: (ms: number) => {
			clock += ms
		},
		at: () => clock,
	}
}

test("the first read returns at once and starts a computation", async () => {
	let finish: (s: StatsSnapshot) => void = () => {}
	const t = setup({
		compute: () =>
			new Promise<StatsSnapshot>((resolve) => {
				finish = resolve
			}),
	})
	assert.equal(await t.source.read(), null)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(t.computations(), 1, "started, still running")
	assert.equal(await t.source.read(), null, "a read never waits for it")
	finish(snapshot("computed"))
	await t.source.check()
	assert.equal((await t.source.read())?.generatedAt, "computed")
	assert.ok(t.redis.values.has(SNAPSHOT_KEY), "stored for the other processes")
	assert.ok(!t.redis.values.has(LOCK_KEY), "lock released")
})

test("a fresh stored copy is read without computing", async () => {
	const redis = memoryRedis()
	const t = setup({ redis })
	redis.values.set(
		SNAPSHOT_KEY,
		JSON.stringify({ builtAt: t.at() - 1000, snapshot: snapshot("stored") }),
	)
	assert.equal((await t.source.read())?.generatedAt, "stored")
	await t.source.check()
	assert.equal(t.computations(), 0)
})

test("a day-old snapshot keeps showing while the next is computed", async () => {
	const redis = memoryRedis()
	const t = setup({ redis })
	redis.values.set(
		SNAPSHOT_KEY,
		JSON.stringify({
			builtAt: t.at() - MAX_AGE_MS - 1,
			snapshot: snapshot("old"),
		}),
	)
	assert.equal((await t.source.read())?.generatedAt, "old")
	await t.source.check()
	assert.equal(t.computations(), 1)
	assert.equal((await t.source.read())?.generatedAt, "computed")
})

test("a snapshot of another shape is computed again", async () => {
	const redis = memoryRedis()
	const t = setup({ redis })
	redis.values.set(
		SNAPSHOT_KEY,
		JSON.stringify({ builtAt: t.at(), snapshot: { version: -1 } }),
	)
	await t.source.read()
	await t.source.check()
	assert.equal(t.computations(), 1)
})

test("while another process holds the lock, this one waits for its copy", async () => {
	const redis = memoryRedis()
	redis.values.set(LOCK_KEY, "someone else")
	const t = setup({ redis })
	assert.equal(await t.source.read(), null)
	await t.source.check()
	assert.equal(t.computations(), 0)
	redis.values.set(
		SNAPSHOT_KEY,
		JSON.stringify({ builtAt: t.at(), snapshot: snapshot("theirs") }),
	)
	t.advance(WAIT_MS)
	await t.source.read()
	await t.source.check()
	assert.equal((await t.source.read())?.generatedAt, "theirs")
	assert.equal(t.computations(), 0)
})

test("a failed computation keeps the last snapshot and tries again later", async () => {
	const redis = memoryRedis()
	let fail = true
	const t = setup({
		redis,
		compute: async () => {
			if (fail) throw new Error("Crate is away")
			return snapshot("recovered")
		},
	})
	redis.values.set(
		SNAPSHOT_KEY,
		JSON.stringify({
			builtAt: t.at() - MAX_AGE_MS - 1,
			snapshot: snapshot("old"),
		}),
	)
	await t.source.read()
	await t.source.check()
	assert.equal((await t.source.read())?.generatedAt, "old")
	assert.equal(t.errors.length, 1)
	assert.ok(!redis.values.has(LOCK_KEY))
	fail = false
	await t.source.check()
	assert.equal(t.computations(), 1, "no retry before RETRY_MS")
	t.advance(RETRY_MS)
	await t.source.check()
	assert.equal((await t.source.read())?.generatedAt, "recovered")
})

test("without Valkey the process computes for itself", async () => {
	let clock = 0
	const source = statsSnapshotSource({
		store: statsStore({ redis: () => null, onError: () => {} }),
		compute: async () => snapshot("alone"),
		now: () => clock++,
		wait: async () => {},
		onError: () => {},
	})
	await source.read()
	await source.check()
	assert.equal((await source.read())?.generatedAt, "alone")
})

test("failures wait twice as long each time, up to the cap", async () => {
	const t = setup({
		compute: async () => {
			throw new Error("Crate is away")
		},
	})
	const waits: number[] = []
	for (let i = 0; i < 7; i++) {
		await t.source.check()
		const failure = JSON.parse(t.redis.values.get(FAILED_KEY) ?? "null")
		waits.push(failure.until - t.at())
		assert.equal(failure.failures, i + 1)
		assert.match(failure.error, /Crate is away/)
		// Not a moment before the wait is over.
		t.advance(failure.until - t.at() - 1)
		await t.source.check()
		assert.equal(t.computations(), i + 1)
		t.advance(1)
	}
	assert.deepEqual(waits, [
		RETRY_MS,
		2 * RETRY_MS,
		4 * RETRY_MS,
		8 * RETRY_MS,
		MAX_RETRY_MS,
		MAX_RETRY_MS,
		MAX_RETRY_MS,
	])
	assert.equal(t.source.status().failures, 7)
	const logged = t.errors.at(-1) as Error & { cause: Error }
	assert.match(logged.message, /7 in a row/)
	assert.match(logged.message, /next try at/)
	assert.equal(logged.cause.message, "Crate is away")
})

test("a failure in one process makes the others wait too", async () => {
	const redis = memoryRedis()
	const failing = setup({
		redis,
		compute: async () => {
			throw new Error("Crate is away")
		},
	})
	await failing.source.check()
	assert.ok(redis.values.has(FAILED_KEY))
	// Another process, same clock: it finds the failure and computes nothing until the wait is over.
	const other = setup({ redis })
	assert.equal(await other.source.read(), null)
	await other.source.check()
	assert.equal(other.computations(), 0)
	assert.equal(other.source.status().failures, 1)
	other.advance(RETRY_MS)
	await other.source.check()
	assert.equal(other.computations(), 1)
	assert.equal((await other.source.read())?.generatedAt, "computed")
	assert.ok(!redis.values.has(FAILED_KEY), "a success clears the failure")
	assert.equal(other.source.status().failures, 0)
})

test("the next failure after another process's counts on from its count", async () => {
	const redis = memoryRedis()
	const t = setup({
		redis,
		compute: async () => {
			throw new Error("still away")
		},
	})
	redis.values.set(
		FAILED_KEY,
		JSON.stringify({
			failures: 3,
			at: t.at() - 1,
			until: t.at() - 1,
			error: "away",
		}),
	)
	await t.source.check()
	const failure = JSON.parse(redis.values.get(FAILED_KEY) ?? "null")
	assert.equal(failure.failures, 4)
	assert.equal(failure.until - t.at(), 8 * RETRY_MS)
})

test("a computation past its deadline is called off and keeps the last snapshot", async () => {
	const redis = memoryRedis()
	let aborted: unknown = null
	const t = setup({
		redis,
		deadlineMs: 20,
		compute: (signal) =>
			new Promise<StatsSnapshot>((_, reject) => {
				signal.addEventListener("abort", () => {
					aborted = signal.reason
					reject(signal.reason)
				})
			}),
	})
	redis.values.set(
		SNAPSHOT_KEY,
		JSON.stringify({
			builtAt: t.at() - MAX_AGE_MS - 1,
			snapshot: snapshot("old"),
		}),
	)
	await t.source.read()
	await t.source.check()
	assert.match(String(aborted), /deadline of 0 s/)
	assert.equal((await t.source.read())?.generatedAt, "old")
	assert.ok(!redis.values.has(LOCK_KEY), "lock released")
	assert.equal(JSON.parse(redis.values.get(FAILED_KEY) ?? "null").failures, 1)
})

test("a computation that never looks at the signal is still called off", async () => {
	const t = setup({
		deadlineMs: 20,
		compute: () => new Promise<StatsSnapshot>(() => {}),
	})
	await t.source.check()
	assert.equal(t.source.status().failures, 1)
	assert.equal(await t.source.read(), null)
})
