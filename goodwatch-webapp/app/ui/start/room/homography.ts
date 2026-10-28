// The CSS transform that lays a w × h element onto a quad, so a cover sits in a shelf slot of the room in perspective.
// Unit square → quad (Heckbert's projective mapping), scaled by the element's size. Pure, so a test runs it without a
// browser.

export type Point = [number, number]

/** Four corners: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point]

/** `matrix3d(...)` for an element of size w × h with `transform-origin: 0 0` at the container's top-left. */
export function quadTransform(quad: Quad, w: number, h: number): string {
	const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad
	const dx1 = x1 - x2
	const dx2 = x3 - x2
	const dx3 = x0 - x1 + x2 - x3
	const dy1 = y1 - y2
	const dy2 = y3 - y2
	const dy3 = y0 - y1 + y2 - y3
	let g = 0
	let hh = 0
	if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
		const den = dx1 * dy2 - dx2 * dy1
		g = (dx3 * dy2 - dx2 * dy3) / den
		hh = (dx1 * dy3 - dx3 * dy1) / den
	}
	const a = x1 - x0 + g * x1
	const b = x3 - x0 + hh * x3
	const c = x0
	const d = y1 - y0 + g * y1
	const e = y3 - y0 + hh * y3
	const f = y0
	// Scale the element's own pixels to the unit square first.
	const n = (v: number) => Number(v.toFixed(8))
	return `matrix3d(${[n(a / w), n(d / w), 0, n(g / w), n(b / h), n(e / h), 0, n(hh / h), 0, 0, 1, 0, n(c), n(f), 0, 1].join(",")})`
}

/** Where a picture of iw × ih sits in its box: its scale and its top-left corner, in the box's pixels. */
export type Placed = { scale: number; dx: number; dy: number }

/** A normalized picture point (0..1 of its width and height) in the box's pixels. */
export const toBox = (
	placed: Placed,
	iw: number,
	ih: number,
	[nx, ny]: Point,
): Point => [
	placed.dx + nx * iw * placed.scale,
	placed.dy + ny * ih * placed.scale,
]

export const quadToBox = (
	placed: Placed,
	iw: number,
	ih: number,
	quad: Quad,
): Quad => quad.map((p) => toBox(placed, iw, ih, p)) as Quad

export type Rect = { left: number; top: number; width: number; height: number }

/** The axis-aligned rectangle around some points. */
export function quadBounds(points: readonly Point[]): Rect {
	const xs = points.map((p) => p[0])
	const ys = points.map((p) => p[1])
	const left = Math.min(...xs)
	const top = Math.min(...ys)
	return {
		left,
		top,
		width: Math.max(...xs) - left,
		height: Math.max(...ys) - top,
	}
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** The element size, `width` px wide, whose proportions match the quad (the mean of opposite edges). */
export function elementSize(
	points: Quad,
	width = 300,
): { w: number; h: number } {
	const [tl, tr, br, bl] = points
	const w = (dist(tl, tr) + dist(bl, br)) / 2
	const h = (dist(tl, bl) + dist(tr, br)) / 2
	return { w: width, h: Math.max(1, Math.round((width * h) / Math.max(1, w))) }
}

/** Whether two rectangles come closer than `pad` px. */
export const overlaps = (a: Rect, b: Rect, pad: number) =>
	a.left < b.left + b.width + pad &&
	b.left - pad < a.left + a.width &&
	a.top < b.top + b.height + pad &&
	b.top - pad < a.top + a.height
