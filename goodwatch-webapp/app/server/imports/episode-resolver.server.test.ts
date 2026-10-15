import "node-crate"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { createEpisodeResolver } from "./episode-resolver.server.ts"

// Synthetic episode IDs, real show identities and numbering examples from #610's research.
const friends = [
	{
		tmdb_id: 101,
		show_id: 1668,
		season_number: 4,
		episode_number: 23,
		name: "The One with Ross's Wedding",
		tvdb_id: null as number | null,
	},
]

test("Friends resolves by TMDB identity despite different source numbering", async () => {
	const resolve = createEpisodeResolver({ episodes: async () => friends })
	assert.deepEqual(
		await resolve({ showId: 1668, episodeTmdbId: 101, season: 4, episode: 24 }),
		{
			status: "matched",
			episodeTmdbId: 101,
			season: 4,
			episode: 23,
			special: false,
		},
	)
})

test("The Office only trusts season/episode coordinates explicitly numbered like TMDB", async () => {
	const office = [
		{
			...friends[0],
			tmdb_id: 201,
			show_id: 2316,
			name: "Goodbye, Toby",
			season_number: 4,
			episode_number: 14,
		},
	]
	const resolve = createEpisodeResolver({ episodes: async () => office })
	assert.deepEqual(
		await resolve({ showId: 2316, numbering: "tmdb", season: 4, episode: 14 }),
		{
			status: "matched",
			episodeTmdbId: 201,
			season: 4,
			episode: 14,
			special: false,
		},
	)
	assert.equal(
		(await resolve({ showId: 2316, season: 4, episode: 14 })).status,
		"unmatched",
	)
})

test("a nameless number is never guessed, but a unique case-insensitive episode name resolves within its show", async () => {
	const resolve = createEpisodeResolver({ episodes: async () => friends })
	assert.deepEqual(
		await resolve({
			showId: 1668,
			episodeName: "  THE ONE WITH ROSS'S WEDDING ",
		}),
		{
			status: "matched",
			episodeTmdbId: 101,
			season: 4,
			episode: 23,
			special: false,
		},
	)
	assert.equal(
		(
			await resolve({
				showId: 2316,
				episodeName: "The One with Ross's Wedding",
			})
		).status,
		"unmatched",
	)
	assert.equal(
		(
			await resolve({
				showId: 1668,
				season: 4,
				episode: 24,
				episodeName: "The One with Ross's Wedding",
			})
		).status,
		"unmatched",
	)
})

test("TVDB lookup accepts only episode results belonging to the matched show and caches the identity", async () => {
	const catalog = friends.map((e) => ({ ...e }))
	const resolve = createEpisodeResolver({
		episodes: async () => catalog,
		findTvdb: async () => ({
			tv_results: [{ id: 999 }],
			tv_episode_results: [{ id: 101, show_id: 1668 }],
		}),
		cacheTvdb: async (showId, episodeId, tvdbId) => {
			assert.equal(showId, 1668)
			assert.equal(episodeId, 101)
			catalog[0].tvdb_id = tvdbId
		},
	})
	assert.deepEqual(
		await resolve({ showId: 1668, episodeTvdbId: 555, season: 4, episode: 24 }),
		{
			status: "matched",
			episodeTmdbId: 101,
			season: 4,
			episode: 23,
			special: false,
		},
	)
	const cached = createEpisodeResolver({
		episodes: async () => catalog,
		findTvdb: async () => {
			throw new Error("Offline")
		},
	})
	assert.equal(
		(await cached({ showId: 1668, episodeTvdbId: 555 })).status,
		"matched",
	)
})

import { moneyHeist, netflixParts } from "./episode-fixtures.test-support.ts"

test("Money Heist Netflix parts resolve to canonical specials and regular episodes", async () => {
	const resolve = createEpisodeResolver({
		episodes: async () => moneyHeist,
		groups: async () => [
			{
				id: "netflix-parts",
				name: "Parts (edited version)",
				type: 4,
				network: { name: "Netflix" },
				group_count: 5,
			},
		],
		group: async () => netflixParts,
	})
	assert.deepEqual(
		await resolve({
			showId: 71446,
			episodeGroup: { label: "Part 2" },
			episode: 1,
		}),
		{
			status: "matched",
			episodeTmdbId: 1014,
			season: 0,
			episode: 14,
			special: true,
		},
	)
	assert.deepEqual(
		await resolve({
			showId: 71446,
			episodeGroup: { label: "Part 3" },
			episode: 1,
		}),
		{
			status: "matched",
			episodeTmdbId: 1201,
			season: 2,
			episode: 1,
			special: false,
		},
	)
})

