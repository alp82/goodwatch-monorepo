import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type CatalogEpisode,
	type EpisodeResolverData,
	createEpisodeResolver,
} from "./episode-resolver.server.ts"

// Catalog shapes measured for #610 on 2026-10-15; episode IDs are synthetic.
// Entry identities/offsets: Anime-Lists master XML, crosswalk: Fribb/anime-lists.
function season(
	showId: number,
	seasonNumber: number,
	count: number,
	start = 1,
): CatalogEpisode[] {
	return Array.from({ length: count }, (_, index) => ({
		show_id: showId,
		tmdb_id: seasonNumber * 10000 + start + index,
		season_number: seasonNumber,
		episode_number: start + index,
		name: null,
		tvdb_id: null,
	}))
}
function resolver(
	data: Partial<EpisodeResolverData> & Pick<EpisodeResolverData, "episodes">,
) {
	return createEpisodeResolver({
		groups: async () => [],
		group: async () => {
			throw new Error("Unexpected group lookup")
		},
		findTvdb: async () => ({ tv_episode_results: [] }),
		cacheTvdb: async () => true,
		...data,
	})
}
const frieren = {
	anidbId: 18886,
	showId: 209867,
	season: 1,
	offset: 28,
	ranges: [],
	ids: { myanimelist: [59978], anilist: [182255], kitsu: [49240] },
}

test("Frieren's second entry starts at TMDB episode 29, not episode 1", async () => {
	const resolve = resolver({
		episodes: async () => season(209867, 1, 38),
		animeMappings: async () => [frieren],
	})
	assert.deepEqual(
		await resolve({
			showId: 209867,
			animeEntry: { source: "myanimelist", id: 59978, progress: 10 },
			episode: 1,
		}),
		{
			status: "matched",
			episodeTmdbId: 10029,
			season: 1,
			episode: 29,
			special: false,
		},
	)
})

test("an entry whose full progress or total exceeds the season matches nothing, even its first episode", async () => {
	const resolve = resolver({
		episodes: async () => season(209867, 1, 38),
		animeMappings: async () => [frieren],
	})
	for (const extent of [{ progress: 11 }, { progress: 1, episodeCount: 12 }]) {
		assert.deepEqual(
			await resolve({
				showId: 209867,
				animeEntry: { source: "myanimelist", id: 59978, ...extent },
				episode: 1,
				numbering: "tmdb",
				season: 1,
			}),
			{
				status: "unmatched",
				reason:
					"This anime mapping does not fit the current TMDB episode catalog.",
			},
		)
	}
})

const onePiece = {
	anidbId: 69,
	showId: 37854,
	season: "a" as const,
	offset: 0,
	ids: { myanimelist: [21], anilist: [21], kitsu: [12] },
	ranges: [
		{ start: 1, end: 61, season: 1, offset: 0 },
		{ start: 62, end: 77, season: 2, offset: -61 },
	],
}
test("One Piece episode 62 follows the master ranges in a season-relative catalog", async () => {
	const resolve = resolver({
		episodes: async () => [...season(37854, 1, 61), ...season(37854, 2, 16)],
		animeMappings: async () => [onePiece],
	})
	assert.deepEqual(
		await resolve({
			showId: 37854,
			animeEntry: { source: "kitsu", id: 12, progress: 77 },
			episode: 62,
		}),
		{
			status: "matched",
			episodeTmdbId: 20001,
			season: 2,
			episode: 1,
			special: false,
		},
	)
})

test("One Piece's continuous TMDB numbers stay continuous despite relative range offsets", async () => {
	const episodes = [...season(37854, 1, 61), ...season(37854, 2, 16, 62)]
	const resolve = resolver({
		episodes: async () => episodes,
		animeMappings: async () => [onePiece],
	})
	assert.deepEqual(
		await resolve({
			showId: 37854,
			animeEntry: { source: "anilist", id: 21, progress: 77 },
			episode: 62,
		}),
		{
			status: "matched",
			episodeTmdbId: 20062,
			season: 2,
			episode: 62,
			special: false,
		},
	)
})

test("the catalog resolver joins tracker IDs from the stored snapshot and pins it for one preview", async (t) => {
	await import("../tracking-loader.test-support.ts")
	const { setImportDbForTest } = await import("./store.server.ts")
	const { createCatalogEpisodeResolver } = await import(
		"./episode-resolver-data.server.ts"
	)
	let entries = [frieren]
	setImportDbForTest({
		select: async <T extends {}>(sql: string) => {
			if (sql.includes("FROM anime_mapping_snapshot"))
				return [
					{
						payload: JSON.stringify({ schemaVersion: 1, entries }),
						refreshed_at: Date.now(),
					},
				] as unknown as T[]
			if (sql.includes("FROM episode"))
				return season(209867, 1, 38) as unknown as T[]
			throw new Error(`Unexpected query ${sql}`)
		},
		run: async () => {
			throw new Error("Anime resolution must not write")
		},
	})
	t.after(() => setImportDbForTest())
	const resolve = createCatalogEpisodeResolver()
	for (const [source, id] of [
		["myanimelist", 59978],
		["anilist", 182255],
		["kitsu", 49240],
	] as const) {
		const result = await resolve({
			showId: 209867,
			animeEntry: { source, id, progress: 10 },
			episode: 1,
		})
		assert.equal(result.status, "matched")
		entries = [] // A concurrent refresh must not change this preview's identities.
	}
	assert.equal(
		(
			await createCatalogEpisodeResolver()({
				showId: 209867,
				animeEntry: { source: "anilist", id: 182255 },
				episode: 1,
			})
		).status,
		"unmatched",
	)
})

