import "react"
import "@remix-run/node"
import "ioredis"
import assert from "node:assert/strict"
import { beforeEach, after, test } from "node:test"
import * as nodeModule from "node:module"
import "./title-filter/test-alias.ts"
import { CacheTestRedis } from "../utils/cache-test-redis.ts"
import {
	withMediaRequestHealth,
	withMediaReadHealth,
	mediaReadFailed,
	noteMediaReadFailure,
	failedMediaResult,
	protectMediaResponse,
} from "./media-read-health.server.ts"
const row = {
	media_type: "movie" as const,
	tmdb_id: 603,
	title: "The Matrix",
	original_title: "The Matrix",
	original_language_code: "en",
	poster_path: "/en.jpg",
	synopsis: "English overview",
	tagline: "English tagline",
}
const fixture = {
	mode: "error",
	calls: [] as string[],
	late: undefined as undefined | (() => void),
}
Object.assign(globalThis, {
	__mediaErrorQuery: async (sql: string) => {
		fixture.calls.push(sql)
		if (sql.includes("information_schema"))
			return [{ table_name: "episode_translation" }]
		if (sql.includes("FROM episode_translation")) {
			if (fixture.mode === "episode-timeout")
				return new Promise((resolve) => {
					fixture.late = () => resolve([])
				})
			if (fixture.mode === "episode-error")
				throw new Error("Crate node unavailable")
			return [
				{
					show_id: 1396,
					tmdb_id: 123,
					language_code: "fr",
					country_code: "FR",
					name: "Pilote",
					overview: "Résumé",
				},
			]
		}
		if (sql.includes("UNION ALL") && fixture.mode === "timeout")
			return new Promise((resolve) => {
				fixture.late = () => resolve([row])
			})
		if (sql.includes("FROM translation")) {
			if (fixture.mode === "error") throw new Error("Crate node unavailable")
			return fixture.mode === "missing"
				? []
				: [
						{
							media_type: "movie",
							media_tmdb_id: 603,
							language_code: "fr",
							country_code: "FR",
							title: "Titre",
							overview: "Résumé",
							tagline: "Texte",
						},
					]
		}
		if (sql.includes("FROM media_image")) return []
		if (fixture.mode === "canonical-error")
			throw new Error("Crate node unavailable")
		return [row]
	},
})
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/utils/crate.ts"))
			source =
				"export const query=(sql,args,options)=>globalThis.__mediaErrorQuery(sql,args,options)"
		if (url.endsWith("/server/media-context.server.ts"))
			source =
				'export const resolveMediaContext=async()=>({effectiveContext:{country:"US",language:"fr"}})'
		if (url.endsWith("/utils/auth.ts"))
			source = "export const getUserIdFromRequest=async()=>null"
		return source === undefined
			? next(url, context)
			: { format: "module", source, shortCircuit: true }
	},
})
const { cached, setRedisClusterForTest, serializeCacheEntry, cacheEntryKey } =
	await import("../utils/cache.ts")
const { loader } = await import("../routes/api.media-title.ts")
const { overlayAlignedGrid, resetEpisodeTextCacheForTest } = await import(
	"./episode-text-overlay.server.ts"
)
const { overlayTitles } = await import("./media-overlay.server.ts")
const { presentCatalogLoader, mediaApiCacheControl } = await import(
	"./media-payload.server.ts"
)
const { resetMediaOverlayCacheForTest } = await import(
	"./media-overlay.server.ts"
)
class Redis extends CacheTestRedis {
	async set(key: string, value: string, _expiry: string, seconds: number) {
		await this.setex(key, seconds, value)
	}
}
let redis = new Redis()
const previousTimeout = process.env.MEDIA_OVERLAY_TIMEOUT_MS
after(() => {
	setRedisClusterForTest(null)
	if (previousTimeout === undefined) delete process.env.MEDIA_OVERLAY_TIMEOUT_MS
	else process.env.MEDIA_OVERLAY_TIMEOUT_MS = previousTimeout
})
beforeEach(() => {
	redis = new Redis()
	setRedisClusterForTest(redis)
	resetMediaOverlayCacheForTest()
	resetEpisodeTextCacheForTest()
	fixture.mode = "error"
	fixture.calls = []
	fixture.late = undefined
	process.env.MEDIA_OVERLAY_TIMEOUT_MS = "25"
})
const preview = () =>
	loader({
		request: new Request(
			"https://goodwatch.test/api/media-title?type=movie&id=603&displayLanguage=fr&presentationVersion=5",
			{
				headers: {
					"User-Agent":
						"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
				},
			},
		),
		params: {},
		context: {},
	})
