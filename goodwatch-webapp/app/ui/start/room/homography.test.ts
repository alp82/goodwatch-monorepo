import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type Quad,
	elementSize,
	overlaps,
	quadBounds,
	quadToBox,
	quadTransform,
} from "./homography.ts"

/** Applies a `matrix3d(...)` (column-major, as CSS writes it) to a point of the element. */
function apply(matrix: string, x: number, y: number): [number, number] {
	const m = matrix.slice("matrix3d(".length, -1).split(",").map(Number)
	assert.equal(m.length, 16)
	const w = m[3] * x + m[7] * y + m[15]
	return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w]
}

// Within a hundredth of a pixel: the matrix is written with 8 decimals.
const near = (actual: [number, number], expected: [number, number]) => {
	assert.ok(
		Math.abs(actual[0] - expected[0]) < 0.01,
		`${actual} vs ${expected}`,
	)
	assert.ok(
		Math.abs(actual[1] - expected[1]) < 0.01,
		`${actual} vs ${expected}`,
	)
}

test("the element's corners land on the quad's corners, in perspective", () => {
	// A shelf slot of the room, in box pixels: no two edges parallel.
	const quad: Quad = [
		[1317, 92],
		[1360, 86],
		[1356, 155],
		[1313, 159],
	]
	const w = 300
	const h = 480
	const m = quadTransform(quad, w, h)
	near(apply(m, 0, 0), quad[0])
	near(apply(m, w, 0), quad[1])
	near(apply(m, w, h), quad[2])
	near(apply(m, 0, h), quad[3])
	// The element's center lands where the quad's diagonals cross (a projective map keeps lines straight).
	const [cx, cy] = apply(m, w / 2, h / 2)
	const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad
	const t =
		((x3 - x0) * (y1 - y3) - (y3 - y0) * (x1 - x3)) /
		((x2 - x0) * (y1 - y3) - (y2 - y0) * (x1 - x3))
	near([cx, cy], [x0 + t * (x2 - x0), y0 + t * (y2 - y0)])
})

test("a rectangle needs no perspective: the last row stays 0, 0, 1", () => {
	const m = quadTransform(
		[
			[10, 20],
			[110, 20],
			[110, 70],
			[10, 70],
		],
		200,
		100,
	)
	assert.equal(m, "matrix3d(0.5,0,0,0,0,0.5,0,0,0,0,1,0,10,20,0,1)")
})

test("a quad of normalized picture points lands in the box where the picture is placed", () => {
	const placed = { scale: 0.5, dx: -10, dy: 40 }
	const points = quadToBox(placed, 1536, 1024, [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1],
	])
	assert.deepEqual(points, [
		[-10, 40],
		[758, 40],
		[758, 552],
		[-10, 552],
	])
	assert.deepEqual(quadBounds(points), {
		left: -10,
		top: 40,
		width: 768,
		height: 512,
	})
})

test("the element has the quad's proportions", () => {
	assert.deepEqual(
		elementSize([
			[0, 0],
			[30, 0],
			[30, 45],
			[0, 45],
		]),
		{ w: 300, h: 450 },
	)
})

test("rectangles overlap within the padding", () => {
	const a = { left: 0, top: 0, width: 10, height: 10 }
	assert.equal(overlaps(a, { left: 15, top: 0, width: 5, height: 5 }, 4), false)
	assert.equal(overlaps(a, { left: 15, top: 0, width: 5, height: 5 }, 8), true)
	assert.equal(overlaps(a, { left: 5, top: 5, width: 5, height: 5 }, 0), true)
})
