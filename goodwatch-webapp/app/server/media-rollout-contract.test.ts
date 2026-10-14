import "react"
import "@remix-run/node"
import "isbot"
import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import * as nodeModule from "node:module"
import "./title-filter/test-alias.ts"
const state = {
	queries: [] as string[],
	cache: new Map<string, unknown>(),
	live: 0,
	talkedRow: { day: "2026-10-14", titles: [{ mediaType: "movie", tmdbId: 603, title: "Movie 603", poster: "/en.jpg", rank: 1, items: [{ text: "Literal post" }] }] },
	titleTranslations: [] as { media_type: string; media_tmdb_id: number; language_code: string; country_code: string; title: string }[],
	episodeRows: [] as {
		show_id: number
		tmdb_id: number
		language_code: string
		country_code: string
		name: string
		overview: string
	}[],
	canonical: {
		mediaType: "show",
		details: {
			tmdb_id: 1396,
			title: "Breaking Bad",
			original_title: "Breaking Bad",
			original_language_code: "en",
			poster_path: "/en.jpg",
		},
		seasons: [
			{
				tmdb_id: 3572,
				season_number: 1,
				name: "Season 1",
				overview: "First season",
			},
		],
	},
}
Object.assign(globalThis, { __mediaRolloutTest: state })
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
		if (url.endsWith("/utils/cache.ts"))
			source = `export const getRedisCluster=()=>null;export const withRedisDeadline=p=>p;export const cached=async({name,params,target})=>{const s=globalThis.__mediaRolloutTest;const key=name+':'+JSON.stringify(params);if(s.cache.has(key))return s.cache.get(key);const value=await target(params);s.cache.set(key,value);return value}`
		if (url.endsWith("/utils/crate.ts"))
			source = `export const query=async(sql,args=[])=>{
	 const s=globalThis.__mediaRolloutTest;s.queries.push(sql);
	 if(sql.includes('information_schema'))return [{table_name:'season_translation'},{table_name:'episode_translation'}];
	 if(sql.includes('UNION ALL'))return [...args[0].map(id=>({media_type:'movie',tmdb_id:id,title:'Movie '+id,poster_path:'/en.jpg'})),...args[1].map(id=>({media_type:'show',tmdb_id:id,title:'Show '+id,poster_path:'/en.jpg'}))];
	 if(sql.includes('FROM show WHERE tmdb_id = ?'))return [{...s.canonical.details,media_type:'show'}];
	 if(sql.includes('FROM translation'))return s.titleTranslations;
	 if(sql.includes('FROM episode_translation'))return s.episodeRows;
	 if(sql.includes('FROM media_image'))return [{media_type:'show',media_tmdb_id:1396,language_code:'en',url_path:'/english-localized.jpg',tmdb_vote_average:9,tmdb_vote_count:10,width:500,height:750}];
	 return [];
	}`
		if (url.endsWith("/utils/auth.ts"))
			source = `export const getUserIdFromRequest=async()=>null`
		if (url.endsWith("/talked-about-now/flags.server.ts"))
			source = `export const talkedAboutNowMode=()=>"on";export const talkedAboutNowEnabled=()=>true`
		if (url.endsWith("/talked-about-now/start-row.server.ts"))
			source = `export const getTalkedAboutNow=async()=>globalThis.__mediaRolloutTest.talkedRow`
		if (url.endsWith("/media-context.server.ts"))
			source = `export const resolveMediaContext=async()=>{globalThis.__mediaRolloutTest.live++;return {effectiveContext:{country:'FR',language:'fr'}}}`
		if (url.endsWith("/title-details-cache.ts"))
			source = `export const createTitleDetailsGetters=()=>({getDetailsForMovie:async()=>globalThis.__mediaRolloutTest.canonical,getDetailsForShow:async()=>globalThis.__mediaRolloutTest.canonical});export const DETAILS_MISSING_CACHE_NAME='details-missing-v1', DETAILS_MISSING_TTL_SECONDS=60,DETAILS_MOVIE_CACHE_NAME='details-movie-v2',DETAILS_SHOW_CACHE_NAME='details-show-v3',DETAILS_TTL_MINUTES=720,DETAILS_STALE_MINUTES=720`
		return source
			? { format: "module", source, shortCircuit: true }
			: next(url, context)
	},
})
const {
	apiDisplayLanguage,
	mediaApiCacheControl,
	localizeApiTitlePayload,
	localizeTitlePayload,
	presentCatalogLoader,
} = await import("./media-payload.server.ts")
const { getDetailsForShow } = await import("./details.server.ts")
const { overlayAlignedGrid, resetEpisodeTextCacheForTest } = await import(
	"./episode-text-overlay.server.ts"
)
const { resetMediaOverlayCacheForTest } = await import(
	"./media-overlay.server.ts"
)
const { canonicalMediaTitle, mediaFieldLanguage } = await import(
	"../utils/media-presentation.ts"
)
const { loader: previewLoader } = await import("../routes/api.media-title.ts")
const { loader: talkedLoader } = await import("../routes/api.talked-about-now.ts")
const rows = (count: number, start = 1) =>
	Array.from({ length: count }, (_, i) => ({
		key: `movie:${start + i}`,
		title: `Movie ${start + i}`,
		type: "movie",
		poster: "/en.jpg",
		year: "2020",
		score: count - i,
	}))
