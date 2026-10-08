import assert from "node:assert/strict"
import { test } from "node:test"
import { matchEpisodeRatings } from "./episode-ratings.ts"

const listed = (
	season: number,
	names: (string | null)[],
	firstId = season * 100,
) =>
	names.map((name, index) => ({
		id: firstId + index + 1,
		season,
		number: index + 1,
		name,
	}))
const imdb = (number: number, episodes: [number, string, number][]) => ({
	number,
	episodes: episodes.map(([n, name, score]) => ({ number: n, name, score })),
})
const scores = (found: ReturnType<typeof matchEpisodeRatings>) =>
	Object.fromEntries(
		[...found.byEpisode].map(([id, rated]) => [
			id,
			`${rated.score} by ${rated.how}`,
		]),
	)

test("an episode takes IMDb's rating at the same season and number when the titles agree", () => {
	const found = matchEpisodeRatings(
		listed(1, ["Pilot", "Wendigo", "Dead in the Water"]),
		[
			imdb(1, [
				[1, "Pilot", 8.6],
				[2, "Wendigo", 7.4],
				[3, "Dead in the Water", 8.1],
			]),
		],
	)
	assert.deepEqual(scores(found), {
		101: "8.6 by number",
		102: "7.4 by number",
		103: "8.1 by number",
	})
	assert.equal(found.notes.size, 0)
})

test("titles agree whatever their case and punctuation", () => {
	const found = matchEpisodeRatings(
		listed(1, ["What Is... and What Should Never Be"]),
		[imdb(1, [[1, "What Is and What Should Never Be", 9.2]])],
	)
	assert.deepEqual(scores(found), { 101: "9.2 by number" })
})

test("a season IMDb lists one episode shorter keeps its ratings by title and never shows a neighbour's", () => {
	// TMDB splits the opener in two; IMDb lists it once, so every later episode sits one number lower there.
	const found = matchEpisodeRatings(
		listed(1, ["Opener (1)", "Opener (2)", "Second", "Third"]),
		[
			imdb(1, [
				[1, "Opener", 9.0],
				[2, "Second", 7.0],
				[3, "Third", 8.0],
			]),
		],
	)
	assert.deepEqual(scores(found), { 103: "7 by title", 104: "8 by title" })
	assert.deepEqual(found.notes.get(1), { byTitle: 2, missing: 2 })
})

test("an episode IMDb lists under another number of the season is found by its title", () => {
	const found = matchEpisodeRatings(
		listed(2, ["Serenity", "The Train Job", "Bushwhacked"]),
		[
			imdb(2, [
				[1, "The Train Job", 8.5],
				[2, "Bushwhacked", 8.3],
				[11, "Serenity", 9.1],
			]),
		],
	)
	assert.deepEqual(scores(found), {
		201: "9.1 by title",
		202: "8.5 by title",
		203: "8.3 by title",
	})
	assert.deepEqual(found.notes.get(2), { byTitle: 3, missing: 0 })
})

test("a title of another season is not taken", () => {
	const found = matchEpisodeRatings(listed(1, ["Reunion"]), [
		imdb(1, [[1, "Arrival", 7.1]]),
		imdb(2, [[4, "Reunion", 9.9]]),
	])
	assert.deepEqual(scores(found), {})
	assert.deepEqual(found.notes.get(1), { byTitle: 0, missing: 1 })
})

test("an episode without a match has no rating", () => {
	const found = matchEpisodeRatings(listed(1, ["One", "Two", "Lost"]), [
		imdb(1, [
			[1, "One", 8.0],
			[2, "Two", 8.2],
		]),
	])
	assert.deepEqual(scores(found), { 101: "8 by number", 102: "8.2 by number" })
	// Nothing sits at number 3 on IMDb: the episode is unrated, not numbered differently.
	assert.equal(found.notes.size, 0)
})

test("a season IMDb does not list has no ratings and no note", () => {
	const found = matchEpisodeRatings(listed(3, ["One"]), [
		imdb(1, [[1, "One", 8.0]]),
	])
	assert.deepEqual(scores(found), {})
	assert.equal(found.notes.size, 0)
})

test("a title that IMDb lists twice in the season is not matched by title", () => {
	const found = matchEpisodeRatings(listed(1, ["Intro", "Part", "Finale"]), [
		imdb(1, [
			[1, "Intro", 7.0],
			[4, "Part", 6.0],
			[5, "Part", 9.0],
			[3, "Finale", 8.0],
		]),
	])
	assert.deepEqual(scores(found), { 101: "7 by number", 103: "8 by number" })
})

test("an IMDb episode is given to one listed episode only", () => {
	// Two listed episodes carry the same name; the one at IMDb's number takes the rating.
	const found = matchEpisodeRatings(listed(1, ["Twin", "Twin"]), [
		imdb(1, [[2, "Twin", 6.5]]),
	])
	assert.deepEqual(scores(found), { 102: "6.5 by number" })
})

test("where a name is missing or generic, the number counts when both list the same number of episodes", () => {
	const found = matchEpisodeRatings(
		listed(1, ["Episode 1", null, "The Real Name"]),
		[
			imdb(1, [
				[1, "The Beginning", 7.5],
				[2, "Episode #1.2", 7.7],
				[3, "The Real Name", 8.8],
			]),
		],
	)
	assert.deepEqual(scores(found), {
		101: "7.5 by number",
		102: "7.7 by number",
		103: "8.8 by number",
	})
})

test("a generic name does not take the number when the two seasons differ in length", () => {
	const found = matchEpisodeRatings(
		listed(1, ["Episode 1", "Episode 2", "Episode 3"]),
		[
			imdb(1, [
				[1, "Arrival", 7.5],
				[2, "Departure", 7.7],
			]),
		],
	)
	assert.deepEqual(scores(found), {})
	assert.deepEqual(found.notes.get(1), { byTitle: 0, missing: 2 })
})

test("specials take no rating", () => {
	const found = matchEpisodeRatings(listed(0, ["Behind the Scenes"]), [
		imdb(0, [[1, "Behind the Scenes", 6.0]]),
	])
	assert.deepEqual(scores(found), {})
})
