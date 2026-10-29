import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const {
	MOODS,
	MOOD_KEYS,
	moodsInText,
	parseMoods,
	moodsOf,
	moodMaskOf,
	moodsInMask,
} = await import("./moods.ts")

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
		"tense",
		"dark",
		"deep",
		"magical",
		"quirky",
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
	assert.equal(MOODS.filter((mood) => mood.feel).length, 12)
})

const { VALID_FINGERPRINT_KEYS } = await import(
	"../server/utils/fingerprint.ts"
)
const fingerprint = (scores: Record<string, number>) =>
	Object.fromEntries(
		VALID_FINGERPRINT_KEYS.map((key) => [key, scores[key] ?? 0]),
	)

test("new moods use the fixed Explorer thresholds on object and ordered fingerprints", async () => {
	const { MOODS: islands } = await import(
		"../server/explorer/islands.server.ts"
	)
	const fixtures = [
		[
			"tense",
			{ tension: 8, adrenaline: 6, scare: 6 },
			[{ tension: 7 }, { tension: 8, adrenaline: 7 }, { tension: 8, scare: 7 }],
		],
		["dark", { bleakness: 8 }, [{ bleakness: 7 }]],
		["deep", { philosophical: 8 }, [{ philosophical: 7 }]],
		["magical", { wonder: 8 }, [{ wonder: 7 }]],
		["quirky", { eccentricity: 8 }, [{ eccentricity: 7 }]],
	] as const
	for (const [key, matching, counters] of fixtures) {
		const island = islands.find((island) => island.id === key)
		assert.ok(island, key)
		for (const [scores, expected] of [
			[matching, true],
			...counters.map((s) => [s, false]),
		] as [Record<string, number>, boolean][]) {
			const fp = fingerprint(scores)
			assert.equal(moodsOf(fp, []).includes(key), expected, key)
			assert.equal(
				moodsOf(
					VALID_FINGERPRINT_KEYS.map((k) => fp[k]),
					[],
				).includes(key),
				expected,
				key,
			)
			assert.equal(island.level((k) => fp[k], []) >= island.from, expected, key)
		}
		assert.deepEqual(
			moodsInText(`${key.toUpperCase()} movies`).map((m) => m.key),
			[key],
		)
		assert.equal(
			moodMaskOf(matching, []),
			0,
			"incomplete analyses have no moods",
		)
	}
	assert.deepEqual(moodsInMask(1 << 15), ["quirky"])
})
