import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"
import {
	createMediaOverlay,
	overlayMediaRow,
	translationCandidates,
	type Sources,
	type CanonicalMediaRow,
	type OverlayQuery,
} from "../utils/media-overlay-core.ts"
import {
	mediaLanguageUrl,
	canonicalMediaTitle,
} from "../utils/media-presentation.ts"
const { localizeTitlePayload } = await import("../utils/media-payload-core.ts")
const { overlayEpisodeText, createEpisodeTextReader, overlayAlignedGrid } =
	await import("../utils/episode-text-overlay.ts")
const { matchEpisodeRatings } = await import(
	"../domain/tracking/episode-ratings.ts"
)
const { getQueryKeyRelatedPanel, relatedPanelUrl } = await import(
	"../utils/related-panel.ts"
)
const { movieCollectionQueryKey } = await import("../utils/title-extras.ts")
const row: CanonicalMediaRow = {
	media_type: "movie",
	tmdb_id: 42,
	title: "Canonical",
	original_title: "原題",
	original_language_code: "ja",
	poster_path: "/en.jpg",
	synopsis: "English overview",
	tagline: "English tagline",
}
const sources: Sources = {
	canonical: [row],
	translations: [
		{
			media_tmdb_id: 42,
			media_type: "movie",
			language_code: "fr",
			country_code: "FR",
			title: "   ",
			overview: "Description française",
			tagline: null,
		},
		{
			media_tmdb_id: 42,
			media_type: "movie",
			language_code: "fr",
			country_code: "CA",
			title: "Titre",
			overview: "Québec",
			tagline: "Tagline française",
		},
	],
	posters: [
		{
			media_tmdb_id: 42,
			media_type: "movie",
			language_code: "en",
			url_path: "/en.jpg",
			width: 500,
			height: 750,
			tmdb_vote_average: 8,
			tmdb_vote_count: 9,
		},
		{
			media_tmdb_id: 42,
			media_type: "movie",
			language_code: "fr",
			url_path: "/fr.jpg",
			width: 500,
			height: 750,
			tmdb_vote_average: 9,
			tmdb_vote_count: 4,
		},
	],
}

