// The episode grid's columns and the part of a long grid that the show page renders first.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { windowEpisodeGrid } = await import("./window.ts")
const { estimateGridBytes, gridFirstEpisode, gridLayout } = await import(
	"./layout.ts"
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
const shape = (columns: ReturnType<typeof gridLayout>) =>
	columns.map((c) =>
		c.kind === "gap" ? `${c.from}-${c.to}` : String(c.number),
	)

test("a run of three or more numbers that no season has is one gap column", () => {
	assert.deepEqual(
		shape(gridLayout(grid([[1, [1, 2, 6, 7, 11_599], 11_599]]))),
		["1", "2", "3-5", "6", "7", "8-11598", "11599"],
	)
})

test("a short run keeps its columns, so a missing episode is still a gap cell", () => {
	assert.deepEqual(shape(gridLayout(grid([[1, [1, 2, 4, 5, 7], 8]]))), [
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
	])
})

test("a number that any season has keeps its column", () => {
	const columns = gridLayout(
		grid([
			[1, [1, 10], 10],
			[2, range(1, 10), 10],
		]),
	)
	assert.deepEqual(
		shape(columns),
		shape(gridLayout(grid([[1, range(1, 10), 10]]))),
	)
})

test("a grid within the budget is kept whole, specials and all", () => {
	const whole = grid(
		[
			[1, range(1, 10), 10],
			[2, range(1, 10), 10],
		],
		3,
	)
	assert.equal(windowEpisodeGrid(whole, estimateGridBytes(whole)), whole)
})

test("a grid over the budget keeps its newest seasons that fit, and the whole run's miniature", () => {
	const whole = grid(
		range(1, 20).map((n) => [n, range(1, 12), 12]),
		4,
	)
	const fourSeasons = estimateGridBytes({
		...whole,
		seasons: whole.seasons.slice(-4),
		specials: [],
	})
	const part = windowEpisodeGrid(whole, fourSeasons)
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
	assert.ok(estimateGridBytes(part) <= fourSeasons)
})

test("a newest season over the budget on its own keeps its latest episodes, its columns starting at the first", () => {
	const whole = grid([[1, range(1, 150), 150]])
	const part = windowEpisodeGrid(whole, estimateGridBytes(whole) / 3)
	const kept = part.seasons[0].episodes.map((e) => e.number)
	assert.equal(kept.at(-1), 150)
	assert.ok(kept.length > 30 && kept.length < 60, `${kept.length}`)
	assert.equal(part.window?.firstEpisodeNumber, kept[0])
	assert.equal(gridFirstEpisode(part), kept[0])
	assert.equal(gridLayout(part).length, kept.length)
	assert.equal(part.window?.hiddenSeasons, 0)
	assert.equal(part.window?.hiddenEpisodes, 150 - kept.length)
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
	const budget = estimateGridBytes({
		...whole,
		seasons: whole.seasons.slice(5, 10),
		specials: [],
	})
	const part = windowEpisodeGrid(whole, budget)
	assert.deepEqual(
		part.seasons.map((s) => s.number),
		[6, 7, 8, 9, 10],
	)
	assert.equal(part.window?.hiddenSeasons, 6)
})

test("a part of a grid with an episode 0 keeps its columns from 0", () => {
	const whole = grid(range(1, 10).map((n) => [n, range(0, 9), 9]))
	const part = windowEpisodeGrid(whole, estimateGridBytes(whole) / 2)
	assert.equal(part.hasEpisodeZero, true)
	assert.equal(gridFirstEpisode(part), 0)
	assert.equal(gridLayout(part).length, 10)
})
