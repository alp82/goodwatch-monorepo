// PROTOTYPE - throwaway. Map layouts for /prototype/rec-explorer-4 (#180, round 4). Each variant lays the same regions
// out differently: a treemap of fields sized by how many titles, organic blobs placed by similarity, a board of equal
// tiles ranked by fit, or concentric taste rings cut into sectors. All in world units (short side about 1000).
// Every cell knows its shape, where its label goes, where its posters go at each zoom level, and its neighbors.
import { BANDS, type Region, type W } from "./wire4"

export type LayoutKind = "fields" | "blobs" | "tiles" | "rings"
export type Dir = "n" | "e" | "s" | "w"

export type Rect = { x: number; y: number; w: number; h: number }
export type Cell = {
	/** Region id, or `${region}@${band}` for a ring cell. */
	id: string
	region: Region
	band: number | null
	items: W[]
	count: number
	fit: number
	kind: "rect" | "blob" | "sector"
	cx: number
	cy: number
	box: Rect
	/** What a fly-in frames (the whole shape; for a ring cell, the whole wedge). */
	frame?: Rect
	/** Where posters go. */
	inner: Rect
	/** Label anchor and size in world units at the overview. */
	label: { x: number; y: number; size: number; align: "left" | "center" }
	fill: string
	rim: string
	/** Shape parameters. */
	r?: number
	seed?: number
	sector?: { r0: number; r1: number; a0: number; a1: number }
	path?: Path2D
}
export type World = {
	kind: LayoutKind
	w: number
	h: number
	cells: Cell[]
	/** Rings: the radii of the bands and where the center is. */
	rings?: { cx: number; cy: number; radii: [number, number][] }
}

/** How many posters a cell shows at each zoom level (0 = color field only). */
export const LEVELS: Record<LayoutKind, number[]> = {
	fields: [0, 3, 6, 10],
	blobs: [0, 3, 5, 8],
	tiles: [0, 4, 6, 9],
	rings: [0, 1, 2, 4],
}

// ---------------------------------------------------------------- color

const hex = (c: string) => [1, 3, 5].map((k) => Number.parseInt(c.slice(k, k + 2), 16))
const mix = (a: string, b: string, t: number) => {
	const A = hex(a)
	const B = hex(b)
	return `rgb(${A.map((v, k) => Math.round(v + (B[k] - v) * t)).join(",")})`
}
export const alpha = (c: string, a: number) => `rgba(${hex(c).join(",")},${a})`

/** Tinted by fit: regions that fit you glow in their color, the rest sink toward the dark. */
function paint(cells: Cell[]) {
	const fits = cells.map((c) => c.fit)
	const lo = Math.min(...fits)
	const hi = Math.max(...fits)
	for (const c of cells) {
		const f = hi > lo ? (c.fit - lo) / (hi - lo) : 0.6
		c.fill = mix(c.region.color, "#0c0a09", 0.72 - 0.47 * f)
		c.rim = alpha(c.region.color, 0.35 + 0.5 * f)
	}
}

// ---------------------------------------------------------------- posters

/** The best grid of n posters (2:3) inside a rect: positions are poster centers, w is the poster width. */
export function grid(r: Rect, n: number) {
	if (n <= 0) return { w: 0, pts: [] as { x: number; y: number }[] }
	let best = { c: 1, w: 0 }
	for (let c = 1; c <= n; c++) {
		const rows = Math.ceil(n / c)
		const w = Math.min(r.w / (c + 0.12 * (c - 1)), r.h / (1.5 * rows + 0.12 * (rows - 1)))
		if (w > best.w) best = { c, w }
	}
	const { c, w } = best
	const rows = Math.ceil(n / c)
	const gap = 0.12 * w
	const gh = rows * 1.5 * w + (rows - 1) * gap
	const pts: { x: number; y: number }[] = []
	for (let k = 0; k < n; k++) {
		const row = Math.floor(k / c)
		const inRow = row === rows - 1 ? n - row * c : c
		const rw = inRow * w + (inRow - 1) * gap
		const col = k - row * c
		pts.push({
			x: r.x + (r.w - rw) / 2 + col * (w + gap) + w / 2,
			y: r.y + (r.h - gh) / 2 + row * (1.5 * w + gap) + 0.75 * w,
		})
	}
	return { w, pts }
}

// ---------------------------------------------------------------- layouts

const base = (region: Region): Omit<Cell, "kind" | "cx" | "cy" | "box" | "inner" | "label"> => ({
	id: region.id,
	region,
	band: null,
	items: region.items,
	count: region.count,
	fit: region.fit,
	fill: "",
	rim: "",
})

