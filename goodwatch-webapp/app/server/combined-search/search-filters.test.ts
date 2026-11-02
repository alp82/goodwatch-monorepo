import assert from "node:assert/strict"
import { test } from "node:test"
import {
	parseSearchFilters,
	searchFiltersKey,
	withTitleScope,
} from "./search-filters.ts"
test("people filters admit only bounded numeric IDs and participate in the cache key", () => {
	assert.deepEqual(
		parseSearchFilters({ people: [31, 287, 31, -1, "31", NaN, Infinity, 1e10] })
			.people,
		[31, 287],
	)
	assert.equal(
		parseSearchFilters({ people: Array.from({ length: 30 }, (_, i) => i + 1) })
			.people?.length,
		20,
	)
	assert.equal(
		searchFiltersKey({ people: [31, 287] }),
		searchFiltersKey({ people: [287, 31] }),
	)
	assert.notEqual(
		searchFiltersKey({ people: [31] }),
		searchFiltersKey({ people: [287] }),
	)
	assert.equal(
		parseSearchFilters({ onlyTitles: ["movie:123"] }).onlyTitles,
		undefined,
	)
})
test("independent title restrictions intersect and an empty scope stays empty", () => {
	assert.deepEqual(
		withTitleScope({ onlyTitles: ["movie:1", "movie:2"] }, [
			"movie:2",
			"movie:3",
		])?.onlyTitles,
		["movie:2"],
	)
	assert.deepEqual(
		withTitleScope({ onlyTitles: [] }, ["movie:2"])?.onlyTitles,
		[],
	)
	assert.deepEqual(withTitleScope(undefined, [])?.onlyTitles, [])
	assert.equal(withTitleScope(undefined, undefined), undefined)
})
