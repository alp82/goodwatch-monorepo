import assert from "node:assert/strict"
import { test } from "node:test"
import { createLocaleSourceCache } from "./locale-source-cache.server.ts"

test("per-title locale cache bounds each Redis value and memory retention, and rejects corrupt/oversized reads", async () => {
	const values = new Map<string, string>(),
		reads: string[] = []
	const redis = {
		get: async (key: string) => {
			reads.push(key)
			return values.get(key) ?? null
		},
		set: async (key: string, value: string) => {
			values.set(key, value)
		},
	}
	const cache = createLocaleSourceCache<string>(() => redis, {
		namespace: "fixture",
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
		reads.includes("fixture:fr:movie-1"),
		"old memory entries are evicted",
	)
	assert.equal((await cache.read(["movie-1"], "de")).size, 0)
	values.set("fixture:fr:corrupt", "{invalid")
	values.set("fixture:fr:large", JSON.stringify("x".repeat(100)))
	assert.equal((await cache.read(["corrupt", "large"], "fr")).size, 0)
})

test("a late Redis source hit cannot extend its original freshness in process memory", (t) => {
	let now = 1000
	t.mock.method(Date, "now", () => now)
	const values = new Map<string, string>()
	const redis = {
		get: async (key: string) => values.get(key) ?? null,
		set: async (key: string, value: string) => {
			values.set(key, value)
		},
	}
	const options = {
		namespace: "expiry",
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
