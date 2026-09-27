// PROTOTYPE - throwaway. Where each poster of an island's fractal sits (#180, round 5). Every child is half its
// parent's size and sits right against it, in one of three arrangements:
//   orbit    six children ring the first posters, then pairs fan outward;
//   corners  four children at the parent's corners, then three at each child's outer corners;
//   plus     four children on the parent's sides, then three on each child's outer sides.
// Positions are in world units and never change with zoom, so zooming in simply makes the next, smaller ring big
// enough to show. Posters are 2:3; x and y are centers, w is the width.

import type { Arrangement } from "./wire5"

export const RATIO = 0.5
const GAP = 0.07

/** Distance from a parent's center to a child's center along u, so the two just don't touch. */
function touch(ux: number, uy: number, wp: number, wc: number) {
	const hx = (wp + wc) / 2 + GAP * wp
	const hy = (1.5 * wp + 1.5 * wc) / 2 + GAP * wp
	const tx = Math.abs(ux) > 1e-6 ? hx / Math.abs(ux) : Number.POSITIVE_INFINITY
	const ty = Math.abs(uy) > 1e-6 ? hy / Math.abs(uy) : Number.POSITIVE_INFINITY
	return Math.min(tx, ty)
}

/** Unit directions of a node's children. `out` is the direction the node itself points (from its parent). */
function directions(
	arr: Arrangement,
	gen: number,
	out: [number, number] | null,
	n: number,
): [number, number][] {
	const norm = (x: number, y: number): [number, number] => {
		const l = Math.hypot(x, y) || 1
		return [x / l, y / l]
	}
	if (arr === "orbit") {
		if (!out)
			return Array.from({ length: n }, (_, k) =>
				norm(
					Math.cos(-Math.PI / 2 + (k * 2 * Math.PI) / n) * 1,
					Math.sin(-Math.PI / 2 + (k * 2 * Math.PI) / n) * 1.5,
				),
			)
		const a = Math.atan2(out[1], out[0])
		const spread = gen === 3 ? 0.7 : 0.6
		return Array.from({ length: n }, (_, k) => {
			const t = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * spread
			return [Math.cos(a + t), Math.sin(a + t)] as [number, number]
		})
	}
	if (arr === "corners") {
		const c: [number, number][] = [
			[-1, -1.5],
			[1, -1.5],
			[1, 1.5],
			[-1, 1.5],
		].map(([x, y]) => norm(x, y))
		if (!out) return c.slice(0, n)
		const sx = Math.sign(out[0]) || 1
		const sy = Math.sign(out[1]) || 1
		return [norm(sx, 1.5 * sy), norm(sx, -1.5 * sy), norm(-sx, 1.5 * sy)].slice(
			0,
			n,
		)
	}
	// plus
	const sides: [number, number][] = [
		[0, -1],
		[1, 0],
		[0, 1],
		[-1, 0],
	]
	if (!out) return sides.slice(0, n)
	const back: [number, number] = [-Math.round(out[0]), -Math.round(out[1])]
	const fwd = sides.filter(([x, y]) => !(x === back[0] && y === back[1]))
	// Straight on first, then either side.
	fwd.sort(
		(a, b) => b[0] * out[0] + b[1] * out[1] - (a[0] * out[0] + a[1] * out[1]),
	)
	return fwd.slice(0, n)
}

export type Placed = { x: Float32Array; y: Float32Array; w: Float32Array }

/**
 * Positions for a tree given its first posters' centers and width. par and gen as the server sends them
 * (breadth first). Children take their parent's directions in order.
 */
export function place(
	arr: Arrangement,
	roots: { x: number; y: number }[],
	w1: number,
	par: number[],
	gen: number[],
): Placed {
	const n = par.length
	const x = new Float32Array(n)
	const y = new Float32Array(n)
	const w = new Float32Array(n)
	const out: ([number, number] | null)[] = new Array(n).fill(null)
	const kids: number[][] = Array.from({ length: n }, () => [])
	for (let i = 0; i < n; i++) if (par[i] >= 0) kids[par[i]].push(i)
	let r = 0
	for (let i = 0; i < n; i++) {
		if (par[i] < 0) {
			const at = roots[r++] ?? roots[roots.length - 1] ?? { x: 0, y: 0 }
			x[i] = at.x
			y[i] = at.y
			w[i] = w1
		}
		const ks = kids[i]
		if (!ks.length) continue
		const ds = directions(arr, gen[i] + 1, out[i], ks.length)
		const wc = w[i] * RATIO
		ks.forEach((c, k) => {
			const d = ds[k] ?? ds[ds.length - 1]
			const t = touch(d[0], d[1], w[i], wc)
			x[c] = x[i] + d[0] * t
			y[c] = y[i] + d[1] * t
			w[c] = wc
			out[c] = d
		})
	}
	return { x, y, w }
}

/** Box around a full tree (every branch filled) whose first poster is 1 wide, centered on it. */
export function extent(arr: Arrangement, branch: number[]) {
	const par: number[] = [-1]
	const gen: number[] = [1]
	for (let at = 0; at < par.length; at++) {
		const b = branch[gen[at] - 1]
		if (!b) continue
		for (let k = 0; k < b; k++) {
			par.push(at)
			gen.push(gen[at] + 1)
		}
	}
	const p = place(arr, [{ x: 0, y: 0 }], 1, par, gen)
	let x0 = 0
	let x1 = 0
	let y0 = 0
	let y1 = 0
	for (let i = 0; i < par.length; i++) {
		x0 = Math.min(x0, p.x[i] - p.w[i] / 2)
		x1 = Math.max(x1, p.x[i] + p.w[i] / 2)
		y0 = Math.min(y0, p.y[i] - 0.75 * p.w[i])
		y1 = Math.max(y1, p.y[i] + 0.75 * p.w[i])
	}
	return { hw: Math.max(-x0, x1), hh: Math.max(-y0, y1), par, gen, p }
}

/**
 * The first posters of an island: n trees in rows, inside a circle of radius R around (cx, cy).
 * Returns their centers and the width that fits.
 */
export function roots(
	arr: Arrangement,
	branch: number[],
	n: number,
	cx: number,
	cy: number,
	R: number,
) {
	const e = extent(arr, branch)
	const bw = 2 * e.hw
	const bh = 2 * e.hh
	let best = { cols: 1, w: 0 }
	for (let cols = 1; cols <= n; cols++) {
		const rows = Math.ceil(n / cols)
		const w = R / Math.hypot((cols * bw) / 2, (rows * bh) / 2)
		if (w > best.w) best = { cols, w }
	}
	const { cols, w } = best
	const rows = Math.ceil(n / cols)
	const pts: { x: number; y: number }[] = []
	for (let k = 0; k < n; k++) {
		const row = Math.floor(k / cols)
		const inRow = row === rows - 1 ? n - row * cols : cols
		const col = k - row * cols
		pts.push({
			x: cx + (col - (inRow - 1) / 2) * bw * w,
			y: cy + (row - (rows - 1) / 2) * bh * w,
		})
	}
	return { pts, w }
}

/** n half-size places evenly around a poster of width 1 (for a title's neighbors when it has no children). */
export function slots(n: number) {
	return directions("orbit", 2, null, n).map(([ux, uy]) => {
		const t = touch(ux, uy, 1, RATIO)
		return { x: ux * t, y: uy * t }
	})
}
