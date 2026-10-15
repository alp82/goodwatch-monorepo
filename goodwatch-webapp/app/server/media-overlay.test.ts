import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"
import {
	createMediaOverlay,
	overlayMediaRow,
	translationCandidates,
	overlayMediaRows,
	type PosterRow,
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

test("mislabeled Latin text in non-Latin translations falls back per field with actual language", () => {
	const arabic: Sources = {
		...sources,
		translations: [
			{
				media_tmdb_id: 42,
				media_type: "movie",
				language_code: "ar",
				country_code: "SA",
				title: "Sword Art Online",
				overview: "بداية رحلة جديدة",
				tagline: "An English tagline",
			},
		],
	}
	const result = overlayMediaRow(row, "ar", arabic)
	assert.equal(result.title, "Canonical")
	assert.equal(result.presentation.title.language, "en")
	assert.equal(result.presentation.title.source, "canonical")
	assert.equal(result.synopsis, "بداية رحلة جديدة")
	assert.equal(result.presentation.overview.language, "ar-SA")
	assert.equal(result.tagline, "English tagline")
	assert.equal(result.presentation.tagline.language, "en")
	const badOriginal = {
		...row,
		original_title: "Sword Art Online",
		original_language_code: "ar",
	}
	const fallback = overlayMediaRow(badOriginal, "ar", {
		...arabic,
		canonical: [badOriginal],
		translations: [],
	})
	assert.equal(fallback.title, "Canonical")
	assert.equal(fallback.presentation.title.source, "canonical")
	const titleless = { ...badOriginal, title: "" }
	assert.equal(
		overlayMediaRow(titleless, "ar", {
			...arabic,
			canonical: [titleless],
			translations: [],
		}).presentation.title.language,
		"und",
	)
})
test("season/episode candidates reject mislabeled fields without hiding canonical membership", async () => {
	for (const kind of ["season", "episode"] as const) {
		const translated = await overlayEpisodeText(
			kind,
			1396,
			[{ id: 62085, name: "Pilot", overview: "Canonical overview" }],
			"ar",
			async () => [
				{
					show_id: 1396,
					tmdb_id: 62085,
					language_code: "ar",
					country_code: "SA",
					name: "Pilot",
					overview: "البداية",
				},
			],
		)
		assert.equal(translated.length, 1)
		assert.equal(translated[0].name, "Pilot")
		assert.equal(translated[0].textPresentation.name.language, "en")
		assert.equal(translated[0].overview, "البداية")
		assert.equal(translated[0].textPresentation.overview.language, "ar-SA")
	}
})

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
	const overlay = createMediaOverlay(read, {
		read: async (ids, language) => {
			keys.push({ keys: ids, language })
			return new Map()
		},
		write: async () => {},
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
		titles: [overlayMediaRow(row, "fr", sources)],
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

test("500 titles × 100 posters scan each source once, independent of machine load", (t) => {
	const canonical = Array.from({ length: 500 }, (_, i) => ({
		...row,
		tmdb_id: i + 1,
	}))
	const posters: PosterRow[] = canonical.flatMap((media) =>
		Array.from({ length: 100 }, (_, i) => ({
			...sources.posters[0],
			media_tmdb_id: media.tmdb_id,
			language_code: i === 0 ? "en" : "fr",
			url_path: i === 0 ? "/en.jpg" : `/fr-${i}.jpg`,
			tmdb_vote_average: i % 10,
			tmdb_vote_count: i,
		})),
	)
	const translations = canonical.map((media) => ({
		...sources.translations[1],
		media_tmdb_id: media.tmdb_id,
	}))
	const data = { canonical, translations, posters }
	const references = [...canonical, ...canonical]
	overlayMediaRows(references, "fr", data) // Warm the JIT; construction and DB latency are outside this CPU test.
	const elapsed: number[] = []
	for (let i = 0; i < 5; i++) {
		const start = performance.now()
		const result = overlayMediaRows(references, "fr", data)
		elapsed.push(performance.now() - start)
		assert.equal(result.length, 1000)
		assert.equal(result[0].title, "Titre")
		assert.equal(result[999].poster_path, "/fr-99.jpg")
	}
	const median = elapsed.sort((a, b) => a - b)[2]
	t.diagnostic(
		`500 unique titles, 1,000 references, 50,000 posters: median ${median.toFixed(2)} ms`,
	)
	// Source visitation is a deterministic regression guard; wall time remains diagnostic only.
	const visited = { canonical: 0, translations: 0, posters: 0 }
	const counted = <T>(items: T[], kind: keyof typeof visited): T[] =>
		new Proxy(items, {
			get(target, key, receiver) {
				if (typeof key === "string" && /^\d+$/.test(key)) visited[kind]++
				return Reflect.get(target, key, receiver)
			},
		})
	overlayMediaRows(references, "fr", {
		canonical: counted(canonical, "canonical"),
		translations: counted(translations, "translations"),
		posters: counted(posters, "posters"),
	})
	assert.deepEqual(visited, {
		canonical: 500,
		translations: 500,
		posters: 50000,
	})
})

test("poster SQL restricts candidate languages or canonical paths, and overlapping batches reuse per-title sources", async () => {
	const entries = new Map<string, Sources>(),
		calls: { sql: string; params: unknown[] }[] = []
	const cache = {
		read: async (keys: readonly string[], language: string) =>
			new Map(
				keys.flatMap((key) =>
					entries.has(`${language}:${key}`)
						? [[key, entries.get(`${language}:${key}`)!] as const]
						: [],
				),
			),
		write: async (values: ReadonlyMap<string, Sources>, language: string) => {
			for (const [key, value] of values)
				entries.set(`${language}:${key}`, value)
		},
	}
	const read: OverlayQuery = async <T extends {}>(
		sql: string,
		params: (string | number | Date)[] = [],
	) => {
		calls.push({ sql, params })
		return [] as T[]
	}
	const overlay = createMediaOverlay(read, cache)
	await overlay([row, { ...row, tmdb_id: 43 }], "fr")
	await overlay(
		[
			{ ...row, tmdb_id: 43 },
			{ ...row, tmdb_id: 44 },
		],
		"fr",
	)
	assert.equal(calls.length, 6)
	assert.deepEqual(calls[3].params[0], [44])
	const posters = calls.find((call) => call.sql.includes("FROM media_image"))!
	assert.match(posters.sql, /language_code = ANY\(\?\) OR url_path = ANY\(\?\)/)
	assert.deepEqual(posters.params.slice(2), [["fr"], ["/en.jpg"]])
	await overlay([row, { ...row, tmdb_id: 43 }], "fr")
	assert.equal(calls.length, 6)
	await overlay([row], "en")
	assert.equal(
		calls.length,
		6,
		"English-equivalent projections never read translation or poster sources",
	)
})

test("payload adapters skip completed overlays and cap Explorer source work without hiding canonical tail titles", async () => {
	let calls = 0,
		size = 0
	const presented = overlayMediaRow(row, "fr", sources)
	const existing = { movies: [presented] }
	const fake = async <T extends CanonicalMediaRow>(
		rows: readonly T[],
		language: string,
	) => {
		calls++
		size = rows.length
		return overlayMediaRows(rows, language, sources)
	}
	assert.equal(
		await localizeTitlePayload(existing, "fr", undefined, fake),
		existing,
	)
	assert.equal(calls, 0)
	const payload = {
		movies: Array.from({ length: 250 }, (_, i) => ({ ...row, tmdb_id: i + 1 })),
	}
	const result = await localizeTitlePayload(payload, "fr", undefined, fake, {
		maxTitles: 200,
	})
	assert.equal(size, 200)
	assert.equal(result.movies.length, 250)
	assert.ok("presentation" in result.movies[199])
	assert.ok(!("presentation" in result.movies[200]))
})

test("an Explorer world as large as production's localizes every grouping in four batches at the 800 cap", async () => {
	// About the size of the production world for a guest with ten ratings: seven maps, 1,166 title cards, 704 unique
	// titles.
	const unique = 704
	const world = {
		maps: Array.from({ length: 7 }, (_, m) => ({
			grouping: `g${m}`,
			islands: Array.from({ length: 10 }, (_, j) => ({
				id: `i${j}`,
				titles: Array.from({ length: 17 }, (_, k) => {
					const id = ((m * 10 + j) * 17 + k) % unique
					return {
						key: 1000000000000 + id + 1,
						mediaType: "movie",
						tmdbId: id + 1,
						title: `Title ${id + 1}`,
						poster: "/en.jpg",
					}
				}),
			})),
		})),
	}
	const statements = (cap: number) => {
		const calls: string[] = []
		const read: OverlayQuery = async <T extends {}>(
			sql: string,
			params: (string | number | Date)[] = [],
		) => {
			calls.push(sql)
			if (!sql.includes("FROM translation")) return [] as T[]
			return (params[0] as unknown as number[]).map((id) => ({
				media_tmdb_id: id,
				media_type: "movie",
				language_code: "de",
				country_code: "DE",
				title: `Titel ${id}`,
				overview: null,
				tagline: null,
			})) as unknown as T[]
		}
		return {
			calls,
			result: localizeTitlePayload(
				world,
				"de",
				undefined,
				createMediaOverlay(read),
				{ maxTitles: cap },
			),
		}
	}
	const titlesOf = (value: typeof world) =>
		value.maps.flatMap((map) => map.islands.flatMap((island) => island.titles))
	assert.equal(titlesOf(world).length, 1190)
	assert.equal(new Set(titlesOf(world).map((t) => t.tmdbId)).size, unique)

	const before = statements(200)
	const old = titlesOf(await before.result)
	assert.equal(before.calls.length, 3)
	assert.equal(
		new Set(old.filter((t) => t.title.startsWith("Titel")).map((t) => t.tmdbId))
			.size,
		200,
	)

	const after = statements(800)
	const all = titlesOf(await after.result)
	assert.equal(
		after.calls.length,
		12,
		"four batches of 200, three statements each",
	)
	assert.ok(all.every((t) => t.title === `Titel ${t.tmdbId}`))
	assert.equal(all.length, 1190)
})

test("English season, episode and grouped text return canonical provenance without a source read", async () => {
	const { overlayEpisodeTextGroups } = await import(
		"../utils/episode-text-overlay.ts"
	)
	const fail = async () => {
		throw new Error("English must not query translations")
	}
	for (const kind of ["season", "episode"] as const) {
		const result = await overlayEpisodeText(
			kind,
			1,
			[{ id: 70, name: "Pilot" }],
			"en",
			fail,
		)
		assert.equal(result[0].name, "Pilot")
		assert.equal(result[0].textPresentation.name.language, "en")
	}
	const groups = await overlayEpisodeTextGroups(
		"episode",
		[{ showId: 1, rows: [{ id: 70, name: "Pilot" }] }],
		"en",
		fail,
	)
	assert.equal(groups[0].rows[0].name, "Pilot")
})

test("cached Latin-only ar-SA presentations are repaired instead of bypassing the script guard", async () => {
	for (const title of ["Sword Art Online", "JUJUTSU KAISEN"]) {
		const base = {
			...row,
			title,
			original_title: title,
			original_language_code: "ja",
		}
		const bad = overlayMediaRow(base, "ar", {
			canonical: [base],
			translations: [],
			posters: [],
		})
		bad.presentation.title = {
			language: "ar-SA",
			source: "localized",
			fallback: false,
		}
		let calls = 0
		const result = await localizeTitlePayload(
			{ movies: [bad] },
			"ar",
			undefined,
			async (rows, language) => {
				calls++
				return overlayMediaRows(rows, language, {
					canonical: [base],
					translations: [],
					posters: [],
				})
			},
		)
		assert.equal(calls, 1)
		assert.equal(result.movies[0].title, title)
		assert.equal(result.movies[0].presentation.title.language, "en")
		assert.equal(result.movies[0].presentation.title.source, "canonical")
	}
})

test("English fast path does not mistake a prefilled original-language title for proved English", async () => {
	const original = {
		...row,
		title: "原題",
		original_title: "原題",
		original_language_code: "ja",
	}
	let queries = 0
	const overlay = createMediaOverlay(async <T extends {}>(sql: string) => {
		queries++
		return sql.includes("UNION ALL")
			? [{ ...original, title: null } as unknown as T]
			: []
	})
	const [result] = await overlay([original], "en")
	assert.equal(queries, 3)
	assert.equal(result.title, "原題")
	assert.equal(result.presentation.title.language, "ja")
})

test("concurrent page overlays share each cold title's canonical, translation and poster reads", async () => {
	const { createLocaleSourceCache } = await import(
		"./locale-source-cache.server.ts"
	)
	const cache = createLocaleSourceCache<
		import("../utils/media-overlay-core.ts").Sources
	>(() => null, {
		namespace: "overlay-flight",
		deadline: (p) => p,
		validate: (v): v is import("../utils/media-overlay-core.ts").Sources =>
			!!v && typeof v === "object",
	})
	let queries = 0,
		release!: () => void
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	const overlay = createMediaOverlay(async <T extends {}>(sql: string) => {
		queries++
		await gate
		return (sql.includes("UNION ALL") ? [row] : []) as unknown as T[]
	}, cache)
	const one = overlay([row], "fr"),
		two = overlay([row], "fr")
	release()
	const [first, second] = await Promise.all([one, two])
	assert.equal(queries, 3)
	assert.equal(first[0].title, second[0].title)
})
