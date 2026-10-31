// The ring glow draws only the band around the circle that's inside the frame: the same light as scanning the whole
// square around the circle, at the cost of the visible arc.
import assert from "node:assert/strict"
import { test } from "node:test"
import { Painter, createFrame } from "./pixelfx/core/index.js"

type P = InstanceType<typeof Painter>

/** pixelfx's glowRing before the band scan: every pixel of the square around the circle. */
function fullScan(
	p: P,
	x: number,
	y: number,
	R: number,
	r: number,
	c: number,
	k = 0.5,
) {
	if (r < 1 || k <= 0.004) return
	const cx = p.toX(x, y)
	const cy = p.toY(x, y)
	const E = R + r
	for (let sy = Math.floor(cy - E); sy <= Math.ceil(cy + E); sy++)
		for (let sx = Math.floor(cx - E); sx <= Math.ceil(cx + E); sx++) {
			const d = Math.abs(Math.hypot(sx + 0.5 - cx, sy + 0.5 - cy) - R) / r
			if (d >= 1) continue
			const f = 1 - d
			p.add(sx, sy, c, f * f * k)
		}
}

const COLOR = 0xffaa33

function both(
	w: number,
	h: number,
	ring: [number, number, number, number],
	origin: [number, number] = [0, 0],
) {
	const a = createFrame(w, h, origin[0], origin[1])
	const b = createFrame(w, h, origin[0], origin[1])
	new Painter(a).glowRing(...ring, COLOR, 0.6)
	fullScan(new Painter(b), ...ring, COLOR, 0.6)
	return { a, b }
}

const cases: [
	string,
	number,
	number,
	[number, number, number, number],
	[number, number]?,
][] = [
	["a ring inside the frame", 120, 90, [60, 45, 30, 6]],
	["a thick ring whose band fills the middle", 80, 80, [40, 40, 8, 10]],
	["a ring cut by the frame's edges", 100, 60, [90, 10, 45, 5]],
	["a ring far bigger than the frame", 64, 48, [32, -900, 930, 12]],
	["a ring around the frame", 60, 40, [30, 20, 200, 4]],
	[
		"a ring off a frame that doesn't start at 0",
		50,
		50,
		[130, 140, 25, 4],
		[100, 110],
	],
	["a ring at a fraction of a pixel", 70, 70, [35.37, 34.81, 20.4, 2.6]],
]

for (const [name, w, h, ring, origin] of cases)
	test(`${name}: the same light as the full scan`, () => {
		const { a, b } = both(w, h, ring, origin)
		assert.deepEqual(a.light, b.light)
		assert.deepEqual(a.color, b.color)
	})

test("the cases draw something", () => {
	const { a } = both(120, 90, [60, 45, 30, 6])
	assert.ok(a.light.some((v: number) => v > 0))
})
