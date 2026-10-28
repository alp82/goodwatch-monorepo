import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type Transform2D,
	coveredSlots,
	mapRect,
	onScreen,
	parseMatrix,
	parseOrigin,
} from "./obstacles.ts"

const scale = (k: number, ox: number, oy: number): Transform2D => ({
	a: k,
	b: 0,
	c: 0,
	d: k,
	e: 0,
	f: 0,
	ox,
	oy,
})
const shift = (x: number, y: number): Transform2D => ({
	a: 1,
	b: 0,
	c: 0,
	d: 1,
	e: x,
	f: y,
	ox: 0,
	oy: 0,
})

test("computed transforms parse to their 2D part", () => {
	assert.deepEqual(parseMatrix("none"), [1, 0, 0, 1, 0, 0])
	assert.deepEqual(
		parseMatrix("matrix(1.12, 0, 0, 1.12, 0, 0)"),
		[1.12, 0, 0, 1.12, 0, 0],
	)
	assert.deepEqual(
		parseMatrix("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 300, 0, 1)"),
		[1, 0, 0, 1, 0, 300],
	)
	assert.equal(parseMatrix("translateY(300px)"), null)
	assert.deepEqual(parseOrigin("640px 374.4px 0px"), { x: 640, y: 374.4 })
})

test("a scale grows a box about its origin, a shift moves it", () => {
	// The camera's 1.12 about (500, 500): a box at the origin stays centered on it.
	const r = mapRect(
		{ left: 450, top: 450, width: 100, height: 100 },
		scale(1.12, 500, 500),
	)
	for (const [got, want] of [
		[r.left, 444],
		[r.top, 444],
		[r.width, 112],
		[r.height, 112],
	])
		assert.ok(Math.abs(got - want) < 1e-9, `${got} ≈ ${want}`)
	assert.deepEqual(
		onScreen({ left: 10, top: 20, width: 30, height: 40 }, [
			shift(0, 300),
			shift(5, 0),
		]),
		{ left: 15, top: 320, width: 30, height: 40 },
	)
})

test("slots are hidden where the centered heading and the zoomed room meet on screen, not in layout", () => {
	// The heading's layout box is at the top; centered, it is drawn 300 px lower.
	const headingLayout = { left: 300, top: 40, width: 400, height: 60 }
	const heading = onScreen(headingLayout, [shift(0, 300)])
	const slots = [
		// Under the heading's layout box only: on screen nothing covers it.
		{ left: 450, top: 50, width: 40, height: 40 },
		// Under the heading as drawn.
		{ left: 450, top: 350, width: 40, height: 40 },
		// 20 px above the heading as drawn, but the camera's 1.12 about the stage's top pushes it under the heading.
		{ left: 450, top: 300, width: 40, height: 20 },
	]
	assert.deepEqual(coveredSlots(slots, [], [heading], 8), [false, true, false])
	assert.deepEqual(coveredSlots(slots, [scale(1.12, 500, 0)], [heading], 8), [
		false,
		true,
		true,
	])
})
