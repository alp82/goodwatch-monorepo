import assert from "node:assert/strict"
import test from "node:test"
import { GOAL, startWords, stepNote, stepsReached } from "./steps.ts"

test("step 1 asks where the member keeps track, then names the picked source", () => {
	assert.equal(
		startWords({ step: 1, liked: 0 }).title,
		"Where do you keep track of what you watch?",
	)
	assert.equal(
		startWords({ step: 1, liked: 0, source: { name: "IMDb" } }).title,
		"Bring your IMDb library",
	)
	assert.match(
		startWords({ step: 1, liked: 0, source: { name: "TMDB", connect: true } })
			.text,
		/^Connect TMDB once/,
	)
})

test("step 1 stops asking for the file once it is in", () => {
	assert.match(
		startWords({ step: 1, liked: 0, source: { name: "IMDb" }, file: true })
			.text,
		/^Check what GoodWatch found/,
	)
})

test("step 2 counts down the liked titles, and says when the server wants more", () => {
	assert.equal(
		startWords({ step: 2, liked: 0 }).title,
		"What have you loved watching?",
	)
	assert.equal(
		startWords({ step: 2, liked: 2 }).title,
		`${GOAL - 2} more you liked.`,
	)
	assert.equal(
		startWords({ step: 2, liked: GOAL }).title,
		"Almost there. A few more you liked.",
	)
	assert.match(
		startWords({ step: 2, liked: 9, short: true }).text,
		/needs a few more/,
	)
})

test("step 3 names how many liked titles the taste is built from", () => {
	assert.equal(
		startWords({ step: 3, liked: 1204 }).text,
		"Built from 1,204 titles you liked. GoodWatch grouped what they share.",
	)
})

test("notes and the filled line follow imports and ratings", () => {
	assert.equal(stepNote(1, { step: 1, liked: 0 }), "Optional · fastest")
	assert.equal(
		stepNote(1, { step: 1, liked: 0, importedFrom: "Letterboxd" }),
		"Letterboxd imported",
	)
	assert.equal(stepNote(2, { step: 2, liked: 9 }), `${GOAL} of ${GOAL} liked`)
	assert.equal(stepsReached({ step: 1, liked: 0 }), 0)
	assert.equal(stepsReached({ step: 1, liked: 0, importedFrom: "IMDb" }), 1)
	assert.equal(stepsReached({ step: 1, liked: GOAL }), 2)
})
