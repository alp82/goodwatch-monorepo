// The title page's taste group line: short between two groups, and short on a phone when the name runs long.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { TitleSides, TitleSidesSide } from "~/server/title-sides.server"
import { PHONE_CHARS, betweenLine, titleSidesText } from "./title-sides-copy.ts"

const group = (
	name: string | null,
	traits: string[] = [],
	noun = "stories",
): TitleSidesSide => ({
	number: 1,
	name,
	short: name ? { traits, noun } : null,
	moods: [],
	near: [],
})
const on = (side: TitleSidesSide): TitleSides => ({
	at: "on",
	edge: null,
	edgeTail: null,
	side,
	other: null,
})
const close = (side: TitleSidesSide, tail: string): TitleSides => ({
	at: "edge",
	edge: "place",
	edgeTail: tail,
	side,
	other: null,
})
const between = (a: TitleSidesSide, b: TitleSidesSide): TitleSides => ({
	at: "edge",
	edge: "between",
	edgeTail: null,
	side: a,
	other: b,
})

const thrillers = group(
	"Dark, psychological thrillers",
	["dark", "psychological"],
	"thrillers",
)
const surreal = group("Psychedelic, surreal stories", [
	"psychedelic",
	"surreal",
])

describe("betweenLine", () => {
	it("takes each group's leading trait", () => {
		assert.equal(
			betweenLine(thrillers, surreal),
			"Between dark and psychedelic",
		)
	})

	it("keeps the noun both groups share", () => {
		const moving = group("Moving, philosophical stories", [
			"moving",
			"philosophical",
		])
		assert.equal(
			betweenLine(moving, surreal),
			"Between moving and psychedelic stories",
		)
	})

	it("takes the second traits when both groups lead with the same one", () => {
		const tense = group("Dark, tense crime", ["dark", "tense"], "crime")
		const gripping = group(
			"Dark, gripping crime",
			["dark", "gripping"],
			"crime",
		)
		assert.equal(
			betweenLine(tense, gripping),
			"Between tense and gripping crime",
		)
	})

	it("keeps each noun when the traits can't tell the groups apart", () => {
		const crime = group("Dark crime", ["dark"], "crime")
		const darkThrillers = group("Dark thrillers", ["dark"], "thrillers")
		assert.equal(
			betweenLine(crime, darkThrillers),
			"Between dark crime and dark thrillers",
		)
	})

	it("falls back to the full names, and to nothing without names", () => {
		const a = group("Dark crime", ["dark"], "crime")
		const b = group("Dark, gripping crime", ["dark", "gripping"], "crime")
		assert.equal(
			betweenLine(a, b),
			"Between dark crime and dark, gripping crime",
		)
		assert.equal(betweenLine(group(null), group(null)), null)
	})
})

describe("titleSidesText", () => {
	it("says the group's name in a group, the same on a phone when it fits", () => {
		assert.deepEqual(titleSidesText(on(thrillers)), {
			text: "Dark, psychological thrillers",
			phone: null,
		})
	})

	it("is always short between two groups", () => {
		assert.deepEqual(titleSidesText(between(thrillers, surreal)), {
			text: "Between dark and psychedelic",
			phone: null,
		})
	})

	it("shortens a long line on a phone to the leading trait, the noun, and what sets the title apart", () => {
		const dark = group("Dark, psychological stories", ["dark", "psychological"])
		const line = titleSidesText(close(dark, "from France"))
		assert.equal(line.text, "Dark, psychological stories, from France")
		assert.ok(line.text && line.text.length > PHONE_CHARS)
		assert.equal(line.phone, "Dark stories, from France")
	})

	it("says nothing without names: the posters and the badge do", () => {
		assert.deepEqual(titleSidesText(on(group(null))), {
			text: null,
			phone: null,
		})
	})
})