function squarify(vals: number[], r: Rect): Rect[] {
	const out: Rect[] = new Array(vals.length)
	const order = vals.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0])
	const total = vals.reduce((s, v) => s + v, 0) || 1
	const scale = (r.w * r.h) / total
	let rect = { ...r }
	let row: (readonly [number, number])[] = []
	const worst = (row: (readonly [number, number])[], side: number) => {
		const s = row.reduce((a, [v]) => a + v * scale, 0)
		let w = 0
		for (const [v] of row) {
			const a = v * scale
			w = Math.max(w, (side * side * a) / (s * s), (s * s) / (side * side * a))
		}
		return w
	}
	const layRow = (row: (readonly [number, number])[]) => {
		const s = row.reduce((a, [v]) => a + v * scale, 0)
		if (rect.w >= rect.h) {
			const w = s / rect.h
			let y = rect.y
			for (const [v, i] of row) {
				const h = (v * scale) / w
				out[i] = { x: rect.x, y, w, h }
				y += h
			}
			rect = { x: rect.x + w, y: rect.y, w: rect.w - w, h: rect.h }
		} else {
			const h = s / rect.w
			let x = rect.x
			for (const [v, i] of row) {
				const w = (v * scale) / h
				out[i] = { x, y: rect.y, w, h }
				x += w
			}
			rect = { x: rect.x, y: rect.y + h, w: rect.w, h: rect.h - h }
		}
	}
	for (const it of order) {
		const side = Math.min(rect.w, rect.h)
		if (!row.length || worst([...row, it], side) <= worst(row, side)) row.push(it)
		else {
			layRow(row)
			row = [it]
		}
	}
	if (row.length) layRow(row)
	return out
}

function fields(regions: Region[], aspect: number): World {
	const w = aspect >= 1 ? 1000 * aspect : 1000
	const h = aspect >= 1 ? 1000 : 1000 / aspect
	const rects = squarify(
		regions.map((r) => r.count ** 0.75),
		{ x: 0, y: 0, w, h },
	)
	const g = 5
	const cells: Cell[] = regions.map((region, i) => {
		const r = rects[i]
		const box = { x: r.x + g, y: r.y + g, w: r.w - 2 * g, h: r.h - 2 * g }
		const head = Math.min(box.h * 0.22, 60)
		const pad = Math.min(box.w, box.h) * 0.06
		return {
			...base(region),
			kind: "rect",
			cx: box.x + box.w / 2,
			cy: box.y + box.h / 2,
			box,
			inner: { x: box.x + pad, y: box.y + head + pad * 0.5, w: box.w - 2 * pad, h: box.h - head - pad * 1.5 },
			label: {
				x: box.x + pad,
				y: box.y + pad,
				size: Math.max(12, Math.min(box.w * 0.1, box.h * 0.2, 72)),
				align: "left",
			},
		}
	})
	paint(cells)
	return { kind: "fields", w, h, cells }
}

const hash = (s: string) => {
	let h = 2166136261
	for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619)
	return (h >>> 0) / 4294967295
}

function blobs(regions: Region[], aspect: number): World {
	const w = aspect >= 1 ? 1000 * aspect : 1000
	const h = aspect >= 1 ? 1000 : 1000 / aspect
	const raw = regions.map((r) => Math.sqrt(r.count ** 0.85))
	const k = Math.sqrt((0.36 * w * h) / Math.PI / raw.reduce((s, v) => s + v * v, 0))
	const R = raw.map((v) => Math.max(v * k, 60))
	const tx = regions.map((r) => w / 2 + r.x * w * 0.34)
	const ty = regions.map((r) => h / 2 + r.y * h * 0.34)
	const X = [...tx]
	const Y = [...ty]
	const gap = 18
	for (let it = 0; it < 400; it++) {
		for (let a = 0; a < X.length; a++)
			for (let b = a + 1; b < X.length; b++) {
				const dx = X[b] - X[a]
				const dy = Y[b] - Y[a]
				const d = Math.hypot(dx, dy) || 0.01
				// Room for the wobbly edges too.
				const need = (R[a] + R[b]) * 1.12 + gap
				if (d < need) {
					const push = (need - d) / 2
					X[a] -= (dx / d) * push
					Y[a] -= (dy / d) * push
					X[b] += (dx / d) * push
					Y[b] += (dy / d) * push
				}
			}
		for (let a = 0; a < X.length; a++) {
			X[a] += (tx[a] - X[a]) * 0.02
			Y[a] += (ty[a] - Y[a]) * 0.02
		}
	}
	// Fit the result into the world with a margin.
	const x0 = Math.min(...X.map((x, a) => x - R[a]))
	const x1 = Math.max(...X.map((x, a) => x + R[a]))
	const y0 = Math.min(...Y.map((y, a) => y - R[a]))
	const y1 = Math.max(...Y.map((y, a) => y + R[a]))
	const s = Math.min((w * 0.94) / (x1 - x0), (h * 0.94) / (y1 - y0))
	const cells: Cell[] = regions.map((region, a) => {
		const r = R[a] * s
		const cx = w / 2 + (X[a] - (x0 + x1) / 2) * s
		const cy = h / 2 + (Y[a] - (y0 + y1) / 2) * s
		return {
			...base(region),
			kind: "blob",
			cx,
			cy,
			r,
			seed: hash(region.id) * 6.28,
			box: { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r },
			inner: { x: cx - 0.64 * r, y: cy - 0.42 * r, w: 1.28 * r, h: 1.08 * r },
			label: { x: cx, y: cy - 0.12 * r, size: Math.max(14, Math.min(r * 0.26, 80)), align: "center" },
		}
	})
	paint(cells)
	return { kind: "blobs", w, h, cells }
}