test("per-field nonblank fallback and actual source provenance, without mutation", () => {
	const before = structuredClone({ row, sources })
	Object.freeze(row)
	sources.translations.forEach(Object.freeze)
	sources.posters.forEach(Object.freeze)
	const french = overlayMediaRow(row, "fr", sources)
	assert.equal(french.title, "Titre")
	assert.equal(french.synopsis, "Description française")
	assert.equal(french.tagline, "Tagline française")
	assert.equal(french.poster_path, "/fr.jpg")
	assert.equal(french.presentation.title.language, "fr-CA")
	assert.equal(french.presentation.overview.language, "fr-FR")
	assert.equal(french.presentation.poster.language, "fr")
	assert.equal(canonicalMediaTitle(french), "Canonical")
	assert.equal(french.presentation.title.source, "localized")
	assert.deepEqual({ row, sources }, before)
	const japanese = overlayMediaRow(row, "ja", sources)
	assert.equal(japanese.title, "原題")
	assert.equal(japanese.presentation.title.source, "original")
	assert.equal(japanese.presentation.title.language, "ja")
	assert.equal(japanese.synopsis, "English overview")
	assert.equal(japanese.presentation.overview.language, "en")
	assert.equal(japanese.presentation.overview.fallback, true)
	const german = overlayMediaRow(row, "de", sources)
	assert.equal(german.title, "Canonical")
	assert.equal(german.poster_path, "/en.jpg")
	assert.equal(german.presentation.poster.language, "en")
	assert.equal(
		overlayMediaRow({ ...row, poster_path: "/unknown.jpg" }, "de", sources)
			.presentation.poster.language,
		"und",
	)
})
test("Portuguese regions and Chinese script families do not borrow across variants", () => {
	const regions = ["BR", "PT"].map((country_code) => ({
		language_code: "pt",
		country_code,
	}))
	assert.deepEqual(
		translationCandidates(regions, "pt-BR").map((r) => r.country_code),
		["BR"],
	)
	const chinese = ["TW", "CN", "HK", "SG", "MO"].map((country_code) => ({
		language_code: "zh",
		country_code,
	}))
	assert.deepEqual(
		translationCandidates(chinese, "zh-Hans").map((r) => r.country_code),
		["CN", "SG"],
	)
	assert.deepEqual(
		translationCandidates(chinese, "zh-Hant").map((r) => r.country_code),
		["TW", "HK", "MO"],
	)
})
test("one source statement per table per deduplicated batch; input order and missing works survive", async () => {
	const calls: string[] = []
	const read: OverlayQuery = async <T extends {}>(sql: string) => {
		calls.push(sql)
		return [] as T[]
	}
	const overlay = createMediaOverlay(read)
	const rows = Array.from({ length: 201 }, (_, i) => ({
		...row,
		tmdb_id: i + 1,
		score: 201 - i,
	}))
	const result = await overlay([...rows, rows[0]], "de")
	assert.equal(calls.length, 6)
	assert.equal(calls.filter((s) => s.includes("FROM translation")).length, 2)
	assert.equal(calls.filter((s) => s.includes("FROM media_image")).length, 2)
	assert.deepEqual(
		result.map((r) => r.tmdb_id),
		[...rows, rows[0]].map((r) => r.tmdb_id),
	)
	assert.equal(result.length, 202)
	assert.equal(result[0].score, rows[0].score)
	assert.notEqual(result[0], rows[0])
	assert.deepEqual(await overlay([], "fr"), [])
	assert.equal(calls.length, 6)
})
test("source cache key is sorted IDs and language; cache failure preserves the entity", async () => {
	const keys: unknown[] = []
	const read: OverlayQuery = async <T extends {}>() => [] as T[]
	const overlay = createMediaOverlay(read, async (params, get) => {
		keys.push(params)
		return get()
	})
	await overlay([row], "pt-BR")
	await overlay([row], "pt-PT")
	assert.notDeepEqual(keys[0], keys[1])
	const failed = createMediaOverlay(async () => {
		throw new Error("offline fixture")
	})
	const saved = console.error
	console.error = () => {}
	try {
		assert.equal((await failed([row], "fr"))[0].title, "Canonical")
	} finally {
		console.error = saved
	}
})
test("graph adapter batches movies, shows, camel-case search/palette and share-card aliases without touching people or ranks", async () => {
	const payload = {
		movies: [
			{ tmdb_id: 42, title: "Canonical", poster_path: "/en.jpg", score: 90 },
		],
		people: [
			{
				tmdb_id: 42,
				name: "Actor",
				known_for: [
					{
						mediaType: "movie",
						tmdbId: 42,
						title: "Canonical",
						posterPath: "/en.jpg",
					},
				],
			},
		],
		items: [
			{
				key: "movie:42",
				type: "movie",
				title: "Canonical",
				poster: "https://image.tmdb.org/t/p/w500/en.jpg",
			},
		],
	}
	const before = structuredClone(payload)
	let batches = 0
	const result = await localizeTitlePayload(
		payload,
		"fr",
		undefined,
		async (rows) => {
			batches++
			return rows.map((r) => overlayMediaRow(r, "fr", sources))
		},
	)
	assert.equal(batches, 1)
	assert.equal(result.movies[0].title, "Titre")
	assert.equal(result.movies[0].score, 90)
	assert.equal(result.people[0].name, "Actor")
	assert.equal(result.people[0].known_for[0].posterPath, "/fr.jpg")
	assert.equal(result.items[0].poster, "https://image.tmdb.org/t/p/w500/fr.jpg")
	assert.deepEqual(payload, before)
})
test("public API addresses and SSR query keys separate display languages", () => {
	assert.notEqual(
		mediaLanguageUrl("/api/media-title?type=movie&id=42", "fr"),
		mediaLanguageUrl("/api/media-title?type=movie&id=42", "en"),
	)
	const params = { tmdbId: 42, sourceMediaType: "movie" as const }
	assert.notDeepEqual(
		getQueryKeyRelatedPanel({ ...params, language: "fr" }),
		getQueryKeyRelatedPanel({ ...params, language: "de" }),
	)
	assert.match(
		relatedPanelUrl({ ...params, language: "zh-Hant" }),
		/displayLanguage=zh-Hant/,
	)
	assert.notDeepEqual(
		movieCollectionQueryKey("1", "42", "fr"),
		movieCollectionQueryKey("1", "42", "de"),
	)
})
test("episode overlay follows canonical name matching, stable IDs and preserves rating coverage; translation rows cannot invent episodes", async () => {
	const episodes = [
		{ id: 70, season: 1, number: 1, name: "Pilot", overview: "English" },
	]
	const matched = matchEpisodeRatings(episodes, [
		{
			number: 2,
			episodes: [{ number: 1, name: "Pilot", score: 8, votes: 20 }],
		},
	])
	const rated = episodes.map((e) => ({
		...e,
		rating: matched.byEpisode.get(e.id)?.score ?? null,
	}))
	const result = await overlayEpisodeText(
		"episode",
		10,
		rated,
		"fr",
		async () =>
			[70, 71].map((tmdb_id) => ({
				show_id: 10,
				tmdb_id,
				language_code: "fr",
				country_code: "FR",
				name: "Épisode pilote",
				overview: "Résumé",
			})),
	)
	assert.equal(result.length, 1)
	assert.equal(result[0].id, 70)
	assert.equal(result[0].rating, rated[0].rating)
	assert.equal(result[0].name, "Épisode pilote")
	assert.equal(result[0].textPresentation.name.language, "fr-FR")
	assert.equal(episodes[0].name, "Pilot")
	let reads = 0
	const absent = createEpisodeTextReader(
		async () => {
			reads++
			return []
		},
		async () => [],
	)
	assert.equal(
		(await overlayEpisodeText("episode", 10, episodes, "fr", absent))[0].name,
		"Pilot",
	)
	assert.equal(reads, 0)
})
test("grid overlays only proved TMDB IDs, never equal season/episode numbers", async () => {
	const scores = {
		imdb: null,
		tmdb: null,
		tomatometer: null,
		popcornmeter: null,
		metascore: null,
		metacriticUser: null,
	}
	const grid = {
		showId: 10,
		seasons: [
			{
				number: 8,
				maxEpisodeNumber: 2,
				scores,
				episodes: [
					{ number: 1, tmdbId: 70, name: "Pilot", score: 8, votes: 4 },
					{ number: 2, name: "Unmatched IMDb", score: 7, votes: 8 },
				],
			},
		],
		specials: [],
		maxEpisodeNumber: 2,
		hasEpisodeZero: false,
		providers: [],
	}
	const translated = await overlayAlignedGrid(
		grid,
		"fr",
		async (_kind, _show, ids) => {
			assert.deepEqual(ids, [70])
			return [
				{
					show_id: 10,
					tmdb_id: 70,
					language_code: "fr",
					country_code: "FR",
					name: "Pilote",
					overview: null,
				},
			]
		},
	)
	assert.equal(translated.seasons[0].episodes[0].name, "Pilote")
	assert.equal(translated.seasons[0].episodes[1].name, "Unmatched IMDb")
	assert.equal(translated.seasons[0].episodes[1].nameLanguage, "und")
	assert.equal(grid.seasons[0].episodes[0].name, "Pilot")
})

