import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"
import type { Reading } from "./read-items.ts"

const { interpret } = await import("~/domain/discover-query")
const { DISCOVER_DEFAULTS } = await import("~/domain/discover-search")
const { filterStateFromParams } = await import("~/domain/filter-state")
const { readPlan } = await import("~/domain/search-preferences")
const { hasItem, readFilterChange, readItems, readText, scopeOwner, searchReadingState, shownState, withOff } = await import(
	"./read-items.ts"
)

const NOW = new Date("2026-11-04T12:00:00Z")
const defaults = DISCOVER_DEFAULTS

// The interpret endpoint's answer for the words, from the real interpreter.
function reading(query: string, existing = ""): Reading {
	const view = interpret(query, existing, NOW)
	const params = new URLSearchParams(view.filters)
	if (view.semanticQuery) params.set("q", view.semanticQuery)
	return {
		query,
		params: params.toString(),
		proposals: view.proposals.map((p) => ({
			parameter: p.parameter,
			value: p.value,
			phrase: p.phrase,
			status: p.status ?? "",
		})),
		negated: [],
	}
}

function itemsFor(query: string, existing = "", off: string[] = []) {
	const r = reading(query, existing)
	const plan = readPlan({
		params: r.params,
		existing,
		proposals: r.proposals.filter(
			(p): p is typeof p & { status: "applied" | "existing wins" } =>
				p.status === "applied" || p.status === "existing wins",
		),
		negated: r.negated,
		namedTitle: false,
	})
	return readItems({ reading: r, existing, plan, off, defaults })
}

test("readText leaves out the switched-off phrases, whole words only", () => {
	assert.equal(readText("funny 90s pirates", ["90s"]), "funny pirates")
	assert.equal(readText("funny pirates", ["fun"]), "funny pirates")
	assert.equal(readText("pirates", ["Pirates"]), null)
	assert.equal(readText(null, []), null)
})

test("moods are preferences, years a filter, the rest one run of words", () => {
	const items = itemsFor("funny 90s pirates")
	const mood = items.find((item) => item.params.some(([k]) => k === "moods"))
	assert.ok(mood?.soft, "the mood ranks, it doesn't filter")
	const years = items.find((item) => item.params.some(([k]) => k === "minYear"))
	assert.equal(years?.soft, false)
	assert.equal(years?.field, "Released")
	const words = items.filter((item) => item.words)
	assert.deepEqual(
		words.map((item) => item.phrase),
		["pirates"],
	)
	assert.equal(scopeOwner(items), "pirates")
})

test("a switched-off item stays listed, off", () => {
	const items = itemsFor("funny 90s pirates", "", ["90s"])
	const years = items.find((item) => item.phrase === "90s")
	assert.equal(years?.on, false)
})

test("the person's own choice sets the words aside", () => {
	const items = itemsFor("funny pirates", "moods=dark")
	const aside = items.find((item) => item.aside)
	assert.equal(aside?.aside, "Mood")
	assert.equal(aside?.on, false)
})

test("a fourth mood isn't 'already there' because Discover keeps three", () => {
	const state = filterStateFromParams(new URLSearchParams("moods=funny,dark,scary"), defaults)
	assert.equal(hasItem(state, { params: [["moods", "epic"]] }, defaults), false)
	assert.equal(hasItem(state, { params: [["moods", "dark"]] }, defaults), true)
})

test("the controls show read items on; removing one there switches it off, not into a filter", () => {
	const items = itemsFor("funny 90s pirates")
	const own = filterStateFromParams(new URLSearchParams(), defaults)
	const shown = shownState(own, items, defaults)
	assert.ok(shown.years, "Released 1990–1999 shows in the controls")
	// The person clears Released in a panel.
	const next = { ...shown, years: undefined, released: "any" as const }
	const change = readFilterChange({ own, next, items, off: [], defaults })
	assert.deepEqual(change.off, ["90s"])
	assert.equal(change.own.years, undefined)
	assert.ok(!change.own.moods?.length, "the read mood doesn't become the person's own")
})

test("a change that brings a switched-off item back switches it on", () => {
	const items = itemsFor("funny 90s pirates", "", ["90s"])
	const own = filterStateFromParams(new URLSearchParams(), defaults)
	const shown = shownState(own, items, defaults)
	const next = filterStateFromParams(new URLSearchParams("minYear=1990&maxYear=1999"), defaults)
	const change = readFilterChange({ own, next: { ...shown, ...next, moods: shown.moods }, items, off: ["90s"], defaults })
	assert.deepEqual(change.off, [])
})

test("withOff writes only the off list and goes back to page one", () => {
	const out = withOff(new URLSearchParams("q=a&off=x&page=3"), ["y", "z"])
	assert.equal(out.toString(), "q=a&off=y&off=z")
})

// The page's flow through the state the hook returns: the whole query's reading, the reading of the words switched
// on (null when none are), and the plan the search and the results use.
function stateFor(query: string, off: string[], existing = "") {
	const text = readText(query, off)
	return searchReadingState({
		typed: query,
		text,
		read: text === null ? null : reading(text, existing),
		whole: reading(query, existing),
		existing,
		namedTitle: false,
		off,
		defaults,
	})
}

test("switching off the last part settles on the person's own filters: no search, no preferences", () => {
	const all = stateFor("epic pirates", [])
	assert.equal(all.plan?.branch, "positive")
	const phrases = all.items.map((item) => item.phrase)
	const cleared = stateFor("epic pirates", phrases, "type=movie")
	assert.equal(cleared.plan?.branch, "catalogue", "settled, not waiting for a reading")
	assert.deepEqual(cleared.plan?.preferences, [])
	assert.equal(cleared.plan?.filters.toString(), "type=movie", "only the person's own filter")
	assert.equal(cleared.words, "", "no words to search")
	assert.ok(cleared.items.length > 0 && cleared.items.every((item) => !item.on), "the parts stay listed, off")
})

test("Clear on a mood, years and words query keeps nothing read; Restore reads it all again", () => {
	const query = "funny 90s dark scary epic"
	const phrases = stateFor(query, []).items.filter((item) => !item.aside).map((item) => item.phrase)
	const cleared = stateFor(query, phrases)
	assert.equal(cleared.plan?.branch, "catalogue")
	assert.equal(cleared.plan?.filters.toString(), "")
	// Shown on the controls: nothing read (the moods and years are off).
	const own = filterStateFromParams(new URLSearchParams(), defaults)
	const shown = shownState(own, cleared.items, defaults)
	assert.equal(shown.years, undefined)
	assert.ok(!shown.moods?.length)
	const restored = stateFor(query, [])
	assert.equal(restored.plan?.branch, "positive")
	assert.deepEqual(restored.plan?.preferences.map((p) => p.value).sort(), ["dark", "funny", "scary"])
	assert.equal(restored.plan?.filters.get("minYear"), "1990")
})

test("the last plain word off, with a read filter still on: Discover's list for that filter", () => {
	const state = stateFor("pirates last 10 years", ["pirates"])
	assert.equal(state.plan?.branch, "catalogue")
	assert.equal(state.plan?.filters.get("minYear"), "2017")
})