const count = () => ({
	total: state.queries.length,
	catalog: state.queries.filter((s) => s.includes("UNION ALL")).length,
	text: state.queries.filter((s) => s.includes("FROM translation WHERE"))
		.length,
	posters: state.queries.filter((s) => s.includes("FROM media_image")).length,
	metadata: state.queries.filter((s) => s.includes("information_schema"))
		.length,
	episodes: state.queries.filter((s) => s.includes("FROM episode_translation"))
		.length,
	seasons: state.queries.filter((s) => s.includes("FROM season_translation"))
		.length,
})
beforeEach(() => {
	resetMediaOverlayCacheForTest()
	resetEpisodeTextCacheForTest()
	state.queries.length = 0
	state.cache.clear()
	state.live = 0
	state.episodeRows = []
	state.titleTranslations = []
})

test("new start-row reader overlays after canonical ranking, with canonical links and literal social text", async () => {
	state.titleTranslations = [{media_type:"movie",media_tmdb_id:603,language_code:"fr",country_code:"FR",title:"La Matrice"}]
	const canonical = structuredClone(state.talkedRow)
	const request = (suffix: string) => ({request:new Request(`https://goodwatch.test/api/talked-about-now${suffix}`),params:{},context:{}})
	const legacy = await talkedLoader(request(""))
	assert.equal((await legacy.json()).row?.titles[0].title, "Movie 603")
	assert.equal(state.queries.length, 0)
	const response = await talkedLoader(request("?displayLanguage=fr"))
	const answer = await response.json()
	assert.ok(answer.row)
	const title = answer.row.titles[0]
	assert.equal(title.title, "La Matrice")
	assert.equal(canonicalMediaTitle(title), "Movie 603")
	assert.match(mediaFieldLanguage(title), /^fr/)
	assert.equal(title.rank, 1)
	assert.equal(title.items[0].text, "Literal post")
	assert.equal(state.queries.length, 3)
	assert.deepEqual(state.talkedRow, canonical)
})