async function previewTitle(response: Awaited<ReturnType<typeof preview>>) {
	const body = await response.json()
	assert.ok("title" in body)
	return body.title
}
test("read ERROR falls back without any source/payload write or CDN freshness; next healthy request recovers", async (t) => {
	t.mock.method(console, "error", () => {})
	const failed = await preview()
	assert.equal(failed.status, 200)
	assert.equal((await previewTitle(failed)).title, "The Matrix")
	assert.equal(failed.headers.get("Cache-Control"), "private, no-store")
	assert.equal(redis.writes.length, 0)
	fixture.mode = "ok"
	const healthy = await preview()
	assert.equal((await previewTitle(healthy)).title, "Titre")
	assert.match(healthy.headers.get("Cache-Control")!, /s-maxage=1800/)
	assert.ok(
		redis.writes.some((write) =>
			write.key.startsWith("cached-localized-title-payload-v5:"),
		),
	)
	const reads = fixture.calls.length
	await preview()
	assert.equal(fixture.calls.length, reads)
})
test("genuine missing translations remain cacheable, and a failed canonical lookup is 503 rather than 404", async () => {
	fixture.mode = "missing"
	const missing = await preview()
	assert.equal((await previewTitle(missing)).title, "The Matrix")
	assert.match(missing.headers.get("Cache-Control")!, /public/)
	assert.ok(redis.writes.length > 0)
	redis.values.clear()
	resetMediaOverlayCacheForTest()
	fixture.mode = "canonical-error"
	const failed = await preview()
	assert.equal(failed.status, 503)
	assert.equal(failed.headers.get("Cache-Control"), "private, no-store")
})
test("catalog JSON adapters and API policies protect fallback outside the preview endpoint", async (t) => {
	t.mock.method(console, "error", () => {})
	const request = new Request(
		"https://goodwatch.test/api/discover?displayLanguage=fr",
	)
	const load = presentCatalogLoader(
		async () =>
			new Response(JSON.stringify({ rows: [row] }), {
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, s-maxage=1800",
				},
			}),
	)
	const response = await load({ request })
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	assert.equal((await response.json()).rows[0].title, "The Matrix")
	assert.equal(redis.writes.length, 0)
	await withMediaRequestHealth(async () => {
		await overlayTitles([row], "fr")
		assert.equal(
			mediaApiCacheControl(request, "public, s-maxage=1800"),
			"private, no-store",
		)
	})
	assert.equal(
		mediaApiCacheControl(request, "public, s-maxage=1800"),
		"public, s-maxage=1800",
	)
})
test("stalled overlay reads return fallback by their own deadline and late completion cannot publish", async (t) => {
	t.mock.method(console, "error", () => {})
	fixture.mode = "timeout"
	const failed = await preview()
	assert.equal(failed.status, 200)
	assert.equal(failed.headers.get("Cache-Control"), "private, no-store")
	assert.equal(redis.writes.length, 0)
	fixture.late!()
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(redis.writes.length, 0)
	fixture.mode = "ok"
	assert.equal((await previewTitle(await preview())).title, "Titre")
})
test("coalesced payload failures mark both requests, even for primitive values, without a cache write", async () => {
	let release!: () => void
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	let calls = 0
	const options = {
		name: "media-failure-join",
		params: { language: "fr" },
		ttlMinutes: 30,
		staleMinutes: 0,
		target: async () => {
			calls++
			await gate
			noteMediaReadFailure()
			return "English"
		},
	}
	const request = () =>
		withMediaRequestHealth(async () => {
			// Exercise the runtime's defensive primitive path, beyond its object-valued public type.
			const data = await Reflect.apply(cached, undefined, [options])
			return { data, failed: mediaReadFailed() }
		})
	const first = request(),
		second = request()
	release()
	assert.deepEqual(await Promise.all([first, second]), [
		{ data: "English", failed: true },
		{ data: "English", failed: true },
	])
	assert.equal(calls, 1)
	assert.equal(redis.writes.length, 0)
})
test("background error fallback preserves the last healthy value and does not taint its reader", async () => {
	const options = {
		name: "media-failure-refresh",
		params: { language: "fr" },
		ttlMinutes: 1,
		staleMinutes: 1,
		target: async () => {
			noteMediaReadFailure()
			return { title: "English" }
		},
	}
	const key = cacheEntryKey(options.name, options.params)
	const prior = serializeCacheEntry({ title: "Titre" }, Date.now() - 61000)
	redis.values.set(key, prior)
	await withMediaRequestHealth(async () => {
		assert.deepEqual(await cached(options), { title: "Titre" })
		assert.equal(mediaReadFailed(), false)
	})
	await new Promise((resolve) => setTimeout(resolve, 10))
	assert.equal(redis.values.get(key), prior)
	assert.equal(redis.writes.length, 0)
})
test("failure tagging cannot contaminate a shared canonical object, and deferred localization protects early headers", async () => {
	const canonical = { title: "English" }
	const degraded = await withMediaReadHealth(async () => {
		noteMediaReadFailure()
		return canonical
	})
	assert.notEqual(degraded, canonical)
	assert.equal(failedMediaResult(degraded), true)
	assert.equal(failedMediaResult(canonical), false)
	await withMediaRequestHealth(async () => {
		let release!: () => void
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const pending = withMediaReadHealth(
			async () => {
				await gate
				return canonical
			},
			{ overlay: true },
		)
		const headers = new Headers({ "Cache-Control": "public, s-maxage=1800" })
		protectMediaResponse(headers)
		assert.equal(headers.get("Cache-Control"), "private, no-store")
		release()
		await pending
		const healthy = new Headers({ "Cache-Control": "public, s-maxage=1800" })
		protectMediaResponse(healthy)
		assert.match(healthy.get("Cache-Control")!, /public/)
	})
})

