import assert from "node:assert/strict"
import { test } from "node:test"
import { episodeLayoutOf, sameEpisodeLayout } from "./episode-layout.ts"

test("layout follows reviewed display seasons, canonical identity stays untouched", () => {
	const episodes = [
		{ season: 1, displaySeason: 2 },
		{ season: 1, displaySeason: 1 },
		{ season: 0 },
		{ season: 1, displaySeason: -1 },
		{ season: 1, displaySeason: 2 },
	]
	assert.deepEqual(episodeLayoutOf(episodes, "Additional episodes"), {
		seasons: [
			{ number: 1, count: 1 },
			{ number: 2, count: 2 },
			{ number: -1, count: 1 },
			{ number: 0, count: 1 },
		],
		note: "Additional episodes",
	})
	assert.equal(episodes[0].season, 1)
})

test("only a changed shape or note needs an explicit reload", () => {
	const first = episodeLayoutOf([{ season: 1 }, { season: 1 }, { season: 2 }])
	assert.equal(
		sameEpisodeLayout(
			first,
			episodeLayoutOf([{ season: 2 }, { season: 1 }, { season: 1 }]),
		),
		true,
	)
	assert.equal(
		sameEpisodeLayout(first, episodeLayoutOf([{ season: 1 }, { season: 2 }])),
		false,
	)
	assert.equal(
		sameEpisodeLayout(first, { ...first, note: "New numbering" }),
		false,
	)
})

test("an empty catalog reserves no episode rows", () => {
	assert.deepEqual(episodeLayoutOf([]), { seasons: [], note: null })
})
