import assert from "node:assert/strict"
import { test } from "node:test"
import { goodwatchScoreDisplay, hasGoodwatchScore } from "./ratings.ts"

test("catalog zero and missing or invalid scores are unrated", () => {
	for (const score of [0, null, undefined, NaN, Infinity, -Infinity, -1, "85"]) {
		assert.equal(hasGoodwatchScore(score), false, `score ${score}`)
	}
})

test("positive scores are rated before rounding for display", () => {
	for (const score of [0.5, 1, 85.9, 100]) {
		assert.equal(hasGoodwatchScore(score), true)
	}
	assert.equal(goodwatchScoreDisplay(85.9), 85)
})
