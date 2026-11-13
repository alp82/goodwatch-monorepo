import assert from "node:assert/strict"
import { test } from "node:test"
import type { CandidateIndex } from "./ranking.ts"
import {
	CHUNK_BYTES,
	LOCK_SECONDS,
	type StoredIndexRedis,
	decodeIndex,
	encodeIndex,
	loadOrBuild,
	storedIndex,
} from "./stored-index.ts"

function sample(titles = 3, perTitle = 4): CandidateIndex {
	return {
		titles: Array.from({ length: titles }, (_, t) => ({
			id: `movie-${t + 1}` as const,
			kind: "movie" as const,
			name: `Title ${t}`,
			year: t ? 2000 + t : null,
			poster: "/p.jpg",
			gwScore: 70.5,
			popularity: 12.25,
			href: `/movie/${t + 1}`,
			tropes: Array.from({ length: t === 1 ? 0 : perTitle }, (_, k) => ({
				i: (t * 7 + k) % 70_000,
				d: (k * 13) % 101,
			})),
		})),
		tropes: ["https://a", 'label:["B",""]'],
		names: ["A", "B"],
		references: [["https://a", "https://a2"], []],
	}
}

function memoryRedis() {
	const values = new Map<string, string | Buffer>()
	const redis: StoredIndexRedis & { values: typeof values } = {
		values,
		async get(key) {
			const value = values.get(key)
			return value === undefined ? null : String(value)
		},
		async getBuffer(key) {
			const value = values.get(key)
			return value === undefined ? null : Buffer.from(value)
		},
		async setex(key, _seconds, value) {
			values.set(key, value)
		},
		async set(key, value) {
			if (values.has(key)) return null
			values.set(key, value)
			return "OK"
		},
		async eval(_script, _keys, key, token) {
			if (values.get(key) !== token) return 0
			values.delete(key)
			return 1
		},
	}
	return redis
}

test("an index survives encoding, including titles without tropes", async () => {
	const index = sample()
	assert.deepEqual(await decodeIndex(await encodeIndex(index)), index)
	const empty = { titles: [], tropes: [], names: [], references: [] }
	assert.deepEqual(await decodeIndex(await encodeIndex(empty)), empty)
})

test("a stored index larger than one chunk loads whole; a missing chunk reads as no copy", async () => {
	const redis = memoryRedis()
	const errors: unknown[] = []
	const store = storedIndex({
		redis: () => redis,
		onError: (e) => errors.push(e),
	})
	// Random positions don't compress, so the value spans several chunks.
	const index = sample(400, 2_000)
	for (const title of index.titles)
		for (const pair of title.tropes) pair.i = Math.floor(Math.random() * 4e9)
	await store.save(index, 1234)
	const chunks = [...redis.values.keys()].filter((k) => /:1234:\d+$/.test(k))
	assert.ok(chunks.length > 1, `expected several chunks, got ${chunks.length}`)
	for (const key of chunks)
		assert.ok(Buffer.from(redis.values.get(key)!).length <= CHUNK_BYTES)
	assert.deepEqual(await store.load(), { value: index, builtAt: 1234 })
	redis.values.delete(chunks[1])
	assert.equal(await store.load(), null)
	assert.deepEqual(errors, [])
})

test("without Valkey there is no copy and every process may build", async () => {
	const store = storedIndex({ redis: () => null })
	assert.equal(await store.load(), null)
	assert.deepEqual(await store.claim(), {})
	const failing = storedIndex({
		redis: () => ({
			...memoryRedis(),
			get: async () => {
				throw Error("down")
			},
			set: async () => {
				throw Error("down")
			},
		}),
		onError: () => {},
	})
	assert.equal(await failing.load(), null)
	assert.deepEqual(await failing.claim(), {})
})

test("a fresh stored copy is used without building; a stale one is rebuilt and stored", async () => {
	const redis = memoryRedis()
	const store = storedIndex({ redis: () => redis })
	let now = 10_000_000
	let builds = 0
	const build = async () => {
		builds++
		return sample()
	}
	const first = await loadOrBuild(store, build, {
		maxAgeMs: 3_600_000,
		now: () => now,
	})
	assert.equal(builds, 1)
	assert.equal(first.builtAt, now)
	now += 3_599_999
	const second = await loadOrBuild(store, build, {
		maxAgeMs: 3_600_000,
		now: () => now,
	})
	assert.equal(builds, 1)
	assert.equal(second.builtAt, 10_000_000)
	assert.deepEqual(second.value, sample())
	now += 1
	await loadOrBuild(store, build, { maxAgeMs: 3_600_000, now: () => now })
	assert.equal(builds, 2)
})

