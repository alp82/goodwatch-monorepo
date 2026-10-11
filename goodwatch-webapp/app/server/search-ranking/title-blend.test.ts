import assert from "node:assert/strict"
import { test } from "node:test"
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
	titleNames: [],
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
