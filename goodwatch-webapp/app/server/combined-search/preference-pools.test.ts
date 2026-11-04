import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { SearchIndex } from "../search-ranking/search-index.server.ts"

const { identityPairs, keptOut, namedTitleKeys, withoutFilter } = await import("./preference-pools.server.ts")

const SHOW = 2_000_000_000_000
// A small title table: two records of one IMDb title (1, 2), an alternate cut pair (3, 4), a show (SHOW + 5).
function index(): SearchIndex {
	const pointIds = [1e12 + 1, 1e12 + 2, 1e12 + 3, 1e12 + 4, SHOW + 5]
	return {
		titleTable: {
			size: pointIds.length,
			pointIds,
			titles: ["A", "A", "B", "B (cut)", "S"],
			originalTitles: ["", "", "", "", ""],
			years: Int32Array.from([1994, 1994, 2001, 2003, 0]),
			votes: Float64Array.from([5000, 10, 2000, 2000, 100]),
			goodwatchScores: Float64Array.from([80, 70, Number.NaN, 75, 60]),
			imdbIds: ["tt1", "tt1", "tt3", "tt4", null],
			flagNames: ["is_anime", "adult"],
			flags: Int32Array.from([0, 0, 1, 2, 0]),
			rowOf: new Map(pointIds.map((key, row) => [key, row])),
		},
		alternateCuts: new Map([[1e12 + 3, new Set([1e12 + 4])]]),
	} as unknown as SearchIndex
}

test("identity pairs: one title under a key in each pool, one to one", () => {
	const at = index()
	assert.deepEqual(identityPairs(at, [1e12 + 2, 1e12 + 4, SHOW + 5], [1e12 + 1, 1e12 + 3]), [
		1e12 + 2,
		1e12 + 1,
		1e12 + 4,
		1e12 + 3,
	])
	// The same key in both pools, or a title without an identity: no pair.
	assert.deepEqual(identityPairs(at, [1e12 + 1, SHOW + 5], [1e12 + 1, SHOW + 5]), [])
	// Both records of one title in the wider pool: not one to one, no pair.
	assert.deepEqual(identityPairs(at, [1e12 + 1, 1e12 + 2], [1e12 + 3]), [])
})

test("keptOut counts what one filter keeps out of a pool, by the title table", () => {
	const at = index()
	const pool = [1e12 + 1, 1e12 + 3, 1e12 + 4, SHOW + 5]
	assert.equal(keptOut(at, pool, "years", { minYear: 2000, maxYear: 2002 }), 3, "1994, 2003 and no year")
	assert.equal(keptOut(at, pool, "type", { type: "movie" }), 1)
	assert.equal(keptOut(at, pool, "anime", { anime: "none" }), 1)
})

test("withoutFilter drops only that filter", () => {
	assert.deepEqual(withoutFilter({ minYear: 1990, maxYear: 1999, type: "movie" }, "years"), { type: "movie" })
	assert.deepEqual(withoutFilter({ anime: "none", type: "show" }, "anime"), { type: "show" })
})

test("a named title is a well-known one Discover would show", async () => {
	const at = index()
	const plain = async () => false
	const named = (query: string) => namedTitleKeys(at, query, new Date("2026-11-04T12:00:00Z"), plain)
	assert.deepEqual(await named("a"), [1e12 + 1], "1,000 votes or more; the 10-vote record isn't named")
	// Row 2 has no score, row 3 is adult: neither names a title.
	assert.deepEqual(await named("b"), [])
	assert.deepEqual(await named("b (cut)"), [])
	// "Movies like A" names A as a reference, not as what to find.
	assert.deepEqual(await namedTitleKeys(at, "a", new Date(), async () => true), [])
})
