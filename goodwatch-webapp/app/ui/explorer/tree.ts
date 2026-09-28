// Where each poster of an island's tree sits. The first posters stand in rows in the middle of the island; every
// child is half its parent's size and sits right against it: six children ring each first poster, then pairs fan
// outward. Positions are in world units and never change with zoom, so zooming in simply makes the next, smaller ring
// big enough to show. Posters are 2:3; x and y are centers, w is the width.

/** A child is this much of its parent's width. */
const RATIO = 0.5
const GAP = 0.07

/** Distance from a parent's center to a child's center along u, so the two just don't touch. */
function touch(ux: number, uy: number, wp: number, wc: number) {
	const hx = (wp + wc) / 2 + GAP * wp
	const hy = (1.5 * wp + 1.5 * wc) / 2 + GAP * wp
	const tx = Math.abs(ux) > 1e-6 ? hx / Math.abs(ux) : Number.POSITIVE_INFINITY
	const ty = Math.abs(uy) > 1e-6 ? hy / Math.abs(uy) : Number.POSITIVE_INFINITY
	return Math.min(tx, ty)
}

/** Unit directions of a poster's children; `out` is the direction the poster itself points (from its parent). */
function directions(
	generation: number,
	out: [number, number] | null,
	n: number,
): [number, number][] {
	if (!out)
		return Array.from({ length: n }, (_, k) => {
			const x = Math.cos(-Math.PI / 2 + (k * 2 * Math.PI) / n)
			const y = Math.sin(-Math.PI / 2 + (k * 2 * Math.PI) / n) * 1.5
			const l = Math.hypot(x, y) || 1
			return [x / l, y / l]
		})
	const a = Math.atan2(out[1], out[0])
	const spread = generation === 3 ? 0.7 : 0.6
	return Array.from({ length: n }, (_, k) => {
		const t = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * spread
		return [Math.cos(a + t), Math.sin(a + t)] as [number, number]
	})
}

export interface Placed {
	x: Float32Array
	y: Float32Array
	w: Float32Array
}

/**
 * Positions of a tree given its first posters' centers and width, with parent and generation as the server sends
 * them (breadth first, parent -1 and generation 1 for the first posters).
 */
export function placeTree(
	roots: { x: number; y: number }[],
	w1: number,
	parent: number[],
	generation: number[],
): Placed {
	const n = parent.length
	const x = new Float32Array(n)
	const y = new Float32Array(n)
	const w = new Float32Array(n)
	const out: ([number, number] | null)[] = new Array(n).fill(null)
	const kids: number[][] = Array.from({ length: n }, () => [])
	for (let i = 0; i < n; i++) if (parent[i] >= 0) kids[parent[i]]?.push(i)
	let r = 0
	for (let i = 0; i < n; i++) {
		if (parent[i] < 0) {
			const at = roots[r++] ?? roots[roots.length - 1] ?? { x: 0, y: 0 }
			x[i] = at.x
			y[i] = at.y
			w[i] = w1
		}
		const children = kids[i]
		if (!children.length) continue
		const ds = directions(generation[i] + 1, out[i], children.length)
		const wc = w[i] * RATIO
		children.forEach((c, k) => {
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

/** Half width and half height of a full tree (every branch filled) whose first poster is 1 wide, around its center. */
export function treeExtent(branching: readonly number[]) {
	const parent: number[] = [-1]
	const generation: number[] = [1]
	for (let at = 0; at < parent.length; at++) {
		const b = branching[generation[at] - 1]
		if (!b) continue
		for (let k = 0; k < b; k++) {
			parent.push(at)
			generation.push(generation[at] + 1)
		}
	}
	const p = placeTree([{ x: 0, y: 0 }], 1, parent, generation)
	let x0 = 0
	let x1 = 0
	let y0 = 0
	let y1 = 0
	for (let i = 0; i < parent.length; i++) {
		x0 = Math.min(x0, p.x[i] - p.w[i] / 2)
		x1 = Math.max(x1, p.x[i] + p.w[i] / 2)
		y0 = Math.min(y0, p.y[i] - 0.75 * p.w[i])
		y1 = Math.max(y1, p.y[i] + 0.75 * p.w[i])
	}
	return { hw: Math.max(-x0, x1), hh: Math.max(-y0, y1) }
}

/**
 * The first posters of an island: n trees in rows, inside a circle of radius R around (cx, cy). Returns their
 * centers and the width that fits.
 */
export function treeRoots(
	branching: readonly number[],
	n: number,
	cx: number,
	cy: number,
	R: number,
) {
	const e = treeExtent(branching)
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
