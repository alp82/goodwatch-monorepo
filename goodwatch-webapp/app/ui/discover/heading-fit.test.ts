// The heading's query size: as large as the "Discover" title, shrinking to fill the row, never under the floor.
import assert from "node:assert/strict"
import test from "node:test"
import { fitSize } from "./heading-fit.ts"

const RANGE = { max: 42, min: 22 }

test("a short query stays at the title's size", () => {
	assert.deepEqual(fitSize(300, 1200, RANGE), { size: 42, overflows: false })
})

test("a longer query shrinks to fill the row", () => {
	// 3,000 px wide at 100 px fills 1,200 px at 40 px.
	assert.deepEqual(fitSize(3000, 1200, RANGE), { size: 40, overflows: false })
	assert.deepEqual(fitSize(4000, 1200, RANGE), { size: 30, overflows: false })
})

test("a very long query stops at the floor and overflows", () => {
	assert.deepEqual(fitSize(9000, 1200, RANGE), { size: 22, overflows: true })
})

test("an empty measure keeps the largest size", () => {
	assert.deepEqual(fitSize(0, 1200, RANGE), { size: 42, overflows: false })
})