test("episode read errors cannot cache a localized grid; successful table metadata remains valid", async (t) => {
	t.mock.method(console, "error", () => {})
	const grid = {
		showId: 1396,
		seasons: [],
		specials: [{ number: 1, tmdbId: 123, name: "Pilot", score: 8, votes: 10 }],
		maxEpisodeNumber: 1,
		hasEpisodeZero: false,
		providers: [],
	}
	const options = {
		name: "localized-grid-error-contract",
		params: { language: "fr" },
		ttlMinutes: 30,
		staleMinutes: 0,
		target: async () => ({ grid: await overlayAlignedGrid(grid, "fr") }),
	}
	fixture.mode = "episode-error"
	await withMediaRequestHealth(async () => {
		const result = await cached(options)
		assert.equal(result.grid.specials[0].name, "Pilot")
		const headers = new Headers({ "Cache-Control": "public, s-maxage=1800" })
		protectMediaResponse(headers)
		assert.equal(headers.get("Cache-Control"), "private, no-store")
	})
	assert.ok(
		redis.writes.every((write) =>
			write.key.startsWith("cached-episode-text-source-tables-v1:"),
		),
	)
	fixture.mode = "ok"
	const healthy = await withMediaRequestHealth(() => cached(options))
	assert.equal(healthy.grid.specials[0].name, "Pilote")
	assert.ok(
		redis.writes.some((write) =>
			write.key.startsWith("cached-localized-grid-error-contract:"),
		),
	)
})
test("joined episode source timeouts mark each request before pure fallback handling", async (t) => {
	t.mock.method(console, "error", () => {})
	fixture.mode = "episode-timeout"
	const grid = {
		showId: 1396,
		seasons: [],
		specials: [{ number: 1, tmdbId: 123, name: "Pilot", score: 8, votes: 10 }],
		maxEpisodeNumber: 1,
		hasEpisodeZero: false,
		providers: [],
	}
	const read = () =>
		withMediaRequestHealth(async () => {
			const result = await overlayAlignedGrid(grid, "fr")
			assert.equal(result.specials[0].name, "Pilot")
			assert.equal(mediaReadFailed(), true)
			const headers = new Headers({ "Cache-Control": "public, s-maxage=1800" })
			protectMediaResponse(headers)
			assert.equal(headers.get("Cache-Control"), "private, no-store")
		})
	await Promise.all([read(), read()])
	assert.equal(
		fixture.calls.filter((sql) => sql.includes("FROM episode_translation"))
			.length,
		1,
	)
	assert.ok(
		redis.writes.every((write) =>
			write.key.startsWith("cached-episode-text-source-tables-v1:"),
		),
	)
	fixture.late!()
})
test("a dead node is read only once across subsequent title batches in the same overlay", async (t) => {
	t.mock.method(console, "error", () => {})
	fixture.mode = "canonical-error"
	await withMediaRequestHealth(async () => {
		const rows = Array.from({ length: 401 }, (_, i) => ({
			...row,
			tmdb_id: 603 + i,
		}))
		const result = await overlayTitles(rows, "fr")
		assert.equal(result.length, 401)
		assert.equal(mediaReadFailed(), true)
		assert.deepEqual(
			result.map((value) => value.tmdb_id),
			rows.map((value) => value.tmdb_id),
		)
	})
	assert.equal(fixture.calls.length, 1)
	assert.equal(redis.writes.length, 0)
})


test("a missing category page stays a thrown 404 Response through catalog presentation and read health", async () => {
	const { requireCategoryPage } = await import("./category-page.server.ts")
	for (const agent of ["Googlebot", "Mozilla/5.0"]) {
		const load = presentCatalogLoader(async () => {
			requireCategoryPage(2, [])
			return { results: [] }
		}, { live: true })
		await assert.rejects(
			() => load({ request: new Request("https://goodwatch.test/movies/moods/scary?page=2", {
				headers: { "User-Agent": agent },
			}) }),
			(error) => error instanceof Response && error.status === 404 && error.statusText === "",
		)
	}
})
