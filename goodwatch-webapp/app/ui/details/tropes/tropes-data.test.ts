import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const {
	signatureCards,
	tropeTextsOf,
	tropesIndexOf,
	tropesTeaserOf,
	withTexts,
} = await import("./tropes-data.ts")

const trope = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	name: id.toUpperCase(),
	url: `https://tvtropes.org/pmwiki/pmwiki.php/Main/${id}`,
	meaning: `What ${id} is.`,
	paragraphs: [[{ text: `How ${id} shows up.` }]],
	teaser: `How ${id} shows up.`,
	length: 400,
	titles: 500,
	lead: false,
	...extra,
})

const all = {
	tropes: [
		trope("a"),
		trope("b", { titles: 12, teaser: null }),
		trope("c", { titles: null }),
		trope("d"),
	],
	total: 4,
	signature: ["b", "c", "d"],
}

test("the index keeps write-ups for the signature tropes only", () => {
	const index = tropesIndexOf(all)
	assert.equal(index.total, 4)
	assert.deepEqual(index.signature, ["b", "c", "d"])
	const a = index.tropes.find((t) => t.id === "a")
	assert.equal(a?.paragraphs, undefined)
	assert.equal(a?.teaser, undefined)
	assert.equal(a?.meaning, "What a is.")
	assert.ok(index.tropes.find((t) => t.id === "b")?.paragraphs)
})

test("the texts put every write-up back into the index", () => {
	const texts = tropeTextsOf(all)
	assert.deepEqual(Object.keys(texts), ["a", "b", "c", "d"])
	assert.deepEqual(withTexts(tropesIndexOf(all), texts), all)
	assert.deepEqual(withTexts(tropesIndexOf(all), undefined), tropesIndexOf(all))
})

test("the cards lead with the spoiler-free openings, rare under 60 titles", () => {
	assert.deepEqual(
		signatureCards(all).map((c) => [c.id, c.rare]),
		[
			["c", false],
			["d", false],
			["b", true],
		],
	)
	const teaser = tropesTeaserOf(all)
	assert.equal(teaser.total, 4)
	assert.deepEqual(
		teaser.cards.map((c) => c.id),
		["c", "d"],
	)
	assert.deepEqual(Object.keys(teaser.cards[0]).sort(), [
		"id",
		"name",
		"rare",
		"teaser",
		"titles",
		"url",
	])
})

test("an unknown signature id is skipped", () => {
	assert.deepEqual(
		signatureCards({ ...all, signature: ["x", "a"] }).map((c) => c.id),
		["a"],
	)
})
