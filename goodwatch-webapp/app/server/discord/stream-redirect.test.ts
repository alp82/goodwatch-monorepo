import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { streamRedirect } from "./stream-redirect.server.ts"
import {
	cachedTitleRead,
	titleCacheKey,
	TITLE_CACHE_SECONDS,
	type CacheStore,
} from "./title-cache.server.ts"

const long = `https://click.justwatch.com/a?cx=${"x".repeat(700)}`
const read = (offers: unknown[], calls: unknown[] = []) =>
	(async (place: unknown, _origin: string, name: string, args: unknown) => {
		calls.push({ place, name, args })
		return {
			title: {
				id: "movie:687163",
				name: "Project Hail Mary",
				availability: { offers },
			},
		}
	}) as never

const memory = () => {
	const values = new Map<string, string>()
	const sets: [string, number][] = []
	const store: CacheStore = {
		get: async (key) => values.get(key) ?? null,
		set: async (key, value, ttl) => {
			values.set(key, value)
			sets.push([key, ttl])
		},
	}
	return { store, values, sets }
}

const go = (path: string, offers: unknown[], calls: unknown[] = []) => {
	const [, , , media, tmdbId, providerId] = new URL(
		path,
		"https://goodwatch.app",
	).pathname.split("/")
	return streamRedirect(
		{ media, tmdbId, providerId },
		new URL(path, "https://goodwatch.app"),
		{ read: read(offers, calls), store: async () => null },
	)
}

test("the stream redirect sends a known offer's long link, with noindex and no-store", async () => {
	const calls: unknown[] = []
	const response = await go(
		"/go/stream/movie/687163/8?country=de",
		[
			{ service_id: 337, url: "https://disney.example" },
			{ service_id: 8, url: long },
		],
		calls,
	)
	assert.equal(response.status, 302)
	assert.equal(response.headers.get("Location"), long)
	assert.equal(response.headers.get("Cache-Control"), "no-store")
	assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow")
	assert.deepEqual(calls, [
		{
			place: { country: "DE", services: [] },
			name: "get_title",
			args: { title_id: "movie:687163" },
		},
	])
})

test("the stream redirect follows the service's channels and tiers, never other links", async () => {
	// 1796 is a Netflix tier: a button made from the tier's offer still finds the service's link.
	const tier = await go("/go/stream/movie/687163/1796?country=US", [
		{ service_id: 8, url: "https://netflix.example/title" },
	])
	assert.equal(tier.headers.get("Location"), "https://netflix.example/title")
	for (const offers of [
		[{ service_id: 337, url: "https://disney.example" }],
		[{ service_id: 8, url: "javascript:alert(1)" }],
		[{ service_id: 8 }],
	]) {
		const response = await go("/go/stream/movie/687163/8", offers)
		assert.equal(response.status, 302)
		assert.equal(
			response.headers.get("Location"),
			"/movie/687163-project-hail-mary#streaming",
		)
	}
})

test("the stream redirect refuses malformed paths and unknown titles", async () => {
	for (const params of [
		{ media: "person", tmdbId: "1", providerId: "8" },
		{ media: "movie", tmdbId: "0", providerId: "8" },
		{ media: "movie", tmdbId: "1", providerId: "https:" },
		{ media: "movie", tmdbId: "1" },
	]) {
		const response = await streamRedirect(
			params,
			new URL("https://goodwatch.app/go/stream"),
			{
				read: read([]),
				store: async () => null,
			},
		)
		assert.equal(response.status, 404)
		assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow")
	}
	const missing = await streamRedirect(
		{ media: "movie", tmdbId: "1", providerId: "8" },
		new URL("https://goodwatch.app/go/stream/movie/1/8?country=../x"),
		{ read: (async () => ({})) as never, store: async () => null },
	)
	assert.equal(missing.status, 404)
	const failing = await streamRedirect(
		{ media: "movie", tmdbId: "1", providerId: "8" },
		new URL("https://goodwatch.app/go/stream/movie/1/8"),
		{
			read: (async () => {
				throw new Error("down")
			}) as never,
			store: async () => null,
		},
	)
	assert.equal(failing.status, 503)
	assert.equal(failing.headers.get("Location"), null)
})

test("title reads are cached five minutes per title and place, and only when the title was found", async () => {
	const { store, values, sets } = memory()
	let reads = 0
	const fresh = async () => {
		reads++
		return { title: { id: "movie:1", name: "One" } }
	}
	const place = { country: "de", services: [337, 8, 8] }
	assert.deepEqual(await cachedTitleRead("movie:1", place, fresh, store), {
		title: { id: "movie:1", name: "One" },
	})
	await new Promise((resolve) => setImmediate(resolve))
	assert.deepEqual(sets, [[titleCacheKey("movie:1", place), TITLE_CACHE_SECONDS]])
	assert.equal(TITLE_CACHE_SECONDS, 300)
	await cachedTitleRead("movie:1", { country: "DE", services: [8, 337] }, fresh, store)
	assert.equal(reads, 1, "the same title and place is a cache hit")
	await cachedTitleRead("movie:1", { country: "DE" }, fresh, store)
	assert.equal(reads, 2, "another service set is another entry")
	assert.match(titleCacheKey("movie:1", { country: "DE" }), /:DE:all$/)
	await cachedTitleRead("movie:2", { country: "DE" }, async () => ({}), store)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(values.size, 2, "a missing title is never stored")
	values.set(titleCacheKey("movie:3", { country: "DE" }), "{not json")
	const broken: CacheStore = {
		get: async () => {
			throw new Error("Redis command timed out")
		},
		set: async () => {
			throw new Error("Redis command timed out")
		},
	}
	assert.deepEqual(
		await cachedTitleRead("movie:3", { country: "DE" }, fresh, store),
		{ title: { id: "movie:1", name: "One" } },
	)
	assert.deepEqual(
		await cachedTitleRead("movie:4", { country: "DE" }, fresh, broken),
		{ title: { id: "movie:1", name: "One" } },
	)
})

test("the stream redirect counts presses per visitor before the catalog read and answers 429 over the limit", async () => {
	const { createRateLimiter } = await import("../rate-limit.server.ts")
	const limiter = createRateLimiter({ redis: () => null })
	const calls: unknown[] = []
	const press = (client: string | null) =>
		streamRedirect(
			{ media: "movie", tmdbId: "687163", providerId: "8" },
			new URL("https://goodwatch.app/go/stream/movie/687163/8"),
			{
				read: read([{ service_id: 8, url: "https://netflix.example" }], calls),
				store: async () => null,
				take: (...args) => limiter.take(...args),
			},
			client,
		)
	for (let i = 0; i < 60; i++) assert.equal((await press("a")).status, 302)
	const limited = await press("a")
	assert.equal(limited.status, 429)
	assert.ok(Number(limited.headers.get("Retry-After")) >= 1)
	assert.equal(limited.headers.get("Location"), null)
	assert.equal(calls.length, 60, "a limited press never reads the catalog")
	assert.equal((await press("b")).status, 302, "another visitor is counted apart")
	assert.equal((await press(null)).status, 302, "without a trusted address nobody is limited")
	const failing = await streamRedirect(
		{ media: "movie", tmdbId: "687163", providerId: "8" },
		new URL("https://goodwatch.app/go/stream/movie/687163/8"),
		{
			read: read([{ service_id: 8, url: "https://netflix.example" }]),
			store: async () => null,
			take: async () => {
				throw new Error("down")
			},
		},
		"a",
	)
	assert.equal(failing.status, 302)
})
