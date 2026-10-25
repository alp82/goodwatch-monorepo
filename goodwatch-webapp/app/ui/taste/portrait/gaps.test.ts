import assert from "node:assert/strict"
import { test } from "node:test"
import { evenEnds, gapLists, genreLabel } from "./gaps.ts"

const gap = (id: string, delta: number) => ({ id, name: id, delta })

test("TV-only genres say shows, and a movie genre says movies beside its TV twin", () => {
	const ids = new Set(["Sci-Fi & Fantasy", "Science Fiction", "Drama"])
	assert.equal(genreLabel("Sci-Fi & Fantasy", ids), "Sci-fi & fantasy shows")
	assert.equal(genreLabel("Science Fiction", ids), "Sci-fi movies")
	assert.equal(genreLabel("Drama", ids), "Drama")
	assert.equal(genreLabel("Science Fiction", new Set()), "Science Fiction")
})

test("an even list keeps both ends, warmest first", () => {
	const rows = [3, 2, 1, -1, -2, -3].map((d) => gap(`g${d}`, d))
	assert.deepEqual(
		evenEnds(rows, 4).map((r) => r.delta),
		[3, 2, -2, -3],
	)
	assert.deepEqual(
		evenEnds([gap("a", 1), gap("b", 2)], 4).map((r) => r.delta),
		[2, 1],
	)
})

test("genres and traits come out at the same length, on one scale", () => {
	const lists = gapLists(
		[gap("Drama", 0.4), gap("Horror", -0.6)],
		[gap("wit", 0.9), gap("gore", -0.3), gap("pace", 0.2), gap("scare", -0.5)],
		(key) => (key === "wit" ? { label: "Wit", emoji: "*" } : null),
	)
	assert.equal(lists.genres.length, 2)
	assert.equal(lists.traits.length, 2)
	assert.deepEqual(
		lists.traits.map((t) => t.label),
		["Wit", "scare"],
	)
	assert.equal(lists.traits[0].emoji, "*")
	assert.equal(lists.max, 0.9)
})

test("with one list empty, the other keeps its length", () => {
	const lists = gapLists([], [gap("wit", 0.9), gap("gore", -0.3)], () => null)
	assert.equal(lists.genres.length, 0)
	assert.equal(lists.traits.length, 2)
})
