import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const {
	FILTER_NAMES,
	MIN_MATCHES,
	clearSecondaryFilters,
	defaultFilterState,
	dropFilter,
	filterQuery,
	filterStateFromParams,
	filterStateToParams,
	secondaryFilterCount,
	sortFromParams,
} = await import("./filter-state.ts")

const defaults = { onMyServices: false, notSeenYet: false }
const parse = (query: string) =>
	filterStateFromParams(new URLSearchParams(query), defaults)

test("the taste match filter reads from and writes to `match`", () => {
	assert.deepEqual([...MIN_MATCHES], [0, 70, 80, 90])
	assert.ok(FILTER_NAMES.includes("minMatch"))
	assert.equal(defaultFilterState(defaults).minMatch, 0)
	assert.equal(parse("").minMatch, 0)
	for (const min of [70, 80, 90] as const) {
		const state = parse(`match=${min}`)
		assert.equal(state.minMatch, min)
		assert.equal(filterStateToParams(state, defaults).get("match"), String(min))
		assert.deepEqual(
			filterStateFromParams(filterStateToParams(state, defaults), defaults),
			state,
		)
	}
	// 0 is left out, and so is anything that isn't an option.
	assert.equal(
		filterStateToParams(parse("match=0"), defaults).has("match"),
		false,
	)
	assert.equal(parse("match=85").minMatch, 0)
	assert.equal(parse("match=abc").minMatch, 0)
	// Writing over existing parameters removes a `match` that no longer applies.
	const params = filterStateToParams(
		parse(""),
		defaults,
		new URLSearchParams("match=80&q=heat"),
	)
	assert.equal(params.toString(), "q=heat")
})

test("the taste match filter is a filter of the Filters sheet", () => {
	const state = parse("match=80&score=70")
	assert.equal(secondaryFilterCount(state), 2)
	assert.equal(dropFilter(state, "minMatch").minMatch, 0)
	assert.equal(dropFilter(state, "minMatch").minScore, 70)
	assert.equal(clearSecondaryFilters(state).minMatch, 0)
	assert.match(filterQuery(state, "match", defaults), /match=80/)
})

test("Best match is a sort, browsing and searching", () => {
	const sort = (query: string, searching: boolean) =>
		sortFromParams(new URLSearchParams(query), searching)
	assert.equal(sort("sort=match", false), "match")
	assert.equal(sort("sort=match", true), "match")
	assert.equal(sort("", false), "popular")
	assert.equal(sort("", true), "relevance")
	assert.equal(sort("sort=relevance", false), "popular")
	assert.match(filterQuery(parse(""), "match", defaults), /sort=match/)
})
