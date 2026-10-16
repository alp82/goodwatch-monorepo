import assert from "node:assert/strict"
import { test } from "node:test"
import { recommendable } from "./recommendable.ts"

const none = {
	seen: new Set<number>(),
	ratings: new Map<number, number>(),
	hidden: new Set<number>(),
	skipped: new Set<number>(),
}
const TITLE = 1e12 + 603

test("an unseen title can be a recommendation", () => {
	assert.equal(recommendable(none, TITLE), true)
	// On Want to See, still unseen.
	assert.equal(
		recommendable({ ...none, seen: new Set([1e12 + 1]) }, TITLE),
		true,
	)
})

test("a rated, watched, dismissed, or passed title can't", () => {
	assert.equal(
		recommendable({ ...none, ratings: new Map([[TITLE, 9]]) }, TITLE),
		false,
	)
	assert.equal(
		recommendable({ ...none, ratings: new Map([[TITLE, 3]]) }, TITLE),
		false,
	)
	assert.equal(recommendable({ ...none, seen: new Set([TITLE]) }, TITLE), false)
	assert.equal(
		recommendable({ ...none, hidden: new Set([TITLE]) }, TITLE),
		false,
	)
	assert.equal(
		recommendable({ ...none, skipped: new Set([TITLE]) }, TITLE),
		false,
	)
})
