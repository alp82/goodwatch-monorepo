import assert from "node:assert/strict"
import { test } from "node:test"
import { type MemberSet, combine } from "./combine.server.ts"

/** A set from titles in the order they stand. */
const setOf = (...titles: number[]): MemberSet =>
	new Map(titles.map((title, at) => [title, at / titles.length]))

test("a combination holds the titles in every set", () => {
	assert.deepEqual(
		combine([setOf(1, 2, 3, 4), setOf(4, 2, 9), setOf(2, 4, 7, 8)]).sort(),
		[2, 4],
	)
})

test("no shared title leaves it empty, and so does no set", () => {
	assert.deepEqual(combine([setOf(1, 2), setOf(3)]), [])
	assert.deepEqual(combine([]), [])
})

test("one set alone is itself, in its order", () => {
	assert.deepEqual(combine([setOf(5, 3, 8)]), [5, 3, 8])
})

test("titles near the top of every set come first", () => {
	// 7 is first in both, 5 second in both, 2 third and last.
	assert.deepEqual(combine([setOf(7, 5, 2, 1), setOf(7, 5, 9, 2)]), [7, 5, 2])
})

test("a tie is broken by index, so the order is stable", () => {
	assert.deepEqual(combine([setOf(4, 3), setOf(3, 4)]), [3, 4])
})

test("the order of the sets does not change the result", () => {
	const a = setOf(1, 2, 3, 4, 5)
	const b = setOf(5, 4, 3)
	const c = setOf(3, 9, 5)
	assert.deepEqual(combine([a, b, c]), combine([c, a, b]))
})
