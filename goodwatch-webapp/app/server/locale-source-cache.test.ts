import assert from "node:assert/strict"
import { test } from "node:test"
import { createLocaleSourceCache } from "./locale-source-cache.server.ts"

test("per-title locale cache bounds each Redis value and memory retention, and rejects corrupt/oversized reads", async () => {
	const values = new Map<string, string>(),
		reads: string[] = []
	const redis = {
		mget: async (...keys: string[]) => {
			reads.push(...keys)
			return keys.map((key) => values.get(key) ?? null)
		},
		set: async (key: string, value: string) => {
			values.set(key, value)
		},
	}
	const cache = createLocaleSourceCache<string>(() => redis, {
		namespace: "fixture",
		deadline: (p) => p,
		maxValueBytes: 80,
		memoryBytes: 80,
		maxEntries: 1,
		validate: (v): v is string => typeof v === "string",
	})
	await cache.write(
		new Map([
			["movie-1", "one"],
			["movie-2", "two"],
			["movie-3", "x".repeat(100)],
		]),
		"fr",
	)
	assert.equal(values.size, 2)
	assert.equal((await cache.read(["movie-1", "movie-2"], "fr")).size, 2)
	assert.ok(
		reads.includes("fixture:{fixture:fr}:movie-1"),
		"old memory entries are evicted",
	)
	assert.equal((await cache.read(["movie-1"], "de")).size, 0)
	values.set("fixture:{fixture:fr}:corrupt", "{invalid")
	values.set("fixture:{fixture:fr}:large", JSON.stringify("x".repeat(100)))
	assert.equal((await cache.read(["corrupt", "large"], "fr")).size, 0)
})

test("a late Redis source hit cannot extend its original freshness in process memory", (t) => {
	let now = 1000
	t.mock.method(Date, "now", () => now)
	const values = new Map<string, string>()
	const redis = {
		mget: async (...keys: string[]) =>
			keys.map((key) => values.get(key) ?? null),
		set: async (key: string, value: string) => {
			values.set(key, value)
		},
	}
	const options = {
		namespace: "expiry",
		deadline: <T>(p: Promise<T>) => p,
		ttlSeconds: 10,
		validate: (v: unknown): v is string => typeof v === "string",
	}
	const writer = createLocaleSourceCache<string>(() => redis, options)
	const reader = createLocaleSourceCache<string>(() => redis, options)
	return (async () => {
		await writer.write(new Map([["movie-1", "one"]]), "fr")
		now = 10_999
		assert.equal((await reader.read(["movie-1"], "fr")).get("movie-1"), "one")
		now = 11_001
		assert.equal((await reader.read(["movie-1"], "fr")).size, 0)
	})()
})

test("overlapping cold loads coalesce source IO by entity and use one tagged MGET per batch", async () => {
	let reads = 0,
		loads = 0
	const loadedKeys: string[] = []
	let release!: () => void
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	const redis = {
		mget: async (...keys: string[]) => {
			reads++
			assert.equal(
				new Set(keys.map((key) => key.match(/\{[^}]+\}/)?.[0])).size,
				1,
			)
			return keys.map(() => null)
		},
		set: async () => {},
	}
	const cache = createLocaleSourceCache<string>(() => redis, {
		namespace: "flight",
		deadline: (p) => p,
		validate: (v): v is string => typeof v === "string",
	})
	const loader = async (keys: string[]) => {
		loads++
		loadedKeys.push(...keys)
		await gate
		return new Map(keys.map((key) => [key, key]))
	}
	const first = cache.load(["1", "2"], "fr", loader)
	const second = cache.load(["2", "3"], "fr", loader)
	release()
	const result = await Promise.all([first, second])
	assert.equal(reads, 2)
	assert.equal(loads, 2)
	assert.deepEqual(
		loadedKeys.sort(),
		["1", "2", "3"],
		"shared title 2 is fetched exactly once",
	)
	assert.deepEqual([...result[0].keys()].sort(), ["1", "2"])
	assert.deepEqual([...result[1].keys()].sort(), ["2", "3"])
	const reused = await cache.load(["1", "2", "3"], "fr", loader)
	assert.equal(reused.size, 3)
	assert.equal(loads, 2)
	const keys = Array.from({ length: 200 }, (_, i) => `movie-${i}`)
	await cache.load(keys, "de", loader)
	assert.equal(reads, 3, "200 keys need one MGET")
})
test("failed source loads release in-flight owners for retry and Redis deadlines degrade to misses", async () => {
	let deadlines = 0
	const redis = {
		mget: async () => new Promise<(string | null)[]>(() => {}),
		set: async () => {},
	}
	const cache = createLocaleSourceCache<string>(() => redis, {
		namespace: "deadline",
		deadline: async () => {
			deadlines++
			throw new Error("timed out")
		},
		validate: (v): v is string => typeof v === "string",
	})
	await assert.rejects(
		cache.load(["1"], "fr", async () => {
			throw new Error("source failed")
		}),
	)
	const answer = await cache.load(
		["1"],
		"fr",
		async () => new Map([["1", "ok"]]),
	)
	assert.equal(answer.get("1"), "ok")
	assert.ok(deadlines >= 2)
})
