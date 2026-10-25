import assert from "node:assert/strict"
import { test } from "node:test"
import { gapRows } from "./gaps.ts"

const gap = (id: string, delta: number) => ({ id, name: id, delta })

test("traits take their fingerprint label and emoji, genres their name, on one scale", () => {
	const rows = gapRows(
		{
			genres: [gap("Science Fiction", 0.4), gap("Horror", -0.6)],
			traits: [gap("wit", 0.9), gap("scare", -0.5)],
		},
		(key) => (key === "wit" ? { label: "Wit", emoji: "*" } : null),
	)
	assert.deepEqual(
		rows.genres.map((g) => g.label),
		["Science Fiction", "Horror"],
	)
	assert.deepEqual(
		rows.traits.map((t) => t.label),
		["Wit", "scare"],
	)
	assert.equal(rows.traits[0].emoji, "*")
	assert.equal(rows.max, 0.9)
})

test("with one list empty, the other still shows", () => {
	const rows = gapRows(
		{ genres: [], traits: [gap("wit", 0.9), gap("gore", -0.3)] },
		() => null,
	)
	assert.equal(rows.genres.length, 0)
	assert.equal(rows.traits.length, 2)
	assert.equal(rows.max, 0.9)
})
