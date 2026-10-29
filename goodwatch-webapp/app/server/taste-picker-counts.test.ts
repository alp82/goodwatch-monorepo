// The taste picker's numbers (#677): what a taste group carries and its colors, each choice's counts, "For you", and
// "Narrow it", on a made-up list.
import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const { MOOD_KEYS } = await import("../domain/moods.ts")
const { THEME_KEYS, STYLE_KEYS } = await import("../domain/themes-styles.ts")
const { WORD_BY_ID } = await import("../domain/taste-picker.ts")
const { describeGroups, pickerCounts } = await import(
	"./taste-picker-counts.ts"
)

/** Masks from word ids. */
function masks(...ids: string[]) {
	const m = { moods: 0, themes: 0, styles: 0 }
	for (const id of ids) {
		const [kind, key] = id.split(":")
		if (kind === "m") m.moods |= 1 << MOOD_KEYS.indexOf(key as never)
		if (kind === "t") m.themes |= 1 << THEME_KEYS.indexOf(key as never)
		if (kind === "s") m.styles |= 1 << STYLE_KEYS.indexOf(key as never)
	}
	return m
}
const times = <T>(n: number, value: T) => Array.from({ length: n }, () => value)

test("a group carries what sets it apart, colored by its mood and its theme or style, one word per ground", () => {
	const crime = [
		...times(8, masks("m:crime", "t:mystery", "t:mind", "s:slow", "s:music")),
		...times(2, masks("m:crime", "s:music")),
	]
	const comedy = times(10, masks("m:funny", "s:fast", "s:music"))
	const [dark, silly] = describeGroups([crime, comedy])
	// Mystery is on the mood's ground: not a color, not on the line next to Crime & mystery.
	assert.deepEqual(dark.hues, [
		WORD_BY_ID["m:crime"].hue,
		WORD_BY_ID["t:mind"].hue,
	])
	assert.equal(dark.madeOf[0], "m:crime")
	assert.ok(!dark.madeOf.includes("t:mystery"))
	assert.ok(dark.carries.includes("t:mystery"))
	// Music is in everything: it never sets a group apart.
	assert.ok(!dark.carries.includes("s:music"))
	assert.deepEqual(silly.hues, [
		WORD_BY_ID["m:funny"].hue,
		WORD_BY_ID["s:fast"].hue,
	])
})

test("counts, what a pick leaves, For you, and Narrow it", () => {
	const groups = [
		{ id: "g1", carries: ["m:crime", "t:mind", "s:slow"] },
		{ id: "g2", carries: ["m:funny"] },
	]
	let key = 0
	const entry = (group: number | null, ...ids: string[]) => ({
		key: ++key,
		masks: masks(...ids),
		group,
	})
	const list = [
		...times(4, null).map(() => entry(1, "m:crime", "t:mind", "s:slow")),
		...times(2, null).map(() => entry(1, "m:crime", "s:fast")),
		...times(3, null).map(() => entry(2, "m:funny")),
		...times(5, null).map(() => entry(null, "m:funny", "m:romance")),
		entry(null, "m:heavy", "s:slow"),
	]
	const none = pickerCounts(list, [], groups)
	assert.equal(none.fitting, list.length)
	const of = (counts: typeof none, id: string) =>
		counts.choices.find((c) => c.id === id)
	assert.deepEqual(of(none, "g1"), { id: "g1", count: 6, leaves: 6 })
	assert.deepEqual(of(none, "m:funny"), { id: "m:funny", count: 8, leaves: 8 })
	// Themes and styles the list holds; every mood, as always.
	assert.equal(of(none, "t:war"), undefined)
	assert.deepEqual(of(none, "m:scary"), { id: "m:scary", count: 0, leaves: 0 })
	// Every taste group shows in For you, also one with none of its titles on the list.
	const five = [1, 2, 3, 4, 5].map((n) => ({ id: `g${n}`, carries: [] }))
	assert.deepEqual(pickerCounts(list, [], five).forYou.slice(0, 5), [
		"g1",
		"g2",
		"g3",
		"g4",
		"g5",
	])
	// An empty list still offers the moods.
	assert.equal(pickerCounts([], [], []).forYou.length, 8)
	assert.equal(pickerCounts([], [], []).choices.length, 16)
	// Groups first, then the words the groups carry (most of their titles first), then the biggest moods.
	assert.deepEqual(none.forYou, [
		"g1",
		"g2",
		"m:crime",
		"t:mind",
		"s:slow",
		"m:funny",
		"m:romance",
		"m:heavy",
	])
	assert.deepEqual(none.narrow, [])

	const crime = pickerCounts(list, ["m:crime"], groups)
	assert.equal(crime.fitting, 6)
	// Another mood adds (Crime & mystery or Funny); a style narrows (Crime & mystery and Slow burn).
	assert.equal(of(crime, "m:funny")?.leaves, 14)
	assert.equal(of(crime, "s:slow")?.leaves, 4)
	// Narrow it: another kind, leaving fewer but some; groups first. g1 holds all six, so it doesn't narrow.
	assert.deepEqual(crime.narrow, ["t:mind", "s:slow", "s:fast"])

	// One suggestion per ground: with Slow burn picked, Crime & mystery shows, not also the theme Mystery.
	const slowList = [
		...times(3, null).map(() => entry(1, "m:crime", "t:mystery", "s:slow")),
		...times(3, null).map(() => entry(null, "s:slow")),
	]
	assert.deepEqual(pickerCounts(slowList, ["s:slow"], groups).narrow, [
		"g1",
		"m:crime",
	])

	const full = pickerCounts(list, ["m:crime", "s:slow", "t:mind"], groups)
	assert.deepEqual(full.narrow, [])
})

test("all five new mood words have counts and combine with the same any-of rule", () => {
	const keys = ["tense", "dark", "deep", "magical", "quirky"]
	const list = keys.map((key, i) => ({
		key: i,
		masks: masks(`m:${key}`),
		group: null,
	}))
	for (const key of keys) {
		assert.equal(WORD_BY_ID[`m:${key}`].kind, "mood")
		const counts = pickerCounts(list, [`m:${key}`], [])
		assert.equal(counts.fitting, 1)
		for (const other of keys) {
			const choice = counts.choices.find((c) => c.id === `m:${other}`)
			assert.ok(choice)
			assert.equal(choice.count, 1)
			assert.equal(choice.leaves, other === key ? 1 : 2)
		}
	}
})
