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
	tasteRefsOf,
	titleOfGroupKey,
	togglePick,
	trimPicks,
} = await import("./taste-picker.ts")
const { watchNextChoiceOf } = await import("./watch-next.ts")

const NONE = { moods: [], themes: [], styles: [], taste: [] }

test("the words: 11 moods, 13 themes (Growing up is Coming of age), 10 styles, with Discover's names (#680)", () => {
	assert.equal(WORDS.filter((w) => w.kind === "mood").length, 11)
	assert.equal(WORDS.filter((w) => w.kind === "theme").length, 13)
	assert.equal(WORDS.filter((w) => w.kind === "style").length, 10)
	assert.equal(WORD_BY_ID["t:growing"], undefined)
	assert.equal(WORD_BY_ID["t:history"].name, "History")
	assert.equal(WORD_BY_ID["t:mind"].name, "The mind")
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

test("the URL names a taste group by its key, or by its size order in older links (#680)", () => {
	assert.deepEqual(
		tasteRefsOf("movie-1949, show-1396,3,0,10,x,movie-0,movie-1949"),
		["movie-1949", "show-1396", "3"],
	)
	assert.equal(titleOfGroupKey("movie-1949"), 1_000_000_001_949)
	assert.equal(titleOfGroupKey("show-1396"), 2_000_000_001_396)
	assert.equal(titleOfGroupKey("person-1"), null)
	// Three words and three taste groups at most: the server keeps three in all once it knows the groups.
	const choice = watchNextChoiceOf(
		new URLSearchParams(
			"taste=movie-1949,show-1396,movie-1,movie-2&moods=funny,scary,heavy,romance",
		),
	)
	assert.deepEqual(
		[choice.taste, choice.moods],
		[
			["movie-1949", "show-1396", "movie-1"],
			["funny", "scary", "heavy"],
		],
	)
})

test("the URL holds at most three picks, taste groups first", () => {
	const choice = watchNextChoiceOf(
		new URLSearchParams(
			"moods=funny,scary&themes=crime&styles=slow&taste=1,1,x",
		),
	)
	assert.deepEqual(
		[choice.taste, choice.moods, choice.themes, choice.styles],
		[["1"], ["funny", "scary"], ["crime"], []],
	)
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

test("Watch next taste words use the renamed moods", () => {
	for (const [key, name] of [
		["feelgood", "Cozy"],
		["romance", "Romantic"],
		["action", "Thrilling"],
		["heavy", "Sad"],
		["mind", "Trippy"],
	])
		assert.equal(WORD_BY_ID[`m:${key}`].name, name)
})