function tiles(regions: Region[], aspect: number): World {
	const sorted = [...regions].sort((a, b) => b.fit - a.fit || b.count - a.count)
	const n = sorted.length
	const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * aspect))))
	const rows = Math.ceil(n / cols)
	const T = 300
	const g = 14
	const cells: Cell[] = sorted.map((region, i) => {
		const c = i % cols
		const r = Math.floor(i / cols)
		const box = { x: c * T + g, y: r * T + g, w: T - 2 * g, h: T - 2 * g }
		return {
			...base(region),
			kind: "rect",
			cx: box.x + box.w / 2,
			cy: box.y + box.h / 2,
			box,
			inner: { x: box.x + 14, y: box.y + 74, w: box.w - 28, h: box.h - 88 },
			label: { x: box.x + 16, y: box.y + 16, size: 34, align: "left" },
		}
	})
	paint(cells)
	return { kind: "tiles", w: cols * T, h: rows * T, cells }
}

const RADII: [number, number][] = [
	[0.17, 0.45],
	[0.47, 0.72],
	[0.74, 1],
]
function rings(regions: Region[], aspect: number): World {
	const R = 440
	const w = aspect >= 1 ? 2 * R * 1.22 * Math.max(1, aspect * 0.8) : 2 * R * 1.22
	const h = aspect >= 1 ? 2 * R * 1.22 : (2 * R * 1.22) / aspect
	const cx = w / 2
	const cy = h / 2
	const vals = regions.map((r) => r.count ** 0.7)
	const sum = vals.reduce((s, v) => s + v, 0)
	const gap = 0.014
	const cells: Cell[] = []
	let a = -Math.PI / 2
	regions.forEach((region, i) => {
		const span = (vals[i] / sum) * Math.PI * 2
		const a0 = a + gap / 2
		const a1 = a + span - gap / 2
		a += span
		const am = (a0 + a1) / 2
		RADII.forEach(([f0, f1], b) => {
			const r0 = f0 * R + 3
			const r1 = f1 * R - 3
			const rm = (r0 + r1) / 2
			const arc = (a1 - a0) * rm
			const side = Math.min(arc * 0.78, (r1 - r0) * 0.86)
			const mx = cx + Math.cos(am) * rm
			const my = cy + Math.sin(am) * rm
			const items = region.items.filter((it) => (it.m >= BANDS[0].min ? 0 : it.m >= BANDS[1].min ? 1 : 2) === b)
			const fitOfBand = [92, 76, 60][b]
			const xs: number[] = []
			const ys: number[] = []
			for (let k = 0; k <= 8; k++) {
				const aa = a0 + ((a1 - a0) * k) / 8
				for (const rr of [r0, r1]) {
					xs.push(cx + Math.cos(aa) * rr)
					ys.push(cy + Math.sin(aa) * rr)
				}
			}
			const fx = Math.min(...xs)
			const fy = Math.min(...ys)
			cells.push({
				...base(region),
				frame: { x: fx, y: fy, w: Math.max(...xs) - fx, h: Math.max(...ys) - fy },
				id: `${region.id}@${b}`,
				band: b,
				items,
				count: region.bands[b],
				fit: fitOfBand,
				kind: "sector",
				cx: mx,
				cy: my,
				sector: { r0, r1, a0, a1 },
				box: { x: mx - side / 2, y: my - side / 2, w: side, h: side },
				inner: { x: mx - side / 2, y: my - side / 2, w: side, h: side },
				label: { x: mx, y: my, size: 0, align: "center" },
			})
		})
	})
	// Ring cells: the region's color, brighter toward the middle (closer to your taste).
	for (const c of cells) {
		const b = c.band ?? 0
		c.fill = mix(c.region.color, "#0c0a09", [0.32, 0.56, 0.76][b])
		c.rim = alpha(c.region.color, [0.9, 0.55, 0.3][b])
	}
	return { kind: "rings", w, h, cells, rings: { cx, cy, radii: RADII.map(([a, b]) => [a * R, b * R]) } }
}

