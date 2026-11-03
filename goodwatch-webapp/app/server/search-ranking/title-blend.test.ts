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
		votes: [0, 0, 0, 0, 0, 0],
		imdbIds: ["k", "c", "cr", "t", "s", "kd"],
	},
	negationLabels: { titles: [], labelsWithStem: new Map() },
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

test("with the ranked list mixed in, an alias match stays below the title matches of its kind", () => {
	// Both start with the query (prefix, 0.9). The alias row is the ranked list's first title, which would lift it to
	// 0.9 + 0.89 x 0.15; the title row isn't ranked at all.
	const byAlias = {
		...lookup(1, "Knights", 9),
		matchedAlias: { text: "Kastell der Ritter Teil 3", language: "de" },
	}
	const byTitle = lookup(701, "Kastell der Ritter Teil 2", 0)
	const order = blend(
		index,
		"kastell der ritter",
		[byAlias, byTitle],
		ranked,
		new Set(),
		all,
	)
	assert.deepEqual(
		order.slice(0, 2).map((row) => row.id),
		[movie(701), movie(1)],
	)
	assert.equal(order[0].score, 0.9)
	assert.ok(order[1].score < 0.9)
	assert.equal(order[1].matchedAlias?.text, "Kastell der Ritter Teil 3")
	// Rows of a lower kind aren't capped by it: the ranked titles without a match keep their fusion scores.
	assert.equal(order.find((row) => row.id === movie(2))?.score, 0.8182)
})

// A catalog where "time travel" is a label of 15 titles (ids 101-115) and three titles carry the words in their name.
const conceptIds = Array.from({ length: 15 }, (_, i) => movie(101 + i))
const named = [movie(201), movie(202), movie(203)]
const conceptKeys = [...conceptIds, ...named]
const conceptIndex = {
	titleTable: {
		pointIds: conceptKeys,
		rowOf: new Map(conceptKeys.map((id, row) => [id, row])),
		titles: [
			...conceptIds.map((_, i) => `Film ${i}`),
			"Time Travel",
			"Time Travel",
			"The Time Travel Hills",
		],
		originalTitles: conceptKeys.map(() => ""),
		years: [...conceptIds.map(() => 2000), 2011, 2018, 2024],
		popularity: conceptKeys.map(() => 0),
		votes: [...conceptIds.map(() => 50_000), 120, 900_000, 300],
		imdbIds: conceptKeys.map((id) => `tt${id}`),
	},
	words: {
		df: new Map([
			["time", 1],
			["travel", 1],
			["film", 1],
		]),
	},
	titleNames: [
		{ name: "time travel", row: 15 },
		{ name: "time travel", row: 16 },
		{ name: "the time travel hills", row: 17 },
	],
	aliases: aliasTable({ version: 1, rows: [], names: [], languages: [] }, 18),
	negationLabels: {
		titles: [conceptIds],
		labelsWithStem: new Map([
			["time", [0]],
			["travel", [0]],
		]),
	},
} as unknown as SearchIndex
const everyRow = new Uint8Array(conceptKeys.length).fill(1)
const namedLookup = [
	{ id: 201, title: "Time Travel", type: "movie", year: "2011", popularity: 5 },
	{ id: 202, title: "Time Travel", type: "movie", year: "2018", popularity: 1 },
	{
		id: 203,
		title: "The Time Travel Hills",
		type: "movie",
		year: "2024",
		popularity: 9,
	},
]

test("a concept search keeps titles named after the concept in their ranked place, unless one is well known", () => {
	const order = blend(
		conceptIndex,
		"time travel",
		namedLookup,
		[...conceptIds.slice(0, 5), movie(201), ...conceptIds.slice(5)],
		new Set(),
		everyRow,
	).map((row) => row.id)
	// The well-known exact title still leads; the obscure exact title keeps its ranked place (6th of the ranked list);
	// the unranked partial match isn't listed.
	assert.equal(order[0], movie(202))
	assert.deepEqual(order.slice(1, 6), conceptIds.slice(0, 5))
	assert.equal(order[6], movie(201))
	assert.equal(order.includes(movie(203)), false)
})

test("a query written as a title is no concept search", () => {
	const order = blend(
		conceptIndex,
		"the time travel hills",
		namedLookup,
		conceptIds,
		new Set(),
		everyRow,
	)
	assert.equal(order[0].id, movie(203))
})

test("a cited year lifts that year's exact title, a year off a step lower, and no other year's", () => {
	const ranked = conceptIds.slice(0, 5)
	const exact = blend(
		conceptIndex,
		"time travel 2011",
		namedLookup,
		ranked,
		new Set(),
		everyRow,
	)
	assert.equal(exact[0].id, movie(201))
	assert.equal(
		exact.find((row) => row.id === movie(202)),
		undefined,
	)
	// Not in the lookup (it searched the words with the year): found in the catalog, a year off.
	const near = blend(
		conceptIndex,
		"time travel 2012",
		[],
		ranked,
		new Set(),
		everyRow,
	)
	assert.equal(near[0].id, movie(201))
	assert.ok(
		near[0].score >
			blend(conceptIndex, "time travel", [], ranked, new Set(), everyRow)[0]
				.score,
	)
	const other = blend(
		conceptIndex,
		"time travel 2015",
		[],
		ranked,
		new Set(),
		everyRow,
	)
	assert.deepEqual(
		other.map((row) => row.id),
		ranked,
	)
})

test("a one-letter word makes the query a name, not a concept", () => {
	const order = blend(
		conceptIndex,
		"time x travel",
		namedLookup,
		conceptIds,
		new Set(),
		everyRow,
	)
	assert.notEqual(
		order.find((row) => row.id === movie(203)),
		undefined,
	)
})

test("a cited title may leave out its article", () => {
	const lookupRows = [
		{
			id: 203,
			title: "The Time Travel Hills",
			type: "movie",
			year: "2024",
			popularity: 0,
		},
	]
	const order = blend(
		conceptIndex,
		"time travel hills 2024",
		lookupRows,
		conceptIds,
		new Set(),
		everyRow,
	)
	assert.equal(order[0].id, movie(203))
	assert.equal(order[0].score, 3)
})

test("a concept search lists no unranked title without a title match", () => {
	const lookupRows = [
		{
			id: 203,
			title: "The Time Travel Hills",
			type: "movie",
			year: "2024",
			popularity: 0,
		},
		{ id: 1, title: "Knights", type: "movie", year: "2001", popularity: 0 },
	]
	const ids = blend(
		conceptIndex,
		"time travel",
		lookupRows,
		conceptIds,
		new Set(),
		everyRow,
	).map((row) => row.id)
	assert.deepEqual(ids, conceptIds)
})
