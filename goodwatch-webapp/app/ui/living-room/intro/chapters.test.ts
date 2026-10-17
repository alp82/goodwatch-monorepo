// The film's chapters (scene.ts): their order is the film's order (film.ts builds the film from it), the quiz ends
// it, and "How GoodWatch works" below the room can name any chapter.
import assert from "node:assert/strict"
import { test } from "node:test"
import { CHAPTERS } from "./scene.ts"

test("the chapters come in the film's order, the quiz last", () => {
	assert.deepEqual(
		CHAPTERS.map((c) => c.name),
		[
			"Let's watch",
			"One score",
			"Streaming",
			"For you",
			"How it feels",
			"Search",
			"Filters",
			"Explorer",
			"Tracking",
			"Your ratings",
			"Your turn",
		],
	)
	assert.equal(CHAPTERS.at(-1)?.id, "closer")
})

test("every chapter has its own id", () => {
	assert.equal(new Set(CHAPTERS.map((c) => c.id)).size, CHAPTERS.length)
})
