import "node-crate"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type EpisodeResolverData,
	createEpisodeResolver,
} from "./episode-resolver.server.ts"

function resolver(
	data: Partial<EpisodeResolverData> & Pick<EpisodeResolverData, "episodes">,
) {
	return createEpisodeResolver({
		animeMappings: async () => [],
		findTvdb: async () => ({ tv_episode_results: [] }),
		groups: async () => [],
		group: async () => {
			throw new Error("Unexpected group lookup")
		},
		cacheTvdb: async () => true,
		...data,
	})
}

const friendsEpisode = friends[22]

test("Friends resolves by TMDB identity despite different source numbering", async () => {
	const resolve = resolver({ episodes: async () => structuredClone(friends) })
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
	const resolve = resolver({ episodes: async () => office })
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
	const resolve = resolver({ episodes: async () => structuredClone(friends) })
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
	const resolve = resolver({
		episodes: async () => catalog,
		findTvdb: async () => ({
			tv_results: [{ id: 999 }],
			tv_episode_results: [{ id: 101, show_id: 1668 }],
		}),
		cacheTvdb: async (showId, episodeId, tvdbId) => {
			assert.equal(showId, 1668)
			assert.equal(episodeId, 101)
			assert.equal(tvdbId, 555)
			return true
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
	const cached = resolver({
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

import {
	friends,
	moneyHeist,
	netflixParts,
	office,
} from "./episode-fixtures.test-support.ts"

test("Money Heist Netflix parts resolve to canonical specials and regular episodes", async () => {
	const resolve = resolver({
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
		const resolve = resolver({
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

test("a numberless Money Heist row tries the selected part before the show-wide name", async () => {
	const resolve = resolver({
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
		"matched",
	)
})

test("an empty TVDB cache is filled with a guarded update through the database helpers", async (t) => {
	const { setImportDbForTest } = await import("./store.server.ts")
	const { createCatalogEpisodeResolver } = await import(
		"./episode-resolver-data.server.ts"
	)
	const writes: { sql: string; params: unknown[] }[] = []
	setImportDbForTest({
		select: async <T extends {}>() =>
			structuredClone(friends) as unknown as T[],
		run: async (sql, params) => {
			writes.push({ sql, params })
			return { rowcount: 1 }
		},
	})
	t.after(() => setImportDbForTest())
	t.mock.method(globalThis, "fetch", async () =>
		Response.json({ tv_episode_results: [{ id: 101, show_id: 1668 }] }),
	)
	assert.deepEqual(
		await createCatalogEpisodeResolver(async () => [])({
			showId: 1668,
			episodeTvdbId: 555,
		}),
		{
			status: "matched",
			episodeTmdbId: 101,
			season: 4,
			episode: 23,
			special: false,
		},
	)
	assert.deepEqual(writes, [
		{
			sql: "UPDATE episode SET tvdb_id = ? WHERE show_id = ? AND tmdb_id = ? AND removed_at IS NULL AND tvdb_id IS NULL",
			params: [555, 1668, 101],
		},
		{
			sql: "UPDATE episode SET tvdb_id = NULL WHERE show_id = ? AND tmdb_id <> ? AND tvdb_id = ?",
			params: [1668, 101, 555],
		},
	])
})

test("a group with self-consistent counts still cannot omit the show's final season", async () => {
	const incomplete = structuredClone(netflixParts)
	incomplete.groups.pop()
	incomplete.group_count = 4
	incomplete.episode_count = 38
	const resolve = resolver({
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

test("fallbacks still reject ambiguous coordinates and names", async () => {
	const resolve = resolver({
		episodes: async () => [...friends, { ...friendsEpisode, tmdb_id: 102 }],
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
		assert.deepEqual(result, {
			status: "unmatched",
			reason:
				"episodeName" in evidence
					? "Episode name did not match uniquely within this show."
					: "Season and episode did not match uniquely within this show.",
		})
	}
})

test("TVDB zero is invalid and must not match uncached NULL ids", async () => {
	const resolve = resolver({ episodes: async () => structuredClone(friends) })
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
	const result = await createCatalogEpisodeResolver(async () => [])({
		showId: 71446,
		episodeGroup: { label: "Part 2" },
		episode: 1,
	})
	assert.equal(result.status, "matched")
})

test("TVDB ambiguity, removed catalog episodes and transport failures stay unmatched", async () => {
	const codes = [
		"episode_tvdb_not_found",
		"episode_tvdb_ambiguous",
		undefined,
		undefined,
	]
	const reasons = [
		"TVDB episode ID did not match uniquely within this show.",
		"TVDB episode ID did not match uniquely within this show.",
		"The TVDB episode is missing or ambiguous in this show's current catalog.",
		"TMDB's TVDB lookup is unavailable; retry this import later.",
	]
	for (const [index, findTvdb] of [
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
	].entries()) {
		const resolve = resolver({
			episodes: async () => structuredClone(friends),
			findTvdb,
			cacheTvdb: async () => {
				assert.fail("Unmatched identities must not be cached")
			},
		})
		const result = await resolve({ showId: 1668, episodeTvdbId: 555 })
		assert.equal(result.status, "unmatched")
		assert.deepEqual(result, {
			status: "unmatched",
			reason: reasons[index],
			...(codes[index] ? { code: codes[index] } : {}),
		})
	}
})

test("an incomplete catalog cannot establish episode uniqueness", async () => {
	const catalog = Array.from({ length: 50001 }, (_, i) => ({
		...friendsEpisode,
		tmdb_id: i + 1,
	}))
	const resolve = resolver({ episodes: async () => catalog })
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
		const result = await createCatalogEpisodeResolver(async () => [])({
			showId: 1668,
			episodeTvdbId: 555,
		})
		assert.equal(result.status, "unmatched")
		if (result.status === "unmatched") assert.match(result.reason, /retry/i)
	}
})

test("a failed TVDB cache write is logged and does not discard a settled match", async (t) => {
	const failure = new Error("Cache unavailable")
	const logged: unknown[][] = []
	t.mock.method(console, "error", (...args: unknown[]) => {
		logged.push(args)
	})
	const resolve = resolver({
		episodes: async () => structuredClone(friends),
		findTvdb: async () => ({
			tv_episode_results: [{ id: 101, show_id: 1668 }],
		}),
		cacheTvdb: async () => {
			throw failure
		},
	})
	assert.deepEqual(await resolve({ showId: 1668, episodeTvdbId: 555 }), {
		status: "matched",
		episodeTmdbId: 101,
		season: 4,
		episode: 23,
		special: false,
	})
	assert.equal(logged.length, 1)
	assert.equal(logged[0][0], "Could not cache import episode TVDB identity")
})

test("3 Body Problem: Season 1: Countdown ignores an untrusted season in name fallback", async () => {
	const resolve = resolver({
		episodes: async () => [
			{
				...friendsEpisode,
				show_id: 108545,
				tmdb_id: 301,
				season_number: 1,
				episode_number: 1,
				name: "Countdown",
			},
		],
	})
	assert.deepEqual(
		await resolve({ showId: 108545, season: 1, episodeName: "Countdown" }),
		{
			status: "matched",
			episodeTmdbId: 301,
			season: 1,
			episode: 1,
			special: false,
		},
	)
	assert.deepEqual(
		await resolve({
			showId: 108545,
			numbering: "tmdb",
			season: 2,
			episodeName: "Countdown",
		}),
		{
			status: "unmatched",
			reason: "Episode name did not match uniquely within this show.",
		},
	)
})

test("failed TMDB identity falls through to TVDB before trusting coordinates", async () => {
	const resolve = resolver({
		episodes: async () => structuredClone(friends),
		findTvdb: async () => ({
			tv_episode_results: [{ id: 101, show_id: 1668 }],
		}),
		cacheTvdb: async () => true,
	})
	assert.deepEqual(
		await resolve({
			showId: 1668,
			episodeTmdbId: 999,
			episodeTvdbId: 555,
			numbering: "tmdb",
			season: 4,
			episode: 1,
		}),
		{
			status: "matched",
			episodeTmdbId: 101,
			season: 4,
			episode: 23,
			special: false,
		},
	)
})

test("failed IDs reach a group before coordinates, then trusted coordinates or a numberless name", async () => {
	const resolve = resolver({
		episodes: async () => moneyHeist,
		findTvdb: async () => ({ tv_episode_results: [] }),
		groups: async () => [
			{
				id: netflixParts.id,
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
			episodeTmdbId: 999,
			episodeTvdbId: 555,
			episodeGroup: { label: "Part 2" },
			numbering: "tmdb",
			season: 3,
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
			episodeTmdbId: 999,
			episodeTvdbId: 555,
			episodeGroup: { label: "Absent" },
			numbering: "tmdb",
			season: 3,
			episode: 1,
		}),
		{
			status: "matched",
			episodeTmdbId: 1301,
			season: 3,
			episode: 1,
			special: false,
		},
	)
	assert.deepEqual(
		await resolve({
			showId: 71446,
			episodeTmdbId: 999,
			episodeTvdbId: 555,
			episodeName: "Episode 3-1",
		}),
		{
			status: "matched",
			episodeTmdbId: 1301,
			season: 3,
			episode: 1,
			special: false,
		},
	)
})

test("fresh TMDB evidence corrects a stale TVDB cache hit and an occupied target", async () => {
	const catalog = [
		{ ...friendsEpisode, tvdb_id: 555 },
		{ ...friendsEpisode, tmdb_id: 102, episode_number: 22, tvdb_id: 777 },
	]
	let online = true
	const resolve = resolver({
		episodes: async () => catalog,
		findTvdb: async () => {
			if (!online) throw new Error("Offline")
			return { tv_episode_results: [{ id: 102, show_id: 1668 }] }
		},
		cacheTvdb: async () => true,
	})
	assert.deepEqual(await resolve({ showId: 1668, episodeTvdbId: 555 }), {
		status: "matched",
		episodeTmdbId: 102,
		season: 4,
		episode: 22,
		special: false,
	})
	online = false
	assert.deepEqual(await resolve({ showId: 1668, episodeTvdbId: 555 }), {
		status: "matched",
		episodeTmdbId: 102,
		season: 4,
		episode: 22,
		special: false,
	})
	assert.deepEqual(await resolve({ showId: 1668, episodeTvdbId: 777 }), {
		status: "unmatched",
		reason: "TMDB's TVDB lookup is unavailable; retry this import later.",
	})
})

test("a cache compare-and-set miss does not invent an in-memory cache entry", async () => {
	const responses = [true, false]
	const catalog = structuredClone(friends)
	const resolve = resolver({
		episodes: async () => catalog,
		findTvdb: async () => {
			if (responses.shift())
				return { tv_episode_results: [{ id: 101, show_id: 1668 }] }
			throw new Error("Offline")
		},
		cacheTvdb: async () => false,
	})
	assert.equal(
		(await resolve({ showId: 1668, episodeTvdbId: 555 })).status,
		"matched",
	)
	assert.deepEqual(await resolve({ showId: 1668, episodeTvdbId: 555 }), {
		status: "unmatched",
		reason: "TMDB's TVDB lookup is unavailable; retry this import later.",
	})
})

test("fresh TVDB evidence updates only the observed cache identity through database helpers", async (t) => {
	const { setImportDbForTest } = await import("./store.server.ts")
	const { createCatalogEpisodeResolver } = await import(
		"./episode-resolver-data.server.ts"
	)
	const catalog = [{ ...friendsEpisode, tvdb_id: 777 }]
	const statements: { sql: string; params: unknown[] }[] = []
	setImportDbForTest({
		select: async <T extends {}>() =>
			structuredClone(catalog) as unknown as T[],
		run: async (sql, params) => {
			statements.push({ sql, params })
			return { rowcount: 0 } // A concurrent update won; do not clear any other row.
		},
	})
	t.after(() => setImportDbForTest())
	t.mock.method(globalThis, "fetch", async () =>
		Response.json({ tv_episode_results: [{ id: 101, show_id: 1668 }] }),
	)
	assert.deepEqual(
		await createCatalogEpisodeResolver(async () => [])({
			showId: 1668,
			episodeTvdbId: 555,
		}),
		{
			status: "matched",
			episodeTmdbId: 101,
			season: 4,
			episode: 23,
			special: false,
		},
	)
	assert.deepEqual(statements, [
		{
			sql: "UPDATE episode SET tvdb_id = ? WHERE show_id = ? AND tmdb_id = ? AND removed_at IS NULL AND tvdb_id = ?",
			params: [555, 1668, 101, 777],
		},
	])
})

test("two complete episode groups agreeing on one TMDB episode are one unique match", async () => {
	const resolve = resolver({
		episodes: async () => moneyHeist,
		groups: async () =>
			["first", "second"].map((id) => ({
				id,
				name: "Parts",
				type: 4,
				network: { name: "Netflix" },
				group_count: 5,
			})),
		group: async (id) => ({ ...netflixParts, id }),
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
})

test("TVDB S4E19 of The Office and S4E24 of Friends cannot be guessed from TMDB seasons", async () => {
	const resolve = resolver({
		episodes: async (showId) => (showId === 2316 ? office : friends),
	})
	assert.deepEqual(await resolve({ showId: 2316, season: 4, episode: 19 }), {
		status: "unmatched",
		reason:
			"This source does not use TMDB episode numbering; an episode ID or group is needed.",
	})
	assert.deepEqual(
		await resolve({ showId: 2316, numbering: "tmdb", season: 4, episode: 19 }),
		{
			status: "unmatched",
			reason: "Season and episode did not match uniquely within this show.",
		},
	)
	assert.deepEqual(await resolve({ showId: 1668, season: 4, episode: 24 }), {
		status: "unmatched",
		reason:
			"This source does not use TMDB episode numbering; an episode ID or group is needed.",
	})
})

test("a fresh negative TVDB response defeats a stored cache hit", async () => {
	const resolve = resolver({
		episodes: async () => [{ ...friendsEpisode, tvdb_id: 555 }],
		findTvdb: async () => ({
			tv_episode_results: [{ id: 101, show_id: 2316 }],
		}),
	})
	assert.deepEqual(await resolve({ showId: 1668, episodeTvdbId: 555 }), {
		status: "unmatched",
		code: "episode_tvdb_parent_mismatch",
		reason: "TVDB episode ID did not match uniquely within this show.",
	})
})

test("reviewed display seasons never replace canonical import identities or imply TMDB numbering", async () => {
	const { readFileSync } = await import("node:fs")
	const { episodeMapping } = await import(
		"../../domain/tracking/episode-mappings.server.ts"
	)
	const audited = JSON.parse(
		readFileSync(
			new URL(
				"../../domain/tracking/fixtures/episode-alignment.json",
				import.meta.url,
			),
			"utf8",
		),
	)
	for (const showId of [154526, 70523, 220542]) {
		const mapping = episodeMapping(showId)!
		const fixture =
			showId === 154526
				? audited.find(
						(f: { mapping: { showId: number } }) => f.mapping.showId === showId,
					)
				: JSON.parse(
						readFileSync(
							new URL(
								`../../domain/tracking/fixtures/${showId === 70523 ? "dark" : "apothecary"}-episodes.json`,
								import.meta.url,
							),
							"utf8",
						),
					)
		const episodes = fixture.catalog.map((e: Record<string, unknown>) => ({
			tmdb_id: Number(e.tmdb_id ?? e.id),
			show_id: showId,
			season_number: Number(e.season_number ?? e.season),
			episode_number: Number(e.episode_number ?? e.number),
			name: String(e.name),
			tvdb_id: null,
		}))
		const resolve = resolver({ episodes: async () => episodes })
		for (const entry of mapping.entries) {
			const canonical = {
				status: "matched",
				episodeTmdbId: entry.id,
				season: entry.canonical[0],
				episode: entry.canonical[1],
				special: false,
			}
			assert.deepEqual(
				await resolve({
					showId,
					episodeTmdbId: entry.id,
					season: entry.display[0],
					episode: entry.display[1],
				}),
				canonical,
			)
			assert.deepEqual(
				await resolve({
					showId,
					numbering: "tmdb",
					season: entry.canonical[0],
					episode: entry.canonical[1],
				}),
				canonical,
			)
			assert.equal(
				(
					await resolve({
						showId,
						season: entry.display[0],
						episode: entry.display[1],
					})
				).status,
				"unmatched",
			)
		}
	}
})