test("measured Spy x Family, Attack on Titan and Bleach cours retain their TMDB season and offset", async () => {
	const { readFileSync } = await import("node:fs")
	const snapshot: {
		entries: import("../../domain/anime-mapping.ts").AnimeMapping[]
	} = JSON.parse(
		readFileSync(
			new URL(
				"../../../../goodwatch-flows/tests/fixtures/anime_mapping/snapshot.json",
				import.meta.url,
			),
			"utf8",
		),
	)
	for (const [anidbId, showId, seasonNumber, count, progress, expected] of [
		[17061, 120089, 1, 25, 13, 13],
		[14444, 1429, 3, 22, 10, 13],
		[17765, 30984, 2, 50, 13, 14],
		[18220, 30984, 2, 50, 14, 27],
	]) {
		const resolve = resolver({
			episodes: async () => season(showId, seasonNumber, count),
			animeMappings: async () =>
				snapshot.entries.filter((m) => m.anidbId === anidbId),
		})
		assert.deepEqual(
			await resolve({
				showId,
				animeEntry: { source: "anidb", id: anidbId, progress },
				episode: 1,
			}),
			{
				status: "matched",
				episodeTmdbId: seasonNumber * 10000 + expected,
				season: seasonNumber,
				episode: expected,
				special: false,
			},
		)
	}
})

test("Attack on Titan's Final Chapters offset and absent seasons cannot match regular episodes or guess specials", async () => {
	for (const mapping of [
		{ ...frieren, season: 2 },
		{ ...frieren, showId: 1429, season: 4, offset: 28 },
	]) {
		const resolve = resolver({
			episodes: async () =>
				mapping.showId === 1429
					? [...season(1429, 4, 28), ...season(1429, 0, 2, 36)]
					: season(209867, 1, 38),
			animeMappings: async () => [mapping],
		})
		assert.equal(
			(
				await resolve({
					showId: mapping.showId,
					animeEntry: { source: "anidb", id: mapping.anidbId, progress: 2 },
					episode: 1,
				})
			).status,
			"unmatched",
		)
	}
})

test("an absolute entry without ranges requires unique regular numbers and ignores specials", async () => {
	const entry = { ...onePiece, ranges: [] }
	const catalog = [
		...season(37854, 1, 61),
		...season(37854, 2, 16, 62),
		...season(37854, 0, 1, 62),
	]
	const resolve = resolver({
		episodes: async () => catalog,
		animeMappings: async () => [entry],
	})
	assert.deepEqual(
		await resolve({
			showId: 37854,
			animeEntry: { source: "anidb", id: 69, progress: 62 },
			episode: 62,
		}),
		{
			status: "matched",
			episodeTmdbId: 20062,
			season: 2,
			episode: 62,
			special: false,
		},
	)
	const ambiguous = resolver({
		episodes: async () => [...catalog, ...season(37854, 3, 1, 62)],
		animeMappings: async () => [entry],
	})
	assert.equal(
		(
			await ambiguous({
				showId: 37854,
				animeEntry: { source: "anidb", id: 69 },
				episode: 62,
			})
		).status,
		"unmatched",
	)
})

test("anime identity ambiguity, wrong parents, catalog holes and unsupported lists fail closed", async () => {
	for (const mappings of [
		[],
		[frieren, frieren],
		[{ ...frieren, showId: 1429 }],
		[{ ...frieren, unsupportedReason: "Unsupported individual mappings" }],
	]) {
		const resolve = resolver({
			episodes: async () => season(209867, 1, 38),
			animeMappings: async () => mappings,
		})
		assert.equal(
			(
				await resolve({
					showId: 209867,
					animeEntry: { source: "anidb", id: 18886 },
					episode: 1,
					season: 1,
					numbering: "tmdb",
				})
			).status,
			"unmatched",
		)
	}
	const gap = resolver({
		episodes: async () =>
			season(209867, 1, 38).filter((e) => e.episode_number !== 31),
		animeMappings: async () => [frieren],
	})
	assert.equal(
		(
			await gap({
				showId: 209867,
				animeEntry: { source: "anidb", id: 18886, progress: 10 },
				episode: 1,
			})
		).status,
		"unmatched",
	)
})

