import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

const { moodsInText } = await import("../../domain/moods.ts")

test("mood text matching recognizes old and new names by the same stable key", () => {
	for (const [key, name, alias] of [
		["feelgood", "Cozy", "feel-good"],
		["romance", "Romantic", "romance"],
		["action", "Thrilling", "action"],
		["heavy", "Sad", "heavy"],
		["mind", "Trippy", "mind-bending"],
		...["tense", "dark", "deep", "magical", "quirky"].map((key) => [
			key,
			key,
			key.toUpperCase(),
		]),
	]) {
		for (const word of [name, alias])
			assert.deepEqual(
				moodsInText(`${word} movies`).map((mood) => mood.key),
				[key],
			)
	}
})
