import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { defaultFilterState } = await import("~/domain/filter-state")
const {
	closePanel,
	initialPanel,
	openAtGroup,
	openSubTab,
	openTab,
	panelCounts,
	pickSubTab,
	setFind,
	shownSubTab,
} = await import("./panel-state.ts")
const { countsFlags } = await import("./tabs.ts")

type Context = Parameters<typeof shownSubTab>[3]

const LADDER = {
	country: "US",
	local: true,
	steps: [
		{ age: 0, label: "G", show: "TV-G" },
		{ age: 14, label: "PG-13", show: "TV-14" },
	],
}
const withLadder: Context = { member: true, ladder: LADDER, query: null }
const noLadder: Context = { member: true, ladder: null, query: null }
const empty = defaultFilterState({ onMyServices: false, notSeenYet: false })
const picked = { ...empty, moods: ["funny" as const] }

test("closed at first, every tab on its default sub-tab", () => {
	const panel = initialPanel(empty)
	assert.equal(panel.open, null)
	assert.deepEqual(panel.sub, {
		search: "titles",
		mood: "combos",
		watch: "services",
		you: "taste",
	})
	assert.equal(openSubTab(panel, empty, withLadder), null)
})

test("tabs slide in tab order", () => {
	let panel = openTab(initialPanel(empty), "watch", empty)
	assert.equal(panel.open, "watch")
	panel = openTab(panel, "search", empty)
	assert.equal(panel.dir, -1)
	panel = openTab(panel, "you", empty)
	assert.equal(panel.dir, 1)
})

test("Mood opens on Everything once something is picked, else on Combos", () => {
	assert.equal(openTab(initialPanel(empty), "mood", empty).sub.mood, "combos")
	assert.equal(
		openTab(initialPanel(empty), "mood", picked).sub.mood,
		"everything",
	)
	// Staying on Mood keeps the sub-tab the person chose.
	const onCombos = pickSubTab(
		openTab(initialPanel(empty), "mood", picked),
		"combos",
	)
	assert.equal(openTab(onCombos, "mood", picked).sub.mood, "combos")
})

test("a tab opens on the sub-tab it was on last, or the one asked for", () => {
	let panel = pickSubTab(openTab(initialPanel(empty), "watch", empty), "scores")
	panel = openTab(closePanel(panel), "watch", empty)
	assert.equal(panel.sub.watch, "scores")
	assert.equal(openTab(panel, "watch", empty, "length").sub.watch, "length")
	// A sub-tab of another tab is ignored.
	assert.equal(openTab(panel, "watch", empty, "titles").sub.watch, "scores")
})

test("a chip opens the sub-tab that owns its group", () => {
	const panel = openAtGroup(initialPanel(empty), "minScore", empty)
	assert.equal(panel.open, "watch")
	assert.equal(panel.sub.watch, "scores")
	assert.equal(
		openAtGroup(initialPanel(empty), "people", empty).sub.search,
		"people",
	)
	// Old URLs' filters live in no tab.
	assert.equal(openAtGroup(initialPanel(empty), "legacy", empty).open, null)
})

test("Find's text stays across tabs; a sub-tab or closing ends it", () => {
	let panel = setFind(openTab(initialPanel(empty), "mood", empty), "cozy")
	panel = openTab(panel, "watch", empty)
	assert.equal(panel.find, "cozy")
	assert.equal(pickSubTab(panel, "released").find, "")
	assert.equal(closePanel(panel).find, "")
	assert.equal(closePanel(panel).open, null)
})

test("a hidden sub-tab falls back to the tab's first", () => {
	const panel = pickSubTab(openTab(initialPanel(empty), "watch", empty), "age")
	assert.equal(shownSubTab(panel, "watch", empty, withLadder), "age")
	assert.equal(shownSubTab(panel, "watch", empty, noLadder), "services")
	assert.equal(openSubTab(panel, empty, noLadder), "services")
})

test("requests ask for the open sub-tab's counts only", () => {
	assert.deepEqual(countsFlags(null), [])
	assert.deepEqual(countsFlags("services"), [])
	assert.deepEqual(countsFlags("popularity"), ["popularity"])
	assert.deepEqual(countsFlags("released"), ["released"])
	assert.deepEqual(countsFlags("length"), ["length"])
	assert.deepEqual(countsFlags("madeIn"), ["origin"])
	assert.deepEqual(countsFlags("taste"), ["taste"])
})

test("the panel asks for the counts of the sub-tab on screen", () => {
	const watch = openTab(initialPanel(empty), "watch", empty)
	assert.deepEqual(
		panelCounts(closePanel(pickSubTab(watch, "released")), empty),
		[],
	)
	assert.deepEqual(panelCounts(pickSubTab(watch, "released"), empty), [
		"released",
	])
	assert.deepEqual(panelCounts(pickSubTab(watch, "age"), empty), [])
	assert.deepEqual(panelCounts(openTab(watch, "you", empty), empty), ["taste"])
})
