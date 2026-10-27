// PROTOTYPE (start page lab): the CSS transform that lays a w × h element onto a quad, so a poster sits in a scene's
// frame or shelf slot in perspective. Unit square → quad (Heckbert's projective mapping), scaled by the element size.
import type { Quad } from "./types"

type Point = [number, number]

/** `matrix3d(...)` for an element of size w × h with `transform-origin: 0 0` at the container's top-left. */
export function quadTransform(quad: [Point, Point, Point, Point], w: number, h: number): string {
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
	const A = a / w
	const D = d / w
	const G = g / w
	const B = b / h
	const E = e / h
	const H = hh / h
	const n = (v: number) => Number(v.toFixed(8))
	return `matrix3d(${[n(A), n(D), 0, n(G), n(B), n(E), 0, n(H), 0, 0, 1, 0, n(c), n(f), 0, 1].join(",")})`
}

/** How an image of iw × ih covers a box of cw × ch at focal point (fx, fy) in 0..1, like object-fit: cover. */
export type Cover = { scale: number; dx: number; dy: number; cw: number; ch: number; iw: number; ih: number }

export function coverFit(cw: number, ch: number, iw: number, ih: number, fx = 0.5, fy = 0.5, zoom = 1): Cover {
	// zoom > 1 crops closer around the focal point.
	const scale = Math.max(cw / iw, ch / ih) * Math.max(1, zoom)
	const sw = iw * scale
	const sh = ih * scale
	// Put the focal point as close to the box's center as the image's edges allow.
	const dx = Math.min(0, Math.max(cw - sw, cw / 2 - fx * sw))
	const dy = Math.min(0, Math.max(ch - sh, ch / 2 - fy * sh))
	return { scale, dx, dy, cw, ch, iw, ih }
}

/** A normalized image point in the box's pixels. */
export const toBox = (cover: Cover, [nx, ny]: Point): Point => [
	cover.dx + nx * cover.iw * cover.scale,
	cover.dy + ny * cover.ih * cover.scale,
]

export const quadToBox = (cover: Cover, quad: Quad): [Point, Point, Point, Point] =>
	quad.map((p) => toBox(cover, p)) as [Point, Point, Point, Point]

/** The axis-aligned rectangle around a quad, in the box's pixels. */
export function quadBounds(points: Point[]) {
	const xs = points.map((p) => p[0])
	const ys = points.map((p) => p[1])
	const left = Math.min(...xs)
	const top = Math.min(...ys)
	return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
}
