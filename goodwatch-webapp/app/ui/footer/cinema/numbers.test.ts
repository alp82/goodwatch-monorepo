import assert from "node:assert/strict"
import { test } from "node:test"
import type { CinemaNumbers } from "../../../domain/cinema-numbers.ts"
import { cinemaText, large, pixelText } from "./numbers.ts"
import { programFor } from "./program.ts"

// The catalog as counted for the stats page on November 15, 2026 (the watchers are made up).
const NUMBERS: CinemaNumbers = {
	watchMinutes: 55_127_779 + 159_442_932,
	movies: 1_278_814,
	shows: 237_261,
	episodes: 6_946_371,
	people: 4_993_663,
	characters: 2_662_925,
	trailers: 213_590,
	imdbVotes: 1_349_150_547 + 218_205_225,
	letterboxdRatings: 2_592_203_875,
	tmdbVotes: 32_331_465,
	metacriticUserRatings: 1_743_373,
	metacriticCriticReviews: 363_912,
	countries: 139,
	services: 995,
	tropeKinds: 42_143,
	tropeMentions: 3_828_564,
	watchers: 412,
	sharkMovies: 777,
	zombieMovies: 1_054,
	christmasMovies: 4_663,
	fridayThe13thHorror: 676,
	mostCommonRole: { role: "dancer", credits: 11_160 },
	mostCommonTitle: { title: "Home", movies: 173 },
	longestMovie: { title: "Live Aid", minutes: 984 },
	oldestTitle: { title: "Passage of Venus", year: 1874 },
}

test("large numbers read as billions and millions", () => {
	assert.equal(large(2_592_203_875), "2.59 billion")
	assert.equal(large(2_000_000_000), "2 billion")
	assert.equal(large(32_331_465), "32.3 million")
	assert.equal(large(1_743_373), "1.7 million")
	assert.equal(large(250_000_000), "250 million")
	assert.equal(large(4_663), "4,663")
})

test("pixel text keeps what the pixel font draws, in capitals", () => {
	assert.equal(pixelText("Amélie! Bring snacks."), "AMELIE BRING SNACKS.")
	assert.equal(pixelText("Live Aid. Bring snacks."), "LIVE AID. BRING SNACKS.")
})

test("the montage, the stinger and the credits word the catalog's numbers", () => {
	const text = cinemaText(NUMBERS)
	assert.deepEqual(
		text.facts.map((f) => [f.n, f.sub]),
		[
			["777", "THE WATER WAS NEVER SAFE"],
			["1,054", "AND THEY KEEP COMING BACK"],
			["4,663", "MOST OF THEM ARE THE SAME ONE"],
			["676", "RELEASED ON A FRIDAY THE 13TH"],
			["16 HOURS", "LIVE AID. BRING SNACKS."],
			["1874", "PASSAGE OF VENUS"],
		],
	)
	assert.equal(text.finale.n, "408")
	const credit = (role: string) =>
		text.credits.find((c) => c.role === role)?.names
	assert.deepEqual(credit("Running time"), ["408 years, give or take"])
	assert.deepEqual(credit("Audience"), [
		"2.59 billion Letterboxd ratings",
		"1.57 billion IMDb votes",
		"1.7 million Metacritic user ratings",
		"32.3 million TMDB votes",
	])
	assert.deepEqual(credit("Most frequent role"), ["Dancer, 11,160 times"])
	assert.match(text.montageSay, /^Did you know\? 777 shark movies\./)
	assert.match(text.finaleSay, /408 years/)
	for (const words of [
		text.montageSay,
		text.finaleSay,
		...text.credits.flatMap((c) => c.names),
	]) {
		assert.doesNotMatch(words, /[—!]/)
	}
})

test("the program ends with the montage, the stinger and the credits, or after the trailers without numbers", () => {
	const full = programFor(cinemaText(NUMBERS))
	assert.deepEqual(
		full.map((g) => g.label),
		[
			"Before the show",
			"Countdown",
			"GoodWatch Pictures",
			"Coming attractions: Midnight Mile",
			"GoodWatch presents",
			"Coming attractions: Iron Nebula",
			"GoodWatch presents",
			"Coming attractions: The Harbor Beast",
			"GoodWatch in numbers",
			"Thanks for watching",
			"End credits",
		],
	)
	assert.equal(
		programFor(null).at(-1)?.label,
		"Coming attractions: The Harbor Beast",
	)
})
