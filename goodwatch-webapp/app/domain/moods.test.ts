import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { MOODS, MOOD_KEYS, moodsInText, parseMoods, moodsOf, moodMaskOf, moodsInMask } =
	await import("./moods.ts")

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
		for (const word of [name, alias, alias.toUpperCase(), alias.replace(/-/g, " ")]) {
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

const { VALID_FINGERPRINT_KEYS } = await import("../server/utils/fingerprint.ts")
const fingerprint = (scores: Record<string, number>) =>
	Object.fromEntries(VALID_FINGERPRINT_KEYS.map((key) => [key, scores[key] ?? 0]))

test("new moods match their rules on object and ordered fingerprints; Tense, Dark and Deep keep Explorer's starting thresholds", async () => {
	const { MOODS: islands } = await import("../server/explorer/islands.server.ts")
	const fixtures = [
		[
			"tense",
			{ tension: 8, adrenaline: 6, scare: 6 },
			[{ tension: 7 }, { tension: 8, adrenaline: 7 }, { tension: 8, scare: 7 }],
		],
		["dark", { bleakness: 8 }, [{ bleakness: 7 }]],
		["deep", { philosophical: 8 }, [{ philosophical: 7 }]],
		// Magical and Quirky are stricter than Explorer's islands since 2026-11-22 (awe alone isn't magic, unhinged
		// isn't quirky), so only the mood side is checked for them.
		[
			"magical",
			{ wonder: 8, fantasy: 6 },
			[
				{ wonder: 7, fantasy: 6 },
				{ wonder: 8 },
				{ wonder: 8, fantasy: 6, futuristic: 6 },
				{ wonder: 8, fantasy: 6, adrenaline: 8 },
			],
		],
		[
			"quirky",
			{ eccentricity: 8 },
			[{ eccentricity: 7 }, { eccentricity: 8, violence: 6 }, { eccentricity: 8, bleakness: 7 }],
		],
	] as const
	const explorerParity = new Set(["tense", "dark", "deep"])
	for (const [key, matching, counters] of fixtures) {
		const island = islands.find((island) => island.id === key)
		assert.ok(island, key)
		for (const [scores, expected] of [[matching, true], ...counters.map((s) => [s, false])] as [
			Record<string, number>,
			boolean,
		][]) {
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
			if (explorerParity.has(key))
				assert.equal(island.level((k) => fp[k], []) >= island.from, expected, key)
		}
		assert.deepEqual(
			moodsInText(`${key.toUpperCase()} movies`).map((m) => m.key),
			[key],
		)
		assert.equal(moodMaskOf(matching, []), 0, "incomplete analyses have no moods")
	}
	assert.deepEqual(moodsInMask(1 << 15), ["quirky"])
})

test("older moods leave out the near misses that read wrong", () => {
	const fits = (key: string, scores: Record<string, number>, genres: string[] = []) =>
		moodsOf(fingerprint(scores), genres).includes(key as never)
	// Romantic: a love subplot in a horror or action film isn't a love story.
	assert.equal(fits("romance", { romance: 7 }, ["Horror", "Romance"]), false)
	assert.equal(fits("romance", { romance: 8, adrenaline: 8 }), false)
	assert.equal(fits("romance", { romance: 6 }, ["Romance"]), true)
	assert.equal(fits("romance", { romance: 8, adrenaline: 6 }), true)
	// Cozy: low stakes.
	const warm = { wholesome: 8, hopefulness: 8, bleakness: 2 }
	assert.equal(fits("feelgood", warm), true)
	assert.equal(fits("feelgood", { ...warm, adrenaline: 8 }), false)
	assert.equal(fits("feelgood", { ...warm, violence: 5 }), false)
	// Funny: wit alone isn't comedy; the Comedy genre lowers the bar.
	assert.equal(fits("funny", { wit_wordplay: 9 }), false)
	assert.equal(fits("funny", { wit_wordplay: 7 }, ["Comedy"]), true)
	assert.equal(fits("funny", { physical_comedy: 9, violence: 6 }), false)
	// Trippy: complex and philosophical isn't trippy.
	assert.equal(fits("mind", { complexity: 9, philosophical: 9 }), false)
	assert.equal(fits("mind", { surrealism: 7 }), true)
	// Scary: peril isn't horror.
	assert.equal(fits("scary", { scare: 7 }), false)
	assert.equal(fits("scary", { scare: 8, uncanny: 6 }), true)
	assert.equal(fits("scary", { scare: 5 }, ["Horror"]), true)
	// Crime & mystery: a puzzle needs a crime.
	assert.equal(fits("crime", { mystery: 9 }), false)
	assert.equal(fits("crime", { mystery: 8 }, ["Mystery"]), true)
	// Sad: big emotions, not big battles.
	assert.equal(fits("heavy", { pathos: 9, melancholy: 7, adrenaline: 8 }), false)
	assert.equal(fits("heavy", { pathos: 8, melancholy: 6 }), true)
})
