import assert from "node:assert/strict"
import { test } from "node:test"
import { openingOf } from "./opening.ts"

const opening = (query: string) => openingOf(new URLSearchParams(query))

test("an address without a grouping opens on the whole world", () => {
	assert.equal(opening(""), null)
	assert.equal(opening("mix=mood:dark"), null)
})

test("a grouping opens on its region", () => {
	assert.deepEqual(opening("grouping=decade"), {
		grouping: "decade",
		island: null,
	})
})

test("a grouping with an island opens inside the island, as the TV's Expand key asks", () => {
	assert.deepEqual(opening("grouping=mood&island=funny"), {
		grouping: "mood",
		island: "funny",
	})
})

test("an island without its grouping, or with one the map lacks, opens nothing", () => {
	assert.equal(opening("island=funny"), null)
	assert.equal(opening("grouping=genre&island=funny"), null)
})

test("an empty island is the region", () => {
	assert.deepEqual(opening("grouping=mood&island="), {
		grouping: "mood",
		island: null,
	})
})
