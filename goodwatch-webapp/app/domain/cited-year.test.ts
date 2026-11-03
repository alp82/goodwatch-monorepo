import assert from "node:assert/strict"
import { test } from "node:test"
import { citedYear } from "./cited-year.ts"

const now = new Date("2026-11-03")

test("a year after a title's words cites that title", () => {
	assert.deepEqual(citedYear("dune 1984", now), { title: "dune", year: 1984 })
	assert.deepEqual(citedYear("Time Travel (2011)", now), {
		title: "Time Travel",
		year: 2011,
	})
	assert.deepEqual(citedYear("the matrix 1999", now), {
		title: "the matrix",
		year: 1999,
	})
})

test("a year after a filter, genre or format word, a decade, a lone year or a future number is no citation", () => {
	for (const q of [
		"horror 1999",
		"movies 2011",
		"time travel movies from 2011",
		"released in 1999",
		"after 1999 and before 2010",
		"from 2020 to 2010",
		"80s time travel",
		"1999",
		"blade runner 2049",
		"dune 1984 on netflix",
	])
		assert.equal(citedYear(q, now), null, q)
})

test("a title ending in punctuation or written with combining marks still cites", () => {
	assert.deepEqual(citedYear("Who Framed Roger Rabbit? 1988", now), {
		title: "Who Framed Roger Rabbit?",
		year: 1988,
	})
	assert.equal(citedYear("Amélie 2001", now)?.year, 2001)
})
