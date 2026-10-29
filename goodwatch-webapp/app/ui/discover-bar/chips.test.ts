import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { defaultFilterState } = await import("~/domain/filter-state")
const { activeChips } = await import("~/ui/filter-bar/labels")
const { titleKey } = await import("~/utils/title-key")
const { barChips, countWords, footerRecoveries } = await import("./chips.ts")

const empty = defaultFilterState({ onMyServices: false, notSeenYet: false })
const severance = titleKey("show", 95396)
const dune = titleKey("movie", 438631)
const names = {
	title: (key: number) => ({ [severance]: "Severance", [dune]: "Dune" })[key],
	poster: (key: number) => (key === severance ? "/sev.jpg" : null),
	person: (id: number) => (id === 1245 ? "Scarlett Johansson" : undefined),
}

const busy = {
	...empty,
	onMyServices: true,
	notSeenYet: true,
	similarTo: [dune],
	loved: [severance],
	disliked: [dune],
	people: [1245],
	moods: ["funny" as const],
	minScore: 80 as const,
	seenBefore: undefined,
	onWishlist: true,
	votes: { max: 9999 },
}

test("chips follow the footer's order", () => {
	const chips = barChips(busy, activeChips(busy, names), {
		query: " space ",
		names,
		face: (id) => (id === 1245 ? "/sj.jpg" : null),
	})
	assert.deepEqual(
		chips.map((chip) => chip.key),
		[
			"query",
			`loved-${severance}`,
			`disliked-${dune}`,
			`similar-${dune}`,
			"person-1245",
			"on-my-services",
			"not-seen-yet",
			"wishlist",
			"mood-funny",
			"score",
			"votes",
		],
	)
	const [query, more, less, like, person] = chips
	assert.equal(query.label, "space")
	assert.equal(query.opens, "titles")
	assert.deepEqual(
		[more.prefix, more.label, more.image],
		["More like", "Severance", "/sev.jpg"],
	)
	assert.deepEqual([less.prefix, less.label], ["Less like", "Dune"])
	assert.deepEqual([like.prefix, like.label], ["Like", "Dune"])
	assert.deepEqual(
		[person.prefix, person.label, person.image],
		["with", "Scarlett Johansson", "/sj.jpg"],
	)
	assert.equal(chips.find((chip) => chip.key === "mood-funny")?.hue, "#facc15")
	assert.equal(chips.find((chip) => chip.key === "score")?.opens, "scores")
})

test("On my services and Not seen yet get chips that remove one at a time", () => {
	const chips = barChips(busy, [], { query: null })
	const mine = chips.find((chip) => chip.key === "on-my-services")
	const unseen = chips.find((chip) => chip.key === "not-seen-yet")
	assert.equal(mine?.remove?.(busy).onMyServices, false)
	assert.equal(unseen?.remove?.(busy).notSeenYet, false)
	assert.equal(unseen?.opens, "taste")
	assert.deepEqual(barChips(empty, [], { query: "  " }), [])
})

test("three or more loved titles are one chip", () => {
	const state = { ...empty, loved: [severance, dune, titleKey("movie", 1)] }
	const [chip] = barChips(state, activeChips(state, names), {
		query: null,
		names,
	})
	assert.equal(`${chip.prefix} ${chip.label}`, "More like 3 titles")
	assert.equal(chip.image, null)
})

test("Made in reads as Made in", () => {
	const state = { ...empty, productionCountries: ["FR"] }
	const [chip] = barChips(state, activeChips(state), { query: null })
	assert.equal(chip.label, "Made in France")
	assert.equal(chip.opens, "madeIn")
})

test("the count's words", () => {
	assert.deepEqual(countWords(null, false), {
		n: null,
		words: "Counting…",
		top: false,
	})
	assert.deepEqual(countWords(1, false), { n: 1, words: "title", top: false })
	assert.deepEqual(countWords(12, false), {
		n: 12,
		words: "titles",
		top: false,
	})
	assert.deepEqual(countWords(1, true), { n: 1, words: "match", top: false })
	assert.deepEqual(countWords(42, true), {
		n: 42,
		words: "matches",
		top: false,
	})
	assert.deepEqual(countWords(100, true), {
		n: 100,
		words: "matches",
		top: true,
	})
	assert.deepEqual(countWords(5000, false).top, false)
})

test("recoveries only while the list is short, biggest first", () => {
	const list = [
		{ filter: "minScore", titles: 12 },
		{ filter: "moods", titles: 49 },
		{ filter: "years", titles: 3 },
	]
	assert.deepEqual(footerRecoveries(41, list, 2), [])
	assert.deepEqual(footerRecoveries(null, list, 2), [])
	assert.deepEqual(
		footerRecoveries(40, list, 2).map((r) => r.filter),
		["moods", "minScore"],
	)
	assert.deepEqual(
		footerRecoveries(0, list, 1).map((r) => r.filter),
		["moods"],
	)
})
