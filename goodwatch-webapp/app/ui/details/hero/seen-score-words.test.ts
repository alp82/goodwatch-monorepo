// What the question before Not seen says it removes, and what its button says.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { notSeenWords } from "./seen-score-words.ts"

describe("notSeenWords", () => {
	it("names the score of a movie Seen through its score alone", () => {
		assert.deepEqual(notSeenWords(7, 0), {
			text: "This removes your score of 7 (Good). Only movies you've seen have a score.",
			action: "Remove score",
		})
	})

	it("names the logged watches of a movie without a score", () => {
		assert.deepEqual(notSeenWords(null, 1), {
			text: "This removes your watch.",
			action: "Remove watch",
		})
		assert.deepEqual(notSeenWords(null, 3), {
			text: "This removes your 3 watches.",
			action: "Remove watches",
		})
	})

	it("names both when there are both", () => {
		assert.deepEqual(notSeenWords(9, 2), {
			text: "This removes your score of 9 (Excellent) and your 2 watches. Only movies you've seen have a score.",
			action: "Remove score and watches",
		})
	})

	it("says what it does while the log is still read", () => {
		assert.deepEqual(notSeenWords(null, null), {
			text: "This marks it as not seen.",
			action: "Mark as not seen",
		})
	})
})
