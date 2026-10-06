// Preload CommonJS dependencies before the alias hook rewrites relative imports.
import "node-crate"
import "react"
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import Redis from "ioredis"
import "./title-filter/test-alias.ts"
// Suppress cache.ts's import-time cluster connection; all commands use the fake below.
const originalConnect = Redis.Cluster.prototype.connect
Redis.Cluster.prototype.connect = async () => {}
const {
	createTitleDetailsGetters,
	DETAILS_MISSING_CACHE_NAME,
	DETAILS_MISSING_TTL_SECONDS,
} = await import("./title-details-cache.ts")
const { cacheEntryKey, setRedisClusterForTest } = await import(
	"../utils/cache.ts"
)
const { trimTitleDetails } = await import("./title-details-shape.ts")
const { createStaticHandler, isRouteErrorResponse } = await import(
	"@remix-run/router"
)
Redis.Cluster.prototype.connect = originalConnect

afterEach(() => setRedisClusterForTest(null))

function fakeRedis(failReads = false, failWrites = false) {
	const store = new Map<string, string>()
	const reads: string[] = []
	const writes: { key: string; ttl: number; value: string }[] = []
	setRedisClusterForTest({
		get: async (key) => {
			reads.push(key)
			if (failReads) throw new Error("Redis read failed")
			return store.get(key) ?? null
		},
		setex: async (key, ttl, value) => {
			writes.push({ key, ttl, value })
			if (failWrites) throw new Error("Redis write failed")
			store.set(key, value)
		},
		del: async (key) => Number(store.delete(key)),
	})
	return { store, reads, writes }
}

const raw = {
	details: { tmdb_id: 42, title: "Title", tropes: [] },
	cast_rows: [],
	videos: { clips: null, trailers: [], featurettes: [] },
}
const markerPrefix = "cached-details-missing-v1:"

function getterFor(
	mediaType: "movie" | "show",
	fetch: Parameters<typeof createTitleDetailsGetters>[0],
) {
	const getters = createTitleDetailsGetters(fetch)
	return (country = "US", language = "en", bypassCache = false) =>
		mediaType === "movie"
			? getters.getDetailsForMovie(
					{ movieId: "5338654", country, language },
					{ bypassCache },
				)
			: getters.getDetailsForShow(
					{ showId: "42", country, language },
					{ bypassCache },
				)
}

async function missing(request: Promise<unknown>): Promise<Response> {
	const result = await request.then(
		() => assert.fail("Missing title resolved"),
		(error: unknown) => error,
	)
	assert.ok(result instanceof Response)
	assert.equal(result.status, 404)
	assert.equal(await result.text(), "Not Found")
	return result
}

