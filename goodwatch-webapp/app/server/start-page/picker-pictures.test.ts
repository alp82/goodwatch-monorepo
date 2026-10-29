// The mood picker's tile pictures (picker-pictures.server.ts): the most popular title with the choice, none repeated
// while another is left.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

const { pickPictureKeys } = await import("./picker-pictures.server.ts")
const { MOOD_KEYS } = await import("~/domain/moods")
const { STYLE_KEYS, THEME_KEYS } = await import("~/domain/themes-styles")

const bits = <K extends string>(all: readonly K[], keys: K[]) =>
	keys.reduce((mask, key) => mask | (1 << all.indexOf(key)), 0)
const title = (
	key: number,
	moods: (typeof MOOD_KEYS)[number][],
	themes: (typeof THEME_KEYS)[number][] = [],
	styles: (typeof STYLE_KEYS)[number][] = [],
) => ({
	key,
	masks: {
		moods: bits(MOOD_KEYS, moods),
		themes: bits(THEME_KEYS, themes),
		styles: bits(STYLE_KEYS, styles),
	},
})

test("mixes take the first title with all their parts; words then take the next one unused", () => {
	const keys = pickPictureKeys([
		title(1, ["funny", "feelgood"]),
		title(2, ["funny"]),
		title(3, ["feelgood", "romance"]),
		title(4, ["romance", "funny"], ["war"]),
	])
	assert.equal(keys.get("g1"), 1)
	assert.equal(keys.get("g4"), 4)
	assert.equal(keys.get("m:funny"), 2)
	assert.equal(keys.get("m:feelgood"), 3)
	// Every title with Romance is taken: it repeats the first rather than showing nothing.
	assert.equal(keys.get("m:romance"), 3)
	assert.equal(keys.get("t:war"), 4)
	// No title has it: no picture.
	assert.equal(keys.has("s:slow"), false)
	assert.equal(keys.has("g7"), false)
})