test("TMDB-only fallback and known-for id/type rows localize without changing people", async () => {
	const payload = {
		people: [
			{
				id: 42,
				name: "Actor",
				knownFor: [
					{ type: "movie", id: 42, title: "Canonical", poster: "/en.jpg" },
				],
			},
		],
		rows: [{ type: "movie", id: 42, title: "Canonical", score: 0.3 }],
	}
	const localized = await localizeTitlePayload(
		payload,
		"fr",
		undefined,
		async (rows) => rows.map((row) => overlayMediaRow(row, "fr", sources)),
	)
	assert.equal(localized.people[0].name, "Actor")
	assert.equal(localized.people[0].knownFor[0].title, "Titre")
	assert.equal(localized.rows[0].score, 0.3)
})

test("Next episode rows across shows share a table batch and respect show identity", async () => {
	const { overlayEpisodeTextGroups } = await import(
		"../utils/episode-text-overlay.ts"
	)
	let queries = 0
	const groups = [
		{ showId: 1, rows: [{ id: 70, name: "Pilot" }] },
		{ showId: 2, rows: [{ id: 71, name: "First" }] },
	]
	const localized = await overlayEpisodeTextGroups(
		"episode",
		groups,
		"fr",
		async (_kind, refs) => {
			queries++
			assert.deepEqual(refs, [
				{ showId: 1, id: 70 },
				{ showId: 2, id: 71 },
			])
			return [
				{
					show_id: 1,
					tmdb_id: 70,
					language_code: "fr",
					country_code: "FR",
					name: "Pilote",
					overview: null,
				},
				{
					show_id: 1,
					tmdb_id: 71,
					language_code: "fr",
					country_code: "FR",
					name: "Wrong show",
					overview: null,
				},
			]
		},
	)
	assert.equal(queries, 1)
	assert.equal(localized[0].rows[0].name, "Pilote")
	assert.equal(localized[1].rows[0].name, "First")
})

