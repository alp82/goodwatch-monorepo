import assert from "node:assert/strict"
import { test } from "node:test"
import { goodwatchScoreDisplay, hasGoodwatchScore, scoreWord } from "./ratings.ts"

test("a GoodWatch score's word rounds to the nearest band, as on the title page (#750)", () => {
	const cases: [number, string][] = [
		[0, "Unwatchable"],
		[4, "Unwatchable"],
		[5, "Unwatchable"],
		[14, "Unwatchable"],
		[15, "Terrible"],
		[92, "Excellent"],
		[94.9, "Excellent"],
		[95, "Masterpiece"],
		[100, "Masterpiece"],
	]
	for (const [score, word] of cases) assert.equal(scoreWord(score), word, `score ${score}`)
})

test("a missing GoodWatch score has no word", () => {
	assert.equal(scoreWord(null), null)
	assert.equal(scoreWord(undefined), null)
	assert.equal(scoreWord(NaN), null)
})

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
