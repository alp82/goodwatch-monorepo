import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { filterStateFromParams, filterStateToParams, resolveFilterChange } =
	await import("~/domain/filter-state")
const {
	MATCH_ROWS,
	groupOn,
	groupsFull,
	listHides,
	listPatch,
	matchLabel,
	matchLit,
	matchPatch,
	matchStepOf,
	shareOf,
	toggleGroup,
} = await import("./you-choices")

const defaults = { onMyServices: false, notSeenYet: true }
const parse = (query: string) =>
	filterStateFromParams(new URLSearchParams(query), defaults)

const groups = [
	{ key: "movie-603", number: 1 },
	{ key: "show-95396", number: 2 },
	{ key: "movie-129", number: 3 },
	{ key: "movie-496243", number: 4 },
]

test("match rows run from 90%+ down to Any, then Outside your usual", () => {
	assert.deepEqual(MATCH_ROWS.map(matchLabel), [
		"90%+",
		"80%+",
		"70%+",
		"60%+",
		"Any",
		"Outside your usual",
	])
})

test("the match step reads and writes minMatch and outsideUsual", () => {
	assert.equal(matchStepOf(parse("match=80")), 80)
	assert.equal(matchStepOf(parse("match=outside")), "outside")
	assert.equal(matchStepOf(parse("")), 0)
	assert.deepEqual(matchPatch("outside"), { minMatch: 0, outsideUsual: true })
	assert.deepEqual(matchPatch(60), { minMatch: 60, outsideUsual: undefined })
})

test("rows from the pick up are lit; Any and Outside your usual light nothing", () => {
	assert.deepEqual(
		MATCH_ROWS.filter((step) => matchLit(step, 70)),
		[90, 80, 70],
	)
	assert.deepEqual(
		MATCH_ROWS.filter((step) => matchLit(step, 0)),
		[],
	)
	assert.deepEqual(
		MATCH_ROWS.filter((step) => matchLit(step, "outside")),
		[],
	)
})

test("a group is on by its key or an old link's number", () => {
	assert.equal(groupOn(parse("taste=movie-603"), groups[0]), true)
	assert.equal(groupOn(parse("taste=2"), groups[1]), true)
	assert.equal(groupOn(parse("taste=2"), groups[0]), false)
})

test("toggling picks by key, unpicks every reference, and refuses a fourth pick", () => {
	const empty = parse("")
	assert.deepEqual(toggleGroup(empty, groups[0], groups), {
		tasteGroups: ["movie-603"],
	})
	assert.deepEqual(toggleGroup(parse("taste=1"), groups[0], groups), {
		tasteGroups: undefined,
	})
	const three = parse("taste=movie-603,show-95396,movie-129")
	assert.equal(groupsFull(three, groups), true)
	assert.equal(toggleGroup(three, groups[3], groups), null)
	assert.deepEqual(toggleGroup(three, groups[1], groups), {
		tasteGroups: ["movie-603", "movie-129"],
	})
	// A reference to a group the member no longer has doesn't take a pick.
	assert.equal(
		groupsFull(parse("taste=movie-603,show-95396,movie-1"), groups),
		false,
	)
})

test("a third pick survives the URL limit after stale references are removed", () => {
	const state = parse("taste=movie-603,movie-1,show-95396")
	const patch = toggleGroup(state, groups[2], groups)
	assert.deepEqual(patch, {
		tasteGroups: ["movie-603", "show-95396", "movie-129"],
	})
	const params = filterStateToParams({ ...state, ...patch }, defaults)
	assert.deepEqual(
		filterStateFromParams(params, defaults).tasteGroups,
		patch?.tasteGroups,
	)
})

test("picks normalize numeric aliases and duplicate keys before adding or removing", () => {
	const state = parse("taste=2,show-95396,1")
	assert.deepEqual(toggleGroup(state, groups[2], groups), {
		tasteGroups: ["show-95396", "movie-603", "movie-129"],
	})
	assert.deepEqual(toggleGroup(state, groups[0], groups), {
		tasteGroups: ["show-95396"],
	})
	assert.deepEqual(
		toggleGroup(parse("taste=1,movie-603,movie-1"), groups[0], groups),
		{
			tasteGroups: undefined,
		},
	)
})

test("lists hide what is left out: off minus what each keeps", () => {
	const counts = {
		notSeenYet: { on: 900, off: 1000, seen: 100 },
		wishlist: { on: 38, off: 1000 },
	} as never
	assert.equal(listHides(counts, "notSeenYet"), 100)
	assert.equal(listHides(counts, "seenBefore"), 900)
	assert.equal(listHides(counts, "onWishlist"), 962)
	assert.equal(listHides(null, "notSeenYet"), null)
})

test("Not seen yet and Seen before exclude each other once resolved", () => {
	const unseen = parse("")
	const seen = resolveFilterChange(unseen, {
		...unseen,
		...listPatch("seenBefore", true),
	})
	assert.equal(seen.seenBefore, true)
	assert.equal(seen.notSeenYet, false)
	assert.deepEqual(listPatch("onWishlist", false), { onWishlist: undefined })
})

test("bars measure against the biggest count", () => {
	assert.equal(shareOf(50, 200), 0.25)
	assert.equal(shareOf(null, 200), 0)
	assert.equal(shareOf(10, 0), 0)
})