test("browser exploration discards only old-language display data and preserves filter/navigation state", async () => {
	const { explorationForLanguage } = await import(
		"../ui/taste/exploration-cache.ts"
	)
	const saved = {
		titles: [{ presentation: { language: "fr" } }],
		ratingQueue: [],
		selectedMedia: null,
		filters: { type: "show" },
		scrollY: 50,
	}
	assert.equal(explorationForLanguage(saved, "fr"), saved)
	const fresh = explorationForLanguage(saved, "ja")
	assert.equal(fresh.titles, undefined)
	assert.deepEqual(fresh.filters, saved.filters)
	assert.equal(fresh.scrollY, 50)
	assert.equal(saved.titles.length, 1)
})

test("card projections keep localized labels without shipping unconsumed overviews", async () => {
	const { copyPresentationFields } = await import(
		"../utils/media-overlay-core.ts"
	)
	const thin = {
		media_type: "movie" as const,
		tmdb_id: 42,
		title: "Canonical",
		poster_path: "/en.jpg",
		tagline: null,
	}
	const presented = copyPresentationFields(
		thin,
		overlayMediaRow(thin, "fr", sources),
	)
	assert.equal(presented.title, "Titre")
	assert.equal(presented.poster_path, "/fr.jpg")
	assert.ok(!("synopsis" in presented))
	assert.equal(presented.presentation.overview.language, "fr-FR")
	assert.equal(thin.title, "Canonical")
})

test("a non-English legacy upstream read prefers canonical Crate fallback or retains unknown provenance for catalog gaps", () => {
	const foreign = {
		...row,
		title: "Upstream foreign name",
		canonical_language: "und",
	}
	const fromCrate = overlayMediaRow(foreign, "de", sources)
	assert.equal(fromCrate.title, "Canonical")
	assert.equal(fromCrate.presentation.title.language, "en")
	const gap = overlayMediaRow(foreign, "de", {
		canonical: [],
		translations: [],
		posters: [],
	})
	assert.equal(gap.title, "Upstream foreign name")
	assert.equal(gap.presentation.title.language, "und")
})

test("TMDB television name/original_name aliases retain localized values and canonical paths", async () => {
	const showSources: Sources = {
		canonical: [{ ...row, media_type: "show" }],
		translations: sources.translations.map((t) => ({
			...t,
			media_type: "show",
		})),
		posters: [],
	}
	const payload = [
		{
			id: 42,
			media_type: "show",
			name: "Canonical",
			original_name: "原題",
			original_language: "ja",
			poster_path: "/en.jpg",
		},
	]
	const translated = await localizeTitlePayload(
		payload,
		"fr",
		undefined,
		async (rows) => rows.map((r) => overlayMediaRow(r, "fr", showSources)),
	)
	assert.equal(translated[0].name, "Titre")
	assert.equal(payload[0].name, "Canonical")
})
