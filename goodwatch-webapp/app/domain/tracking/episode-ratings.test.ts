import assert from "node:assert/strict"
import { test } from "node:test"
import { matchEpisodeRatings } from "./episode-ratings.ts"

const listed = (season: number, count: number) =>
	Array.from({ length: count }, (_, i) => ({ id: season * 100 + i + 1, season, number: i + 1, name: `E${i + 1}` }))

test("an episode takes the rating of the IMDb episode proven to be it, wherever the grid draws that", () => {
	const found = matchEpisodeRatings(
		[...listed(1, 2), ...listed(2, 1)],
		[
			{ number: 1, episodes: [{ number: 1, name: "a", score: 8, votes: 10, tmdbId: 101 }] },
			// IMDb's season 3 holds TMDB's S1 E2 and S2 E1.
			{ number: 3, episodes: [{ number: 1, name: "b", score: 7, tmdbId: 102 }, { number: 2, name: "c", score: 6, tmdbId: 201 }] },
		],
	)
	assert.deepEqual(Object.fromEntries([...found.byEpisode].map(([id, r]) => [id, r.score])), { 101: 8, 102: 7, 201: 6 })
	assert.equal(found.byEpisode.get(101)?.votes, 10)
})

test("no proof, no rating: same numbers or titles alone don't rate an episode", () => {
	const found = matchEpisodeRatings(listed(1, 2), [
		{ number: 1, episodes: [{ number: 1, name: "E1", score: 8 }, { number: 2, name: "E2", score: 7, tmdbId: 102 }] },
	])
	assert.deepEqual([...found.byEpisode.keys()], [102])
	assert.deepEqual(found.notes.get(1), { byTitle: 0, missing: 1 })
})

test("an unrated IMDb episode, an id claimed twice and specials give no rating", () => {
	const found = matchEpisodeRatings([...listed(1, 2), { id: 1, season: 0, number: 1, name: "Special" }], [
		{ number: 1, episodes: [{ number: 1, name: "a", score: 0, unrated: true, tmdbId: 101 }] },
		{ number: 2, episodes: [{ number: 1, name: "b", score: 7, tmdbId: 102 }, { number: 2, name: "c", score: 6, tmdbId: 102 }] },
		{ number: 3, episodes: [{ number: 1, name: "d", score: 9, tmdbId: 1 }] },
	])
	assert.equal(found.byEpisode.size, 0)
})