for (const mediaType of ["movie", "show"] as const) {
	test(`${mediaType}: missing bursts share a tiny marker until its exact expiry`, async (t) => {
		t.mock.timers.enable({ apis: ["Date"], now: 1_700_000_000_000 })
		const { store, writes } = fakeRedis()
		let fetches = 0
		let added = false
		const get = getterFor(mediaType, async () => {
			fetches++
			return added ? raw : null
		})
		const responses = await Promise.all(
			Array.from({ length: 20 }, () => missing(get())),
		)
		assert.equal(fetches, 1)
		responses.push(await missing(get("DE", "de")))
		assert.equal(fetches, 1)
		for (let i = 0; i < 20; i++) responses.push(await missing(get()))
		assert.equal(new Set(responses).size, 41)
		assert.equal(fetches, 1)
		const key = cacheEntryKey(DETAILS_MISSING_CACHE_NAME, {
			mediaType,
			id: mediaType === "movie" ? "658039" : "42",
		})
		const checkMarkers = (count: number) => {
			assert.equal(writes.length, count)
			for (const write of writes) {
				assert.equal(write.key, key)
				assert.ok(write.key.startsWith(markerPrefix))
				assert.equal(write.ttl, DETAILS_MISSING_TTL_SECONDS)
				assert.ok(write.value.length < 100)
				assert.deepEqual(JSON.parse(write.value).data, { marker: true })
			}
			assert.deepEqual([...store.keys()], [key])
		}
		checkMarkers(1)
		t.mock.timers.tick(DETAILS_MISSING_TTL_SECONDS * 1000 - 1)
		await missing(get())
		assert.equal(fetches, 1)
		t.mock.timers.tick(1)
		await missing(get())
		assert.equal(fetches, 2)
		await missing(get())
		assert.equal(fetches, 2)
		checkMarkers(2)
		added = true
		t.mock.timers.tick(DETAILS_MISSING_TTL_SECONDS * 1000)
		assert.deepEqual(await get(), trimTitleDetails(raw, mediaType, "US"))
		assert.equal(fetches, 3)
		assert.equal((await get()).details.title, "Title")
		assert.equal(fetches, 3)
		assert.equal(writes.length, 3)
		assert.ok(writes[2].key.startsWith(`cached-details-${mediaType}-v2:`))
	})

	test(`${mediaType}: existing details keep their v2 shape and hits use one read`, async () => {
		const { reads, writes } = fakeRedis()
		let fetches = 0
		const get = getterFor(mediaType, async () => {
			fetches++
			return raw
		})
		await get()
		assert.equal(writes.length, 1)
		assert.ok(writes[0].key.startsWith(`cached-details-${mediaType}-v2:`))
		assert.deepEqual(
			JSON.parse(writes[0].value).data,
			JSON.parse(JSON.stringify(trimTitleDetails(raw, mediaType, "US"))),
		)
		const before = reads.length
		await get()
		assert.equal(reads.length - before, 1)
		assert.ok(reads.at(-1)?.startsWith(`cached-details-${mediaType}-v2:`))
		assert.equal(fetches, 1)
		assert.equal(writes.length, 1)
	})

	test(`${mediaType}: bypass does not read or write missing markers`, async () => {
		const { reads, writes } = fakeRedis()
		let fetches = 0
		const get = getterFor(mediaType, async () => {
			fetches++
			return null
		})
		await missing(get("US", "en", true))
		assert.equal(fetches, 1)
		assert.deepEqual(reads, [])
		assert.deepEqual(writes, [])
	})

	test(`${mediaType}: failed Redis reads still return 404 and fetch each time`, async () => {
		fakeRedis(true)
		let fetches = 0
		const get = getterFor(mediaType, async () => {
			fetches++
			return null
		})
		for (let i = 0; i < 3; i++) await missing(get())
		assert.equal(fetches, 3)
	})

	test(`${mediaType}: failed Redis writes still return 404`, async () => {
		fakeRedis(false, true)
		let fetches = 0
		const get = getterFor(mediaType, async () => {
			fetches++
			return null
		})
		for (let i = 0; i < 3; i++) await missing(get())
		assert.equal(fetches, 3)
	})

	test(`${mediaType}: ordinary errors propagate without a marker`, async () => {
		const { writes } = fakeRedis()
		const error = new Error("Fetch failed")
		const get = getterFor(mediaType, async () => {
			throw error
		})
		for (const bypass of [false, true])
			await assert.rejects(
				get("US", "en", bypass),
				(caught) => caught === error,
			)
		assert.deepEqual(writes, [])
	})

	test(`${mediaType}: Remix receives three readable 404 errors from one null fetch`, async () => {
		fakeRedis()
		let fetches = 0
		const get = getterFor(mediaType, async () => {
			fetches++
			return null
		})
		const handler = createStaticHandler([
			{ id: "details", path: "/details", loader: () => get() },
		])
		const results = await Promise.all(
			Array.from({ length: 3 }, () =>
				handler.query(new Request("http://localhost/details")),
			),
		)
		assert.equal(fetches, 1)
		for (const result of results) {
			assert.ok(!(result instanceof Response))
			assert.equal(result.statusCode, 404)
			const error = result.errors?.details
			assert.ok(isRouteErrorResponse(error))
			assert.equal(error.data, "Not Found")
		}
	})
}

// The real statement path: only a statement that ran and returned no row counts as missing.
const { getDetailsForMovie, getDetailsForShow } = await import(
	"./details.server.ts"
)
const { setCrateClientForTest } = await import("../utils/crate.ts")

for (const mediaType of ["movie", "show"] as const) {
	test(`${mediaType}: an empty Crate result is stored as missing, a failed or timed-out statement is not`, async (t) => {
		t.mock.method(console, "log", () => {})
		t.mock.method(console, "error", () => {})
		t.mock.method(console, "trace", () => {})
		const { writes } = fakeRedis()
		let statements = 0
		let outcome: "empty" | "error" | "timeout" = "error"
		setCrateClientForTest({
			execute: async () => {
				statements++
				if (outcome === "error") throw new Error("Crate is down")
				if (outcome === "timeout") throw new Error("Query timeout after 5000ms")
				return { json: [], rowcount: 0 }
			},
		})
		t.after(() => setCrateClientForTest(null))
		const get = () =>
			mediaType === "movie"
				? getDetailsForMovie({
						movieId: "999999991",
						country: "US",
						language: "en",
					})
				: getDetailsForShow({
						showId: "999999991",
						country: "US",
						language: "en",
					})
		for (outcome of ["error", "timeout"] as const) {
			for (let i = 0; i < 2; i++)
				await assert.rejects(get(), (error) => !(error instanceof Response))
		}
		assert.equal(statements, 4)
		assert.equal(writes.length, 0)
		outcome = "empty"
		for (let i = 0; i < 3; i++) await missing(get())
		assert.equal(statements, 5)
		assert.equal(writes.length, 1)
		assert.ok(writes[0].key.startsWith(markerPrefix))
	})
}
