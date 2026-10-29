import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { defaultFilterState } = await import("~/domain/filter-state")
const { titleKey } = await import("~/utils/title-key")
const {
	matchesLabel,
	moreCount,
	moreRows,
	togglePerson,
	toggleSteer,
	titlesLabel,
} = await import("./search-tab.ts")

const empty = defaultFilterState({ onMyServices: false, notSeenYet: false })
const dark = titleKey("show", 70523)
const parasite = titleKey("movie", 496243)

test("More like and Less like exclude each other", () => {
	const loved = toggleSteer(empty, "loved", dark)
	assert.deepEqual(loved.loved, [dark])
	const disliked = toggleSteer(loved, "disliked", dark)
	assert.deepEqual(disliked.disliked, [dark])
	assert.equal(disliked.loved, undefined)
	const back = toggleSteer(disliked, "loved", dark)
	assert.deepEqual(back.loved, [dark])
	assert.equal(back.disliked, undefined)
})

test("Like this is independent and toggles off to undefined", () => {
	const both = toggleSteer(toggleSteer(empty, "loved", dark), "similarTo", dark)
	assert.deepEqual(both.loved, [dark])
	assert.deepEqual(both.similarTo, [dark])
	const off = toggleSteer(both, "similarTo", dark)
	assert.equal(off.similarTo, undefined)
	assert.deepEqual(off.loved, [dark])
})

test("steering keeps other titles", () => {
	const two = toggleSteer(toggleSteer(empty, "loved", dark), "loved", parasite)
	assert.deepEqual(two.loved, [dark, parasite])
	assert.deepEqual(toggleSteer(two, "loved", dark).loved, [parasite])
})

test("people toggle as any of", () => {
	const one = togglePerson(empty, 525)
	assert.deepEqual(one.people, [525])
	assert.deepEqual(togglePerson(one, 31).people, [525, 31])
	assert.equal(togglePerson(one, 525).people, undefined)
})

test("More grows 4, 12, then 12 more", () => {
	assert.equal(moreRows(4), 12)
	assert.equal(moreRows(6), 12)
	assert.equal(moreRows(12), 24)
	assert.equal(moreRows(24), 36)
})

test("More's count", () => {
	assert.equal(moreCount(4, 13), "4 of 13")
	assert.equal(moreCount(4, 20, true), "4 of 20+")
	assert.equal(moreCount(13, 13), null)
	assert.equal(moreCount(20, 13), null)
})

test("labels", () => {
	const short = (n: number) => String(n)
	assert.equal(matchesLabel(100, short), "Top 100 matches")
	assert.equal(matchesLabel(1, short), "1 match")
	assert.equal(matchesLabel(42, short), "42 matches")
	assert.equal(titlesLabel(1), "1 title")
	assert.equal(titlesLabel(12), "12 titles")
})

test("person notes are short", async () => {
	const { personNote } = await import("./search-tab.ts")
	assert.equal(personNote({ role: "Actor", count: 5 }), "5 titles")
	assert.equal(personNote({ role: "Actor", count: 1 }), "1 title")
	assert.equal(personNote({ role: "Director", count: 4 }), "Director · 4")
	assert.equal(
		personNote({ role: "Director of Photography", count: 3 }),
		"Camera · 3",
	)
	assert.equal(
		personNote({ role: "Original Music Composer", count: 3 }),
		"Music · 3",
	)
	assert.equal(personNote({ role: "Sound", count: null }), "Music")
	assert.equal(personNote({ role: "Writer", count: null }), "Writer")
})
