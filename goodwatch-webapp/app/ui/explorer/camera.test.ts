import assert from "node:assert/strict"
import { test } from "node:test"
import { nextStop, overviewStep } from "./camera.ts"

const home = { x: 1000, y: 1000, s: 0.1 }
const combination = { x: 1000, y: 1000, s: 0.6 }
const region = { x: 2000, y: 1000, s: 1 }

test("wheel steps enter the combination from the world, then continue into its titles", () => {
	const frame = overviewStep(
		home.s,
		region.s,
		1,
		() => home,
		() => combination,
	)
	assert.deepEqual(frame, combination)
	assert.equal(
		overviewStep(
			combination.s,
			region.s,
			1,
			() => home,
			() => combination,
		),
		null,
	)
	assert.equal(nextStop([0.6, 1, 2, 4], combination.s, 1), 1)
})

test("zooming out to the combination frame does not trap the next step in", () => {
	const stops = [0.6, 1, 2, 4]
	const out = nextStop(stops, 1, -1)
	assert.equal(out, combination.s)
	assert.ok(out !== null)
	assert.equal(
		overviewStep(
			out,
			region.s,
			1,
			() => home,
			() => combination,
		),
		null,
	)
	assert.equal(nextStop(stops, out, 1), 1)
})

test("a step in near or beyond the combination frame never reframes it", () => {
	for (const scale of [combination.s * 0.95, combination.s * 1.2]) {
		assert.equal(
			overviewStep(
				scale,
				region.s,
				1,
				() => home,
				() => combination,
			),
			null,
		)
	}
})

test("ordinary regions still frame from the world and allow the next zoom step", () => {
	assert.deepEqual(
		overviewStep(
			home.s,
			region.s,
			1,
			() => home,
			() => region,
		),
		region,
	)
	assert.equal(
		overviewStep(
			region.s,
			region.s,
			1,
			() => home,
			() => region,
		),
		null,
	)
})

test("a step out from the wide combination frame still returns to the world", () => {
	assert.deepEqual(
		overviewStep(
			combination.s,
			region.s,
			-1,
			() => home,
			() => combination,
		),
		home,
	)
})
