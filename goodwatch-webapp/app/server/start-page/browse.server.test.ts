// The Where to start section's reads (browse.server.ts), from made-up readers: what each rail takes, what a failed
// read leaves out, and how long a part is kept.
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { describe, it } from "node:test"
import "../title-filter/test-alias.ts"
import type { DiscoverParams, DiscoverResult } from "~/server/discover.server"

// The real readers need Crate, Redis, and the bundled sitemaps; the tests pass their own.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (s: string, c: unknown) => unknown,
		): unknown
	}): void
}
const STUBS: Record<string, string> = {
	"~/server/best-lists.server":
		"export const getRankedList = () => { throw new Error('stub') }",
	"~/server/new-on-services.server":
		"export const getCountryArrivals = () => { throw new Error('stub') }",
	"~/server/streaming-providers.server":
		"export const getStreamingProviders = () => { throw new Error('stub') }",
	"~/server/discover.server":
		"export const getDiscoverResults = () => { throw new Error('stub') }",
}
registerHooks({
	resolve: (specifier, context, next) =>
		STUBS[specifier]
			? {
					url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`,
					shortCircuit: true,
				}
			: next(specifier, context),
})

const {
	keptParts,
	joinBrowse,
	pickPosters,
	readCountryBrowse,
	readSharedBrowse,
	serviceHref,
} = await import("./browse.server.ts")
const { BRANDS } = await import("~/domain/new-on-services")
const { BROWSE_GENRES, BROWSE_MOODS, moodHref } = await import(
	"~/ui/start/browse/browse-data"
)
const { exploreAddressExists } = await import("~/ui/explore/address")
type Readers = Parameters<typeof readSharedBrowse>[0]

const result = (id: number, more: Partial<DiscoverResult> = {}) =>
	({
		tmdb_id: id,
		media_type: "movie",
		title: `Title ${id}`,
		poster_path: `/p${id}.jpg`,
		goodwatch_overall_score_voting_count: 50_000,
		...more,
	}) as DiscoverResult

/** Discover answers each read with titles of its own, from an id the read's filters decide. */
let reads: DiscoverParams[] = []
const discover = async (params: DiscoverParams) => {
	reads.push(params)
	const base = reads.length * 100
	return [1, 2, 3, 4, 5].map((i) => result(base + i))
}

const readers = (more: Partial<Readers> = {}): Readers => ({
	ranked: async (kind) =>
		Array.from({ length: 12 }, (_, i) => ({
			tmdb_id: i + 1,
			media_type: kind,
			title: `Best ${i + 1}`,
			release_year: 2000,
			poster_path: `/b${i}.jpg`,
			genres: [],
			goodwatch_overall_score_normalized_percent: 90.7,
			path: `/${kind}/${i + 1}`,
		})),
	arrivals: async () => ({
		brands: { hulu: [] },
		all: Array.from({ length: 15 }, (_, i) => ({
			key: 1e12 + i,
			tmdb_id: i + 1,
			media_type: "movie" as const,
			title: `New ${i}`,
			release_year: 2026,
			runtime: 100,
			poster_path: i === 0 ? null : `/n${i}.jpg`,
			backdrop_path: null,
			score: 81.4,
			path: `/movie/${i + 1}`,
			service: 8,
			at: 0,
			exact: true,
		})),
	}),
	// Netflix, then Disney+, then Hulu (no page here: no arrivals), then a service that isn't a brand.
	providers: async () => [
		{ id: 8, logo_path: "/netflix.jpg" },
		{ id: 337, logo_path: "/disney.jpg" },
		{ id: 15, logo_path: "/hulu.jpg" },
		{ id: 999, logo_path: "/other.jpg" },
	],
	discover,
	...more,
})

describe("the shared rails", () => {
	it("take ten of each best-of list in whole points, and a rail per mood and genre", async () => {
		reads = []
		const { value, complete } = await readSharedBrowse(readers())
		assert.equal(complete, true)
		assert.equal(value.top.movie.length, 10)
		assert.equal(value.top.show[0].media_type, "show")
		assert.equal(
			value.top.movie[0].goodwatch_overall_score_normalized_percent,
			90,
		)
		assert.deepEqual(
			value.moods.map((mood) => mood.path),
			BROWSE_MOODS.map((mood) => mood.path),
		)
		assert.equal(value.moods[0].posters.length, 3)
		assert.deepEqual(
			value.genres.movie.map((genre) => genre.path),
			BROWSE_GENRES.movie,
		)
		assert.equal(
			value.genres.show.find((genre) => genre.path === "scifi-and-fantasy")
				?.name,
			"Sci-Fi & Fantasy",
		)
		// The pages' own filters, movies for the moods, each genre's own type, never a service.
		const comedy = reads.find(
			(read) => read.withGenres === "35" && read.type === "show",
		)
		assert.ok(comedy)
		for (const [key, field] of Object.entries({
			tense: "tension",
			dark: "bleakness",
			deep: "philosophical",
			magical: "wonder",
			quirky: "eccentricity",
		})) {
			const conditions = reads.map((read) =>
				JSON.parse(read.fingerprintConditions || "[]"),
			)
			const expected = [
				{
					logic: "AND",
					conditions: [
						{ field, operator: ">=", value: 8 },
						...(key === "tense"
							? [
									{ field: "adrenaline", operator: "<=", value: 6 },
									{ field: "scare", operator: "<=", value: 6 },
								]
							: []),
					],
				},
			]
			assert.ok(
				conditions.some(
					(value) => JSON.stringify(value) === JSON.stringify(expected),
				),
				key,
			)
		}
		assert.ok(reads.every((read) => read.withStreamingProviders === ""))
		assert.ok(
			reads
				.slice(0, BROWSE_MOODS.length)
				.every((read) => read.type === "movie" && read.fingerprintConditions),
		)
	})

	it("leave out a mood whose read failed, and say the part is incomplete", async () => {
		let n = 0
		const { value, complete } = await readSharedBrowse(
			readers({
				discover: async (params) => {
					n++
					if (n === 1) throw new Error("down")
					return discover(params)
				},
			}),
		)
		assert.equal(complete, false)
		assert.equal(value.moods.length, BROWSE_MOODS.length - 1)
		assert.equal(value.moods[0].path, BROWSE_MOODS[1].path)
	})

	it("every mood and genre names a page of the site", () => {
		for (const mood of BROWSE_MOODS) {
			if (["tense", "dark", "deep", "magical", "quirky"].includes(mood.path)) {
				assert.equal(moodHref(mood.path), `/discover?moods=${mood.path}`)
				continue
			}
			assert.ok(
				exploreAddressExists({
					type: "movies",
					category: "moods",
					page: mood.path,
				}),
				mood.path,
			)
		}
		for (const [kind, paths] of Object.entries(BROWSE_GENRES))
			for (const page of paths)
				assert.ok(
					exploreAddressExists({ type: `${kind}s`, category: "genres", page }),
					`${kind} ${page}`,
				)
	})
})

describe("the country's rails", () => {
	it("take the arrivals with posters, and the brands in the country's order that have a page", async () => {
		reads = []
		const { value, complete } = await readCountryBrowse("DE", readers())
		assert.equal(complete, true)
		assert.equal(value.arrivals.length, 12)
		assert.equal(value.arrivals[0].title, "New 1")
		assert.equal(
			value.arrivals[0].goodwatch_overall_score_normalized_percent,
			81,
		)
		assert.deepEqual(
			value.services.map((service) => [
				service.name,
				service.href,
				service.logo,
			]),
			[
				["Netflix", "/shows/streaming/netflix", "/netflix.jpg"],
				["Disney+", "/shows/streaming/disney-plus", "/disney.jpg"],
			],
		)
		assert.equal(value.services[0].posters.length, 4)
		assert.deepEqual(
			reads.map((read) => [read.country, read.withStreamingProviders]),
			[
				["DE", "8,1796"],
				["DE", "337"],
			],
		)
	})

	it("a failed arrivals read leaves the rail empty and the part incomplete", async () => {
		const { value, complete } = await readCountryBrowse(
			"US",
			readers({
				arrivals: async () => {
					throw new Error("down")
				},
			}),
		)
		assert.equal(complete, false)
		assert.deepEqual(value.arrivals, [])
		assert.equal(value.services.length, 2)
	})

	it("a service without a hub page links to its New on page while it has arrivals", () => {
		const hulu = BRANDS.find((brand) => brand.slug === "hulu")
		assert.ok(hulu)
		assert.equal(serviceHref(hulu, "US", { brands: {}, all: [] }), null)
		assert.equal(
			serviceHref(hulu, "US", { brands: { hulu: [{} as never] }, all: [] }),
			"/new/us/hulu",
		)
	})
})

describe("posters", () => {
	it("known titles first, none twice in a rail, none without a poster", () => {
		const used = new Set<string>()
		const first = pickPosters(
			[
				result(1, { goodwatch_overall_score_voting_count: 10 }),
				result(2),
				result(3, { poster_path: "" }),
				result(4),
			],
			2,
			used,
		)
		assert.deepEqual(
			first.map((poster) => poster.poster_path),
			["/p2.jpg", "/p4.jpg"],
		)
		const second = pickPosters(
			[result(2), result(1, { goodwatch_overall_score_voting_count: 10 })],
			2,
			used,
		)
		assert.deepEqual(
			second.map((poster) => poster.poster_path),
			["/p1.jpg"],
		)
	})
})

describe("kept parts", () => {
	it("read once, serve kept parts, and read again in the background once old", async () => {
		let clock = 0
		let count = 0
		const part = keptParts(
			async (key) => {
				count++
				return { value: `${key} ${count}`, complete: count !== 2 }
			},
			{ ttl: 100, retry: 10, now: () => clock },
		)
		const [a, b] = await Promise.all([part("x"), part("x")])
		assert.deepEqual([a?.value, b?.value, count], ["x 1", "x 1", 1])
		clock = 50
		assert.equal((await part("x"))?.value, "x 1")
		assert.equal(count, 1)
		clock = 200
		// Old: served as it is while the next read runs.
		assert.equal((await part("x"))?.value, "x 1")
		await new Promise((resolve) => setImmediate(resolve))
		assert.equal((await part("x"))?.value, "x 2")
		// The second read was incomplete: it is read again after the retry time, not the full one.
		clock = 215
		await part("x")
		await new Promise((resolve) => setImmediate(resolve))
		assert.equal((await part("x"))?.value, "x 3")
	})

	it("a kept part answers well under the page's 50 ms", async () => {
		const part = keptParts(async () => ({ value: 1, complete: true }))
		await part("x")
		const start = performance.now()
		for (let i = 0; i < 1000; i++) await part("x")
		assert.ok(performance.now() - start < 50)
	})

	it("a failed first read gives null and is tried again on the next request", async () => {
		let fail = true
		const part = keptParts(async () => {
			if (fail) throw new Error("down")
			return { value: 1, complete: true }
		})
		assert.equal(await part("x"), null)
		fail = false
		assert.equal((await part("x"))?.value, 1)
	})

	it("a missing part leaves its rails empty and the section incomplete", () => {
		const joined = joinBrowse(null, {
			value: { arrivals: [], services: [] },
			complete: true,
		})
		assert.equal(joined.complete, false)
		assert.deepEqual(joined.value.top, { movie: [], show: [] })
	})
})
