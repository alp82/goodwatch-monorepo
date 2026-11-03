import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
const { withSearchFilters } = await import("./discover-search.ts")
const { defaultFilterState } = await import("./filter-state.ts")
const DEFAULT_FILTER_STATE = defaultFilterState({ onMyServices: false, notSeenYet: false })

const counts = { total: 30, hidden: 5, recoveries: [{ filter: "moods" as const, titles: 5 }], optionCounts: {} as never }
const scope = { country: "DE", services: [8] }

test("search mode: the search's own filters get the topic's counts, the rest are set in search", () => {
	const state = { ...DEFAULT_FILTER_STATE, years: { min: 2020, max: 2020 }, anime: "none" as const, genres: ["Comedy"] }
	const out = withSearchFilters(counts, state, scope, { hidden: 95, years: 89, anime: 0 })
	assert.equal(out.hidden, 5 + 95, "titles both filters keep out count in the total")
	assert.deepEqual(out.recoveries, [
		{ filter: "years", titles: 89 },
		{ filter: "moods", titles: 5 },
	])
	assert.deepEqual(out.inSearch, ["genres"], "anime counted (0: no effect), the genre isn't countable")
	assert.deepEqual(withSearchFilters(counts, state, scope, undefined).inSearch, ["anime", "genres", "years"])
	assert.equal(withSearchFilters(counts, DEFAULT_FILTER_STATE, scope, undefined), counts)
})
