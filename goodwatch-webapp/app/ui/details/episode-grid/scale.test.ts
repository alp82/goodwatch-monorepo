// The miniature of the episode grid in the hero's ratings.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { MINIATURE_CELLS, hasEpisodeGrid, miniatureScores } = await import("./scale.ts")
type EpisodeGrid = import("../../../server/episode-grid.server.ts").EpisodeGrid

const grid = (seasons: number[][]): EpisodeGrid => ({
	showId: 1,
	seasons: seasons.map((scores, index) => ({
		number: index + 1,
		episodes: scores.map((score, at) => ({ number: at + 1, name: "", score, votes: 100 })),
		maxEpisodeNumber: scores.length,
		scores: { imdb: null, tmdb: null, tomatometer: null, popcornmeter: null, metascore: null, metacriticUser: null },
	})),
	specials: [],
	maxEpisodeNumber: Math.max(0, ...seasons.map((scores) => scores.length)),
	hasEpisodeZero: false,
	providers: [],
})

test("the miniature is twelve cells, the show's episodes in order from the first to the last", () => {
	// 24 episodes: each cell is the mean of two.
	const rising = Array.from({ length: 24 }, (_, index) => 5 + index * 0.2)
	const cells = miniatureScores(grid([rising.slice(0, 10), rising.slice(10)]))
	assert.equal(cells.length, MINIATURE_CELLS)
	assert.ok(Math.abs(cells[0] - 5.1) < 1e-9 && Math.abs(cells[11] - 9.5) < 1e-9, JSON.stringify(cells))
	assert.deepEqual([...cells].sort((a, b) => a - b), cells, "in the order the episodes aired")
})

test("exactly twelve episodes are the twelve cells, and a season boundary means nothing to it", () => {
	const scores = [8.2, 8.6, 7.9, 9.1, 7.4, 8.3, 8.8, 6.6, 8.0, 9.3, 8.5, 7.7]
	assert.deepEqual(miniatureScores(grid([scores.slice(0, 5), scores.slice(5)])), scores)
})

test("a show with fewer rated episodes than cells repeats them, so the picture is full", () => {
	const cells = miniatureScores(grid([[9, 6, 3]]))
	assert.deepEqual(cells, [9, 9, 9, 9, 6, 6, 6, 6, 3, 3, 3, 3])
	assert.deepEqual(miniatureScores(grid([[7.5]])), Array(MINIATURE_CELLS).fill(7.5))
})

test("a show without a rated episode has no grid and no miniature", () => {
	assert.deepEqual(miniatureScores(grid([])), [])
	assert.equal(hasEpisodeGrid(grid([])), false)
	assert.equal(hasEpisodeGrid(null), false)
})
