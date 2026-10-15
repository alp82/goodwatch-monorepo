import assert from "node:assert/strict"
import { test } from "node:test"
import { aliasTable } from "./aliases.server.ts"
import type { SearchIndex } from "./search-index.server.ts"
import { blend } from "./title-blend.server.ts"
import { startsTitle } from "./title-prefix.server.ts"

const movie = (id: number) => 1e12 + id
// The ranked list's titles, best first; only fields the blend reads are needed.
const ranked = [movie(1), movie(2), movie(3), movie(4), movie(5), movie(6)]
const index = {
	titleTable: {
		pointIds: ranked,
		rowOf: new Map(ranked.map((id, row) => [id, row])),
		titles: ["Knights", "Castle", "Crown", "Throne", "Sword", "Kingdom"],
		originalTitles: [
			"Knights",
			"Castle",
			"Crown",
			"Throne",
			"Sword",
			"Kingdom",
		],
		years: [2001, 2002, 2003, 2004, 2005, 2006],
		popularity: [0, 0, 0, 0, 0, 0],
		imdbIds: ["k", "c", "cr", "t", "s", "kd"],
	},
	words: {
		df: new Map(["lord", "of", "star", "w", "dark"].map((w) => [w, 1])),
	},
	titleNames: [{ name: "castle", row: 1 }],
	// Localized names: "Kastell der Ritter" for Castle (row 1), "Die Krone" for Crown (row 2), "Castlle" for Throne.
	aliases: aliasTable(
		{
			version: 1,
			rows: [1, 2, 3],
			names: ["Kastell der Ritter", "Die Krone", "Castlle"],
			languages: ["de", "de", "it"],
		},
		6,
	),
} as unknown as SearchIndex
const lookup = (id: number, title: string, popularity = 1) => ({
	id,
	title,
	type: "movie",
	year: "2000",
	popularity,
})
const all = new Uint8Array(ranked.length).fill(1)

test("a query of two or more words starts a title, also after an article or with its last word cut short", () => {
	assert.equal(startsTitle("lord of war", "lord of"), true)
	assert.equal(startsTitle("the lord of the rings", "lord of"), true)
	assert.equal(startsTitle("star wars", "star w"), true)
	assert.equal(
		startsTitle("the dark knight", "dark"),
		false,
		"one word doesn't count",
	)
	assert.equal(startsTitle("warlord of mars", "lord of"), false)
	assert.equal(startsTitle("house of the lord of", "lord of"), false)
})

test("titles that start with the query rank with the ranked list's first title, without concrete words", () => {
	const titles = [
		lookup(101, "Lord of War", 3),
		lookup(102, "The Lord of the Rings: The Fellowship of the Ring", 9),
		lookup(103, "Lord of the Flies", 2),
		lookup(104, "Overlord of Nothing", 5),
	]
	const order = blend(index, "lord of", titles, ranked, new Set(), all).map(
		(row) => row.id,
	)
	// The three prefix titles score level with the first ranked title; the tie goes to popularity, which only the title
	// lookup knows, so they lead the list.
	assert.deepEqual(order.slice(0, 4), [
		movie(102),
		movie(101),
		movie(103),
		movie(1),
	])
	// A partial match that doesn't start the title still needs the strict rules.
	assert.ok(order.indexOf(movie(104)) > order.indexOf(movie(6)))
})

test("an exact title still wins over titles the query only starts", () => {
	const titles = [
		lookup(201, "Lord of War Extended", 9),
		lookup(202, "Lord of War", 1),
	]
	const order = blend(index, "lord of war", titles, ranked, new Set(), all)
	assert.equal(order[0].id, movie(202))
})

test("a query is the exact title with or without spaces", () => {
	const titles = [
		lookup(301, "Spider-Man: Homecoming", 9),
		lookup(302, "Spider-Man", 1),
		lookup(303, "Spiders", 5),
	]
	const order = blend(index, "spiderman", titles, ranked, new Set(), all)
	assert.equal(order[0].id, movie(302))
	assert.equal(order[0].score, 3)
	assert.equal(order[1].id, movie(301), "the title it starts comes next")
})

test("a lookup row found by a localized name scores one step below the same match by a title", () => {
	const kastell = {
		...lookup(401, "Castle Siege", 1),
		matchedAlias: { text: "Kastell der Ritter", language: "de" },
	}
	const exact = lookup(402, "Kastell der Ritter", 0)
	const order = blend(
		index,
		"kastell der ritter",
		[kastell, exact],
		ranked,
		new Set(),
		all,
	)
	assert.equal(order[0].id, movie(402), "the title match comes first")
	assert.equal(order[0].matchedAlias, undefined)
	assert.equal(
		order[1].id,
		movie(401),
		"the alias match next, ahead of the ranked list",
	)
	assert.equal(order[1].score, 1.99 + 0.15 * 0)
	assert.deepEqual(order[1].matchedAlias, {
		text: "Kastell der Ritter",
		language: "de",
	})
})

test("a localized name doesn't lift a row its title already matches better", () => {
	const row = {
		...lookup(501, "Kastell", 1),
		matchedAlias: { text: "Kastell der Ritter", language: "de" },
	}
	const [first] = blend(index, "kastell", [row], [], new Set(), all)
	assert.equal(first.id, movie(501))
	assert.equal(first.score, 3)
	assert.equal(first.matchedAlias, undefined)
})

test("the fuzzy match tries localized names only when no title is close", () => {
	// "Kastel der Ritter" is a typo of the alias; no title is close, so the alias's title comes in at 1.05 - 0.01.
	const order = blend(index, "kastel der ritter", [], ranked, new Set(), all)
	const castle = order.find((row) => row.id === movie(2))
	assert.ok(castle)
	assert.equal(order[0].id, movie(2))
	assert.deepEqual(castle.matchedAlias, {
		text: "Kastell der Ritter",
		language: "de",
	})
	// A typo of a title wins even when an alias is closer (here the very alias of Throne).
	const typo = blend(index, "castlle", [], ranked, new Set(), all)
	assert.equal(typo[0].id, movie(2))
	assert.equal(typo[0].matchedAlias, undefined)
	// The exact alias is the title lookup's to find (through the palette), not the fuzzy match's.
	const exact = blend(index, "die krone", [], [], new Set(), all)
	assert.equal(exact.length, 0)
})

test("a row found by a localized name that neither name matches ranks after the titles of its score", () => {
	// "kas" is too short a word for a title match: both rows score 0, and the one the palette found by its title comes
	// first although the other is more popular.
	const byTitle = lookup(601, "Kasbah", 1)
	const byAlias = {
		...lookup(602, "Castle Siege", 9),
		matchedAlias: { text: "Kastell der Ritter", language: "de" },
	}
	const order = blend(index, "kas", [byAlias, byTitle], [], new Set(), all)
	assert.deepEqual(
		order.map((row) => row.id),
		[movie(601), movie(602)],
	)
	assert.equal(order[1].matchedAlias, undefined)
})
