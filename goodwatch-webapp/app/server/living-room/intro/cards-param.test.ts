import assert from "node:assert/strict"
import { test } from "node:test"
import { MAX_CARDS, parseCardsParam } from "./cards-param.ts"

test("reads movies and shows as title keys", () => {
	assert.deepEqual(
		parseCardsParam("movie:603,show:1396"),
		[1_000_000_000_603, 2_000_000_001_396],
	)
})

test("leaves out anything else, and keeps at most MAX_CARDS", () => {
	assert.deepEqual(
		parseCardsParam("person:1,movie:abc,,movie:12; DROP,show:-1"),
		[],
	)
	const many = Array.from({ length: 20 }, (_, i) => `movie:${i + 1}`).join(",")
	assert.equal(parseCardsParam(many).length, MAX_CARDS)
})
