// Loaded before the alias hook, which rewrites relative imports.
import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { SCALE_GROUPS, readScale, scalesOf } = await import("./scales.ts")
const { matrix, toyStory } = await import("./titles.test-support.ts")

const readings = (t: typeof matrix) =>
	Object.fromEntries(
		SCALE_GROUPS.flatMap((g) => g.scales).map((sc) => [
			sc.name,
			readScale(sc, t).word,
		]),
	)

test("the scales come in three groups, Feel, Story, and Look", () => {
	assert.deepEqual(
		SCALE_GROUPS.map((g) => [g.name, g.scales.map((sc) => sc.name)]),
		[
			["Feel", ["Pace", "Energy", "Intensity", "Tone", "Heart", "Humor"]],
			["Story", ["Attention", "Setting", "World"]],
			["Look", ["Style", "Craft"]],
		],
	)
})

test("each scale reads as a word", () => {
	assert.deepEqual(readings(matrix), {
		Pace: "Breakneck",
		Energy: "Relentless",
		Intensity: "Intense",
		Tone: "Mixed",
		Heart: "Some heart",
		Humor: "Light",
		Attention: "Very demanding",
		Setting: "Fantastical",
		World: "Immersive",
		Style: "Stunning",
		Craft: "Strong",
	})
	assert.equal(readings(toyStory).Tone, "Uplifting")
	assert.equal(readings(toyStory).Attention, "Easy to follow")
})

test("an area scale sits in the middle of its tier's fifth, so its word matches the tier", () => {
	const [energy] = scalesOf("Energy").filter((sc) => sc.name === "Energy")
	for (const tier of [0, 1, 2, 3, 4] as const) {
		const t = {
			...matrix,
			fingerprint: {
				...matrix.fingerprint,
				pillars: { ...matrix.fingerprint.pillars, Energy: tier },
			},
		}
		const { position, word } = readScale(energy, t)
		assert.equal(position, (tier + 0.5) / 5)
		assert.equal(word, energy.words[tier])
	}
})

test("a word changes at each fifth, and a fifth's edge reads as the next word", () => {
	const [pace] = scalesOf("Energy")
	const at = (fast_pace: number, slow_burn: number) =>
		readScale(pace, {
			...matrix,
			fingerprint: {
				...matrix.fingerprint,
				scores: { ...matrix.fingerprint.scores, fast_pace, slow_burn },
			},
		})
	// Opposites fill from the middle: equal scores are steady, and 8 apart is an end.
	assert.deepEqual(at(5, 5), { position: 0.5, word: "Steady" })
	assert.deepEqual(at(0, 8), { position: 0, word: "Very slow" })
	assert.deepEqual(at(10, 0), { position: 1, word: "Breakneck" })
	// (x - y) / 16 + 0.5 = 0.8 at a difference of 4.8; 0.6 at 1.6.
	assert.equal(at(4.8, 0).word, "Breakneck")
	assert.equal(at(1.6, 0).word, "Fast")
	assert.equal(at(1.5, 0).word, "Steady")
})

test("an area's scales are the ones that select it", () => {
	assert.deepEqual(
		scalesOf("Energy").map((sc) => sc.name),
		["Pace", "Energy", "Intensity"],
	)
	assert.deepEqual(
		scalesOf("Craft").map((sc) => sc.name),
		["Attention", "Craft"],
	)
	assert.deepEqual(
		scalesOf("Heart").map((sc) => sc.name),
		["Tone", "Heart"],
	)
	// Only opposites fill from the middle.
	assert.deepEqual(
		SCALE_GROUPS.flatMap((g) => g.scales)
			.filter((sc) => sc.fromMiddle)
			.map((sc) => sc.name),
		["Pace", "Tone", "Setting"],
	)
})
