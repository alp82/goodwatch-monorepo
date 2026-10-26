import assert from "node:assert/strict"
import { test } from "node:test"
import { scoreWord } from "./ratings.ts"
import { SCORE_BANDS, scoreBandWords, scoreBandWordsFor } from "./score-bands.ts"

test("each person page score band names the words at both of its ends (Q12)", () => {
	assert.deepEqual(
		SCORE_BANDS.map((b) => [b.label, scoreBandWords(b)]),
		[
			["90 to 100", "Excellent to masterpiece"],
			["80 to 89", "Great to excellent"],
			["70 to 79", "Good to great"],
			["60 to 69", "Decent to good"],
			["30 to 59", "Bad to decent"],
			["0 to 29", "Unwatchable to bad"],
		],
	)
})

test("a band whose ends share a word shows that one word", () => {
	assert.equal(scoreBandWords({ min: 85, max: 94 }), "Excellent")
})

test("band words agree with scoreWord at both ends", () => {
	for (const b of SCORE_BANDS) {
		const words = scoreBandWords(b).toLowerCase()
		assert.ok(words.startsWith(scoreWord(b.min)!.toLowerCase()), b.label)
		assert.ok(words.endsWith(scoreWord(b.max)!.toLowerCase()), b.label)
	}
})

test("the bands cover 0 to 100 without gaps", () => {
	const sorted = [...SCORE_BANDS].sort((a, b) => a.min - b.min)
	assert.equal(sorted[0].min, 0)
	assert.equal(sorted.at(-1)!.max, 100)
	for (let i = 1; i < sorted.length; i++) assert.equal(sorted[i].min, sorted[i - 1].max + 1)
})

test("a key that isn't a band has no words", () => {
	assert.equal(scoreBandWordsFor("unrated"), null)
	assert.equal(scoreBandWordsFor("90"), "Excellent to masterpiece")
})
