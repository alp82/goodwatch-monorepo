// The taste picker (#677): picks travel as choice ids and URL parameters, three at most, and combine by Discover's rule.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const {
	WORDS,
	WORD_BY_ID,
	fitsPicks,
	kindsMet,
	pickIds,
	picksOf,
	tasteNumbersOf,
	togglePick,
	trimPicks,
} = await import("./taste-picker.ts")
const { watchNextChoiceOf } = await import("./watch-next.ts")

const NONE = { moods: [], themes: [], styles: [], taste: [] }

test("the words: 11 moods, 13 themes (Growing up is Coming of age), 10 styles, two themes renamed", () => {
	assert.equal(WORDS.filter((w) => w.kind === "mood").length, 11)
	assert.equal(WORDS.filter((w) => w.kind === "theme").length, 13)
	assert.equal(WORDS.filter((w) => w.kind === "style").length, 10)
	assert.equal(WORD_BY_ID["t:growing"], undefined)
	assert.equal(WORD_BY_ID["t:history"].name, "Period pieces")
	assert.equal(WORD_BY_ID["t:mind"].name, "Psychological")
	for (const w of WORDS) assert.match(w.hue, /^#[0-9a-f]{6}$/i)
})

test("picks round-trip as ids, taste groups first, and a fourth is refused", () => {
	const picks = picksOf(["m:funny", "g2", "s:slow"])
	assert.deepEqual(picks, {
		moods: ["funny"],
		themes: [],
		styles: ["slow"],
		taste: [2],
	})
	assert.deepEqual(pickIds(picks), ["g2", "m:funny", "s:slow"])
	assert.deepEqual(togglePick(picks, "t:crime"), { picks, refused: true })
	assert.deepEqual(togglePick(picks, "m:funny").picks, {
		...NONE,
		styles: ["slow"],
		taste: [2],
	})
	assert.deepEqual(togglePick(NONE, "t:crime"), {
		picks: { ...NONE, themes: ["crime"] },
		refused: false,
	})
	assert.deepEqual(picksOf(["x:nope", "g0", "g12"]), NONE)
})

test("the URL holds at most three picks, taste groups first", () => {
	const choice = watchNextChoiceOf(
		new URLSearchParams(
			"moods=funny,scary&themes=crime&styles=slow&taste=1,1,x",
		),
	)
	assert.deepEqual(pickIds(choice), ["g1", "m:funny", "m:scary"])
	assert.deepEqual(tasteNumbersOf("3, 1,0,10"), [3, 1])
	assert.deepEqual(
		trimPicks({ ...NONE, moods: ["funny", "scary", "heavy", "romance"] }).moods,
		["funny", "scary", "heavy"],
	)
	// Moods only: as before.
	assert.deepEqual(
		watchNextChoiceOf(new URLSearchParams("moods=funny")).moods,
		["funny"],
	)
})

test("Discover's rule: the same kind adds, another kind narrows", () => {
	const title = new Set(["m:funny", "s:slow", "g1"])
	const has = (id: string) => title.has(id)
	assert.equal(fitsPicks([], has), true)
	assert.equal(fitsPicks(["m:funny", "m:scary"], has), true)
	assert.equal(fitsPicks(["m:scary"], has), false)
	assert.equal(fitsPicks(["m:funny", "s:slow"], has), true)
	assert.equal(fitsPicks(["m:funny", "s:fast"], has), false)
	assert.equal(fitsPicks(["g2", "g1", "m:scary", "m:funny"], has), true)
	assert.deepEqual(kindsMet(["m:funny", "m:scary", "t:crime", "g1"], has), {
		met: 2,
		picked: 3,
	})
})
