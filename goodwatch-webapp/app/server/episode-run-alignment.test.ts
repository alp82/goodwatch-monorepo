import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import "./title-filter/test-alias.ts"
import type { CanonicalGridEpisode } from "../domain/tracking/episode-grid-identity.ts"
import { identifyGridEpisodes } from "../domain/tracking/episode-grid-identity.ts"
import { matchEpisodeRatings } from "../domain/tracking/episode-ratings.ts"
import { alignEpisodeRun, runSeasonScores } from "../domain/tracking/episode-run-alignment.ts"

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

test("Naruto: IMDb's one season of 220 lands in TMDB's four seasons, every episode rated", () => {
	const identified = identifyGridEpisodes(naruto.imdb, naruto.tmdb)
	const run = alignEpisodeRun(identified, naruto.tmdb)
	assert.ok(run)
	const grid = buildEpisodeGrid(46260, {
		episodes: run,
		imdbSeasons: runSeasonScores(run),
		tmdbSeasons: [],
		rottenSeasons: [],
		metacriticSeasons: [],
	})
	assert.deepEqual(
		grid.seasons.map((s) => [s.number, s.episodes.length, s.maxEpisodeNumber]),
		[
			[1, 52, 52],
			[2, 52, 52],
			[3, 54, 54],
			[4, 62, 62],
		],
	)
	// Season 2 starts at TMDB's episode 53, at the start of its row.
	const s2e1 = grid.seasons[1].episodes[0]
	assert.equal(s2e1.number, 1)
	assert.equal(s2e1.canonicalNumber, 53)
	assert.equal(s2e1.name, naruto.imdb.find((r) => r.episode_number === 53)?.name)
	// The two English titles IMDb has (2 and 19) agree with the order.
	assert.equal(grid.seasons[0].episodes[18].score, 9.1)
	assert.ok(grid.seasons.every((s) => s.scores.imdb !== null))
	assert.equal(grid.maxEpisodeNumber, 62)

	const listed = naruto.tmdb.map((e) => ({ id: e.tmdb_id, season: e.season_number, number: e.episode_number, name: e.name }))
	const found = matchEpisodeRatings(listed, grid.seasons)
	assert.equal(found.byEpisode.size, 220)
	assert.ok([...found.byEpisode.values()].every((r) => r.how === "id"))
})

const canonical = (seasons: number[], runNumbered = false): CanonicalGridEpisode[] => {
	let n = 0
	return seasons.flatMap((count, s) =>
		Array.from({ length: count }, (_, i) => {
			n++
			return { tmdb_id: 1000 + n, imdb_id: null, season_number: s + 1, episode_number: runNumbered ? n : i + 1, name: `T${n}` }
		}),
	)
}
const imdbRun = (count: number): ImdbRow[] =>
	Array.from({ length: count }, (_, i) => ({
		imdb_episode_id: `tt${i + 1}`,
		season_number: 1,
		episode_number: i + 1,
		name: `I${i + 1}`,
		score: 8,
		votes: 10,
	}))

test("TMDB restarting its numbers each season: aligned by order only when both list the same number of episodes", () => {
	const run = alignEpisodeRun(imdbRun(5), canonical([3, 2]))
	assert.deepEqual(
		run?.map((r) => [r.season_number, r.episode_number, r.tmdbId]),
		[
			[1, 1, 1001],
			[1, 2, 1002],
			[1, 3, 1003],
			[2, 1, 1004],
			[2, 2, 1005],
		],
	)
	assert.equal(alignEpisodeRun(imdbRun(4), canonical([3, 2])), null)
	assert.equal(alignEpisodeRun(imdbRun(6), canonical([3, 2])), null)
})

test("TMDB numbering on across seasons: IMDb's k is TMDB's k, even when IMDb hasn't listed the newest yet", () => {
	const run = alignEpisodeRun(imdbRun(4), canonical([3, 2], true))
	assert.deepEqual(
		run?.map((r) => [r.season_number, r.episode_number, r.canonicalNumber]),
		[
			[1, 1, 1],
			[1, 2, 2],
			[1, 3, 3],
			[2, 1, 4],
		],
	)
	assert.equal(alignEpisodeRun(imdbRun(6), canonical([3, 2], true)), null)
})

test("no alignment for several IMDb seasons, a gap in IMDb's numbers, one TMDB season, or a contradicting identity", () => {
	assert.equal(alignEpisodeRun([...imdbRun(3), { ...imdbRun(1)[0], imdb_episode_id: "tt9", season_number: 2 }], canonical([2, 2])), null)
	assert.equal(alignEpisodeRun(imdbRun(5).filter((r) => r.episode_number !== 3), canonical([2, 2])), null)
	assert.equal(alignEpisodeRun(imdbRun(5), canonical([5])), null)
	const identified = imdbRun(5).map((r, i) => (i === 1 ? { ...r, tmdbId: 1003 } : r))
	assert.equal(alignEpisodeRun(identified, canonical([3, 2])), null)
	const agreeing = imdbRun(5).map((r, i) => (i === 1 ? { ...r, tmdbId: 1002 } : r))
	assert.ok(alignEpisodeRun(agreeing, canonical([3, 2])))
})

test("specials pass through, and season scores are vote-weighted per TMDB season", () => {
	const rows = [...imdbRun(3), { imdb_episode_id: "tt99", season_number: null, episode_number: null, name: "OVA", score: 7, votes: 5 }]
	rows[2] = { ...rows[2], score: 5, votes: 30 }
	const run = alignEpisodeRun(rows, canonical([2, 1]))
	assert.ok(run)
	assert.equal(run[3].season_number, null)
	assert.deepEqual(runSeasonScores(run), [
		{ season_number: 1, score: 8, votes: 20, max_episode_number: 2 },
		{ season_number: 2, score: 5, votes: 30, max_episode_number: 1 },
	])
})
