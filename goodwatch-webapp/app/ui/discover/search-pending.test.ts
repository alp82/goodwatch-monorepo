import assert from "node:assert/strict"
import test from "node:test"
import { type SearchPendingInput, searchPending, unsentWords } from "./search-pending.ts"

const settled: SearchPendingInput = {
	waitingForWords: false,
	searching: true,
	failed: false,
	readingPending: false,
	catalogue: false,
	hasSearchAnswer: true,
	stale: false,
	partial: false,
	shownForWords: false,
}
const stale = { pending: true, staleResults: true }
const idle = { pending: false, staleResults: false }

test("words not yet sent dim the old results, even before any search ran", () => {
	assert.deepEqual(searchPending({ ...settled, searching: false, waitingForWords: true }), stale)
	assert.deepEqual(searchPending({ ...settled, failed: true, waitingForWords: true }), stale)
})

test("each stage of a running search keeps the results dimmed", () => {
	assert.deepEqual(searchPending({ ...settled, readingPending: true }), stale)
	assert.deepEqual(searchPending({ ...settled, hasSearchAnswer: false }), stale)
	assert.deepEqual(searchPending({ ...settled, stale: true }), stale)
})

test("a catalogue reading waits only for its list", () => {
	assert.deepEqual(searchPending({ ...settled, catalogue: true, hasSearchAnswer: false }), idle)
	assert.deepEqual(searchPending({ ...settled, catalogue: true, hasSearchAnswer: false, stale: true }), stale)
})

test("a partial list for these words stays bright while the ranking finishes", () => {
	assert.deepEqual(searchPending({ ...settled, partial: true }), { pending: true, staleResults: false })
	assert.deepEqual(searchPending({ ...settled, stale: true, shownForWords: true }), {
		pending: true,
		staleResults: false,
	})
})

test("a failed search, no search and painted results are not pending", () => {
	assert.deepEqual(searchPending({ ...settled, failed: true, readingPending: true }), idle)
	assert.deepEqual(searchPending({ ...settled, searching: false, stale: true }), idle)
	assert.deepEqual(searchPending(settled), idle)
})

test("the unsent words tell listeners only when they change", () => {
	const words = unsentWords()
	let calls = 0
	const stop = words.subscribe(() => calls++)
	words.set("space")
	words.set("space")
	words.set(null)
	stop()
	words.set("ship")
	assert.equal(calls, 2)
	assert.equal(words.get(), "ship")
})
