// The point glow and the beam glow scan only the part of their box that's inside the frame: the same light as
// scanning the whole box, and a huge off-screen beam costs next to nothing.
import assert from "node:assert/strict"
import { test } from "node:test"
import { Painter, createFrame } from "./pixelfx/core/index.js"

type P = InstanceType<typeof Painter>

const COLOR = 0x33aaff
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** pixelfx's glow before clipping: every pixel of the square around the point. */
function fullGlow(p: P, x: number, y: number, r: number, c: number, k = 0.5) {
	if (r < 1 || k <= 0.004) return
	const cx = p.toX(x, y)
	const cy = p.toY(x, y)
	for (let sy = Math.floor(cy - r); sy <= Math.ceil(cy + r); sy++) {
		const dy = (sy + 0.5 - cy) / r
		for (let sx = Math.floor(cx - r); sx <= Math.ceil(cx + r); sx++) {
			const dx = (sx + 0.5 - cx) / r
			const d = dx * dx + dy * dy
			if (d >= 1) continue
			const f = 1 - Math.sqrt(d)
			p.add(sx, sy, c, f * f * k)
		}
	}
}

/** pixelfx's glowLine before clipping: every pixel of the box around the segment. */
function fullGlowLine(
	p: P,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	r: number,
	c: number,
	k = 0.5,
) {
	if (r < 1 || k <= 0.004) return
	const ax = p.toX(x0, y0)
	const ay = p.toY(x0, y0)
	const bx = p.toX(x1, y1)
	const by = p.toY(x1, y1)
	const dx = bx - ax
	const dy = by - ay
	const L2 = dx * dx + dy * dy || 1e-9
	for (
		let sy = Math.floor(Math.min(ay, by) - r);
		sy <= Math.ceil(Math.max(ay, by) + r);
		sy++
	)
		for (
			let sx = Math.floor(Math.min(ax, bx) - r);
			sx <= Math.ceil(Math.max(ax, bx) + r);
			sx++
		) {
			const px = sx + 0.5
			const py = sy + 0.5
			const u = clamp(((px - ax) * dx + (py - ay) * dy) / L2)
			const ex = ax + dx * u - px
			const ey = ay + dy * u - py
			const d = Math.sqrt(ex * ex + ey * ey) / r
			if (d >= 1) continue
			const f = 1 - d
			p.add(sx, sy, c, f * f * k)
		}
}

type Origin = [number, number]

const glowCases: [string, number, number, [number, number, number], Origin?][] =
	[
		["a glow inside the frame", 80, 60, [40, 30, 12]],
		["a glow cut by the frame's corner", 80, 60, [75, 2, 20]],
		["a glow bigger than the frame", 40, 30, [20, 15, 90]],
		["a glow next to the frame", 40, 30, [-30, 15, 20]],
		[
			"a glow off a frame that doesn't start at 0",
			50,
			50,
			[95, 140, 18],
			[80, 110],
		],
	]

for (const [name, w, h, [x, y, r], origin = [0, 0]] of glowCases)
	test(`${name}: the same light as the full scan`, () => {
		const a = createFrame(w, h, origin[0], origin[1])
		const b = createFrame(w, h, origin[0], origin[1])
		new Painter(a).glow(x, y, r, COLOR, 0.6)
		fullGlow(new Painter(b), x, y, r, COLOR, 0.6)
		assert.deepEqual(a.light, b.light)
	})

const lineCases: [
	string,
	number,
	number,
	[number, number, number, number, number],
	Origin?,
][] = [
	["a beam inside the frame", 120, 90, [10, 10, 100, 70, 6]],
	["a beam leaving the frame", 100, 60, [50, 30, 400, -200, 8]],
	["a beam across the whole frame", 64, 48, [-500, -300, 600, 400, 10]],
	["a beam passing outside the frame", 60, 40, [-100, -50, 200, -60, 5]],
	[
		"a beam off a frame that doesn't start at 0",
		50,
		50,
		[0, 0, 200, 250, 7],
		[100, 110],
	],
]

for (const [name, w, h, [x0, y0, x1, y1, r], origin = [0, 0]] of lineCases)
	test(`${name}: the same light as the full scan`, () => {
		const a = createFrame(w, h, origin[0], origin[1])
		const b = createFrame(w, h, origin[0], origin[1])
		new Painter(a).glowLine(x0, y0, x1, y1, r, COLOR, 0.6)
		fullGlowLine(new Painter(b), x0, y0, x1, y1, r, COLOR, 0.6)
		assert.deepEqual(a.light, b.light)
	})

test("the cases draw something", () => {
	const a = createFrame(120, 90)
	new Painter(a).glowLine(10, 10, 100, 70, 6, COLOR, 0.6)
	assert.ok(a.light.some((v: number) => v > 0))
})

test("a huge beam and glow off screen cost next to nothing", () => {
	const f = createFrame(320, 180)
	const p = new Painter(f)
	const t0 = performance.now()
	for (let i = 0; i < 20; i++) {
		p.glowLine(-6000, -4000, 6000, -3000, 2000, COLOR, 0.6)
		p.glow(9000, 9000, 4000, COLOR, 0.6)
	}
	const ms = (performance.now() - t0) / 20
	assert.ok(ms < 5, `${ms.toFixed(2)} ms per draw`)
	assert.ok(f.light.every((v: number) => v === 0))
})