test("community episode groups with gaps, duplicate identities or foreign episodes are rejected", async () => {
	for (const damage of [
		(g: typeof netflixParts) => {
			g.groups[4].episodes.pop()
		},
		(g: typeof netflixParts) => {
			g.groups[4].episodes[2].order = 99
		},
		(g: typeof netflixParts) => {
			g.groups[4].episodes[2].id = 1014
		},
		(g: typeof netflixParts) => {
			g.groups[4].episodes[2].id = 999999
		},
		(g: typeof netflixParts) => {
			g.groups[4].order = 7
		},
	]) {
		const group = structuredClone(netflixParts)
		damage(group)
		const resolve = createEpisodeResolver({
			episodes: async () => moneyHeist,
			groups: async () => [
				{
					id: group.id,
					name: "Parts",
					type: 4,
					network: { name: "Netflix" },
					group_count: 5,
				},
			],
			group: async () => group,
		})
		assert.equal(
			(
				await resolve({
					showId: 71446,
					episodeGroup: { id: group.id, label: "Part 2" },
					episode: 1,
				})
			).status,
			"unmatched",
		)
	}
})

test("a numberless Money Heist row can match its name only inside the selected part", async () => {
	const resolve = createEpisodeResolver({
		episodes: async () => moneyHeist,
		groups: async () => [
			{
				id: "netflix-parts",
				name: "Parts",
				type: 4,
				network: { name: "Netflix" },
				group_count: 5,
			},
		],
		group: async () => netflixParts,
	})
	assert.deepEqual(
		await resolve({
			showId: 71446,
			episodeGroup: { label: "Part 2" },
			episodeName: "Episode 0-14",
		}),
		{
			status: "matched",
			episodeTmdbId: 1014,
			season: 0,
			episode: 14,
			special: true,
		},
	)
	assert.equal(
		(
			await resolve({
				showId: 71446,
				episodeGroup: { label: "Part 3" },
				episodeName: "Episode 0-14",
			})
		).status,
		"unmatched",
	)
})

test("the shared resolver reads and writes the TVDB cache through the import database boundary", async (t) => {
	const { setImportDbForTest } = await import("./store.server.ts")
	const { createCatalogEpisodeResolver } = await import(
		"./episode-resolver-data.server.ts"
	)
	const catalog = friends.map((e) => ({ ...e }))
	setImportDbForTest({
		select: async <T extends {}>() =>
			structuredClone(catalog) as unknown as T[],
		run: async (sql, params) => {
			assert.match(sql, /UPDATE episode SET tvdb_id = \?/)
			assert.deepEqual(params, [555, 1668, 101])
			catalog[0].tvdb_id = 555
			return { rowcount: 1 }
		},
	})
	t.after(() => setImportDbForTest())
	t.mock.method(globalThis, "fetch", async (input: string) => {
		const url = new URL(input)
		assert.equal(url.pathname, "/3/find/555")
		assert.equal(url.searchParams.get("external_source"), "tvdb_id")
		return Response.json({ tv_episode_results: [{ id: 101, show_id: 1668 }] })
	})
	assert.equal(
		(await createCatalogEpisodeResolver()({ showId: 1668, episodeTvdbId: 555 }))
			.status,
		"matched",
	)
	t.mock.method(globalThis, "fetch", async () => {
		throw new Error("Offline")
	})
	assert.equal(
		(await createCatalogEpisodeResolver()({ showId: 1668, episodeTvdbId: 555 }))
			.status,
		"matched",
	)
})

test("a group with self-consistent counts still cannot omit the show's final season", async () => {
	const incomplete = structuredClone(netflixParts)
	incomplete.groups.pop()
	incomplete.group_count = 4
	incomplete.episode_count = 38
	const resolve = createEpisodeResolver({
		episodes: async () => moneyHeist,
		groups: async () => [
			{
				id: incomplete.id,
				name: "Parts",
				type: 4,
				network: { name: "Netflix" },
				group_count: 4,
			},
		],
		group: async () => incomplete,
	})
	assert.equal(
		(
			await resolve({
				showId: 71446,
				episodeGroup: { label: "Part 2" },
				episode: 1,
			})
		).status,
		"unmatched",
	)
})

test("ambiguous or foreign identities never fall through to a weaker number match", async () => {
	const resolve = createEpisodeResolver({
		episodes: async () => [...friends, { ...friends[0], tmdb_id: 102 }],
		findTvdb: async () => ({
			tv_episode_results: [{ id: 101, show_id: 2316 }],
		}),
	})
	for (const evidence of [
		{ episodeTmdbId: 999, season: 4, episode: 23 },
		{ episodeTvdbId: 555, season: 4, episode: 23 },
		{ season: 4, episode: 23 },
		{ episodeName: "The One with Ross's Wedding" },
	]) {
		const result = await resolve({
			showId: 1668,
			numbering: "tmdb",
			...evidence,
		})
		assert.equal(result.status, "unmatched")
		if (result.status === "unmatched") assert.ok(result.reason.length > 0)
	}
})

