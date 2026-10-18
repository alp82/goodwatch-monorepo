// The first part of a long episode grid on the show page.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { windowEpisodeGrid, gridColumns, gridFirstEpisode } = await import(
	"./window.ts"
)
const { miniatureScores } = await import("./scale.ts")
type EpisodeGrid = import("../../../server/episode-grid.server.ts").EpisodeGrid

const noScores = {
	imdb: null,
	tmdb: null,
	tomatometer: null,
	popcornmeter: null,
	metascore: null,
	metacriticUser: null,
}

/** One season per entry: [season number, rated episode numbers, highest episode number]. */
const grid = (
	seasons: [number, number[], number][],
	specials = 0,
): EpisodeGrid => ({
	showId: 1,
	seasons: seasons.map(([number, episodes, max]) => ({
		number,
		episodes: episodes.map((n) => ({
			number: n,
			name: `E${n}`,
			score: 5 + (n % 5),
			votes: 100,
		})),
		maxEpisodeNumber: max,
		scores: noScores,
	})),
	specials: Array.from({ length: specials }, (_, i) => ({
		name: `Special ${i}`,
		score: 7,
		votes: 100,
	})),
	maxEpisodeNumber: Math.max(0, ...seasons.map(([, , max]) => max)),
	hasEpisodeZero: seasons.some(([, episodes]) => episodes[0] === 0),
	providers: [],
})

const range = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, i) => from + i)
const limits = { episodes: 50, cells: 200 }

test("a grid within both limits is kept whole, specials and all", () => {
	const whole = grid(
		[
			[1, range(1, 10), 10],
			[2, range(1, 10), 10],
		],
		3,
	)
	assert.equal(windowEpisodeGrid(whole, limits), whole)
})

test("a long run keeps its newest seasons that fit, and the whole run's miniature", () => {
	const whole = grid(
		range(1, 20).map((n) => [n, range(1, 12), 12]),
		4,
	)
	const part = windowEpisodeGrid(whole, limits)
	// 4 seasons of 12 = 48 rated episodes; a fifth would be 60.
	assert.deepEqual(
		part.seasons.map((s) => s.number),
		[17, 18, 19, 20],
	)
	assert.deepEqual(part.specials, [])
	assert.deepEqual(part.window, {
		seasons: 20,
		episodes: 244,
		hiddenSeasons: 16,
		hiddenEpisodes: 196,
		miniature: miniatureScores(whole),
	})
	assert.deepEqual(miniatureScores(part), miniatureScores(whole))
})

test("the cell limit counts the widest season's columns for every season kept", () => {
	// Few rated episodes, but each season is 90 episodes wide: two seasons are 180 cells, three are 270.
	const whole = grid(range(1, 5).map((n) => [n, [1, 45, 90], 90]))
	const part = windowEpisodeGrid(whole, limits)
	assert.deepEqual(
		part.seasons.map((s) => s.number),
		[4, 5],
	)
	assert.equal(gridColumns(part), 90)
})

test("a newest season too long on its own is cut to its latest episode numbers", () => {
	// One IMDb season numbered into the thousands, as a daily soap has it.
	const whole = grid([[1, [1, 2, 500, 9_000, 11_000, 11_500, 11_599], 11_599]])
	const part = windowEpisodeGrid(whole, limits)
	assert.equal(part.window?.firstEpisodeNumber, 11_400)
	assert.equal(gridFirstEpisode(part), 11_400)
	assert.equal(gridColumns(part), 200)
	assert.deepEqual(
		part.seasons[0].episodes.map((e) => e.number),
		[11_500, 11_599],
	)
	assert.equal(part.window?.hiddenSeasons, 0)
	assert.equal(part.window?.hiddenEpisodes, 5)
})

test("a cut season keeps no more rated episodes than the limit", () => {
	const whole = grid([[1, range(1, 150), 150]])
	const part = windowEpisodeGrid(whole, limits)
	assert.deepEqual(
		part.seasons[0].episodes.map((e) => e.number),
		range(101, 150),
	)
	assert.equal(part.window?.firstEpisodeNumber, 101)
})

test("the extra episodes outside every season are not taken for the newest season", () => {
	const whole = grid([
		...range(1, 10).map((n): [number, number[], number] => [
			n,
			range(1, 10),
			10,
		]),
		[-1, range(1, 30), 30],
	])
	const part = windowEpisodeGrid(whole, limits)
	assert.deepEqual(
		part.seasons.map((s) => s.number),
		[6, 7, 8, 9, 10],
	)
	assert.equal(part.window?.hiddenSeasons, 6)
})

test("a part of a grid with an episode 0 keeps its columns from 0", () => {
	const whole = grid(range(1, 10).map((n) => [n, range(0, 9), 9]))
	const part = windowEpisodeGrid(whole, limits)
	assert.equal(part.hasEpisodeZero, true)
	assert.equal(gridFirstEpisode(part), 0)
	assert.equal(gridColumns(part), 10)
})
