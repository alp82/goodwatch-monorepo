import assert from "node:assert/strict"
import { test } from "node:test"
import type { StatsSnapshot, StatsTitle } from "../../domain/stats/snapshot.ts"
import { buildQuiz, verdict } from "./quiz-questions.ts"

const title = (
	tmdbId: number,
	name: string,
	type: "movie" | "show" = "movie",
): StatsTitle => ({
	type,
	tmdbId,
	title: name,
	year: 2000,
	poster: null,
})

/** Only what the quiz reads. */
function snapshot(): StatsSnapshot {
	return {
		records: {
			mostImdbVotesMovies: [
				{ ...title(278, "The Shawshank Redemption"), votes: 3_100_000 },
				{ ...title(155, "The Dark Knight"), votes: 3_090_000 },
				{ ...title(27205, "Inception"), votes: 2_700_000 },
			],
			mostEpisodes: [
				{ ...title(1, "Tagesschau", "show"), episodes: 21_000, seasons: 75 },
				{ ...title(2, "Today", "show"), episodes: 15_000, seasons: 67 },
				{
					...title(3, "General Hospital", "show"),
					episodes: 10_000,
					seasons: 64,
				},
			],
			criticsVsAudience: [{ ...title(10, "Split"), critics: 90, audience: 20 }],
			imdbOverLetterboxd: [
				{ ...title(11, "Small"), imdb: 6, imdbVotes: 100, letterboxd: 1.5 },
				{
					...title(12, "Famous"),
					imdb: 5.5,
					imdbVotes: 300_000,
					letterboxd: 1.6,
				},
			],
		},
		trivia: {
			commonTitles: ["Home", "Alone", "Mother", "Echo"].map((t, i) => ({
				title: t,
				movies: 170 - i * 20,
			})),
			friday13Horror: 32,
			friday13Top: [
				{ ...title(20, "Friday the 13th"), imdb: 6.4, votes: 150_000 },
			],
			sourcesAgree: [
				{
					...title(30, "Twister"),
					imdb: 6.5,
					letterboxd: 3.2,
					metascore: 68,
					tomatometer: 64,
				},
			],
		},
		members: {
			scores: { spread: [5, 2, 2, 6, 8, 23, 30, 43, 25, 24] },
			genres: [
				{ genre: "War", scores: 500, members: 100, average: 7.8 },
				{ genre: "Western", scores: 170, members: 80, average: 7.7 },
				{ genre: "Drama", scores: 9000, members: 280, average: 7.3 },
				{ genre: "Horror", scores: 900, members: 120, average: 6.6 },
			],
		},
		charts: {
			runtimeByDecade: [1950, 1960, 1970, 1980, 1990, 2000].map((decade) => ({
				decade,
				minutes: decade === 1960 ? 104 : decade === 2000 ? 106 : 99,
			})),
		},
		episodes: {
			mostVoted: [1, 2, 3].map((n) => ({
				showId: 1396,
				show: "Breaking Bad",
				poster: null,
				season: 5,
				episode: 13 + n,
				name: `Episode #5.${13 + n}`,
				imdb: 10 - n / 10,
				votes: 300_000 - n,
			})),
		},
		streaming: {
			topCountries: ["US", "GB", "CA", "DE"].map((code, i) => ({
				code,
				offers: 1_000_000 / (i + 2),
			})),
		},
	} as unknown as StatsSnapshot
}

test("ten questions, each with three different answers and the right one among them", () => {
	const quiz = buildQuiz(snapshot())
	assert.equal(quiz.length, 10)
	for (const q of quiz) {
		assert.equal(new Set(q.answers.map((a) => a.key)).size, 3, q.id)
		assert.ok(
			q.answers.some((a) => a.key === q.right),
			q.id,
		)
	}
})

test("the right answer isn't always in the same place before the shuffle", () => {
	const places = new Set(
		buildQuiz(snapshot()).map((q) =>
			q.answers.findIndex((a) => a.key === q.right),
		),
	)
	assert.equal(places.size, 3)
})

test("a question without enough data is left out", () => {
	const s = snapshot()
	s.records.mostEpisodes = s.records.mostEpisodes.slice(0, 2)
	s.members.genres = []
	const ids = buildQuiz(s).map((q) => q.id)
	assert.ok(!ids.includes("quiz-most-episodes"))
	assert.ok(!ids.includes("quiz-member-genre"))
	assert.equal(ids.length, 8)
})

test("country names read with an article where English needs one", () => {
	const q = buildQuiz(snapshot()).find((x) => x.id === "quiz-streaming-country")
	assert.equal(
		q?.question,
		"After the United States, which country has the most streaming offers?",
	)
	assert.match(q?.explain ?? "", /^The United Kingdom has /)
})

test("episode answers use the number when IMDb has no name, and link to the episode", () => {
	const q = buildQuiz(snapshot()).find((x) => x.id === "quiz-episode-votes")
	assert.ok(q?.answers.every((a) => /^Episode \d+$/.test(a.label)))
	assert.equal(q?.link?.to, "/show/1396-breaking-bad?episode=s5e14#episodes")
})

test("the verdict grows with the score", () => {
	assert.equal(verdict(10, 10).label, "Perfect score")
	assert.equal(verdict(8, 10).label, "Film buff")
	assert.equal(verdict(5, 10).label, "Regular")
	assert.equal(verdict(2, 10).label, "Casual viewer")
	assert.equal(verdict(0, 10).label, "Fresh eyes")
})
