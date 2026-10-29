import assert from "node:assert/strict"
import { test } from "node:test"
import {
	channelPath,
	guessKeys,
	pathTitleKeys,
	pathWords,
	serviceKeys,
	toChannel,
} from "./channels.ts"


const matrix = 1_000_000_000_603
const names = [
	{ key: matrix, name: "matrix", popularity: 10 },
	{ key: 2, name: "matrix reloaded", popularity: 100 },
	{ key: 3, name: "matrx", popularity: 1 },
	{ key: 4, name: "it", popularity: 100 },
]

test("path words discard route words, years and numbers and fold accents", () => {
	assert.deepEqual(
		pathWords("/tv-shows/movies/The-M%C3%A1trx-1999/42?ignored=yes"),
		["matrx"],
	)
	assert.equal(channelPath("x".repeat(400)).length, 300)
	assert.doesNotThrow(() => pathWords("/bad-%escape"))
})

test("the-matrx-1999 guesses The Matrix without suggesting its sequel", () => {
	assert.deepEqual(
		guessKeys(
			"/the-matrx-1999",
			names.filter((n) => n.key !== 3),
			() => true,
		),
		[matrix],
	)
})

test("exact names precede typos, then popularity orders equal matches", () => {
	assert.deepEqual(
		guessKeys("/matrx", names, () => true),
		[3, matrix],
	)
	assert.deepEqual(
		guessKeys(
			"/matrix",
			[...names, { key: 5, name: "matrix", popularity: 20 }],
			() => true,
		),
		[5, matrix, 3],
	)
})

test("unrelated paths, partial names and short typos produce no guesses", () => {
	for (const path of [
		"/account/reset",
		"/reloaded",
		"/at",
		"/1999/404",
		"/matrix/something",
	])
		assert.deepEqual(
			guessKeys(path, names, () => true),
			[],
		)
})

test("typed TMDB ids and title keys resolve ahead of fuzzy names", () => {
	assert.deepEqual(pathTitleKeys("/movie/603-old-slug"), [matrix])
	assert.deepEqual(
		pathTitleKeys("/tv-shows/1399-old-slug"),
		[2_000_000_001_399],
	)
	assert.deepEqual(pathTitleKeys(`/old/${matrix}-slug`), [matrix])
	assert.deepEqual(pathTitleKeys("/1999/603"), [])
	assert.deepEqual(
		guessKeys("/movie/603-matrx", names, (k) => k !== 2),
		[matrix, 3],
	)
	assert.deepEqual(
		guessKeys("/movie/603-old-slug", names, () => false),
		[],
	)
})

test("service filtering retains popularity order, caps lists and treats unknown as empty", () => {
	const keys = [1, 2, 3, 4, 5]
	assert.deepEqual(
		serviceKeys(keys, (k) => k % 2 === 1, 2),
		[1, 3],
	)
	assert.deepEqual(
		serviceKeys(keys, () => null),
		[],
	)
	assert.deepEqual(
		serviceKeys(keys, () => false),
		[],
	)
})

test("channels skip missing backdrops and use canonical site URLs with nullable year and score", () => {
	const display = {
		key: matrix,
		media_type: "movie" as const,
		tmdb_id: 603,
		title: "The Matrix",
		release_year: null,
		backdrop_path: "/abc.jpg",
		goodwatch_overall_score_normalized_percent: null,
	}
	assert.deepEqual(toChannel(display), {
		key: matrix,
		mediaType: "movie",
		title: "The Matrix",
		year: null,
		url: "/movie/603-the-matrix",
		backdrop: "/abc.jpg",
		score: null,
	})
	assert.equal(toChannel({ ...display, backdrop_path: null }), null)
	assert.equal(toChannel({ ...display, backdrop_path: "" }), null)
})
