import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import "./title-filter/test-alias.ts"
import type { CanonicalGridEpisode } from "../domain/tracking/episode-grid-identity.ts"
import { matchEpisodeRatings } from "../domain/tracking/episode-ratings.ts"
import { drawnSeasonScores, gridRows } from "../domain/tracking/episode-grid-rows.ts"

const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: { load(url: string, context: unknown, next: (url: string, context: unknown) => unknown): unknown }): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/episode-presentation.server.ts")) source = "export const getEpisodePresentation=async()=>null"
		if (url.endsWith("/utils/cache.ts")) source = "export const cached=async({params,target})=>target(params)"
		if (url.endsWith("/utils/crate.ts")) source = "export const query=async()=>[]"
		if (url.endsWith("/feedback/apply-corrections.server.ts")) source = "export const applyCorrections=async(_s,v)=>v"
		return source === undefined ? next(url, context) : { format: "module", source, shortCircuit: true }
	},
})
const { buildEpisodeGrid } = await import("./episode-grid.server.ts")

type ImdbRow = {
	imdb_episode_id: string
	season_number: number | null
	episode_number: number | null
	name: string | null
	score: number | null
	votes: number | null
}
// Naruto (TMDB 46260) as Crate had it on 2026-11-03: IMDb lists 220 episodes as season 1, TMDB as seasons 1-4
// (52, 52, 54, 62) numbered on from one season to the next, plus two specials.
const naruto = JSON.parse(
	readFileSync(new URL("../domain/tracking/fixtures/naruto-run.json", import.meta.url), "utf8"),
) as { imdb: ImdbRow[]; tmdb: CanonicalGridEpisode[] }

const grid = (showId: number, imdb: ImdbRow[], tmdb: CanonicalGridEpisode[]) => {
	const drawn = gridRows(imdb, tmdb)
	return buildEpisodeGrid(showId, {
		episodes: drawn.rows,
		imdbSeasons: drawn.reshaped ? drawnSeasonScores(drawn.rows) : [],
		tmdbSeasons: [],
		rottenSeasons: [],
		metacriticSeasons: [],
	})
}
const listed = (tmdb: CanonicalGridEpisode[]) =>
	tmdb.map((e) => ({ id: e.tmdb_id, season: e.season_number, number: e.episode_number, name: e.name }))

test("Naruto: IMDb's one season of 220 is drawn in TMDB's four seasons, every episode rated", () => {
	const g = grid(46260, naruto.imdb, naruto.tmdb)
	assert.deepEqual(
		g.seasons.map((s) => [s.number, s.episodes.length, s.maxEpisodeNumber]),
		[
			[1, 52, 52],
			[2, 52, 52],
			[3, 54, 54],
			[4, 62, 62],
		],
	)
	// Season 2 starts at TMDB's episode 53, at the start of its row.
	const s2e1 = g.seasons[1].episodes[0]
	assert.equal(s2e1.number, 1)
	assert.equal(s2e1.canonicalNumber, 53)
	assert.equal(s2e1.name, naruto.imdb.find((r) => r.episode_number === 53)?.name)
	assert.equal(g.seasons[0].episodes[18].score, 9.1)
	assert.ok(g.seasons.every((s) => s.scores.imdb !== null))
	const found = matchEpisodeRatings(listed(naruto.tmdb), g.seasons)
	assert.equal(found.byEpisode.size, 220)
})

const tmdbRun = (seasons: string[][]): CanonicalGridEpisode[] =>
	seasons.flatMap((names, s) =>
		names.map((name, n) => ({ tmdb_id: 1000 + 100 * (s + 1) + n + 1, imdb_id: null, season_number: s + 1, episode_number: n + 1, name })),
	)
const imdbRun = (seasons: string[][], score = 8): ImdbRow[] =>
	seasons.flatMap((names, s) =>
		names.map((name, n) => ({
			imdb_episode_id: `tt${s + 1}${String(n + 1).padStart(3, "0")}`,
			season_number: s + 1,
			episode_number: n + 1,
			name,
			score,
			votes: 10,
		})),
	)

