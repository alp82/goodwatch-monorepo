import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import * as nodeModule from "node:module"
import {
	withMediaRequestHealth,
	mediaReadFailed,
	protectMediaResponse,
} from "./media-read-health.server.ts"
import "./title-filter/test-alias.ts"
import {
	identifyGridEpisodes,
	type CanonicalGridEpisode,
} from "../domain/tracking/episode-grid-identity.ts"
const state = {
	queries: [] as string[],
	canonical: [] as CanonicalGridEpisode[],
	failIdentity: false,
	cacheName: "",
}
Object.assign(globalThis, { __gridIdentityTest: state })
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
		if (url.endsWith("/episode-presentation.server.ts"))
			source = `export const getEpisodePresentation=async()=>null`
		if (url.endsWith("/utils/cache.ts"))
			source = `export const cached=async({name,params,target})=>{globalThis.__gridIdentityTest.cacheName=name;return target(params)}`
		if (url.endsWith("/utils/crate.ts"))
			source = `export const query=async(sql,args)=>{
	 const s=globalThis.__gridIdentityTest;s.queries.push(sql);
	 if(args[0]!==1396)throw new Error('unbounded show read');
	 if(sql.includes('FROM episode WHERE')){if(s.failIdentity)throw new Error('catalog unavailable');return s.canonical;}
	 if(sql.includes('FROM imdb_episode'))return [{imdb_episode_id:'tt0959621',season_number:1,episode_number:1,name:'Pilot',score:9,votes:100}];
	 return [];
	}`
		return source
			? { format: "module", shortCircuit: true, source }
			: next(url, context)
	},
})
const { getEpisodeGrid } = await import("./episode-grid.server.ts")
const { overlayAlignedGrid } = await import("../utils/episode-text-overlay.ts")
const { packEpisodeGrid, unpackEpisodeGrid } = await import(
	"../utils/episode-grid-wire.ts"
)
const canonical = (
	fields: Partial<CanonicalGridEpisode> = {},
): CanonicalGridEpisode => ({
	tmdb_id: 62085,
	imdb_id: null,
	season_number: 1,
	episode_number: 1,
	name: "Pilot",
	...fields,
})
const imdb = (fields = {}) => ({
	imdb_episode_id: "tt0959621",
	season_number: 1,
	episode_number: 1,
	name: "Pilot",
	score: 9,
	votes: 100,
	...fields,
})
beforeEach(() => {
	state.queries = []
	state.canonical = [canonical()]
	state.failIdentity = false
})