test("new API + legacy request is canonical despite a French cookie/browser; explicit URL opts in", async () => {
	const payload = { rows: rows(2) }
	const old = new Request(
		"https://goodwatch.test/api/command-palette?q=movie",
		{
			headers: {
				"Accept-Language": "fr",
				Cookie: "gw_loc=ignored-by-legacy-request",
			},
		},
	)
	assert.equal(apiDisplayLanguage(old), undefined)
	assert.equal(await localizeApiTitlePayload(payload, old), payload)
	assert.equal(
		await presentCatalogLoader(async () => Response.json(payload), {
			live: true,
		})({ request: old })
			.then((r) => r.json())
			.then((r) => r.rows[0].title),
		"Movie 1",
	)
	assert.equal(state.queries.length, 0)
	assert.equal(state.live, 0)
	const current = new Request(old.url + "&displayLanguage=fr")
	const answer = await localizeApiTitlePayload(payload, current)
	assert.equal(mediaFieldLanguage(answer.rows[0]), "en")
	assert.equal(count().total, 3)
})
test("new consumers tolerate an old canonical payload with no provenance or canonical_title", () => {
	const old = { title: "The Matrix", poster: "/poster.jpg" }
	assert.equal(canonicalMediaTitle(old), "The Matrix")
	assert.equal(mediaFieldLanguage(old), "en")
})
test("live HTML resolves the recipient language while legacy APIs and crawlers stay canonical", async () => {
	const payload = { rows: rows(1) }
	await presentCatalogLoader(async () => payload, { live: true })({
		request: new Request("https://goodwatch.test/discover?displayLanguage=ja"),
	})
	assert.equal(state.live, 1)
	state.queries.length = 0
	assert.equal(
		apiDisplayLanguage(
			new Request(
				"https://goodwatch.test/api/command-palette?displayLanguage=fr",
				{ headers: { "User-Agent": "Googlebot" } },
			),
		),
		undefined,
	)
	assert.equal(state.queries.length, 0)
	const bot = new Request(
		"https://goodwatch.test/api/related-map?displayLanguage=fr",
		{ headers: { "User-Agent": "Googlebot" } },
	)
	assert.equal(
		mediaApiCacheControl(bot, "public, max-age=3600"),
		"private, no-store",
	)
	assert.equal(
		mediaApiCacheControl(new Request(bot.url), "public, max-age=3600"),
		"public, max-age=3600",
	)
})
test("show details + related cards + aligned episodes: cold 8 overlay queries, warm 0, no N+1", async () => {
	const scores = {
		imdb: null,
		tmdb: null,
		tomatometer: null,
		popcornmeter: null,
		metascore: null,
		metacriticUser: null,
	}
	const grid = {
		showId: 1396,
		seasons: [
			{
				number: 1,
				episodes: Array.from({ length: 62 }, (_, i) => ({
					number: i + 1,
					tmdbId: 100 + i,
					name: `Episode ${i + 1}`,
					score: 8,
					votes: 10,
				})),
				maxEpisodeNumber: 62,
				scores,
			},
		],
		specials: [],
		maxEpisodeNumber: 62,
		hasEpisodeZero: false,
		providers: [],
	}
	const render = async () => {
		const details = await getDetailsForShow({
			showId: "1396",
			country: "FR",
			language: "fr",
		})
		await localizeTitlePayload({ rows: rows(40) }, "fr")
		await overlayAlignedGrid(grid, "fr")
	}
	await render()
	assert.deepEqual(count(), {
		total: 8,
		catalog: 2,
		text: 2,
		posters: 2,
		metadata: 1,
		episodes: 1,
		seasons: 0,
	})
	state.queries.length = 0
	await render()
	assert.deepEqual(count(), {
		total: 0,
		catalog: 0,
		text: 0,
		posters: 0,
		metadata: 0,
		episodes: 0,
		seasons: 0,
	})
	assert.equal(state.canonical.details.title, "Breaking Bad")
})
test("search provisional/final/fallback and Discover batch whole sets after canonical order", async () => {
	const provisional = { rows: rows(20) },
		final = { rows: rows(100) }
	await localizeApiTitlePayload(
		provisional,
		new Request(
			"https://goodwatch.test/api/combined-search?displayLanguage=fr",
		),
	)
	const result = await localizeApiTitlePayload(
		final,
		new Request(
			"https://goodwatch.test/api/combined-search?displayLanguage=fr",
		),
	)
	assert.equal(count().total, 6)
	assert.deepEqual(
		result.rows.map((r) => r.score),
		final.rows.map((r) => r.score),
	)
	state.queries.length = 0
	await localizeTitlePayload(final, "fr")
	assert.equal(count().total, 0)
	state.cache.clear()
	state.queries.length = 0
	await localizeTitlePayload({ results: { movies: rows(60) } }, "ja")
	assert.deepEqual(count(), {
		total: 3,
		catalog: 1,
		text: 1,
		posters: 1,
		metadata: 0,
		episodes: 0,
		seasons: 0,
	})
	state.cache.clear()
	state.queries.length = 0
	await localizeTitlePayload({ rows: rows(401) }, "de")
	assert.equal(count().total, 9)
})
test("page prose remains canonical and never requests a prose source table", async () => {
	const payload = {
		rows: rows(1),
		identity: { name: "The Explorer" },
		line: "Your taste in films",
		pageData: {
			description: "Canonical category description",
			faq: [{ q: "Why?", a: "Because." }],
		},
		essence_text: "An atmospheric journey",
		essence_tags: ["beautiful", "intense"],
	}
	const result = await localizeTitlePayload(payload, "ja")
	assert.deepEqual(result.identity, payload.identity)
	assert.equal(result.line, payload.line)
	assert.deepEqual(result.pageData, payload.pageData)
	assert.equal(result.essence_text, payload.essence_text)
	assert.deepEqual(result.essence_tags, payload.essence_tags)
	assert.equal(
		state.queries.some((sql) => sql.includes("prose_translation")),
		false,
	)
})
test("media-only preview separates canonical crawlers from English presentation cache entries", async () => {
	const request = new Request(
		"https://goodwatch.test/api/media-title?type=show&id=1396&displayLanguage=en",
	)
	const response = await previewLoader({ request, params: {}, context: {} })
	const live = await response.json()
	assert.ok("title" in live)
	assert.equal(live.title.poster_path, "/en.jpg")
	assert.equal("essence_text" in live.title, false)
	assert.equal("prosePresentation" in live.title, false)
	assert.match(response.headers.get("Cache-Control")!, /public/)
	state.queries.length = 0
	const bot = await previewLoader({
		request: new Request(request.url, {
			headers: { "User-Agent": "Googlebot" },
		}),
		params: {},
		context: {},
	})
	const canonical = await bot.json()
	assert.ok("title" in canonical)
	assert.equal(canonical.title.poster_path, "/en.jpg")
	assert.equal(state.queries.length, 1)
	assert.match(bot.headers.get("Cache-Control")!, /private, no-store/)
	assert.equal(
		state.queries.some(
			(sql) => sql.includes("essence") || sql.includes("prose_translation"),
		),
		false,
	)
})

test("a 2,100-episode show reuses one complete show source across page chunks and subsequent grids", async () => {
	state.episodeRows = Array.from({ length: 2101 }, (_, i) => ({
		show_id: 1396,
		tmdb_id: i + 1,
		language_code: "fr",
		country_code: "FR",
		name: `Épisode ${i + 1}`,
		overview: "Résumé",
	}))
	const grid = {
		showId: 1396,
		seasons: [],
		specials: Array.from({ length: 2100 }, (_, i) => ({
			number: i + 1,
			tmdbId: i + 1,
			name: `Episode ${i + 1}`,
			score: 8,
			votes: 10,
		})),
		maxEpisodeNumber: 2100,
		hasEpisodeZero: false,
		providers: [],
	}
	const first = await overlayAlignedGrid(grid, "fr")
	assert.equal(
		first.specials.length,
		2100,
		"an unrequested translation cannot create an episode",
	)
	assert.equal(first.specials[2099].name, "Épisode 2100")
	assert.equal(count().episodes, 1)
	state.queries.length = 0
	await overlayAlignedGrid(grid, "fr")
	assert.equal(
		count().total,
		0,
		"large shows do not cycle through an episode-key LRU",
	)
})
