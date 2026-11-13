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
	assert.equal(await store.claim(), true)
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
	assert.equal(await failing.claim(), true)
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
	redis.values.delete("trope-recs:index:v1:lock")
	await loadOrBuild(store, build, { maxAgeMs: 3_600_000, now: () => now })
	assert.equal(builds, 2)
})

test("while another process holds the lock, its copy is awaited; with none arriving the process builds itself", async () => {
	const redis = memoryRedis()
	const store = storedIndex({ redis: () => redis })
	const other = storedIndex({ redis: () => redis })
	let now = 10_000_000
	assert.equal(await other.claim(), true)
	let builds = 0
	const build = async () => {
		builds++
		return sample()
	}
	let waits = 0
	const arrived = await loadOrBuild(store, build, {
		maxAgeMs: 3_600_000,
		now: () => now,
		wait: async (ms) => {
			now += ms
			if (++waits === 2) await other.save(sample(1), now)
		},
	})
	assert.equal(builds, 0)
	assert.equal(arrived.value.titles.length, 1)

	redis.values.clear()
	assert.equal(await other.claim(), true)
	waits = 0
	await loadOrBuild(store, build, {
		maxAgeMs: 3_600_000,
		now: () => now,
		wait: async (ms) => {
			waits++
			now += ms
		},
	})
	assert.equal(builds, 1)
	assert.equal(waits, (LOCK_SECONDS * 1000) / 15_000)
})
