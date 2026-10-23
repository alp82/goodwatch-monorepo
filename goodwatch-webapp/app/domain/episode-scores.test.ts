import assert from "node:assert/strict"
import { test } from "node:test"
import {
	episodeScoreKey,
	episodeScoreLabel,
	importedScoreTarget,
	isWholeTmdbSeason,
	parseEpisodeScoreTarget,
	partCoversSeason,
} from "./episode-scores.ts"

test("each part of a show has one stable key in TMDB's numbering", () => {
	assert.equal(episodeScoreKey({ scope: "season", season: 2 }), "s2")
	// An episode is keyed by its TMDB id, so a renumbered episode keeps its score.
	assert.equal(
		episodeScoreKey({
			scope: "episode",
			season: 1,
			episode: 3,
			episodeTmdbId: 62085,
		}),
		"e62085",
	)
	assert.equal(
		episodeScoreKey({
			scope: "part",
			season: 1,
			ranges: [
				{ season: 2, firstEpisode: 1, lastEpisode: 5 },
				{ season: 1, firstEpisode: 13, lastEpisode: 25 },
			],
		}),
		"p:s1e13-25,s2e1-5",
	)
})

test("labels name a season, an episode, and a part with its whole episode range", () => {
	assert.equal(episodeScoreLabel({ scope: "season", season: 3 }), "Season 3")
	assert.equal(
		episodeScoreLabel({
			scope: "episode",
			season: 1,
			episode: 4,
			episodeTmdbId: 9,
		}),
		"S1 E4",
	)
	assert.equal(
		episodeScoreLabel({
			scope: "part",
			season: 1,
			ranges: [{ season: 1, firstEpisode: 1, lastEpisode: 12 }],
		}),
		"S1 E1–12",
	)
	assert.equal(
		episodeScoreLabel({
			scope: "part",
			season: 1,
			ranges: [
				{ season: 1, firstEpisode: 20, lastEpisode: 26 },
				{ season: 2, firstEpisode: 1, lastEpisode: 5 },
			],
		}),
		"S1 E20–26, S2 E1–5",
	)
	assert.equal(
		episodeScoreLabel({
			scope: "part",
			season: 3,
			ranges: [{ season: 3, firstEpisode: 7, lastEpisode: 7 }],
		}),
		"S3 E7",
	)
})

test("a member's request names one season or one episode; parts come only from imports", () => {
	assert.deepEqual(parseEpisodeScoreTarget({ scope: "season", season: 2 }), {
		scope: "season",
		season: 2,
	})
	assert.deepEqual(
		parseEpisodeScoreTarget({ scope: "episode", episodeId: 62085 }),
		{ scope: "episode", episodeTmdbId: 62085 },
	)
	for (const bad of [
		null,
		{},
		{ scope: "season" },
		{ scope: "season", season: 0 },
		{ scope: "season", season: 1.5 },
		{ scope: "season", season: -1 },
		{ scope: "episode" },
		{ scope: "episode", episodeId: 0 },
		{ scope: "episode", episodeId: "12" },
		{ scope: "part", ranges: [] },
	])
		assert.equal(parseEpisodeScoreTarget(bad), null, JSON.stringify(bad))
})

test("a part shows in each season its range touches", () => {
	const part = {
		scope: "part" as const,
		season: 1,
		ranges: [
			{ season: 1, firstEpisode: 20, lastEpisode: 26 },
			{ season: 2, firstEpisode: 1, lastEpisode: 5 },
		],
	}
	assert.equal(partCoversSeason(part, 1), true)
	assert.equal(partCoversSeason(part, 2), true)
	assert.equal(partCoversSeason(part, 3), false)
})

test("an import row names its target only once the preview has placed it", () => {
	assert.deepEqual(importedScoreTarget({ scoreScope: "season", season: 2 }), {
		scope: "season",
		season: 2,
	})
	assert.equal(
		importedScoreTarget({ scoreScope: "episode", season: 1, episode: 2 }),
		null,
	)
	assert.deepEqual(
		importedScoreTarget({
			scoreScope: "episode",
			season: 1,
			episode: 2,
			episodeTmdbId: 7,
		}),
		{ scope: "episode", season: 1, episode: 2, episodeTmdbId: 7 },
	)
	assert.equal(importedScoreTarget({ scoreScope: "part" }), null)
	assert.deepEqual(
		importedScoreTarget({
			scoreScope: "part",
			scoreRanges: [
				{ season: 2, firstEpisode: 1, lastEpisode: 3 },
				{ season: 1, firstEpisode: 10, lastEpisode: 12 },
			],
		}),
		{
			scope: "part",
			season: 1,
			ranges: [
				{ season: 2, firstEpisode: 1, lastEpisode: 3 },
				{ season: 1, firstEpisode: 10, lastEpisode: 12 },
			],
		},
	)
})

test("a shown season is scored as a TMDB season only when it holds exactly that season's episodes", () => {
	const tmdb = (season: number, count: number, from = 0) =>
		Array.from({ length: count }, (_, i) => ({
			id: season * 1000 + from + i,
			season,
		}))
	const whole = tmdb(1, 37)
	// The shown season is TMDB's season 1, all of it.
	assert.equal(isWholeTmdbSeason(1, whole, [...whole, ...tmdb(2, 10)]), true)
	// A regrouped show shows 12 of TMDB season 1's 37 episodes as its season 1 (MF Ghost).
	assert.equal(isWholeTmdbSeason(1, whole.slice(0, 12), whole), false)
	assert.equal(isWholeTmdbSeason(2, whole.slice(12), whole), false)
	// A shown season that mixes TMDB seasons, or renumbers one, isn't a TMDB season.
	assert.equal(
		isWholeTmdbSeason(
			1,
			[...tmdb(1, 3), ...tmdb(2, 2)],
			[...tmdb(1, 3), ...tmdb(2, 2)],
		),
		false,
	)
	assert.equal(isWholeTmdbSeason(2, tmdb(1, 3), tmdb(1, 3)), false)
	assert.equal(isWholeTmdbSeason(1, [], []), false)
})
