import assert from "node:assert/strict"
import { test } from "node:test"
import "./test-alias.ts"
import type { PassInput } from "./passes.server.ts"

const { runPasses } = await import("./passes.server.ts")
const { byMatch, compareRows, sortToUse } = await import("./order.server.ts")

const UNKNOWN_SCORE = 255
const MOVIE = 1e12

// Six movies, rows 0 to 5: GoodWatch score, votes, and the person's taste match (0 is none).
const SCORES = [90, 55, 75, UNKNOWN_SCORE, 75, 65]
const VOTES = [10, 20, 30, 40, 50, 60]
const MATCHES = [72, 95, 80, 99, 80, 0]
const columns = {
	pointIds: Float64Array.from(SCORES, (_, row) => MOVIE + row + 1),
	genres: new Uint32Array(SCORES.length),
	genreNames: [],
	releaseDays: new Int32Array(SCORES.length).fill(19000),
	votes: Uint32Array.from(VOTES),
	popularity: Float32Array.from(SCORES, (_, row) => 100 - row),
	scores: Uint8Array.from(SCORES),
	flags: new Uint8Array(SCORES.length),
	moods: new Uint16Array(SCORES.length),
}
const noTitles = {
	keys: new Set<number>(),
	rows: new Uint8Array(SCORES.length),
}

/** The universe in the given row order, with the matches unless the person has no taste. */
function passes(
	order: number[],
	filters: { minMatch?: number; minScore?: number; taste?: boolean },
) {
	const input: PassInput = {
		columns,
		rows: Int32Array.from(order),
		keys: Float64Array.from(order, (row) => columns.pointIds[row]),
		services: { kind: "column", kept: null, onMyServices: false },
		notSeen: null,
		seenOrSkipped: noTitles,
		type: "all",
		anime: "any",
		moods: 0,
		genres: 0,
		genresChosen: false,
		minScore: filters.minScore ?? 0,
		minMatch: filters.minMatch ?? 0,
		matches:
			filters.taste === false
				? null
				: Uint8Array.from(order, (row) => MATCHES[row]),
		released: null,
		releasedOptions: { any: null },
		similarTo: [],
		people: [],
		legacy: null,
	}
	const out = runPasses(input)
	return { ...out, rows: Array.from(out.passing, (i) => order[i]) }
}

const plain = [0, 1, 2, 3, 4, 5]

test("the taste match filter keeps the titles at or above the threshold; a title without a match fails it", () => {
	assert.deepEqual(passes(plain, {}).rows, plain)
	assert.deepEqual(passes(plain, { minMatch: 70 }).rows, [0, 1, 2, 3, 4])
	assert.deepEqual(passes(plain, { minMatch: 80 }).rows, [1, 2, 3, 4])
	assert.deepEqual(passes(plain, { minMatch: 90 }).rows, [1, 3])
})

test("the taste match options count what each would leave, the other filters unchanged", () => {
	assert.deepEqual(passes(plain, { minMatch: 80 }).optionCounts.minMatch, {
		"0": 6,
		"70": 5,
		"80": 4,
		"90": 2,
	})
	// GoodWatch score of at least 70 leaves rows 0, 2, and 4.
	const both = passes(plain, { minMatch: 80, minScore: 70 })
	assert.deepEqual(both.rows, [2, 4])
	assert.deepEqual(both.optionCounts.minMatch, {
		"0": 3,
		"70": 3,
		"80": 2,
		"90": 0,
	})
	// And the score options count within the taste match filter.
	assert.deepEqual(both.optionCounts.minScore, {
		"0": 4,
		"60": 2,
		"70": 2,
		"80": 0,
	})
})

test("a recovery counts the titles only the taste match filter hides", () => {
	// Match 80 hides rows 0 and 5; score 70 hides rows 1, 3, and 5. Row 5 is hidden by both and counts in neither.
	const { recoveries } = passes(plain, { minMatch: 80, minScore: 70 })
	assert.deepEqual(recoveries, [
		{ filter: "minScore", titles: 2 },
		{ filter: "minMatch", titles: 1 },
	])
	assert.deepEqual(passes(plain, { minMatch: 90 }).recoveries, [
		{ filter: "minMatch", titles: 4 },
	])
})

test("without taste the taste match filter doesn't narrow", () => {
	const out = passes(plain, { minMatch: 90, taste: false })
	assert.deepEqual(out.rows, plain)
	assert.deepEqual(out.recoveries, [])
	assert.deepEqual(out.optionCounts.minMatch, {
		"0": 6,
		"70": 6,
		"80": 6,
		"90": 6,
	})
})

test("Best match orders by taste match, then GoodWatch score, then the tie-break; no match goes last", () => {
	const top = plain.slice().sort(compareRows(columns, "top"))
	assert.deepEqual(top, [0, 4, 2, 5, 1, 3])
	const { passing } = passes(top, {})
	const matches = Uint8Array.from(top, (row) => MATCHES[row])
	// 99, 95, then the two 80s (same score: the one with more votes first), 72, and the title without a match.
	assert.deepEqual(
		Array.from(byMatch(passing, matches), (i) => top[i]),
		[3, 1, 4, 2, 0, 5],
	)
	// It ranks what passes: with a filter, only those.
	const filtered = passes(top, { minScore: 70 })
	assert.deepEqual(
		Array.from(byMatch(filtered.passing, matches), (i) => top[i]),
		[4, 2, 0],
	)
})

test("Best match falls back to the plain default without taste", () => {
	assert.equal(sortToUse("match", true, false), "match")
	assert.equal(sortToUse("match", true, true), "match")
	assert.equal(sortToUse("match", false, false), "popular")
	assert.equal(sortToUse("match", false, true), "relevance")
	assert.equal(sortToUse("relevance", true, false), "popular")
	assert.equal(sortToUse("relevance", false, true), "relevance")
	assert.equal(sortToUse("top", false, false), "top")
	assert.equal(sortToUse("newest", true, true), "newest")
})
