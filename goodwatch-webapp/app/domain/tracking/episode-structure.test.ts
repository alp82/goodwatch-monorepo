import assert from "node:assert/strict"
import { test } from "node:test"
import { shownScoreLabel } from "../episode-scores.ts"
import { type AlignImdbEpisode, type AlignTmdbEpisode, alignEpisodes } from "./episode-alignment.ts"
import { borrowedLayout, generatedPresentation } from "./episode-structure.ts"

/** TMDB: one season of `count` titled T1..; IMDb: seasons of the given sizes, titled alike. */
const show = (count: number, imdbSeasons: number[], extraTmdbSeasons: number[] = []) => {
	const tmdb: AlignTmdbEpisode[] = [
		...Array.from({ length: count }, (_, i) => ({ tmdb_id: 1 + i, imdb_id: null, season_number: 1, episode_number: i + 1, name: `T${i + 1}` })),
		...extraTmdbSeasons.flatMap((size, s) =>
			Array.from({ length: size }, (_, i) => ({ tmdb_id: 500 + 100 * s + i, imdb_id: null, season_number: 2 + s, episode_number: i + 1, name: `X${s}-${i}` })),
		),
	]
	let k = 0
	const imdb: (AlignImdbEpisode & { score: number; votes: number })[] = imdbSeasons.flatMap((size, s) =>
		Array.from({ length: size }, (_, i) => {
			k++
			return { imdb_episode_id: `tt${k}`, season_number: s + 1, episode_number: i + 1, name: `T${k}`, score: 7 + s, votes: 10 }
		}),
	)
	return { tmdb, imdb }
}
const layoutOf = (tmdb: AlignTmdbEpisode[], imdb: AlignImdbEpisode[]) => {
	const layout = borrowedLayout(alignEpisodes(imdb, tmdb))
	return layout && tmdb.map((e) => layout.get(e.tmdb_id)?.join(".") ?? "-")
}

test("IMDb's finer seasons give the breaks; numbers count each season from 1", () => {
	const { tmdb, imdb } = show(5, [2, 3])
	assert.deepEqual(layoutOf(tmdb, imdb), ["1.1", "1.2", "2.1", "2.2", "2.3"])
})

test("as many seasons or fewer on IMDb keeps TMDB's", () => {
	const { tmdb, imdb } = show(4, [4])
	assert.equal(borrowedLayout(alignEpisodes(imdb, tmdb)), null)
})

test("an unpaired episode inside a season joins it; at a break it keeps TMDB's seasons", () => {
	const inside = show(5, [2, 3])
	inside.tmdb[3].name = "Unmatched"
	inside.imdb[3].name = "Different"
	// T4 has no partner by title, but the gap between T3 and T5 is one episode on each side: it pairs by position.
	assert.deepEqual(layoutOf(inside.tmdb, inside.imdb), ["1.1", "1.2", "2.1", "2.2", "2.3"])
	// TMDB has an extra episode right at IMDb's break: its season is unknown.
	const atBreak = show(6, [2, 3])
	atBreak.tmdb[2].name = "Extra"
	for (const e of atBreak.tmdb.slice(3)) e.name = `T${Number(e.name?.slice(1)) - 1}`
	assert.equal(borrowedLayout(alignEpisodes(atBreak.imdb, atBreak.tmdb)), null)
})

test("TMDB's newest episodes continue the last season; a TMDB season IMDb lacks becomes the next", () => {
	const { tmdb, imdb } = show(6, [2, 2, 1], [2])
	assert.deepEqual(layoutOf(tmdb, imdb), ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2"])
})

test("the generated presentation draws the layout with each episode's own IMDb rating", () => {
	const { tmdb, imdb } = show(5, [2, 3])
	const alignment = alignEpisodes(imdb, tmdb)
	const layout = borrowedLayout(alignment)
	assert.ok(layout)
	const catalog = [
		{ id: 900, season: 0, number: 1, name: "Special" },
		...tmdb.map((e) => ({ id: e.tmdb_id, season: e.season_number, number: e.episode_number, name: e.name })),
	]
	const p = generatedPresentation(catalog, imdb, alignment, layout)
	assert.ok(p)
	assert.equal(p.active, true)
	assert.match(p.version, /^auto1-/)
	assert.deepEqual(p.episodes.map((e) => [e.id, e.displaySeason, e.displayNumber, e.rating]), [
		[900, 0, 1, null],
		[1, 1, 1, 7],
		[2, 1, 2, 7],
		[3, 2, 1, 8],
		[4, 2, 2, 8],
		[5, 2, 3, 8],
	])
	assert.deepEqual(p.seasons.map((s) => [s.number, s.ids, s.score]), [
		[1, [1, 2], 7],
		[2, [3, 4, 5], 8],
	])
	// The member's old TMDB season 1 score now covers both drawn seasons, named in their numbering.
	assert.equal(shownScoreLabel({ scope: "season", season: 1 }, p.episodes), "S1 E1 – S2 E3")
	assert.equal(
		shownScoreLabel({ scope: "part", season: 1, ranges: [{ season: 1, firstEpisode: 3, lastEpisode: 5 }] }, p.episodes),
		"S2 E1–3",
	)
})

test("without a presentation, score labels stay TMDB's", () => {
	const episodes = [{ season: 1, number: 1 }, { season: 1, number: 2 }]
	assert.equal(shownScoreLabel({ scope: "season", season: 1 }, episodes), "Season 1")
})

test("a catalog episode the layout can't place, before its last one, keeps TMDB's seasons", () => {
	const { tmdb, imdb } = show(5, [2, 3])
	const alignment = alignEpisodes(imdb, tmdb)
	const layout = borrowedLayout(alignment)
	assert.ok(layout)
	const catalog = tmdb.map((e) => ({ id: e.tmdb_id, season: e.season_number, number: e.episode_number, name: e.name }))
	// A second TMDB row under S1 E2: the aligner leaves both out, so neither has a place.
	assert.equal(generatedPresentation([...catalog, { id: 77, season: 1, number: 2, name: "Dup" }], imdb, alignment, layout), null)
	// A newer episode still continues the last season.
	const newer = generatedPresentation([...catalog, { id: 78, season: 1, number: 6, name: "New" }], imdb, alignment, layout)
	assert.deepEqual(newer?.episodes.find((e) => e.id === 78)?.displaySeason, 2)
})
