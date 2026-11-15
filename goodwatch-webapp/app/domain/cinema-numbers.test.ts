import assert from "node:assert/strict"
import { test } from "node:test"
import { cinemaNumbersFrom } from "./cinema-numbers.ts"
import type { StatsSnapshot } from "./stats/snapshot.ts"

const title = (name: string, year: number | null) => ({
	type: "movie" as const,
	tmdbId: 1,
	title: name,
	year,
	poster: null,
})

// Only the parts of a snapshot the cinema reads.
const snapshot = (over: { oldest?: ReturnType<typeof title>[] } = {}) =>
	({
		catalog: {
			movies: 10,
			shows: 2,
			episodes: 30,
			people: 40,
			characters: 50,
			trailers: 6,
			movieMinutes: 1_000,
			episodeMinutes: 500,
		},
		sources: {
			imdbMovieVotes: 70,
			imdbShowVotes: 30,
			letterboxdRatings: 90,
			tmdbVotes: 8,
			metacriticUserRatings: 7,
			metacriticCriticReviews: 5,
		},
		streaming: { countries: 3, services: 4 },
		tropes: { distinct: 11, mentions: 99 },
		members: { watchers: 12 },
		trivia: {
			sharks: 1,
			zombies: 2,
			christmas: 3,
			friday13Horror: 4,
			commonRoles: [{ role: "doctor", credits: 9 }],
			commonTitles: [{ title: "Home", movies: 5 }],
		},
		records: {
			longest: [{ ...title("Long", 1990), runtime: 600 }],
			oldest: over.oldest ?? [title("Undated", null), title("Old", 1888)],
		},
	}) as unknown as StatsSnapshot

test("the cinema's numbers come from the stats snapshot", () => {
	const n = cinemaNumbersFrom(snapshot())
	assert.ok(n)
	assert.equal(n.watchMinutes, 1_500)
	assert.equal(n.imdbVotes, 100)
	assert.deepEqual(n.longestMovie, { title: "Long", minutes: 600 })
	assert.deepEqual(n.oldestTitle, { title: "Old", year: 1888 })
	assert.deepEqual(n.mostCommonRole, { role: "doctor", credits: 9 })
	assert.equal(n.watchers, 12)
})

test("a snapshot without a dated oldest title gives no numbers", () => {
	assert.equal(
		cinemaNumbersFrom(snapshot({ oldest: [title("Undated", null)] })),
		null,
	)
})