export function layout(kind: LayoutKind, regions: Region[], aspect: number): World {
	if (kind === "blobs") return blobs(regions, aspect)
	if (kind === "tiles") return tiles(regions, aspect)
	if (kind === "rings") return rings(regions, aspect)
	return fields(regions, aspect)
}

// ---------------------------------------------------------------- shapes

export function shapeOf(c: Cell): Path2D {
	if (c.path) return c.path
	const p = new Path2D()
	if (c.kind === "rect") {
		const { x, y, w, h } = c.box
		const rr = Math.min(w, h) * 0.04
		p.roundRect(x, y, w, h, rr)
	} else if (c.kind === "blob") {
		const r = c.r ?? 100
		const s = c.seed ?? 0
		const N = 72
		for (let k = 0; k <= N; k++) {
			const a = (k / N) * Math.PI * 2
			const rr = r * (1 + 0.055 * Math.sin(3 * a + s) + 0.035 * Math.sin(5 * a + s * 2.3) + 0.03 * Math.sin(2 * a + s * 0.7))
			const x = c.cx + Math.cos(a) * rr
			const y = c.cy + Math.sin(a) * rr
			if (k) p.lineTo(x, y)
			else p.moveTo(x, y)
		}
		p.closePath()
	} else if (c.sector) {
		const { r0, r1, a0, a1 } = c.sector
		const { cx, cy } = ringCenter(c)
		p.arc(cx, cy, r1, a0, a1)
		p.arc(cx, cy, r0, a1, a0, true)
		p.closePath()
	}
	c.path = p
	return p
}
/** Recover a ring cell's center of rotation from its sector midpoint. */
function ringCenter(c: Cell) {
	const s = c.sector as NonNullable<Cell["sector"]>
	const am = (s.a0 + s.a1) / 2
	const rm = (s.r0 + s.r1) / 2
	return { cx: c.cx - Math.cos(am) * rm, cy: c.cy - Math.sin(am) * rm }
}

export function hit(world: World, x: number, y: number): Cell | null {
	for (const c of world.cells) {
		if (c.kind === "rect") {
			const b = c.box
			if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return c
		} else if (c.kind === "blob") {
			if (Math.hypot(x - c.cx, y - c.cy) <= (c.r ?? 0) * 1.05) return c
		} else if (c.sector) {
			const { cx, cy } = ringCenter(c)
			const d = Math.hypot(x - cx, y - cy)
			let a = Math.atan2(y - cy, x - cx)
			const s = c.sector
			while (a < s.a0) a += Math.PI * 2
			while (a > s.a0 + Math.PI * 2) a -= Math.PI * 2
			if (d >= s.r0 && d <= s.r1 && a <= s.a1) return c
		}
	}
	return null
}

// ---------------------------------------------------------------- neighbors

export type Door = { dir: Dir; cell: Cell; label: string }

/** The nearest cell in each direction; rings go inward (closer to your taste), outward, and around. */
export function doorsOf(world: World, cell: Cell): Door[] {
	if (world.kind === "rings" && cell.band != null) {
		const same = world.cells.filter((c) => c.band === cell.band)
		const i = same.findIndex((c) => c.id === cell.id)
		const out: Door[] = []
		const inward = world.cells.find((c) => c.region.id === cell.region.id && c.band === (cell.band ?? 0) - 1)
		const outward = world.cells.find((c) => c.region.id === cell.region.id && c.band === (cell.band ?? 0) + 1)
		if (inward) out.push({ dir: "n", cell: inward, label: "Closer to your taste" })
		if (outward) out.push({ dir: "s", cell: outward, label: "Further out" })
		if (same.length > 1) {
			const prev = same[(i - 1 + same.length) % same.length]
			const next = same[(i + 1) % same.length]
			out.push({ dir: "w", cell: prev, label: prev.region.name })
			if (next.id !== prev.id) out.push({ dir: "e", cell: next, label: next.region.name })
		}
		return out
	}
	const best: Partial<Record<Dir, { c: Cell; d: number }>> = {}
	for (const c of world.cells) {
		if (c.id === cell.id) continue
		const dx = c.cx - cell.cx
		const dy = c.cy - cell.cy
		const d = Math.hypot(dx, dy)
		const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "e" : "w") : dy > 0 ? "s" : "n"
		if (!best[dir] || d < (best[dir]?.d ?? 0)) best[dir] = { c, d }
	}
	return (["n", "e", "s", "w"] as Dir[])
		.filter((d) => best[d])
		.map((d) => ({ dir: d, cell: (best[d] as { c: Cell }).c, label: (best[d] as { c: Cell }).c.region.name }))
}
