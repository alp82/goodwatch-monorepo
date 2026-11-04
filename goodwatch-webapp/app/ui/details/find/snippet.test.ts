import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { contextLine, excerpt, matchSpans } = await import("./snippet.ts")

test("spans of every query word, accents and case ignored", () => {
	assert.deepEqual(
		matchSpans("Tuco Salamanca meets Señor Salamanca", "salamanca senor"),
		[
			[5, 14],
			[21, 26],
			[27, 36],
		],
	)
})

test("short words only at a word's start", () => {
	assert.deepEqual(matchSpans("Sweet we", "we"), [[6, 8]])
})

test("a match near the start keeps the whole line", () => {
	assert.deepEqual(excerpt("Tuco is introduced", "tuco"), {
		text: "Tuco is introduced",
		spans: [[0, 4]],
	})
})

test("a later match: a few words of lead-in after an ellipsis, at a word's start", () => {
	const text =
		"Season 1: Tuco Salamanca is introduced near the end of the season as the first real Big Bad of the show."
	const x = excerpt(text, "big bad")
	assert.ok(x)
	assert.ok(x.text.startsWith("…"))
	assert.match(x.text, /^…\w/)
	const [a, b] = x.spans[0]
	assert.equal(x.text.slice(a, b).toLowerCase(), "big")
	assert.ok(a < 30)
})

test("the context first, then the long text, else the context unchanged", () => {
	assert.equal(
		contextLine(
			"Trope",
			"A long write-up where Gus appears",
			"gus",
		).text.includes("Gus"),
		true,
	)
	assert.deepEqual(contextLine("Trope", undefined, "gus"), {
		text: "Trope",
		spans: [],
	})
})
