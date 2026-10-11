import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const {
	MAP_TRAITS,
	TRAIT_KEYS,
	chipTokens,
	filterName,
	parseToken,
	traitWords,
} = await import("./traits.ts")

const words = traitWords()
const levels = (given: Record<string, number>) => (key: string) =>
	given[key] ?? 5

test("every trait has a word, an emoji, and a family", () => {
	assert.equal(TRAIT_KEYS.length, 20)
	assert.equal(new Set(TRAIT_KEYS).size, 20)
	for (const [key] of MAP_TRAITS) {
		const [word, emoji, family] = words[key]
		assert.ok(word && emoji, key)
		assert.ok(family >= 0 && family < 5, key)
	}
})

test("a token is a trait with 6 or more, or with 4 or less", () => {
	assert.deepEqual(parseToken("tension>6"), {
		key: "tension",
		op: ">",
		value: 6,
	})
	assert.deepEqual(parseToken("romance<4"), {
		key: "romance",
		op: "<",
		value: 4,
	})
	for (const token of [
		"tension>7",
		"tension<6",
		"tension=6",
		"unknown>6",
		"_y>2000",
		"tension>6 ",
		"",
	])
		assert.equal(parseToken(token), null, token)
})

test("a filter has one name whatever the order of its tokens", () => {
	assert.equal(filterName(""), "")
	assert.equal(filterName("tension>6,romance<4"), "romance<4,tension>6")
	assert.equal(filterName("romance<4,tension>6,romance<4"), "romance<4,tension>6")
})

test("a filter the chips can't make has no name", () => {
	assert.equal(filterName("tension>6,tension<4"), null)
	assert.equal(filterName("tension>6,nope>6"), null)
	assert.equal(
		filterName("tension>6,romance<4,scare>6,wonder>6"),
		null,
		"more tokens than chips can be on",
	)
})

test("the chips drop up to three strong traits and add up to three weak ones", () => {
	const tokens = chipTokens(
		levels({
			spectacle: 10,
			adrenaline: 9,
			wonder: 9,
			situational_comedy: 1,
			wholesome: 1,
			melancholy: 2,
		}),
		words,
	)
	assert.deepEqual(tokens, [
		"spectacle<4",
		"adrenaline<4",
		"wonder<4",
		"situational_comedy>6",
		"wholesome>6",
		"melancholy>6",
	])
})

test("the chips offer one trait per family in each group", () => {
	// Tension, adrenaline, and pace are one family: only the strongest is offered.
	const tokens = chipTokens(
		levels({ tension: 9, adrenaline: 8, fast_pace: 8, violence: 7 }),
		words,
	)
	assert.deepEqual(tokens, ["tension<4", "violence<4"])
	// A weak trait may share a family with a strong one, but not with another weak one.
	const mixed = chipTokens(
		levels({ tension: 9, slow_burn: 1, adrenaline: 2, romance: 0 }),
		words,
	)
	assert.deepEqual(mixed, ["tension<4", "romance>6", "slow_burn>6"])
})

test("strong traits go by level, and the traits' own order breaks a tie", () => {
	const tokens = chipTokens(
		levels({ bleakness: 8, complexity: 8, romance: 8, tension: 9 }),
		words,
	)
	assert.deepEqual(tokens, ["tension<4", "romance<4", "complexity<4"])
})

test("a title in the middle of every trait has no chips", () => {
	assert.deepEqual(chipTokens(levels({}), words), [])
})
