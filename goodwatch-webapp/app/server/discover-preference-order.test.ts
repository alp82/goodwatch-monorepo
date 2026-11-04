import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const { composeOrders, fitsComposition, foldIdentities, preferenceStrength, withPreferences } = await import(
	"./discover-preference-order.ts"
)
const { VALID_FINGERPRINT_KEYS } = await import("~/server/utils/fingerprint")
const { defaultFilterState } = await import("~/domain/filter-state")
const { DISCOVER_DEFAULTS } = await import("~/domain/discover-search")

const byKey = (a: number, b: number) => a - b

test("Relevance keeps the search's order, nudged by fit, then the original matches it lacks", () => {
	// Positions 1..4; title 4 fits fully, the rest not at all. A quarter weight can lift it only past close neighbours.
	const fit = new Map([[4, 1]])
	const orders = composeOrders({
		wider: [1, 2, 3, 4],
		admitted: [4, 9],
		strength: (key) => fit.get(key) ?? 0,
		byRating: byKey,
	})
	assert.equal(orders.relevance[0], 4, "a title that fits rises above its close neighbours")
	assert.deepEqual(orders.relevance.slice(1), [1, 2, 3, 9])
	assert.deepEqual(orders.original, [4, 9])
})

test("a far-down title that fits doesn't jump to the top", () => {
	const wider = Array.from({ length: 1000 }, (_, i) => i + 1)
	const orders = composeOrders({
		wider,
		admitted: [],
		strength: (key) => (key === 900 ? 1 : 0),
		byRating: byKey,
	})
	assert.ok(orders.relevance.indexOf(900) > 100)
})

test("Top rated lists the original matches first, then the rest by rating; both sorts list the same titles", () => {
	const orders = composeOrders({
		wider: [5, 6, 7],
		admitted: [7, 8],
		strength: () => 0,
		// Higher key, higher rating.
		byRating: (a, b) => b - a,
	})
	assert.deepEqual(orders.top, [7, 8, 6, 5])
	assert.deepEqual([...orders.top].sort(byKey), [...orders.relevance].sort(byKey))
})

test("past 5,000 titles the composition can't be sent on", () => {
	const wider = Array.from({ length: 5001 }, (_, i) => i + 1)
	const orders = composeOrders({ wider, admitted: [], strength: () => 1, byRating: byKey })
	assert.equal(fitsComposition(orders), false)
	assert.equal(fitsComposition(composeOrders({ wider: [1], admitted: [], strength: () => 1, byRating: byKey })), true)
})

test("withPreferences adds each read preference to its group once", () => {
	const state = { ...defaultFilterState(DISCOVER_DEFAULTS), moods: ["funny"] } as ReturnType<typeof defaultFilterState>
	const out = withPreferences(state, [
		{ group: "moods", value: "funny" },
		{ group: "moods", value: "dark" },
		{ group: "genres", value: "Action" },
	])
	assert.deepEqual(out.moods, ["funny", "dark"])
	assert.deepEqual(out.genres, ["Action"])
	assert.deepEqual(state.moods, ["funny"], "the state it was given is unchanged")
})

test("strength: the mean fit of the preferences, shows' War read from the fingerprint", () => {
	const print = new Uint8Array(VALID_FINGERPRINT_KEYS.length).fill(255)
	print[(VALID_FINGERPRINT_KEYS as readonly string[]).indexOf("warfare")] = 6
	const snapshot = {
		facts: () => ({ genres: ["War & Politics", "Drama"], moods: ["dark"], mediaType: "show" }),
		fingerprint: () => print,
	} as unknown as Parameters<typeof preferenceStrength>[0]
	assert.equal(preferenceStrength(snapshot, 1, [{ group: "moods", value: "dark" }]), 1)
	assert.equal(preferenceStrength(snapshot, 1, [{ group: "genres", value: "War" }]), 0.6)
	assert.equal(
		preferenceStrength(snapshot, 1, [
			{ group: "moods", value: "dark" },
			{ group: "moods", value: "funny" },
		]),
		0.5,
	)
	assert.equal(preferenceStrength(snapshot, 1, []), 1)
})

test("foldIdentities: the original key replaces the wider one only when it passes", () => {
	assert.deepEqual(foldIdentities([1, 2, 3], [20], [[2, 20], [3, 30]]), { wider: [1, 20, 3], replaced: new Set([2]) })
	// Both keys listed already: the title stays once, where the wider pool had it first.
	assert.deepEqual(foldIdentities([2, 20], [20], [[2, 20]]).wider, [20])
	assert.deepEqual(foldIdentities([1], [], []).wider, [1])
})
