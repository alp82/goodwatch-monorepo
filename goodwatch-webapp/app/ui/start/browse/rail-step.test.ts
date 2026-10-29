// Where a browse rail's arrows scroll to (rail-step.ts).
import assert from "node:assert/strict"
import { test } from "node:test"
import { railEnds, railTarget } from "./rail-step.ts"

// Twenty cards 100 px wide with a 10 px gap, in a rail 560 px wide with 30 px padding: five cards a view.
const cards = Array.from({ length: 20 }, (_, i) => ({
	at: i * 110,
	right: 30 + i * 110 + 100,
	width: 100,
}))
const box = (left: number) => ({
	left,
	max: 20 * 110 - 10 + 60 - 560,
	width: 560,
	pad: 30,
	gap: 10,
})

test("forward: the first card not wholly in view becomes the first", () => {
	// Cards 0 to 3 are whole (4 ends at 570 > 531): card 4 comes first.
	assert.equal(railTarget(box(0), cards, 1), 440)
	assert.equal(railTarget(box(440), cards, 1), 880)
})

test("back: the card now first becomes about the last in view", () => {
	assert.equal(railTarget(box(880), cards, -1), 440)
})

test("a step never leaves a tiny last move: it goes to the end", () => {
	const { max } = box(0)
	// From 1320 the next card start is 1760, but only 1690 is left: within a third of a view of the end.
	assert.equal(railTarget(box(1320), cards, 1), max)
	assert.equal(railTarget(box(max - 50), cards, 1), max)
	// Back from close to the start goes to the start.
	assert.equal(railTarget(box(300), cards, -1), 0)
})

test("the ends, within a few pixels", () => {
	assert.deepEqual(railEnds(0, 500), { atStart: true, atEnd: false })
	assert.deepEqual(railEnds(498, 500), { atStart: false, atEnd: true })
	// A rail that fits has nowhere to go.
	assert.deepEqual(railEnds(0, 0), { atStart: true, atEnd: true })
})