test("TMDB then TVDB IDs precede anime placement, and invalid progress cannot become a whole-show watch", async () => {
	const resolve = resolver({
		episodes: async () => season(209867, 1, 38),
		animeMappings: async () => [frieren],
		findTvdb: async () => ({
			tv_episode_results: [{ id: 10002, show_id: 209867 }],
		}),
	})
	const base = {
		showId: 209867,
		animeEntry: { source: "anidb" as const, id: 18886, progress: 10 },
		episode: 1,
	}
	assert.deepEqual(
		await resolve({ ...base, episodeTmdbId: 10001, episodeTvdbId: 5 }),
		{
			status: "matched",
			episodeTmdbId: 10001,
			season: 1,
			episode: 1,
			special: false,
		},
	)
	assert.deepEqual(
		await resolve({ ...base, episodeTmdbId: 99999, episodeTvdbId: 5 }),
		{
			status: "matched",
			episodeTmdbId: 10002,
			season: 1,
			episode: 2,
			special: false,
		},
	)
	for (const episode of [undefined, 0, -1, 1.5, 11, Number.POSITIVE_INFINITY])
		assert.equal((await resolve({ ...base, episode })).status, "unmatched")
})

test("overlapping ranges and many-to-one placement never produce a guessed identity", async () => {
	for (const ranges of [
		[
			{ start: 1, end: 2, season: 1, offset: 0 },
			{ start: 2, end: 3, season: 1, offset: 0 },
		],
		[
			{ start: 1, end: 1, season: 1, offset: 0 },
			{ start: 2, end: 2, season: 1, offset: -1 },
		],
	]) {
		const resolve = resolver({
			episodes: async () => season(209867, 1, 38),
			animeMappings: async () => [{ ...frieren, offset: 0, ranges }],
		})
		assert.equal(
			(
				await resolve({
					showId: 209867,
					animeEntry: { source: "anidb", id: 18886, progress: 2 },
					episode: 1,
				})
			).status,
			"unmatched",
		)
	}
})

test("missing, expired or malformed snapshots leave anime unmatched with a retry reason", async (t) => {
	const { setImportDbForTest } = await import("./store.server.ts")
	const { createCatalogEpisodeResolver } = await import(
		"./episode-resolver-data.server.ts"
	)
	t.after(() => setImportDbForTest())
	for (const rows of [
		[],
		[{ payload: "invalid", refreshed_at: Date.now() }],
		[
			{
				payload: JSON.stringify({ schemaVersion: 1, entries: [frieren] }),
				refreshed_at: Date.now() - 22 * 86400_000,
			},
		],
	]) {
		setImportDbForTest({
			select: async <T extends {}>(sql: string) =>
				(sql.includes("FROM episode")
					? season(209867, 1, 38)
					: rows) as unknown as T[],
			run: async () => {
				throw new Error("Unexpected write")
			},
		})
		assert.deepEqual(
			await createCatalogEpisodeResolver()({
				showId: 209867,
				animeEntry: { source: "anidb", id: 18886 },
				episode: 1,
			}),
			{
				status: "unmatched",
				reason: "Anime mappings are unavailable; retry this import later.",
			},
		)
	}
})

test("progress beyond the entry's declared total rejects even its first episode", async () => {
	const resolve = resolver({
		episodes: async () => season(209867, 1, 50),
		animeMappings: async () => [frieren],
	})
	assert.deepEqual(
		await resolve({
			showId: 209867,
			animeEntry: {
				source: "myanimelist",
				id: 59978,
				progress: 11,
				episodeCount: 10,
			},
			episode: 1,
		}),
		{ status: "unmatched", reason: "Invalid anime entry episode or progress." },
	)
})

test("a TMDB range overrides a numeric default and an explicitly mapped special stays a special", async () => {
	const resolve = resolver({
		episodes: async () => [
			...season(209867, 1, 2),
			...season(209867, 2, 2),
			...season(209867, 0, 1, 9),
		],
		animeMappings: async () => [
			{
				...frieren,
				offset: 0,
				ranges: [
					{ start: 3, end: 4, season: 2, offset: -2 },
					{ start: 5, end: 5, season: 0, offset: 4 },
				],
			},
		],
	})
	assert.deepEqual(
		await resolve({
			showId: 209867,
			animeEntry: { source: "anidb", id: 18886, progress: 5 },
			episode: 3,
		}),
		{
			status: "matched",
			episodeTmdbId: 20001,
			season: 2,
			episode: 1,
			special: false,
		},
	)
	assert.deepEqual(
		await resolve({
			showId: 209867,
			animeEntry: { source: "anidb", id: 18886, progress: 5 },
			episode: 5,
		}),
		{
			status: "matched",
			episodeTmdbId: 9,
			season: 0,
			episode: 9,
			special: true,
		},
	)
})
