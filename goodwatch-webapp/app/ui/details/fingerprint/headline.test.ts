// Loaded before the alias hook, which rewrites relative imports.
import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { composeHeadline, areaLines, segmentText } = await import(
	"./headline.ts"
)
const { breakingBad, grandBudapest, matrix, toyStory } = await import(
	"./titles.test-support.ts"
)

const colored = (segs: ReturnType<typeof composeHeadline>) =>
	segs.filter((s) => s.area).map((s) => [s.text, s.area])

test("the headline sums up a title in one sentence", () => {
	assert.equal(
		segmentText(composeHeadline(matrix)),
		"A relentless, philosophical sci-fi movie: stunning to look at, thrilling but never gory, only lightly funny.",
	)
	assert.equal(
		segmentText(composeHeadline(breakingBad)),
		"A relentless, intricate crime series: masterfully made, slow but gripping, emotionally reserved.",
	)
	assert.equal(
		segmentText(composeHeadline(grandBudapest)),
		"A nostalgic, eccentric comedy: stunning and masterfully made, clever but never confusing.",
	)
	assert.equal(
		segmentText(composeHeadline(toyStory)),
		"A nostalgic, uplifting animated movie: striking to look at, heartwarming but never a tearjerker, with light humor.",
	)
})

test("the words that name an area carry it, so they can be colored and selected", () => {
	assert.deepEqual(colored(composeHeadline(matrix)), [
		["relentless", "Energy"],
		["philosophical", "Craft"],
		["stunning to look at", "Style"],
		["thrilling", "Energy"],
		["only lightly funny", "Humor"],
	])
	// Tone words read as heart.
	assert.deepEqual(colored(composeHeadline(toyStory)).slice(0, 2), [
		["nostalgic", "Heart"],
		["uplifting", "Heart"],
	])
})

test("the far side of a 'not' contrast is muted", () => {
	const segs = composeHeadline(matrix)
	assert.deepEqual(
		segs.find((s) => s.text === " but never gory"),
		{ text: " but never gory", tone: "muted" },
	)
})

test("a comedy that is funny doesn't say so again, and a light title is never 'never funny'", () => {
	assert.ok(!segmentText(composeHeadline(grandBudapest)).includes("funny"))
	assert.ok(
		segmentText(composeHeadline(toyStory)).endsWith("with light humor."),
	)
})

test("a title without strong feel traits leads with its genre and the right article", () => {
	const plain = {
		...toyStory,
		genres: ["Animation"],
		fingerprint: {
			...toyStory.fingerprint,
			scores: Object.fromEntries(
				Object.keys(toyStory.fingerprint.scores).map((k) => [k, 3]),
			) as typeof toyStory.fingerprint.scores,
			pillars: { Energy: 1, Heart: 2, Humor: 0, World: 2, Craft: 2, Style: 2 },
		},
	} as typeof toyStory
	assert.equal(
		segmentText(composeHeadline(plain)),
		"An animated movie: with no jokes.",
	)
})

test("an area's lines start with its phrase and add the contrasts its traits lead", () => {
	const lines = (t: typeof matrix, area: Parameters<typeof areaLines>[1]) =>
		areaLines(t, area).map(segmentText)
	assert.deepEqual(lines(matrix, "Energy"), [
		"Relentless energy.",
		"Thrilling, not gory.",
		"Tense, not scary.",
	])
	assert.deepEqual(lines(breakingBad, "Craft"), [
		"Masterful craft.",
		"Clever, not confusing.",
	])
	assert.deepEqual(lines(grandBudapest, "Humor"), [
		"Funny.",
		"Funny, but bittersweet.",
		"Quirky, but heartfelt.",
	])
})

test("without a contrast, an area's verdict follows its phrase, and world themes get a frame", () => {
	assert.deepEqual(areaLines(matrix, "Humor").map(segmentText), [
		"Light humor.",
		"Some sharp wit.",
	])
	assert.deepEqual(areaLines(toyStory, "World").map(segmentText), [
		"An immersive world.",
		"Built around family.",
	])
	// The verdict is plain text; only the phrase selects the area.
	assert.deepEqual(colored(areaLines(matrix, "Humor").flat()), [
		["Light humor.", "Humor"],
	])
})
