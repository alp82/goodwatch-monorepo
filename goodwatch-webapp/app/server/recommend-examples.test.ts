// The guest recommend-by-example split (recommend-examples.ts).
import assert from "node:assert/strict"
import { test } from "node:test"
import { splitExamples } from "./recommend-examples.ts"

const scores = (items: { score: number }[]) => items.map((i) => i.score)
const split = (...s: number[]) => {
	const { positive, negative } = splitExamples(s.map((score) => ({ score })))
	return { positive: scores(positive), negative: scores(negative) }
}

test("equally scored loved titles are all positive", () => {
	assert.deepEqual(split(10, 10, 10), { positive: [10, 10, 10], negative: [] })
	assert.deepEqual(split(9, 9), { positive: [9, 9], negative: [] })
	assert.deepEqual(split(10, 10, 10, 5), {
		positive: [10, 10, 10],
		negative: [5],
	})
})

test("different scores split by rank as before: the top half positive", () => {
	assert.deepEqual(split(10), { positive: [10], negative: [] })
	assert.deepEqual(split(4, 10), { positive: [10], negative: [4] })
	assert.deepEqual(split(10, 8, 6, 4), { positive: [10, 8], negative: [6, 4] })
	assert.deepEqual(split(10, 5, 5), { positive: [10, 5], negative: [5] })
	assert.deepEqual(split(3, 9, 7, 1, 5), {
		positive: [9, 7, 5],
		negative: [3, 1],
	})
})