test("ordinary Breaking Bad grid proves Pilot identity in one show-scoped query and overlays afterwards", async () => {
	const grid = await getEpisodeGrid({ showId: "1396" })
	assert.ok(grid)
	assert.equal(state.cacheName, "episode-grid-media-v3")
	assert.equal(state.queries.length, 6)
	assert.equal(
		state.queries.filter((sql) => sql.includes("FROM episode WHERE")).length,
		1,
	)
	assert.match(
		state.queries.find((sql) => sql.includes("FROM episode WHERE"))!,
		/removed_at IS NULL/,
	)
	assert.equal(grid.seasons[0].episodes[0].tmdbId, 62085)
	const localized = await overlayAlignedGrid(
		grid,
		"ja",
		async (_kind, show, ids) => {
			assert.equal(show, 1396)
			assert.deepEqual(ids, [62085])
			return [
				{
					show_id: 1396,
					tmdb_id: 62085,
					language_code: "ja",
					country_code: "JP",
					name: "化学教師",
					overview: null,
				},
			]
		},
	)
	assert.equal(localized.seasons[0].episodes[0].nameLanguage, "ja-JP")
	assert.equal(localized.seasons[0].episodes[0].name, "化学教師")
	assert.equal(localized.seasons[0].episodes[0].score, 9)
	assert.equal(grid.seasons[0].episodes[0].name, "Pilot")
	assert.deepEqual(unpackEpisodeGrid(packEpisodeGrid(localized)), localized)
	const fallback = await overlayAlignedGrid(grid, "ar", async () => [])
	assert.equal(fallback.seasons[0].episodes[0].nameLanguage, "en")
})
test("unique real titles can match renumbering, but equal numbers, placeholders and ambiguous titles cannot", () => {
	const source = [imdb({ episode_number: 2 })]
	assert.equal(identifyGridEpisodes(source, [canonical()])[0].tmdbId, 62085)
	assert.equal(
		identifyGridEpisodes(source, [canonical({ name: "Other" })])[0].tmdbId,
		undefined,
	)
	assert.equal(
		identifyGridEpisodes(
			[imdb({ name: "Episode 1" })],
			[canonical({ name: "Episode 1" })],
		)[0].tmdbId,
		undefined,
	)
	assert.equal(
		identifyGridEpisodes(source, [canonical(), canonical({ tmdb_id: 9 })])[0]
			.tmdbId,
		undefined,
	)
	assert.equal(
		identifyGridEpisodes(
			[imdb(), imdb({ imdb_episode_id: "tt2", episode_number: 2 })],
			[canonical()],
		)[0].tmdbId,
		undefined,
	)
	assert.equal(
		identifyGridEpisodes(source, [canonical({ season_number: 2 })])[0].tmdbId,
		undefined,
	)
	assert.equal(
		identifyGridEpisodes(source, [canonical({ imdb_id: "ttDifferent" })])[0]
			.tmdbId,
		undefined,
	)
	assert.deepEqual(source, [imdb({ episode_number: 2 })])
})
test("unique external IDs prove specials; duplicate IDs and conflicting sources fail closed", () => {
	const source = [imdb({ season_number: null, name: "Special IMDb name" })]
	const catalog = [
		canonical({
			imdb_id: "tt0959621",
			season_number: 0,
			name: "Canonical special",
		}),
	]
	assert.equal(identifyGridEpisodes(source, catalog)[0].tmdbId, 62085)
	assert.equal(identifyGridEpisodes(source, catalog)[0].name, source[0].name)
	assert.equal(identifyGridEpisodes(source, catalog)[0].nameLanguage, "und")
	assert.equal(
		identifyGridEpisodes(source, [...catalog, { ...catalog[0], tmdb_id: 8 }])[0]
			.tmdbId,
		undefined,
	)
	assert.equal(
		identifyGridEpisodes([...source, ...source], catalog)[0].tmdbId,
		undefined,
	)
	assert.equal(
		identifyGridEpisodes(source, [
			canonical({ imdb_id: "tt0959621", name: null }),
		])[0].nameLanguage,
		"und",
	)
})
test("catalog failure preserves rated grid and unknown language, without inventing IDs or cacheable fallback", async () =>
	withMediaRequestHealth(async () => {
		state.failIdentity = true
		const grid = await getEpisodeGrid({ showId: "1396" })
		assert.ok(grid)
		const result = await overlayAlignedGrid(grid, "ja", async () =>
			assert.fail("no stable ID to read"),
		)
		assert.equal(result.seasons[0].episodes[0].nameLanguage, "und")
		assert.equal(result.seasons[0].episodes[0].score, 9)
		assert.equal(mediaReadFailed(), true)
		const headers = new Headers({ "Cache-Control": "public, s-maxage=1800" })
		protectMediaResponse(headers)
		assert.equal(headers.get("Cache-Control"), "private, no-store")
	}))
test("wire sidecars preserve original special indices when only later specials have identity", () => {
	const grid = {
		showId: 1396,
		seasons: [],
		specials: [
			{ name: "Unknown", score: 8, votes: 1 },
			{ tmdbId: 2, nameLanguage: "ja", name: "特別編", score: 9, votes: 2 },
		],
		maxEpisodeNumber: 0,
		hasEpisodeZero: false,
		providers: [],
	}
	assert.deepEqual(unpackEpisodeGrid(packEpisodeGrid(grid)), grid)
})