test("Code Geass: seasons numbered alike rate every episode though IMDb's titles are romanized Japanese", () => {
	const tmdb = tmdbRun([["The Day a New Demon was Born", "The White Knight Awakens", "Zero"], ["Alpha", "Beta", "Re;"]])
	const imdb = imdbRun([["Majin ga umareta hi", "Kakusei no shiroki kishi", "Zero"], ["Uno", "Dos", "Re;"]])
	const g = grid(31724, imdb, tmdb)
	assert.deepEqual(g.seasons.map((s) => s.number), [1, 2])
	assert.equal(matchEpisodeRatings(listed(tmdb), g.seasons).byEpisode.size, 6)
})

test("a show drawn in IMDb's numbering when an IMDb episode found no TMDB episode, so no rating is left out", () => {
	// TMDB cuts finer, but IMDb has an episode TMDB lacks between two anchors: nothing would place it.
	const tmdb = tmdbRun([["A", "B"], ["C", "D"]])
	const imdb = imdbRun([["A", "B", "Lost", "Extra", "C", "D"]])
	const g = grid(1, imdb, tmdb)
	assert.deepEqual(g.seasons.map((s) => [s.number, s.episodes.length]), [[1, 6]])
	assert.equal(matchEpisodeRatings(listed(tmdb), g.seasons).byEpisode.size, 4)
})

test("specials keep the id-only identity, and season scores are vote-weighted per drawn season", () => {
	const tmdb: CanonicalGridEpisode[] = [
		...tmdbRun([["A", "B"], ["C"]]),
		{ tmdb_id: 9, imdb_id: "tt99", season_number: 0, episode_number: 1, name: "OVA" },
	]
	const imdb: ImdbRow[] = [
		...imdbRun([["A", "B", "C"]]),
		{ imdb_episode_id: "tt99", season_number: null, episode_number: null, name: "OVA", score: 7, votes: 5 },
	]
	imdb[2] = { ...imdb[2], score: 5, votes: 30 }
	const drawn = gridRows(imdb, tmdb)
	assert.equal(drawn.reshaped, true)
	assert.equal(drawn.rows[3].tmdbId, 9)
	assert.deepEqual(drawnSeasonScores(drawn.rows), [
		{ season_number: 1, score: 8, votes: 20, max_episode_number: 2 },
		{ season_number: 2, score: 5, votes: 30, max_episode_number: 1 },
	])
})

test("on a drawn presentation, a provider's season N shows only where a drawn season holds exactly TMDB season N", async () => {
	const { withProviderSeasons, presentationGrid } = await import("./episode-grid.server.ts")
	const episode = (id: number, season: number, number: number, displaySeason: number, displayNumber: number) => ({
		id, season, number, name: `E${id}`, displaySeason, displayNumber, rating: 8, votes: 10, resolved: true,
	})
	// TMDB: season 1 (ids 1-3), season 2 (id 4). Drawn: IMDb's seasons 1 (ids 1-2), 2 (id 3), 3 (id 4).
	const episodes = [episode(1, 1, 1, 1, 1), episode(2, 1, 2, 1, 2), episode(3, 1, 3, 2, 1), episode(4, 2, 1, 3, 1)]
	const presentation = {
		version: "auto1-x", active: true, note: null, episodes,
		seasons: [
			{ number: 1, ids: [1, 2], score: 8, rated: 2, total: 2, unresolved: 0 },
			{ number: 2, ids: [3], score: 8, rated: 1, total: 1, unresolved: 0 },
			{ number: 3, ids: [4], score: 8, rated: 1, total: 1, unresolved: 0 },
		],
	}
	const grid = withProviderSeasons(presentationGrid(7, presentation), presentation, {
		tmdbSeasons: [{ season_number: 1, vote_average: 7.5, episode_count: 3 }, { season_number: 2, vote_average: 8.5, episode_count: 1 }],
		rottenSeasons: [
			{ season_number: 1, url: null, tomato: 90, tomato_count: 20, audience: null, audience_count: null },
			{ season_number: 2, url: null, tomato: 95, tomato_count: 30, audience: null, audience_count: null },
		],
		metacriticSeasons: [],
	})
	assert.deepEqual(
		grid.seasons.map((s) => [s.number, s.scores.tmdb?.score ?? null, s.scores.tomatometer?.score ?? null]),
		[
			[1, null, null],
			[2, null, null],
			// Drawn season 3 is exactly TMDB season 2.
			[3, 8.5, 95],
		],
	)
	assert.deepEqual(grid.providers, ["imdb", "tmdb", "tomatometer"])
})
