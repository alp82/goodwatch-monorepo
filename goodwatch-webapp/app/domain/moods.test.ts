import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { MOODS, MOOD_KEYS, moodsInText, parseMoods } = await import("./moods.ts")

const renamed = [
	["feelgood", "Cozy", "Feel-good"],
	["romance", "Romantic", "Romance"],
	["action", "Thrilling", "Action"],
	["heavy", "Sad", "Heavy"],
	["mind", "Trippy", "Mind-bending"],
] as const

test("mood URL keys stay stable", () => {
	for (const [key] of renamed) assert.deepEqual(parseMoods(key), [key])
	assert.deepEqual(MOOD_KEYS, [
		"funny",
		"feelgood",
		"romance",
		"action",
		"scary",
		"crime",
		"mind",
		"heavy",
		"worlds",
		"history",
		"growing",
	])
})

test("mood text matching recognizes old and new mood words without matching parts of words", () => {
	for (const [key, name, alias] of renamed) {
		for (const word of [
			name,
			alias,
			alias.toUpperCase(),
			alias.replace(/-/g, " "),
		]) {
			assert.deepEqual(
				moodsInText(`${word} movies`).map((mood) => mood.key),
				[key],
			)
			assert.deepEqual(
				moodsInText(`shows, ${word}!`).map((mood) => mood.key),
				[key],
			)
		}
	}
	assert.deepEqual(moodsInText("saddle reaction heavyset mindless"), [])
	assert.deepEqual(
		moodsInText("Cozy feel-good movies").map((mood) => mood.key),
		["feelgood"],
	)
})

test("only the four topic moods are reserved to stay outside the future Feel column", () => {
	assert.deepEqual(
		MOODS.filter((mood) => !mood.feel).map((mood) => mood.key),
		["crime", "worlds", "history", "growing"],
	)
	assert.equal(MOODS.filter((mood) => mood.feel).length, 7)
})
