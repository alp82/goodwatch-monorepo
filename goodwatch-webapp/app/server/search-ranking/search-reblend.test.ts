import assert from "node:assert/strict"
import { test } from "node:test"
import { createSearchReblend } from "./search-reblend.server.ts"
import type { SearchIndex } from "./search-index.server.ts"
import type { Reference } from "./references.server.ts"
const movie = (id: number) => 1e12 + id
const show = (id: number) => 2e12 + id
const ids = [movie(1), movie(2), movie(3), show(4)]
// Only fields read by the real title blend/fold are needed; every candidate is in this tiny table.
const index = {
	titleTable: {
		pointIds: ids, rowOf: new Map(ids.map((id, row) => [id, row])),
		titles: ["Earth", "Moon", "Moon director cut", "Moon"],
		originalTitles: ["Earth", "Moon", "Moon", "Moon"],
		years: [1990, 1995, 1995, 2020], popularity: [0, 2, 1, 0],
		imdbIds: ["earth", "moon-movie", "moon-movie", "moon-show"],
	},
	words: { df: new Map([["moon", 1]]) }, titleNames: [], alternateCuts: new Map([[movie(3), [movie(2)]]]),
} as unknown as SearchIndex
const lookup = { id: 99, title: "A remake", original: "Moon", type: "movie", year: "2025", popularity: 0 }

test("reblend uses frozen discovery scores, native-title math, duplicates and separate remake identities", () => {
	const reblend = createSearchReblend(index, "Moon", ids, new Set(), new Uint8Array([1, 1, 1, 1]), new Map(), null)
	const initial = reblend([])
	assert.deepEqual(initial.map(row => row.id), [movie(2), show(4), movie(1)])
	const final = reblend([lookup])
	assert.deepEqual(final.map(row => row.id), [movie(2), show(4), movie(99), movie(1)])
	assert.equal(final.find(row => row.id === movie(99))!.score, 3)
	for (const row of initial) assert.equal(final.find(next => next.id === row.id)!.score, row.score)
	assert.deepEqual(reblend([lookup]), final, "reblending must not mutate the candidate scores or lookup")
})

test("reblend retains the original reference's own-title bounds", () => {
	const ref = { kind: "title", intent: "like", own: new Set([movie(2)]), text: "" } as Reference
	const reblend = createSearchReblend(index, "Moon", ids, new Set(), new Uint8Array([1, 1, 1, 1]), new Map(), ref)
	assert.notEqual(reblend([])[0].id, movie(2))
	assert.notEqual(reblend([lookup])[0].id, movie(2))
	assert.ok(reblend([lookup]).some(row => row.id === movie(99)))
})

test("Discover continues past 100 while preserving every position in the original head", () => {
	const keys = Array.from({ length: 640 }, (_, i) => movie(i + 1))
	const table = {
		pointIds: keys,
		rowOf: new Map(keys.map((key, row) => [key, row])),
		titles: keys.map((_, i) => `Candidate ${i}`),
		originalTitles: keys.map((_, i) => `Candidate ${i}`),
		years: keys.map(() => 2000),
		popularity: keys.map(() => 0),
		imdbIds: keys.map((_, i) => `tt${i}`),
	}
	const large = {
		...index,
		words: { df: new Map([["candidate", 1]]) },
		titleTable: table,
		alternateCuts: new Map(),
	} as unknown as SearchIndex
	const mask = new Uint8Array(keys.length).fill(1)
	const before = createSearchReblend(
		large,
		"candidate",
		keys.slice(0, 100),
		new Set(),
		mask,
		new Map(),
		null,
	)([])
	const expanded = createSearchReblend(
		large,
		"candidate",
		keys,
		new Set(),
		mask,
		new Map(),
		null,
		5000,
	)([])
	assert.equal(expanded.length, 640)
	assert.deepEqual(expanded.slice(0, 100), before)
	assert.equal(new Set(expanded.map((row) => row.id)).size, 640)
	const next = createSearchReblend(
		large,
		"candidate",
		keys,
		new Set(),
		mask,
		new Map(),
		null,
		5000,
	)
	assert.deepEqual(next([]), expanded, "later pages use one frozen order")
})