test("while another process holds the lock, its copy is awaited", async () => {
	const redis = memoryRedis()
	const store = storedIndex({ redis: () => redis })
	const other = storedIndex({ redis: () => redis })
	let now = 10_000_000
	assert.ok((await other.claim())?.token)
	let builds = 0
	let waits = 0
	const arrived = await loadOrBuild(
		store,
		async () => {
			builds++
			return sample()
		},
		{
			maxAgeMs: 3_600_000,
			now: () => now,
			wait: async (ms) => {
				now += ms
				if (++waits === 2) await other.save(sample(1), now)
			},
		},
	)
	assert.equal(builds, 0)
	assert.equal(arrived.value.titles.length, 1)
})

test("a waiter takes over once the other process's lock is gone, and only one waiter builds", async () => {
	const redis = memoryRedis()
	const other = storedIndex({ redis: () => redis })
	let now = 10_000_000
	assert.ok((await other.claim())?.token)
	let builds = 0
	let running = 0
	const releaseAt = 3
	let waits = 0
	const wait = async (ms: number) => {
		now += ms
		// The other process died: its lock expires.
		if (++waits === releaseAt) redis.values.delete("trope-recs:index:v1:lock")
		await new Promise((resolve) => setImmediate(resolve))
	}
	const build = async () => {
		builds++
		running++
		assert.equal(running, 1)
		await new Promise((resolve) => setImmediate(resolve))
		running--
		return sample()
	}
	const options = { maxAgeMs: 3_600_000, now: () => now, wait }
	const results = await Promise.all([
		loadOrBuild(storedIndex({ redis: () => redis }), build, options),
		loadOrBuild(storedIndex({ redis: () => redis }), build, options),
		loadOrBuild(storedIndex({ redis: () => redis }), build, options),
	])
	assert.equal(builds, 1)
	for (const result of results) assert.equal(result.value.titles.length, 3)
	assert.equal(redis.values.has("trope-recs:index:v1:lock"), false)
})

test("a failed build releases its lock, so the retry builds at once", async () => {
	const redis = memoryRedis()
	const store = storedIndex({ redis: () => redis })
	const now = 10_000_000
	let waits = 0
	const options = {
		maxAgeMs: 3_600_000,
		now: () => now,
		wait: async () => {
			waits++
		},
	}
	await assert.rejects(
		loadOrBuild(
			store,
			async () => {
				throw Error("Crate unavailable")
			},
			options,
		),
	)
	assert.equal(redis.values.has("trope-recs:index:v1:lock"), false)
	await loadOrBuild(store, async () => sample(), options)
	assert.equal(waits, 0)
})

test("a release never removes another process's lock", async () => {
	const redis = memoryRedis()
	const store = storedIndex({ redis: () => redis })
	const claim = await store.claim()
	assert.ok(claim?.token)
	redis.values.set("trope-recs:index:v1:lock", "someone-else")
	await store.release(claim)
	assert.equal(redis.values.get("trope-recs:index:v1:lock"), "someone-else")
})

test("past twice the lock's lifetime a waiter builds without the lock", async () => {
	const redis = memoryRedis()
	const store = storedIndex({ redis: () => redis })
	redis.set = async () => null
	let now = 10_000_000
	let waits = 0
	let builds = 0
	await loadOrBuild(
		store,
		async () => {
			builds++
			return sample()
		},
		{
			maxAgeMs: 3_600_000,
			now: () => now,
			wait: async (ms) => {
				waits++
				now += ms
			},
		},
	)
	assert.equal(builds, 1)
	assert.equal(waits, (2 * LOCK_SECONDS * 1000) / 15_000)
})

test("a copy published between the last read and the claim is used, not built again", async () => {
	const redis = memoryRedis()
	const store = storedIndex({ redis: () => redis })
	const other = storedIndex({ redis: () => redis })
	const now = 10_000_000
	// The other builder publishes and releases right before this process claims the lock.
	const set = redis.set.bind(redis)
	let first = true
	redis.set = async (...args) => {
		if (first) {
			first = false
			await other.save(sample(1), now)
		}
		return set(...args)
	}
	let builds = 0
	const result = await loadOrBuild(
		store,
		async () => {
			builds++
			return sample()
		},
		{ maxAgeMs: 3_600_000, now: () => now, wait: async () => {} },
	)
	assert.equal(builds, 0)
	assert.equal(result.value.titles.length, 1)
	assert.equal(redis.values.has("trope-recs:index:v1:lock"), false)
})
