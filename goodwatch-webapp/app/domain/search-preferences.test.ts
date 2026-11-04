import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
import type { ReadProposal } from "./search-preferences.ts"

const { interpret } = await import("./discover-query.ts")
const { preferencesFromParam, preferencesParam, readPlan, staysFilter } = await import("./search-preferences.ts")

const NOW = new Date("2026-11-04T12:00:00Z")

// The real interpreter's reading, as the interpret endpoint hands it to the plan.
function plan(query: string, existing = "", namedTitle = false, negated: string[] = []) {
	const view = interpret(query, existing, NOW)
	const proposals = view.proposals.filter(
		(p): p is typeof p & { status: ReadProposal["status"] } =>
			p.status === "applied" || p.status === "existing wins",
	)
	const params = new URLSearchParams(view.filters)
	if (view.semanticQuery) params.set("q", view.semanticQuery)
	return readPlan({
		params: params.toString(),
		existing,
		proposals,
		negated,
		namedTitle,
	})
}

test("descriptive genre and theme words become preferences, not filters", () => {
	const p = plan("Historical Action")
	assert.equal(p.branch, "positive")
	assert.deepEqual(
		p.preferences.map((x) => `${x.group}:${x.value}`).sort(),
		["genres:Action", "themes:history"],
	)
	assert.equal(p.filters.get("genres"), null)
	assert.equal(p.filters.get("themes"), null)
	// The original reading still knows both, for "matches every read filter" and the original pool.
	assert.equal(p.original.get("genres"), "Action")
	assert.equal(p.original.get("themes"), "history")
})

test("years and moods: years stay a filter, moods become preferences", () => {
	const p = plan("funny 90s dark scary epic")
	assert.deepEqual(p.preferences.map((x) => x.value).sort(), ["dark", "funny", "scary"])
	assert.equal(p.filters.get("minYear"), "1990")
	assert.equal(p.filters.get("maxYear"), "1999")
	assert.equal(p.filters.get("moods"), null)
})

test("true stories and the Animated form stay filters", () => {
	assert.equal(staysFilter("themes", "true"), true)
	assert.equal(staysFilter("styles", "animated"), true)
	assert.equal(staysFilter("themes", "history"), false)
	const p = plan("true stories horror")
	assert.deepEqual(p.preferences.map((x) => `${x.group}:${x.value}`), ["genres:Horror"])
	assert.equal(p.filters.get("themes"), "true")
})

test("the person's own filter wins and is never turned into a preference", () => {
	const p = plan("Historical Action", "genres=Comedy")
	assert.equal(p.filters.get("genres"), "Comedy")
	assert.ok(!p.preferences.some((x) => x.group === "genres"))
	const pinned = plan("Historical Action", "genres=Action&themes=history")
	assert.deepEqual(pinned.preferences, [])
	assert.equal(pinned.filters.get("genres"), "Action")
	assert.equal(pinned.filters.get("themes"), "history")
})

test("leaving something out keeps every read filter strict", () => {
	// The interpret endpoint finds the clause with the ranker's splitNegation.
	const p = plan("historical action without warfare", "", false, ["warfare"])
	assert.equal(p.branch, "exclusion")
	assert.deepEqual(p.preferences, [])
	assert.equal(p.filters.get("genres"), "Action")
})

test("a named title uses only the person's own filters", () => {
	const p = plan("The Big Short", "type=movie", true)
	assert.equal(p.branch, "title")
	assert.deepEqual(p.preferences, [])
	assert.equal(p.filters.toString(), "type=movie")
})

test("words that all became filters keep every filter strict", () => {
	const p = plan("90s movies")
	assert.equal(p.branch, "catalogue")
	assert.deepEqual(p.preferences, [])
	assert.equal(p.filters.get("type"), "movie")
	assert.equal(p.filters.get("minYear"), "1990")
})

test("the preference parameter round-trips and ignores junk", () => {
	const value = preferencesParam([
		{ group: "moods", value: "funny" },
		{ group: "genres", value: "Science Fiction" },
	])
	assert.deepEqual(preferencesFromParam(value), [
		{ group: "moods", value: "funny" },
		{ group: "genres", value: "Science Fiction" },
	])
	assert.deepEqual(preferencesFromParam("type:movie,moods:,:x,moods:<script>"), [])
})