test("TVDB zero is invalid and must not match uncached NULL ids", async () => {
	const resolve = createEpisodeResolver({ episodes: async () => friends })
	assert.equal(
		(await resolve({ showId: 1668, episodeTvdbId: 0 })).status,
		"unmatched",
	)
})

test("an empty community group does not prevent resolving a complete Netflix group", async (t) => {
	const { setImportDbForTest } = await import("./store.server.ts")
	const { createCatalogEpisodeResolver } = await import(
		"./episode-resolver-data.server.ts"
	)
	setImportDbForTest({
		select: async <T extends {}>() => moneyHeist as unknown as T[],
		run: async () => {
			throw new Error("Unexpected write")
		},
	})
	t.after(() => setImportDbForTest())
	t.mock.method(globalThis, "fetch", async (input: string) => {
		const path = new URL(input).pathname
		if (path.endsWith("/episode_groups"))
			return Response.json({
				results: [
					{
						id: "empty",
						name: "Test group",
						type: 2,
						network: null,
						group_count: 0,
					},
					{
						id: "netflix-parts",
						name: "Parts",
						type: 4,
						network: { name: "Netflix" },
						group_count: 5,
					},
				],
			})
		assert.equal(path, "/3/tv/episode_group/netflix-parts")
		return Response.json(netflixParts)
	})
	const result = await createCatalogEpisodeResolver()({
		showId: 71446,
		episodeGroup: { label: "Part 2" },
		episode: 1,
	})
	assert.equal(result.status, "matched")
})

test("TVDB ambiguity, removed catalog episodes and transport failures stay unmatched", async () => {
	for (const findTvdb of [
		async () => ({ tv_episode_results: [] }),
		async () => ({
			tv_episode_results: [
				{ id: 101, show_id: 1668 },
				{ id: 102, show_id: 1668 },
			],
		}),
		async () => ({ tv_episode_results: [{ id: 999, show_id: 1668 }] }),
		async () => {
			throw new Error("TMDB unavailable")
		},
	]) {
		const resolve = createEpisodeResolver({
			episodes: async () => friends,
			findTvdb,
			cacheTvdb: async () => {
				assert.fail("Unmatched identities must not be cached")
			},
		})
		const result = await resolve({ showId: 1668, episodeTvdbId: 555 })
		assert.equal(result.status, "unmatched")
		if (result.status === "unmatched") assert.ok(result.reason)
	}
})

test("an incomplete catalog cannot establish episode uniqueness", async () => {
	const catalog = Array.from({ length: 50001 }, (_, i) => ({
		...friends[0],
		tmdb_id: i + 1,
	}))
	const resolve = createEpisodeResolver({ episodes: async () => catalog })
	assert.equal(
		(await resolve({ showId: 1668, episodeTmdbId: 101 })).status,
		"unmatched",
	)
})

test("the TMDB boundary rejects malformed responses and HTTP errors, and bounds stalled lookups", async (t) => {
	const { setImportDbForTest } = await import("./store.server.ts")
	const { createCatalogEpisodeResolver } = await import(
		"./episode-resolver-data.server.ts"
	)
	setImportDbForTest({
		select: async <T extends {}>() =>
			structuredClone(friends) as unknown as T[],
		run: async () => {
			assert.fail("Failed lookups must not write the cache")
		},
	})
	const timeout = process.env.TMDB_TIMEOUT_MS
	process.env.TMDB_TIMEOUT_MS = "20"
	t.after(() => {
		setImportDbForTest()
		if (timeout === undefined)
			Reflect.deleteProperty(process.env, "TMDB_TIMEOUT_MS")
		else process.env.TMDB_TIMEOUT_MS = timeout
	})
	for (const response of [
		async () => Response.json({}, { status: 429 }),
		async () =>
			Response.json({ tv_episode_results: [{ id: "101", show_id: 1668 }] }),
		async () => new Promise<Response>(() => {}),
	]) {
		t.mock.method(globalThis, "fetch", response)
		const result = await createCatalogEpisodeResolver()({
			showId: 1668,
			episodeTvdbId: 555,
		})
		assert.equal(result.status, "unmatched")
		if (result.status === "unmatched") assert.match(result.reason, /retry/i)
	}
})
