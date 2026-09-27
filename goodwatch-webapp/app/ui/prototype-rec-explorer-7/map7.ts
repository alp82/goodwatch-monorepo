// PROTOTYPE - throwaway. The round-7 map engine (#180): round 6's engine (camera, input, fractal of posters, island
// names) with three changes.
//
// The lens. Every poster's size, detail and light depend on the zoom (its width on screen) and on its distance from
// the focus: the pointer on a desktop, the middle on touch, the pinned poster while a card is pinned. The focus
// glides after the pointer, so nothing pops: near it, full posters (and round 6's captions and card); further out,
// smaller and simpler; far away, a dot, a line or a flat tile, depending on the variant (wire7.ts, Present).
//
// The ground. sea7.ts draws it with WebGL2, WebGL1 or Canvas 2D, whichever works (or ?gl= in development).
//
// Combining. Two islands can be combined: a bridge island rises between them, holding the titles they share, with a
// causeway of light to each; the rest of the map dims. It is an island like any other (zoom in, open a title), and
// it sinks back when you let it go.
import { HEAT } from "~/ui/prototype-rec-explorer-2/Stage"
import type { Cell, World } from "~/ui/prototype-rec-explorer-4/geo"
import { type Placed, extent, place, roots } from "~/ui/prototype-rec-explorer-5/fractal"
import { COLS, hexRgb, image, luminous, makeAtlas, mixRgb, onImage, paintSurface, poster, rgbCss } from "~/ui/prototype-rec-explorer-6/surface6"
import { type Ground, type SeaIsland7, makeGround } from "./sea7"
import { BRANCH, type BlendRes, type Config7, type GlLevel, type TreeRes, type W, firstCount } from "./wire7"

const MAX = 240
const FONT = "Gabarito, system-ui, sans-serif"
const ARR = "orbit" as const

export type Pad = { t: number; r: number; b: number; l: number }
type RGB = [number, number, number]

export type Isl = {
	cell: Cell
	id: string
	name: string
	count: number
	fit: number
	color: string
	tint: RGB
	logo: string | null
	slot: number
	n1: number
	w1: number
	roots: { x: number; y: number }[]
	items: W[]
	par: number[]
	gen: number[]
	pos: Placed
	loaded: boolean
	sx: number
	sy: number
	sr: number
	on: boolean
	emph: number
	/** Picked for combining (animated 0..1). */
	pick: number
	/** Dimmed while a bridge shows the two islands it joins (animated 0..1). */
	dim: number
	/** A bridge: the two islands it joins; grow rises 0..1 as it forms and sinks back to 0 when let go. */
	bridge: { a: string; b: string; kind: BlendRes["kind"]; grow: number; to: 0 | 1 } | null
}

export type Drawn = {
	isl: Isl
	i: number
	it: W
	gen: number
	/** Screen rect as drawn (after the lens), top left, and center. */
	x: number
	y: number
	w: number
	h: number
	cx: number
	cy: number
	a: number
	/** Closeness to the focus, 1 at it, 0 far away. */
	t: number
}

export type Hooks = {
	pass: (it: W) => boolean
	pad: () => Pad
	center: () => { x: number; y: number }
	active: () => { k: string; pinned: boolean } | null
	card: () => DOMRect | null
	onTapPoster: (d: Drawn) => void
	onTapIsland: (isl: Isl) => void
	onTapWater: () => void
	onLongPress: (d: Drawn) => void
	needTree: (isl: Isl) => void
	onFrame: () => void
	onPointer: () => void
	/** Taps on islands pick them for combining (the Combine button is on). */
	combining: () => boolean
	onPickIsland: (isl: Isl) => void
	onCombine: (a: Isl, b: Isl) => void
	/** An island was lifted to drag onto another (or put down: null). */
	onLift: (isl: Isl | null, over: Isl | null) => void
}

export type Look = { id: string; name: string; color: string; logo: string | null }

type Cam = { x: number; y: number; s: number }
type Flight = { from: Cam; to: Cam; t0: number; ms: number; hop: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const smooth = (a: number, b: number, v: number) => {
	const t = clamp((v - a) / (b - a), 0, 1)
	return t * t * (3 - 2 * t)
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const backOut = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2
const toHex = (c: RGB) => `#${c.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join("")}`

function shapeR(c: { r?: number; seed?: number }, a: number) {
	const r = c.r ?? 100
	const s = c.seed ?? 0
	return r * (1 + 0.055 * Math.sin(3 * a + s) + 0.035 * Math.sin(5 * a + s * 2.3) + 0.03 * Math.sin(2 * a + s * 0.7))
}
export const islandDist = (c: Cell, x: number, y: number) => Math.hypot(x - c.cx, y - c.cy) - shapeR(c, Math.atan2(y - c.cy, x - c.cx))

function shadowSprite() {
	const c = document.createElement("canvas")
	c.width = 96
	c.height = 132
	const g = c.getContext("2d") as CanvasRenderingContext2D
	g.filter = "blur(10px)"
	g.fillStyle = "rgba(0,0,0,.9)"
	g.beginPath()
	g.roundRect(24, 24, 48, 84, 6)
	g.fill()
	return c
}
/** A round soft dot of light, for far-away titles. */
function dotSprite() {
	const c = document.createElement("canvas")
	c.width = 64
	c.height = 64
	const g = c.getContext("2d") as CanvasRenderingContext2D
	const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
	gr.addColorStop(0, "rgba(255,255,255,1)")
	gr.addColorStop(0.22, "rgba(255,255,255,.9)")
	gr.addColorStop(0.3, "rgba(255,255,255,.35)")
	gr.addColorStop(1, "rgba(255,255,255,0)")
	g.fillStyle = gr
	g.fillRect(0, 0, 64, 64)
	return c
}

const GLOWS = new Map<string, HTMLCanvasElement>()
function glowSprite(c: RGB) {
	const key = c.map((v) => Math.round(v * 40)).join(",")
	let s = GLOWS.get(key)
	if (!s) {
		s = document.createElement("canvas")
		s.width = 128
		s.height = 160
		const g = s.getContext("2d") as CanvasRenderingContext2D
		g.filter = "blur(11px)"
		g.fillStyle = rgbCss(c, 0.95)
		g.beginPath()
		g.roundRect(32, 32, 64, 96, 6)
		g.fill()
		GLOWS.set(key, s)
	}
	return s
}

/** A poster's own average color (from its smallest image), for far-away dots. */
const AVG = new Map<string, string>()
let avgCanvas: CanvasRenderingContext2D | null = null
function avgOf(path: string, budget: { n: number }) {
	const hit = AVG.get(path)
	if (hit) return hit
	if (budget.n <= 0) return null
	const e = image(path, "w92")
	if (!e.ok) return null
	budget.n--
	try {
		if (!avgCanvas) {
			const c = document.createElement("canvas")
			c.width = 1
			c.height = 1
			avgCanvas = c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D
		}
		avgCanvas.clearRect(0, 0, 1, 1)
		avgCanvas.drawImage(e.im, 0, 0, 1, 1)
		const d = avgCanvas.getImageData(0, 0, 1, 1).data
		const c = luminous([d[0] / 255, d[1] / 255, d[2] / 255])
		const s = rgbCss(c, 1)
		AVG.set(path, s)
		return s
	} catch {
		AVG.set(path, "rgba(200,210,240,1)")
		return null
	}
}

/** How far each presentation shrinks far-away posters (the rest of the lens is in the draw functions). */
const FAR: Record<Config7["present"], number> = { lit: 0.74, rise: 0.9, tiles: 0.55, frames: 0.72 }
/** How wide each presentation's lens is. */
const LENS: Record<Config7["present"], number> = { lit: 1, rise: 1, tiles: 1, frames: 1.2 }

/** A match as a color for the dots: quiet below 70, warm white, gold for your best. */
const matchDot = (m: number) => (m >= 92 ? "#ffd05a" : m >= 85 ? "#e9b04a" : m >= 72 ? "#e8e1cf" : "#8797bd")

export type Engine = ReturnType<typeof makeEngine>

export function makeEngine(glc: HTMLCanvasElement, c2: HTMLCanvasElement, cfg: Config7, gl: GlLevel | null, hooks: { current: Hooks }) {
	const g = c2.getContext("2d") as CanvasRenderingContext2D
	const atlas = makeAtlas()
	const ground: Ground = makeGround(glc, atlas, gl)
	const small = () => W < 640
	let W = 1
	let H = 1
	let dpr = 1
	let gdpr = 1
	let world: World | null = null
	let islands: Isl[] = []
	let fitS = 1
	let maxS = 10
	const cur: Cam = { x: 0, y: 0, s: 1 }
	const tgt: Cam = { x: 0, y: 0, s: 1 }
	let flight: Flight | null = null
	let vel = { x: 0, y: 0 }
	let snapAt = 0
	let snapPt: { x: number; y: number } | null = null
	let gestureDir = 0
	let dead = false
	let drawn: Drawn[] = []
	let hoverKey: string | null = null
	let hoverIsl: Isl | null = null
	let dirty = true
	let raf = 0
	let last = performance.now()
	const t0 = performance.now()
	const listeners = new Set<() => void>()
	const shadow = shadowSprite()
	const dotS = dotSprite()
	const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	const surfaces = new Map<string, Promise<{ tile: HTMLCanvasElement; avg: RGB } | null>>()
	const frames: number[] = []
	let prevCam = { x: 0, y: 0, s: 0 }
	let fontsOk = false
	let picks = new Set<string>()
	let surfKey = ""
	document.fonts?.load(`800 24px ${FONT}`).then(() => {
		fontsOk = true
		dirty = true
	})
	const ACT = () => (small() ? 92 : 118)
	const SHOW = () => (small() ? 14 : 16)
	const BIG = () => Math.max(small() ? 300 : 440, Math.min(W, H) * 0.62)

	const offImg = onImage(() => {
		dirty = true
	})

	// ------------------------------------------------------------ the lens

	/** Where the lens is (it glides after its target), and its radius in px. */
	const lens = { x: 0, y: 0, r: 300, on: false }
	function lensTarget() {
		const a = hooks.current.active()
		if (a?.pinned) {
			const d = drawn.find((x) => x.it.k === a.k)
			if (d) return { x: d.cx, y: d.cy }
		}
		if (pointer?.mouse && !small()) return { x: pointer.x, y: pointer.y }
		return hooks.current.center()
	}
	function stepLens(dt: number) {
		const t = lensTarget()
		const R = (small() ? Math.min(W, H) * 0.55 : clamp(Math.min(W, H) * 0.5, 260, 520)) * LENS[cfg.present]
		if (!lens.on) {
			lens.x = t.x
			lens.y = t.y
			lens.r = R
			lens.on = true
			return true
		}
		const k = reduce ? 1 : 1 - Math.exp(-dt * 11)
		const dx = t.x - lens.x
		const dy = t.y - lens.y
		const dr = R - lens.r
		if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3 && Math.abs(dr) < 0.3) return false
		lens.x += dx * k
		lens.y += dy * k
		lens.r += dr * k
		return true
	}
	const closeness = (cx: number, cy: number) => 1 - smooth(lens.r * 0.28, lens.r * 1.25, Math.hypot(cx - lens.x, cy - lens.y))

	// ------------------------------------------------------------ islands

	const branch = BRANCH[ARR]
	function build(c: Cell, look: Look, slot: number): Isl {
		const n1 = firstCount(c.count)
		const r = c.r ?? 100
		const rt = roots(ARR, branch, n1, c.cx, c.cy + 0.02 * r, 0.8 * r)
		const isl: Isl = {
			cell: c,
			id: c.id,
			name: look.name,
			count: c.count,
			fit: c.fit,
			color: look.color,
			tint: luminous(hexRgb(look.color)),
			logo: look.logo,
			slot,
			n1,
			w1: rt.w,
			roots: rt.pts,
			items: [],
			par: [],
			gen: [],
			pos: { x: new Float32Array(0), y: new Float32Array(0), w: new Float32Array(0) },
			loaded: false,
			sx: 0,
			sy: 0,
			sr: 0,
			on: false,
			emph: 0,
			pick: 0,
			dim: 0,
			bridge: null,
		}
		fallback(isl)
		return isl
	}
	function fallback(isl: Isl) {
		if (isl.bridge) return
		const items = isl.cell.items.filter(hooks.current.pass).slice(0, isl.n1)
		isl.items = items
		isl.par = items.map(() => -1)
		isl.gen = items.map(() => 1)
		isl.pos = place(ARR, isl.roots, isl.w1, isl.par, isl.gen)
	}
	function setTree(id: string, t: TreeRes) {
		const isl = islands.find((x) => x.id === id)
		if (!isl || !t.items.length || isl.loaded) return
		isl.items = t.items
		isl.par = t.par
		isl.gen = t.gen
		isl.pos = place(ARR, isl.roots, isl.w1, t.par, t.gen)
		isl.loaded = true
		dirty = true
	}
	function paintOne(isl: Isl) {
		if (isl.slot < 0) return Promise.resolve()
		const sk = `${surfKey}|${isl.id}|${isl.slot}`
		let p = surfaces.get(sk)
		if (!p) {
			p = paintSurface(isl.bridge ? isl.items : isl.cell.items, "backdrop", isl.color).catch(() => null)
			surfaces.set(sk, p)
		}
		return p.then((res) => {
			if (res && islands.includes(isl)) {
				ground.tile(res.tile, isl.slot)
				isl.tint = luminous(mixRgb(res.avg, hexRgb(isl.color), 0.45))
				wake()
			}
		})
	}
	function paintSurfaces() {
		const todo = islands.filter((i) => i.slot >= 0)
		let k = 0
		const next = (): Promise<void> => {
			const isl = todo[k++]
			if (!isl) return Promise.resolve()
			return paintOne(isl).then(next)
		}
		void next()
		void next()
		void next()
	}

	// ------------------------------------------------------------ bridges

	const bridgeOf = () => islands.find((i) => i.bridge && i.bridge.to === 1) ?? null
	/** A free spot between two islands for a bridge of radius r: near their middle, off every other island. */
	function spotFor(A: Isl, B: Isl, r: number) {
		const ax = A.cell.cx
		const ay = A.cell.cy
		const bx = B.cell.cx
		const by = B.cell.cy
		const mx = (ax + bx) / 2
		const my = (ay + by) / 2
		const others = islands.filter((i) => i !== A && i !== B && !i.bridge)
		let best = { x: mx, y: my, v: Number.POSITIVE_INFINITY }
		for (let ring = 0; ring <= 26; ring++) {
			const rad = ring * r * 0.22
			const n = ring ? 20 : 1
			for (let k = 0; k < n; k++) {
				const a = (k / n) * Math.PI * 2
				const x = mx + Math.cos(a) * rad
				const y = my + Math.sin(a) * rad
				let v = Math.hypot(x - mx, y - my) * 0.6
				for (const o of others) {
					const over = r + (o.cell.r ?? 100) * 1.06 + 14 - Math.hypot(x - o.cell.cx, y - o.cell.cy)
					if (over > 0) v += over * over * 0.5 + 400
				}
				for (const o of [A, B]) {
					const d = Math.hypot(x - o.cell.cx, y - o.cell.cy)
					const want = r + (o.cell.r ?? 100) + 18
					if (d < want) v += (want - d) ** 2 * 0.8 + 200
				}
				if (v < best.v) best = { x, y, v }
			}
		}
		return best
	}
	function addBridge(A: Isl, B: Isl, res: BlendRes, name: string) {
		for (const i of islands) if (i.bridge) i.bridge.to = 0
		const r = Math.max(52, Math.min(A.cell.r ?? 100, B.cell.r ?? 100) * 0.62)
		const at = spotFor(A, B, r)
		const color = toHex(mixRgb(hexRgb(A.color), hexRgb(B.color), 0.5))
		const ms = res.items.map((x) => x.m).sort((a, b) => a - b)
		const fit = ms[Math.floor(ms.length / 2)] ?? 60
		const id = `${A.id}+${B.id}`
		const cell: Cell = {
			id,
			region: { id, name, color, count: res.count, fit, bands: [0, 0, 0], x: 0, y: 0, line: "", items: res.items.slice(0, 12) },
			band: null,
			items: res.items.slice(0, 12),
			count: res.count,
			fit,
			kind: "blob",
			cx: at.x,
			cy: at.y,
			box: { x: at.x - r, y: at.y - r, w: 2 * r, h: 2 * r },
			inner: { x: at.x - r * 0.7, y: at.y - r * 0.7, w: r * 1.4, h: r * 1.4 },
			label: { x: at.x, y: at.y, size: 24, align: "center" },
			fill: color,
			rim: color,
			r,
			seed: (A.cell.seed ?? 0) + (B.cell.seed ?? 0) * 0.7 + 1.3,
		}
		const used = new Set(islands.filter((i) => !(i.bridge && i.bridge.to === 0 && i.bridge.grow < 0.05)).map((i) => i.slot))
		let slot = -1
		for (let s = COLS * COLS - 1; s >= 0; s--)
			if (!used.has(s)) {
				slot = s
				break
			}
		const isl = build(cell, { id, name, color, logo: null }, slot)
		isl.tint = luminous(mixRgb(A.tint, B.tint, 0.5))
		isl.bridge = { a: A.id, b: B.id, kind: res.kind, grow: 0, to: 1 }
		isl.n1 = res.gen.filter((x) => x === 1).length || 1
		const rt = roots(ARR, branch, isl.n1, at.x, at.y + 0.02 * r, 0.8 * r)
		isl.w1 = rt.w
		isl.roots = rt.pts
		isl.items = res.items
		isl.par = res.par
		isl.gen = res.gen
		isl.pos = place(ARR, isl.roots, isl.w1, res.par, res.gen)
		isl.loaded = true
		islands.push(isl)
		void paintOne(isl)
		computeScales()
		// Frame the bridge with the shores it joins, so it's clear what it came from.
		const p = hooks.current.pad()
		const fw = W - p.l - p.r
		const fh = H - p.t - p.b
		let x0 = at.x - r * 1.5
		let x1 = at.x + r * 1.5
		let y0 = at.y - r * 1.5
		let y1 = at.y + r * 1.5
		for (const o of [A, B]) {
			const a = Math.atan2(at.y - o.cell.cy, at.x - o.cell.cx)
			const sx = o.cell.cx + Math.cos(a) * shapeR(o.cell, a) * 0.6
			const sy = o.cell.cy + Math.sin(a) * shapeR(o.cell, a) * 0.6
			x0 = Math.min(x0, sx)
			x1 = Math.max(x1, sx)
			y0 = Math.min(y0, sy)
			y1 = Math.max(y1, sy)
		}
		const s = clamp(Math.min(fw / (x1 - x0), fh / (y1 - y0)), fitS, islandCam(isl).s)
		flyTo({ x: (x0 + x1) / 2 - (p.l - p.r) / 2 / s, y: (y0 + y1) / 2 - (p.t - p.b) / 2 / s, s }, 900)
		wake()
		return isl
	}
	function removeBridge() {
		let any = false
		for (const i of islands)
			if (i.bridge && i.bridge.to === 1) {
				i.bridge.to = 0
				any = true
			}
		if (any) wake()
		return any
	}

	// ------------------------------------------------------------ scales and stops

	function computeScales() {
		if (!world) return
		const p = hooks.current.pad()
		fitS = Math.min((W - p.l - p.r) / world.w, (H - p.t - p.b) / world.h) * 0.96
		const minW = Math.min(...islands.map((x) => x.w1).filter((w) => w > 0), 1e9)
		maxS = Math.max(fitS * 6, (ACT() * 2.4) / (minW / 8))
	}
	const homeCam = (): Cam => {
		const p = hooks.current.pad()
		const w = world as World
		return { x: w.w / 2 - (p.l - p.r) / 2 / fitS, y: w.h / 2 - (p.t - p.b) / 2 / fitS, s: fitS }
	}
	const ext = extent(ARR, branch)
	function islandCam(isl: Isl): Cam {
		const p = hooks.current.pad()
		const fw = W - p.l - p.r
		const fh = H - p.t - p.b
		let x0 = Number.POSITIVE_INFINITY
		let x1 = Number.NEGATIVE_INFINITY
		let y0 = Number.POSITIVE_INFINITY
		let y1 = Number.NEGATIVE_INFINITY
		for (const r of isl.roots) {
			x0 = Math.min(x0, r.x - ext.hw * isl.w1)
			x1 = Math.max(x1, r.x + ext.hw * isl.w1)
			y0 = Math.min(y0, r.y - ext.hh * isl.w1)
			y1 = Math.max(y1, r.y + ext.hh * isl.w1)
		}
		const s = Math.min(fw / ((x1 - x0) * 1.06), fh / ((y1 - y0) * 1.06))
		const cx = (x0 + x1) / 2
		const cy = (y0 + y1) / 2
		return { x: cx - (p.l - p.r) / 2 / s, y: cy - (p.t - p.b) / 2 / s, s }
	}
	function stopsOf(isl: Isl | null) {
		const out = [fitS]
		if (isl) {
			out.push(islandCam(isl).s)
			const deepest = isl.loaded ? Math.max(...isl.gen) : 4
			for (let gen = 1; gen <= deepest; gen++) out.push((ACT() * 1.08) / (isl.w1 * 0.5 ** (gen - 1)))
		}
		const clean: number[] = []
		for (const s of out.sort((a, b) => a - b)) if (!clean.length || s > clean[clean.length - 1] * 1.3) clean.push(Math.min(s, maxS))
		return clean
	}
	const toWorld = (sx: number, sy: number, c: Cam = cur) => ({ x: c.x + (sx - W / 2) / c.s, y: c.y + (sy - H / 2) / c.s })
	const live = () => islands.filter((i) => !i.bridge || i.bridge.to === 1)
	function islandAt(sx: number, sy: number, reach = 0.25, not?: Isl | null): Isl | null {
		const p = toWorld(sx, sy)
		let best: Isl | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const isl of live()) {
			if (isl === not) continue
			const d = islandDist(isl.cell, p.x, p.y) / (isl.cell.r ?? 100)
			if (d < reach && d < bd) {
				bd = d
				best = isl
			}
		}
		return best
	}
	function focusIsland(): Isl | null {
		const c = hooks.current.center()
		return islandAt(c.x, c.y, 0.25) ?? islandAt(c.x, c.y, 1.5)
	}

	// ------------------------------------------------------------ camera (round 6's, unchanged)

	function clampTgt() {
		if (!world) return
		tgt.s = clamp(tgt.s, fitS * 0.8, maxS)
		const mx = Math.max(0, world.w / 2 - W / 2 / tgt.s + (W * 0.35) / tgt.s)
		const my = Math.max(0, world.h / 2 - H / 2 / tgt.s + (H * 0.35) / tgt.s)
		tgt.x = clamp(tgt.x, world.w / 2 - mx, world.w / 2 + mx)
		tgt.y = clamp(tgt.y, world.h / 2 - my, world.h / 2 + my)
	}
	function approach(dt: number) {
		const k = 1 - Math.exp(-dt * 13)
		const l0 = Math.log(cur.s)
		const l1 = Math.log(tgt.s)
		if (Math.abs(l1 - l0) < 2e-4) {
			cur.s = tgt.s
			cur.x += (tgt.x - cur.x) * k
			cur.y += (tgt.y - cur.y) * k
			if (Math.abs(tgt.x - cur.x) * cur.s < 0.05 && Math.abs(tgt.y - cur.y) * cur.s < 0.05) {
				cur.x = tgt.x
				cur.y = tgt.y
			}
			return
		}
		const fx = (tgt.x * tgt.s - cur.x * cur.s) / (tgt.s - cur.s)
		const fy = (tgt.y * tgt.s - cur.y * cur.s) / (tgt.s - cur.s)
		const ns = Math.exp(l0 + (l1 - l0) * k)
		cur.x = fx - ((fx - cur.x) * cur.s) / ns
		cur.y = fy - ((fy - cur.y) * cur.s) / ns
		cur.s = ns
	}
	function zoomAt(s: number, sx: number, sy: number) {
		flight = null
		const a = toWorld(sx, sy, cur)
		tgt.s = clamp(s, fitS * 0.8, maxS)
		tgt.x = a.x - (sx - W / 2) / tgt.s
		tgt.y = a.y - (sy - H / 2) / tgt.s
		clampTgt()
		wake()
	}
	function zoomInAt(s: number, sx: number, sy: number) {
		s = clamp(s, fitS * 0.8, maxS)
		const a = toWorld(sx, sy, cur)
		const minW = ACT() * 0.92
		const big = BIG()
		let best = -1
		let bIsl: Isl | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const isl of live()) {
			if (islandDist(isl.cell, a.x, a.y) > (isl.cell.r ?? 100) * 0.6) continue
			for (let i = 0; i < isl.items.length; i++) {
				const w = isl.pos.w[i] * s
				if (w < minW || w > big || !hooks.current.pass(isl.items[i])) continue
				const dx = Math.max(0, Math.abs(a.x - isl.pos.x[i]) - isl.pos.w[i] / 2) * s
				const dy = Math.max(0, Math.abs(a.y - isl.pos.y[i]) - isl.pos.w[i] * 0.75) * s
				const d = Math.hypot(dx, dy)
				if (d < bd) {
					bd = d
					best = i
					bIsl = isl
				}
			}
		}
		if (!bIsl || bd <= 28) return zoomAt(s, sx, sy)
		const p = hooks.current.pad()
		const pw = bIsl.pos.w[best] * s
		const px = clamp(sx, p.l + pw * 0.6, W - p.r - pw * 0.6)
		const py = clamp(sy, p.t + pw * 0.8, H - p.b - pw * 0.8)
		flight = null
		tgt.s = s
		tgt.x = bIsl.pos.x[best] - (px - W / 2) / s
		tgt.y = bIsl.pos.y[best] - (py - H / 2) / s
		clampTgt()
		wake()
	}
	function glideTo(c: Cam) {
		flight = null
		vel = { x: 0, y: 0 }
		tgt.x = c.x
		tgt.y = c.y
		tgt.s = c.s
		clampTgt()
		wake()
	}
	function flyTo(to: Cam, ms?: number) {
		vel = { x: 0, y: 0 }
		const dist = Math.hypot(to.x - cur.x, to.y - cur.y)
		const sHop = (Math.min(W, H) * 0.8) / Math.max(dist, 1e-6)
		const hop = Math.max(0, Math.log(Math.min(cur.s, to.s)) - Math.log(sHop)) * 0.9
		tgt.x = to.x
		tgt.y = to.y
		tgt.s = to.s
		clampTgt()
		flight = { from: { ...cur }, to: { ...tgt }, t0: performance.now(), ms: reduce ? 1 : (ms ?? 700 + 260 * Math.min(1.5, hop)), hop }
		wake()
	}
	function stepFlight(now: number) {
		const f = flight as Flight
		const t = clamp((now - f.t0) / f.ms, 0, 1)
		const e = ease(t)
		const ls = Math.log(f.from.s) + (Math.log(f.to.s) - Math.log(f.from.s)) * e - f.hop * Math.sin(Math.PI * e)
		cur.x = f.from.x + (f.to.x - f.from.x) * e
		cur.y = f.from.y + (f.to.y - f.from.y) * e
		cur.s = Math.exp(ls)
		if (t >= 1) {
			cur.x = f.to.x
			cur.y = f.to.y
			cur.s = f.to.s
			flight = null
		}
	}
	function settle() {
		if (!snapPt || drag || pts.size) return
		const pt = snapPt
		snapPt = null
		const isl = islandAt(pt.x, pt.y, 0.3) ?? focusIsland()
		const st = stopsOf(isl)
		const l = Math.log(tgt.s)
		let best = st[0]
		for (const s of st) if (Math.abs(Math.log(s) - l) < Math.abs(Math.log(best) - l)) best = s
		if (gestureDir > 0) {
			const up = st.find((s) => s >= tgt.s)
			const down = [...st].reverse().find((s) => s < tgt.s)
			if (up && (!down || l - Math.log(down) > 0.18)) best = up
		} else if (gestureDir < 0) {
			const down = [...st].reverse().find((s) => s <= tgt.s)
			const up = st.find((s) => s > tgt.s)
			if (down && (!up || Math.log(up) - l > 0.18)) best = down
		}
		const reach = gestureDir ? 1.15 : 0.5
		gestureDir = 0
		if (Math.abs(Math.log(best) - l) < reach && Math.abs(Math.log(best) - l) > 0.004) {
			if (st.length > 2 && best >= st[2] * 0.98 && best >= tgt.s) zoomInAt(best, pt.x, pt.y)
			else zoomAt(best, pt.x, pt.y)
		}
	}
	function stepZoom(dir: 1 | -1, sx: number, sy: number) {
		const isl = islandAt(sx, sy, 0.3) ?? (dir > 0 ? islandAt(sx, sy, 1.2) : focusIsland())
		const st = stopsOf(isl)
		const base = flight ? flight.to.s : tgt.s
		let next: number | null = null
		if (dir > 0) next = st.find((s) => s > base * 1.12) ?? null
		else next = [...st].reverse().find((s) => s < base / 1.12) ?? null
		if (next == null) next = dir > 0 ? base * 1.7 : base / 1.7
		if (dir > 0 && isl && base < st[1] * 0.9 && next === st[1]) {
			glideTo(islandCam(isl))
			return
		}
		if (dir < 0 && next <= fitS * 1.01) {
			glideTo(homeCam())
			return
		}
		if (dir > 0 && st.length > 2 && next >= st[2] * 0.98) return zoomInAt(next, sx, sy)
		zoomAt(next, sx, sy)
	}

	// ------------------------------------------------------------ input

	const pts = new Map<number, { x: number; y: number; type: string }>()
	let drag: { x: number; y: number; t: number; moved: number; id: number; shift: boolean } | null = null
	let pinch: { d: number; cx: number; cy: number } | null = null
	let lastMove = { x: 0, y: 0, t: 0 }
	let press: ReturnType<typeof setTimeout> | null = null
	let pressed = false
	let pointer: { x: number; y: number; mouse: boolean; t: number } | null = null
	let lastTap = { t: 0, x: 0, y: 0 }
	let trackpadUntil = 0
	/** An island held up to drop onto another (the drag variant). */
	let lift: { isl: Isl; x: number; y: number; over: Isl | null; t: number } | null = null
	const local = (e: { clientX: number; clientY: number }) => {
		const r = c2.getBoundingClientRect()
		return { x: e.clientX - r.left, y: e.clientY - r.top }
	}
	/** Zoomed out far enough that a tap on an island means the island, not the posters on it. */
	const islandLevel = (isl: Isl) => cur.s < stopsOf(isl)[1] * 0.8

	function onWheel(e: WheelEvent) {
		e.preventDefault()
		const p = local(e)
		pointer = { x: p.x, y: p.y, mouse: true, t: performance.now() }
		const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1)
		if (!dy) return
		const now = performance.now()
		const notch = !e.ctrlKey && Math.abs(dy) >= 50 && now > trackpadUntil
		if (!notch) {
			trackpadUntil = now + 260
			const f = Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0045))
			gestureDir = f > 1 ? 1 : -1
			zoomAt((flight ? cur.s : tgt.s) * f, p.x, p.y)
			snapAt = now + 200
			snapPt = p
			return
		}
		stepZoom(dy < 0 ? 1 : -1, p.x, p.y)
	}
	function hitPoster(x: number, y: number) {
		for (let k = drawn.length - 1; k >= 0; k--) {
			const d = drawn[k]
			if (d.a > 0.5 && x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d
		}
		return null
	}
	function onDown(e: PointerEvent) {
		c2.setPointerCapture?.(e.pointerId)
		const p = local(e)
		pts.set(e.pointerId, { ...p, type: e.pointerType })
		flight = null
		vel = { x: 0, y: 0 }
		if (pts.size === 1) {
			drag = { x: p.x, y: p.y, t: performance.now(), moved: 0, id: e.pointerId, shift: e.shiftKey }
			lastMove = { x: p.x, y: p.y, t: performance.now() }
			pressed = false
			const d = hitPoster(p.x, p.y)
			const isl = d ? null : islandAt(p.x, p.y, 0.04)
			if (d && e.pointerType !== "mouse" && press == null)
				press = setTimeout(() => {
					press = null
					if (drag && drag.moved < 8) {
						pressed = true
						hooks.current.onLongPress(d)
					}
				}, 380)
			else if (isl && cfg.combine === "drag" && islandLevel(isl))
				// Hold an island to lift it, then drag it onto another.
				press = setTimeout(() => {
					press = null
					if (drag && drag.moved < 8) {
						pressed = true
						lift = { isl, x: drag.x, y: drag.y, over: null, t: performance.now() }
						c2.style.cursor = "grabbing"
						hooks.current.onLift(isl, null)
						wake()
					}
				}, 260)
			else if (isl && cfg.combine === "tap" && e.pointerType !== "mouse")
				press = setTimeout(() => {
					press = null
					if (drag && drag.moved < 8) {
						pressed = true
						hooks.current.onPickIsland(isl)
					}
				}, 420)
		} else if (pts.size === 2) {
			if (press) clearTimeout(press)
			press = null
			drag = null
			lift = null
			const [a, b] = [...pts.values()]
			pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }
		}
	}
	function panBy(dx: number, dy: number) {
		cur.x -= dx / cur.s
		cur.y -= dy / cur.s
		tgt.x -= dx / tgt.s
		tgt.y -= dy / tgt.s
		wake()
	}
	function onMove(e: PointerEvent) {
		const p = local(e)
		if (e.pointerType === "mouse") {
			pointer = { x: p.x, y: p.y, mouse: true, t: performance.now() }
			hooks.current.onPointer()
			wake()
		}
		if (lift) {
			lift.x = p.x
			lift.y = p.y
			const over = islandAt(p.x, p.y, 0.1, lift.isl)
			if (over !== lift.over) {
				lift.over = over
				hooks.current.onLift(lift.isl, over)
			}
			wake()
			return
		}
		if (!pts.has(e.pointerId)) {
			if (e.pointerType === "mouse") {
				const d = hitPoster(p.x, p.y)
				const k = d ? d.it.k : null
				const hi = d ? null : islandAt(p.x, p.y, 0.05)
				if (k !== hoverKey || hi !== hoverIsl) {
					hoverKey = k
					hoverIsl = hi
					c2.style.cursor = d || hi ? "pointer" : "grab"
					dirty = true
				}
			}
			return
		}
		const prev = pts.get(e.pointerId) as { x: number; y: number; type: string }
		pts.set(e.pointerId, { ...p, type: e.pointerType })
		if (pts.size >= 2 && pinch) {
			const [a, b] = [...pts.values()]
			const d = Math.hypot(a.x - b.x, a.y - b.y)
			const cx = (a.x + b.x) / 2
			const cy = (a.y + b.y) / 2
			const f = d / Math.max(pinch.d, 1)
			if (Math.abs(f - 1) > 0.002) gestureDir = f > 1 ? 1 : -1
			const w = toWorld(pinch.cx, pinch.cy, cur)
			const ns = clamp(cur.s * f, fitS * 0.7, maxS * 1.1)
			cur.s = ns
			cur.x = w.x - (cx - W / 2) / ns
			cur.y = w.y - (cy - H / 2) / ns
			tgt.x = cur.x
			tgt.y = cur.y
			tgt.s = cur.s
			pinch = { d, cx, cy }
			snapPt = { x: cx, y: cy }
			snapAt = performance.now() + 120
			wake()
			return
		}
		if (drag && e.pointerId === drag.id) {
			const dx = p.x - prev.x
			const dy = p.y - prev.y
			drag.moved += Math.hypot(dx, dy)
			if (drag.moved > 4) {
				c2.style.cursor = "grabbing"
				panBy(dx, dy)
				const now = performance.now()
				const dtm = Math.max(1, now - lastMove.t)
				vel = { x: vel.x * 0.4 + ((p.x - lastMove.x) / dtm) * 1000 * 0.6, y: vel.y * 0.4 + ((p.y - lastMove.y) / dtm) * 1000 * 0.6 }
				lastMove = { x: p.x, y: p.y, t: now }
			}
		}
	}
	function onUp(e: PointerEvent) {
		const p = local(e)
		const had = pts.has(e.pointerId)
		pts.delete(e.pointerId)
		if (press) clearTimeout(press)
		press = null
		if (lift) {
			const l = lift
			lift = null
			drag = null
			c2.style.cursor = "grab"
			hooks.current.onLift(null, null)
			if (l.over && e.type === "pointerup") hooks.current.onCombine(l.isl, l.over)
			wake()
			return
		}
		if (pinch) {
			if (pts.size < 2) pinch = null
			if (pts.size === 1) {
				const [id, q] = [...pts.entries()][0]
				drag = { x: q.x, y: q.y, t: performance.now(), moved: 99, id, shift: false }
				lastMove = { x: q.x, y: q.y, t: performance.now() }
				vel = { x: 0, y: 0 }
			}
			return
		}
		if (!had || !drag) return
		const d0 = drag
		drag = null
		c2.style.cursor = "grab"
		if (pressed) return
		const now = performance.now()
		if (d0.moved < 8 && now - d0.t < 450) {
			vel = { x: 0, y: 0 }
			const d = hitPoster(p.x, p.y)
			const isl = islandAt(p.x, p.y, 0.04)
			// Picking islands to combine: the Combine button, or shift-click.
			if (isl && !d && cfg.combine && (d0.shift || e.shiftKey || hooks.current.combining())) return hooks.current.onPickIsland(isl)
			if (now - lastTap.t < 300 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
				lastTap = { t: 0, x: 0, y: 0 }
				stepZoom(1, p.x, p.y)
				return
			}
			lastTap = { t: now, x: p.x, y: p.y }
			if (d) return hooks.current.onTapPoster(d)
			if (isl && islandLevel(isl)) return hooks.current.onTapIsland(isl)
			return hooks.current.onTapWater()
		}
		if (now - lastMove.t > 70) vel = { x: 0, y: 0 }
		snapPt = { x: p.x, y: p.y }
		snapAt = now + 260
		wake()
	}
	function onLeave() {
		pointer = null
		if (hoverKey || hoverIsl) {
			hoverKey = null
			hoverIsl = null
			dirty = true
		}
		hooks.current.onPointer()
		wake()
	}
	c2.style.cursor = "grab"
	c2.addEventListener("wheel", onWheel, { passive: false })
	c2.addEventListener("pointerdown", onDown)
	c2.addEventListener("pointermove", onMove)
	c2.addEventListener("pointerup", onUp)
	c2.addEventListener("pointercancel", onUp)
	c2.addEventListener("pointerleave", onLeave)
	c2.addEventListener("contextmenu", (e) => e.preventDefault())

	// ------------------------------------------------------------ frame

	function wake() {
		if (dead) return
		dirty = true
		if (!raf) raf = requestAnimationFrame(frame)
	}
	function resize() {
		const r = c2.getBoundingClientRect()
		W = Math.max(1, r.width)
		H = Math.max(1, r.height)
		dpr = Math.min(2, window.devicePixelRatio || 1)
		gdpr = Math.min(1.5, window.devicePixelRatio || 1)
		c2.width = Math.round(W * dpr)
		c2.height = Math.round(H * dpr)
		const was = fitS
		computeScales()
		if (world && Math.abs(cur.s - was) < was * 0.01) {
			const h = homeCam()
			Object.assign(cur, h)
			Object.assign(tgt, h)
		}
		wake()
	}

	/** Animate picks, dimming and bridges; true while anything still moves. */
	function stepIslands(dt: number) {
		let moving = false
		const br = bridgeOf()
		const k = reduce ? 1 : 1 - Math.exp(-dt * 7)
		const fi = hoverIsl ?? (cur.s > fitS * 1.4 ? focusIsland() : null)
		for (const isl of islands) {
			const wantE = isl === fi ? 1 : 0
			const joined = !!br && (isl.id === br.bridge?.a || isl.id === br.bridge?.b)
			const wantP = picks.has(isl.id) || (lift && (lift.isl === isl || lift.over === isl)) ? 1 : joined ? 0.45 : 0
			const wantD = br && !isl.bridge && !joined ? 1 : 0
			for (const [key, want] of [
				["emph", wantE],
				["pick", wantP],
				["dim", wantD],
			] as const) {
				const v = isl[key]
				const n = v + (want - v) * (key === "emph" ? 1 - Math.exp(-dt * 8) : k)
				if (Math.abs(n - v) > 0.002) moving = true
				isl[key] = Math.abs(want - n) < 0.003 ? want : n
			}
			if (isl.bridge) {
				const b = isl.bridge
				const speed = b.to ? 1.15 : 2.2
				const n = reduce ? b.to : clamp(b.grow + (b.to ? 1 : -1) * dt * speed, 0, 1)
				if (n !== b.grow) moving = true
				b.grow = n
			}
		}
		// A bridge that has sunk is gone.
		const before = islands.length
		islands = islands.filter((i) => !(i.bridge && i.bridge.to === 0 && i.bridge.grow <= 0))
		if (islands.length !== before) moving = true
		return moving
	}
	const growOf = (isl: Isl) => (isl.bridge ? backOut(isl.bridge.grow) : 1)

	function frame(now: number) {
		raf = 0
		if (dead) return
		const dt = Math.min(0.05, (now - last) / 1000)
		frames.push(now - last)
		if (frames.length > 600) frames.shift()
		last = now
		if (!world) return
		if (flight) stepFlight(now)
		else {
			if (!drag && !pinch && (Math.abs(vel.x) > 8 || Math.abs(vel.y) > 8)) {
				panBy(vel.x * dt, vel.y * dt)
				const f = Math.exp(-dt * 4.2)
				vel.x *= f
				vel.y *= f
				if (Math.abs(vel.x) <= 8 && Math.abs(vel.y) <= 8) vel = { x: 0, y: 0 }
			} else if (!drag && !pinch) clampTgt()
			approach(dt)
			if (snapPt && now >= snapAt) settle()
		}
		const moved = cur.x !== prevCam.x || cur.y !== prevCam.y || cur.s !== prevCam.s
		prevCam = { ...cur }
		const islMoving = stepIslands(dt)
		const lensMoving = stepLens(dt)
		const s0 = stopsOf(focusIsland())
		const deep = smooth(s0[1] ?? fitS * 3, (s0[2] ?? fitS * 6) * 1.1, cur.s)
		ground.draw({
			w: W,
			h: H,
			dpr: gdpr,
			cam: cur,
			fit: fitS,
			time: reduce ? 0 : (now - t0) / 1000,
			deep,
			islands: islands.map(
				(isl): SeaIsland7 => ({
					x: isl.cell.cx,
					y: isl.cell.cy,
					r: (isl.cell.r ?? 100) * growOf(isl),
					seed: isl.cell.seed ?? 0,
					c: isl.tint.map((v) => v * (1 - 0.62 * isl.dim)) as RGB,
					e: isl.emph * (1 - isl.dim) + 0.7 * isl.pick - 0.85 * isl.dim,
					slot: isl.slot,
				}),
			),
		})
		// A picked island's ring turns slowly, so it keeps being drawn.
		const ringing = islands.some((i) => i.pick > 0.5 && !i.bridge) || !!lift
		if (moved || dirty || islMoving || lensMoving || ringing) {
			dirty = false
			draw2d()
			for (const fn of listeners) fn()
			hooks.current.onFrame()
		}
		const busy = !!flight || moved || islMoving || lensMoving || ringing || !!snapPt || Math.abs(vel.x) > 0 || Math.abs(vel.y) > 0
		if (!raf && (ground.animated ? !reduce || busy || dirty : busy || dirty)) raf = requestAnimationFrame(frame)
	}

	// ------------------------------------------------------------ 2D: posters and names

	function draw2d() {
		g.setTransform(dpr, 0, 0, dpr, 0, 0)
		g.clearRect(0, 0, W, H)
		const out: Drawn[] = []
		const act = hooks.current.active()
		const show = SHOW()
		const far = FAR[cfg.present]
		for (const isl of islands) {
			const r = isl.cell.r ?? 100
			isl.sx = W / 2 + (isl.cell.cx - cur.x) * cur.s
			isl.sy = H / 2 + (isl.cell.cy - cur.y) * cur.s
			isl.sr = r * cur.s * growOf(isl)
			isl.on = isl.sx + isl.sr * 1.15 > 0 && isl.sx - isl.sr * 1.15 < W && isl.sy + isl.sr * 1.15 > 0 && isl.sy - isl.sr * 1.15 < H
			if (!isl.on) continue
			const st1 = islandCam(isl).s
			if (cur.s > st1 * 0.45 && !isl.loaded) hooks.current.needTree(isl)
			if (isl.w1 * cur.s < show * 0.9) continue
			const rise = isl.bridge ? smooth(0.7, 1, isl.bridge.grow) * (isl.bridge.to ? 1 : isl.bridge.grow) : 1
			if (rise <= 0.01) continue
			const fade = 1 - 0.55 * isl.dim
			for (let i = 0; i < isl.items.length && out.length < MAX; i++) {
				const rw = isl.pos.w[i] * cur.s
				if (rw < show * 0.9) {
					if (isl.gen[i] > 1) break
					continue
				}
				const it = isl.items[i]
				if (!hooks.current.pass(it)) continue
				const cx = W / 2 + (isl.pos.x[i] - cur.x) * cur.s
				const cy = H / 2 + (isl.pos.y[i] - cur.y) * cur.s
				if (cx + rw < -20 || cx - rw > W + 20 || cy + rw * 1.5 < -20 || cy - rw * 1.5 > H + 20) continue
				const big = BIG()
				const isAct = !!act && act.k === it.k
				if (rw > big && !(isAct && rw < big * 1.6)) continue
				const dis = isAct ? 1 : 1 - smooth(big * 0.72, big, rw)
				const t = isAct ? 1 : closeness(cx, cy)
				const k = far + (1 - far) * t
				const w = rw * k
				const h = w * 1.5
				out.push({ isl, i, it, gen: isl.gen[i], x: cx - w / 2, y: cy - h / 2, w, h, cx, cy, a: smooth(show * 0.9, show * 2, rw) * dis * rise * fade, t })
			}
		}
		drawn = out
		drawCauseways()
		if (cfg.present === "lit") pool()
		// Far ones first, the ones at the focus on top; the active and hovered posters last.
		const lift2 = (d: Drawn) => (act && d.it.k === act.k ? 2 : d.it.k === hoverKey ? 1 : 0)
		const order = [...out].sort((a, b) => lift2(a) - lift2(b) || a.t - b.t || b.gen - a.gen)
		const dimOthers = act?.pinned ? 0.55 : 1
		const budget = { n: 10 }
		for (const d of order) {
			const l = lift2(d)
			const a = d.a * (act && l < 2 ? dimOthers : 1)
			if (a <= 0.01) continue
			if (cfg.present === "lit") drawLit(d, l, a, budget)
			else if (cfg.present === "rise") drawRise(d, l, a)
			else if (cfg.present === "tiles") drawTile(d, l, a)
			else drawFrame(d, l, a)
		}
		if (act) thread(act.k)
		drawRings()
		drawNames()
		drawLift()
		// Keep loading the next posters' dots' colors.
		if (budget.n <= 0) dirty = true
	}

	/** lit: a warm pool of light on the ground at the focus, the night deepening away from it (only once you're in). */
	function pool() {
		const z = smooth(fitS * 1.3, fitS * 2.4, cur.s)
		if (z <= 0.01) return
		g.save()
		const night = g.createRadialGradient(lens.x, lens.y, lens.r * 0.45, lens.x, lens.y, lens.r * 1.9)
		night.addColorStop(0, "rgba(2,4,10,0)")
		night.addColorStop(1, `rgba(2,4,10,${0.5 * z})`)
		g.fillStyle = night
		g.fillRect(0, 0, W, H)
		g.globalCompositeOperation = "lighter"
		const warm = g.createRadialGradient(lens.x, lens.y, 0, lens.x, lens.y, lens.r * 1.05)
		warm.addColorStop(0, `rgba(255,236,205,${0.11 * z})`)
		warm.addColorStop(1, "rgba(255,236,205,0)")
		g.fillStyle = warm
		g.fillRect(lens.x - lens.r * 1.1, lens.y - lens.r * 1.1, lens.r * 2.2, lens.r * 2.2)
		g.restore()
	}

	/** The poster image (or its title on a dark card while it loads), clipped to a rounded rect. */
	function face(d: Drawn, x: number, y: number, w: number, h: number, rr: number) {
		const im = d.it.p ? poster(d.it.p, w * dpr) : null
		g.save()
		g.beginPath()
		g.roundRect(x, y, w, h, rr)
		g.clip()
		if (im) g.drawImage(im, x, y, w, h)
		else {
			g.fillStyle = rgbCss(mixRgb(d.isl.tint, [0.05, 0.06, 0.1], 0.7), 1)
			g.fillRect(x, y, w, h)
			if (w > 60) {
				g.fillStyle = "rgba(255,255,255,.8)"
				g.font = `600 ${Math.min(15, w * 0.11)}px ${FONT}`
				g.textAlign = "center"
				g.textBaseline = "middle"
				g.fillText(d.it.t.length > 22 ? `${d.it.t.slice(0, 20)}…` : d.it.t, x + w / 2, y + h / 2, w * 0.86)
			}
		}
	}
	function glowBehind(d: Drawn, l: number, a: number, x: number, y: number, w: number, h: number) {
		if (!l) return
		g.globalAlpha = a * (l === 2 ? 1 : 0.65)
		g.drawImage(glowSprite(d.isl.tint), x - w * 0.5, y - h * 0.34, w * 2, h * 1.68)
		g.globalAlpha = a
	}
	function edge(x: number, y: number, w: number, h: number, rr: number, l: number, base: number) {
		g.lineWidth = l === 2 ? 2 : 1
		g.strokeStyle = l === 2 ? "rgba(255,255,255,.9)" : `rgba(255,255,255,${base})`
		g.beginPath()
		g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, rr)
		g.stroke()
	}
	function dot(x: number, y: number, r: number, color: string, a: number) {
		g.globalAlpha = a
		g.fillStyle = color
		g.beginPath()
		g.arc(x, y, r, 0, Math.PI * 2)
		g.fill()
	}

	/** lit: a pool of light around the focus; cards turn toward it, shadows fall away from it, the rest sinks into the dark. */
	function drawLit(d: Drawn, l: number, a: number, budget: { n: number }) {
		const t = d.t
		// Far and small: a dot in the poster's own color.
		const dotW = 1 - smooth(13, 24, d.w)
		if (dotW > 0.01) {
			const c = (d.it.p && avgOf(d.it.p, budget)) || rgbCss(d.isl.tint, 1)
			g.globalAlpha = a * dotW * 0.9
			const r = clamp(d.w * 0.34, 2.2, 6)
			g.drawImage(dotS, d.cx - r * 2.2, d.cy - r * 2.2, r * 4.4, r * 4.4)
			dot(d.cx, d.cy, r * 0.62, c, a * dotW)
			g.globalAlpha = 1
			if (dotW > 0.99) return
		}
		const pa = a * (1 - dotW)
		const lx = lens.x
		const ly = lens.y
		let vx = (d.cx - lx) / lens.r
		let vy = (d.cy - ly) / lens.r
		const vl = Math.hypot(vx, vy)
		if (vl > 1) {
			vx /= vl
			vy /= vl
		}
		const k = l === 2 ? 1.05 : l === 1 ? 1.03 : 1
		const w = d.w * k
		const h = d.h * k
		const x = -w / 2
		const y = -h / 2
		const rr = Math.max(2, w * 0.045)
		// The shadow falls away from the light, longer for the cards closest to it.
		const off = w * (0.05 + 0.12 * t)
		g.globalAlpha = pa * (0.3 + 0.45 * t)
		g.drawImage(shadow, d.cx - w * 0.35 + vx * off, d.cy - h / 2 - h * 0.2 + w * 0.06 + vy * off, w * 1.7, h * 1.36)
		g.globalAlpha = pa
		glowBehind(d, l, pa, d.cx - w / 2, d.cy - h / 2, w, h)
		// A tilt toward the light: none right under it, most at the edge of the pool.
		const tilt = t * smooth(0.04, 0.5, vl) * 0.085
		g.save()
		g.translate(d.cx, d.cy)
		g.transform(1 - Math.abs(vx) * tilt * 0.9, -vx * vy * tilt * 0.6, -vx * tilt * 0.55, 1 - Math.abs(vy) * tilt * 0.5, 0, 0)
		face(d, x, y, w, h, rr)
		if (w > 30) {
			// A sheen on the side facing the light, and the dark of the night on the rest.
			const gr = g.createLinearGradient(-vx * w * 0.6, -vy * h * 0.6, vx * w * 0.6, vy * h * 0.6)
			gr.addColorStop(0, `rgba(255,255,255,${0.2 * t + 0.04})`)
			gr.addColorStop(0.5, "rgba(255,255,255,0)")
			g.fillStyle = gr
			g.fillRect(x, y, w, h)
		}
		const dark = (1 - t) * 0.5
		if (dark > 0.01 && l < 2) {
			g.fillStyle = `rgba(3,5,12,${dark})`
			g.fillRect(x, y, w, h)
		}
		g.restore()
		edge(x, y, w, h, rr, l, 0.06 + 0.22 * t)
		g.restore()
		g.globalAlpha = 1
	}

	/** rise: posters lie flat in the island's surface, and stand up as the focus comes near. */
	function drawRise(d: Drawn, l: number, a: number) {
		const r = l ? 1 : smooth(0.12, 0.8, d.t)
		const w = d.w * (l === 2 ? 1.04 : 1)
		const h = d.h * (0.5 + 0.5 * r) * (l === 2 ? 1.04 : 1)
		const base = d.cy + d.h / 2
		const lift = d.h * 0.035 * r
		const x = d.cx - w / 2
		const y = base - h - lift
		const rr = Math.max(2, w * 0.05)
		if (r > 0.02) {
			// A shadow cast on the ground behind the card, longer as it stands.
			g.globalAlpha = a * 0.62 * r
			g.drawImage(shadow, x - w * 0.28 + w * 0.12 * r, base - h * 0.3, w * 1.62, h * 0.5 + d.h * 0.28 * r)
		}
		g.globalAlpha = a * (0.62 + 0.38 * r)
		glowBehind(d, l, a, x, y, w, h)
		g.globalAlpha = a * (0.62 + 0.38 * r)
		face(d, x, y, w, h, rr)
		// Lying down, it takes the island's light and loses its own.
		if (r < 0.98) {
			// The far edge of a card lying down is darker, as if it tipped away from you.
			const gr = g.createLinearGradient(x, y, x, y + h)
			gr.addColorStop(0, rgbCss(mixRgb(d.isl.tint, [0.02, 0.03, 0.07], 0.7), 0.72 * (1 - r)))
			gr.addColorStop(1, rgbCss(mixRgb(d.isl.tint, [0.02, 0.03, 0.07], 0.45), 0.4 * (1 - r)))
			g.fillStyle = gr
			g.fillRect(x, y, w, h)
		}
		if (w > 36 && r > 0.2) {
			const gr = g.createLinearGradient(x, y, x, y + h * 0.5)
			gr.addColorStop(0, `rgba(255,255,255,${0.12 * r})`)
			gr.addColorStop(1, "rgba(255,255,255,0)")
			g.fillStyle = gr
			g.fillRect(x, y, w, h * 0.5)
		}
		g.restore()
		g.globalAlpha = a
		edge(x, y, w, h, rr, l, 0.05 + 0.14 * r)
		g.globalAlpha = 1
	}

	/** tiles: rounded tiles with a match pill; far out they melt into dots colored by match. */
	function drawTile(d: Drawn, l: number, a: number) {
		const dotW = 1 - smooth(14, 26, d.w)
		if (dotW > 0.01) {
			const c = matchDot(d.it.m)
			const best = d.it.m >= 92
			const r = clamp(d.w * 0.18, 1.8, 3.8) * (best ? 1.2 : d.it.m >= 85 ? 1 : 0.8)
			if (best) {
				g.globalAlpha = a * dotW * 0.55
				g.drawImage(dotS, d.cx - r * 3.2, d.cy - r * 3.2, r * 6.4, r * 6.4)
			}
			dot(d.cx, d.cy, r, c, a * dotW * (d.it.m >= 72 ? 0.95 : 0.6))
			g.globalAlpha = 1
			if (dotW > 0.99) return
		}
		const pa = a * (1 - dotW)
		const k = l === 2 ? 1.05 : l === 1 ? 1.03 : 1
		const w = d.w * k
		const h = d.h * k
		const x = d.cx - w / 2
		const y = d.cy - h / 2
		const rr = Math.max(3, w * 0.13)
		g.globalAlpha = pa * (0.45 + 0.3 * d.t + l * 0.1)
		g.drawImage(shadow, x - w * 0.35, y - h * 0.2 + w * 0.08, w * 1.7, h * 1.36)
		g.globalAlpha = pa
		glowBehind(d, l, pa, x, y, w, h)
		face(d, x, y, w, h, rr)
		if (w > 36) {
			const gr = g.createLinearGradient(x, y, x, y + h * 0.45)
			gr.addColorStop(0, "rgba(255,255,255,.12)")
			gr.addColorStop(1, "rgba(255,255,255,0)")
			g.fillStyle = gr
			g.fillRect(x, y, w, h * 0.45)
		}
		g.restore()
		edge(x, y, w, h, rr, l, 0.16)
		// The match: a pill when there's room, a dot in the corner when there isn't.
		const pill = smooth(58, 78, w)
		const corner = smooth(26, 36, w) * (1 - pill)
		const m = d.it.r ? null : d.it.m
		if (m != null && pill > 0.01 && fontsOk) {
			const ph = clamp(w * 0.13, 16, 22)
			const fs = ph * 0.6
			g.font = `800 ${fs}px ${FONT}`
			const txt = `${m}%`
			const tw = g.measureText(txt).width
			const pw = tw + ph * 0.8
			const px = x + Math.max(5, w * 0.05)
			const py = y + Math.max(5, w * 0.05)
			g.globalAlpha = pa * pill
			g.fillStyle = "rgba(7,10,19,.8)"
			g.beginPath()
			g.roundRect(px, py, pw, ph, ph / 2)
			g.fill()
			g.strokeStyle = "rgba(255,255,255,.14)"
			g.lineWidth = 1
			g.stroke()
			g.fillStyle = HEAT[m] ?? "#fbbf24"
			g.textAlign = "left"
			g.textBaseline = "middle"
			g.fillText(txt, px + ph * 0.4, py + ph / 2 + 0.5)
		} else if (m != null && corner > 0.01) {
			const r = clamp(w * 0.07, 2.4, 4)
			dot(x + r + 4, y + r + 4, r + 1.4, "rgba(7,10,19,.85)", pa * corner)
			dot(x + r + 4, y + r + 4, r, matchDot(m), pa * corner)
		}
		g.globalAlpha = 1
	}

	/** frames: the poster at the focus, its 16:9 backdrop and name a little further, then only the name, then a line. */
	const wraps = new Map<string, string[]>()
	function wrap(text: string, fs: number, maxW: number, lines: number) {
		const key = `${text}|${Math.round(fs)}|${Math.round(maxW / 8)}|${lines}`
		const hit = wraps.get(key)
		if (hit) return hit
		const words = text.split(" ")
		const out: string[] = []
		let line = ""
		for (let n = 0; n < words.length; n++) {
			const next = line ? `${line} ${words[n]}` : words[n]
			if (g.measureText(next).width <= maxW || !line) line = next
			else {
				out.push(line)
				line = words[n]
				if (out.length === lines - 1) {
					line = words.slice(n).join(" ")
					break
				}
			}
		}
		if (line) out.push(line)
		const last = out.length - 1
		while (last >= 0 && g.measureText(out[last]).width > maxW && out[last].length > 2) out[last] = `${out[last].slice(0, -2).trimEnd()}…`
		if (wraps.size > 3000) wraps.clear()
		wraps.set(key, out)
		return out
	}
	function drawFrame(d: Drawn, l: number, a: number) {
		const t = l ? 1 : d.t
		const wp = smooth(0.58, 0.7, t)
		const wb = (1 - wp) * smooth(0.18, 0.28, t) * smooth(34, 46, d.w)
		const wt = Math.max(0, 1 - wp - wb)
		const x = d.cx - d.w / 2
		const y = d.cy - d.h / 2
		if (wp > 0.01) {
			const k = l === 2 ? 1.05 : l === 1 ? 1.03 : 1
			const w = d.w * k
			const h = d.h * k
			const px = d.cx - w / 2
			const py = d.cy - h / 2
			const rr = Math.max(2, w * 0.05)
			g.globalAlpha = a * wp * 0.6
			g.drawImage(shadow, px - w * 0.35, py - h * 0.2 + w * 0.08, w * 1.7, h * 1.36)
			g.globalAlpha = a * wp
			glowBehind(d, l, a * wp, px, py, w, h)
			face(d, px, py, w, h, rr)
			if (w > 36) {
				const gr = g.createLinearGradient(px, py, px, py + h * 0.5)
				gr.addColorStop(0, "rgba(255,255,255,.1)")
				gr.addColorStop(1, "rgba(255,255,255,0)")
				g.fillStyle = gr
				g.fillRect(px, py, w, h * 0.5)
			}
			g.restore()
			edge(px, py, w, h, rr, l, 0.14)
		}
		const light = rgbCss(mixRgb(d.isl.tint, [1, 1, 1], 0.55), 1)
		if (wb > 0.01) {
			// A still from the title: wider than the poster, with its name under it.
			const bw = d.w * 1.3
			const bh = bw * 0.5625
			const bx = d.cx - bw / 2
			const by = d.cy - bh / 2 - d.h * 0.1
			const rr = Math.max(2, bw * 0.035)
			g.globalAlpha = a * wb * 0.55
			g.drawImage(shadow, bx - bw * 0.2, by - bh * 0.2, bw * 1.4, bh * 1.5)
			g.globalAlpha = a * wb
			const e = d.it.b ? image(d.it.b, "w300") : null
			g.save()
			g.beginPath()
			g.roundRect(bx, by, bw, bh, rr)
			g.clip()
			if (e?.ok) g.drawImage(e.im, bx, by, bw, bh)
			else {
				const im = d.it.p ? poster(d.it.p, bw * dpr) : null
				if (im) g.drawImage(im, 0, im.naturalHeight * 0.18, im.naturalWidth, im.naturalWidth * 0.5625, bx, by, bw, bh)
				else {
					g.fillStyle = rgbCss(mixRgb(d.isl.tint, [0.05, 0.06, 0.1], 0.7), 1)
					g.fillRect(bx, by, bw, bh)
				}
			}
			g.restore()
			g.strokeStyle = "rgba(255,255,255,.14)"
			g.lineWidth = 1
			g.beginPath()
			g.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, rr)
			g.stroke()
			const fs = clamp(bw * 0.085, 9.5, 13)
			if (fontsOk && bw > 54) {
				g.font = `700 ${fs}px ${FONT}`
				g.textAlign = "center"
				g.textBaseline = "top"
				const lines = wrap(d.it.t, fs, bw * 1.02, 1)
				g.lineJoin = "round"
				g.lineWidth = 3
				g.strokeStyle = "rgba(3,5,12,.6)"
				g.strokeText(lines[0] ?? "", d.cx, by + bh + 5)
				g.fillStyle = "rgba(245,247,255,.95)"
				g.fillText(lines[0] ?? "", d.cx, by + bh + 5)
			}
		}
		if (wt > 0.01) {
			// Far out, only the name: type set in the island's light, then just a line where it would be.
			const fs = clamp(d.w * 0.2, 0, 15)
			const tw = d.w * 1.5
			g.globalAlpha = a * wt * (0.7 + 0.3 * t)
			if (fs >= 8.5 && fontsOk) {
				g.font = `700 ${fs}px ${FONT}`
				g.textAlign = "center"
				g.textBaseline = "middle"
				const lines = wrap(d.it.t, fs, tw, 2)
				const lead = fs * 1.08
				g.lineJoin = "round"
				g.lineWidth = Math.max(2, fs * 0.28)
				g.strokeStyle = "rgba(3,5,12,.55)"
				lines.forEach((ln, n) => g.strokeText(ln, d.cx, d.cy + (n - (lines.length - 1) / 2) * lead))
				g.fillStyle = "rgba(244,246,255,.92)"
				lines.forEach((ln, n) => g.fillText(ln, d.cx, d.cy + (n - (lines.length - 1) / 2) * lead))
			} else {
				// Too small to read: a point of the island's light where the name would be.
				const r = clamp(d.w * 0.12, 1.4, 2.6)
				dot(d.cx, d.cy, r, light, a * wt * 0.8)
			}
		}
		void x
		void y
		g.globalAlpha = 1
	}

	/** A thread of light from the active poster to its card (round 6). */
	function thread(k: string) {
		const d = drawn.find((x) => x.it.k === k)
		const r = hooks.current.card()
		if (!d || !r) return
		const b = c2.getBoundingClientRect()
		const rx = r.left - b.left
		const ry = r.top - b.top
		const toRight = rx > d.cx
		const px = toRight ? d.cx + d.w * 0.53 : d.cx - d.w * 0.53
		const py = d.cy
		const inside = d.cx > rx - 4 && d.cx < rx + r.width + 4 && d.cy > ry - 4 && d.cy < ry + r.height + 4
		if (inside) return
		const cx = clamp(px, rx, rx + r.width)
		const cy = clamp(py, ry + 24, ry + r.height - 24)
		const ex = cx === rx || cx === rx + r.width ? cx : px
		const ey = cx === rx || cx === rx + r.width ? cy : cy < py ? ry + r.height : ry
		if (Math.hypot(ex - px, ey - py) < 6) return
		const mx = (px + ex) / 2
		g.save()
		const gr = g.createLinearGradient(px, py, ex, ey)
		gr.addColorStop(0, rgbCss(d.isl.tint, 0.95))
		gr.addColorStop(1, "rgba(255,255,255,.35)")
		g.beginPath()
		g.moveTo(px, py)
		g.bezierCurveTo(mx, py, mx, ey, ex, ey)
		g.strokeStyle = rgbCss(d.isl.tint, 0.22)
		g.lineWidth = 6
		g.stroke()
		g.strokeStyle = gr
		g.lineWidth = 1.5
		g.stroke()
		g.fillStyle = "#fff"
		g.beginPath()
		g.arc(px, py, 3, 0, Math.PI * 2)
		g.fill()
		g.restore()
	}

	/** A bridge's causeways: a band of light from each island it joins to its shore. */
	function drawCauseways() {
		for (const isl of islands) {
			if (!isl.bridge) continue
			const gw = isl.bridge.grow
			if (gw <= 0.01) continue
			for (const id of [isl.bridge.a, isl.bridge.b]) {
				const o = islands.find((x) => x.id === id)
				if (!o) continue
				const a1 = Math.atan2(isl.cell.cy - o.cell.cy, isl.cell.cx - o.cell.cx)
				const a2 = a1 + Math.PI
				const ox = W / 2 + (o.cell.cx + Math.cos(a1) * shapeR(o.cell, a1) * 0.985 - cur.x) * cur.s
				const oy = H / 2 + (o.cell.cy + Math.sin(a1) * shapeR(o.cell, a1) * 0.985 - cur.y) * cur.s
				const br = shapeR(isl.cell, a2) * backOut(gw) * 0.985
				const bx = W / 2 + (isl.cell.cx + Math.cos(a2) * br - cur.x) * cur.s
				const by = H / 2 + (isl.cell.cy + Math.sin(a2) * br - cur.y) * cur.s
				// It reaches out from the island as the bridge rises.
				const reach = smooth(0, 0.8, gw)
				const ex = ox + (bx - ox) * reach
				const ey = oy + (by - oy) * reach
				const wide = clamp((isl.cell.r ?? 100) * cur.s * 0.16, 3, 26)
				const gr = g.createLinearGradient(ox, oy, ex, ey)
				gr.addColorStop(0, rgbCss(o.tint, 0.5))
				gr.addColorStop(1, rgbCss(isl.tint, 0.5))
				g.save()
				g.lineCap = "round"
				g.globalAlpha = isl.bridge.to ? 1 : gw
				g.strokeStyle = gr
				g.lineWidth = wide * 2.2
				g.globalAlpha *= 0.28
				g.beginPath()
				g.moveTo(ox, oy)
				g.lineTo(ex, ey)
				g.stroke()
				g.globalAlpha = (isl.bridge.to ? 1 : gw) * 0.75
				g.lineWidth = wide * 0.5
				g.stroke()
				g.globalAlpha = isl.bridge.to ? 1 : gw
				g.setLineDash([1, Math.max(6, wide * 0.9)])
				g.lineWidth = Math.max(1.6, wide * 0.18)
				g.strokeStyle = "rgba(255,255,255,.85)"
				g.stroke()
				g.restore()
			}
		}
	}

	/** Islands picked for combining: a slowly turning dashed ring of light off their shore. */
	function drawRings() {
		const now = (performance.now() - t0) / 1000
		for (const isl of islands) {
			if (isl.bridge || isl.pick < 0.02 || !isl.on) continue
			const joined = islands.some((b) => b.bridge?.to === 1 && (b.bridge.a === isl.id || b.bridge.b === isl.id))
			if (joined) continue
			g.save()
			g.globalAlpha = isl.pick
			g.setLineDash([10, 9])
			g.lineDashOffset = reduce ? 0 : -now * 22
			g.lineWidth = 2
			g.strokeStyle = "rgba(255,255,255,.85)"
			g.beginPath()
			const N = 72
			for (let n = 0; n <= N; n++) {
				const a = (n / N) * Math.PI * 2
				const rr = shapeR(isl.cell, a) * cur.s * 1.07 + 6
				const x = isl.sx + Math.cos(a) * rr
				const y = isl.sy + Math.sin(a) * rr
				if (n) g.lineTo(x, y)
				else g.moveTo(x, y)
			}
			g.closePath()
			g.stroke()
			g.restore()
		}
	}

	/** The island being dragged: a small copy of it under the pointer, with a line back to where it came from. */
	function drawLift() {
		if (!lift) return
		const isl = lift.isl
		const R = clamp(isl.sr * 0.5, 34, 70)
		const k = R / (isl.cell.r ?? 100)
		g.save()
		g.globalAlpha = 0.9
		g.setLineDash([2, 7])
		g.lineCap = "round"
		g.strokeStyle = rgbCss(isl.tint, 0.7)
		g.lineWidth = 2
		g.beginPath()
		g.moveTo(isl.sx, isl.sy)
		g.lineTo(lift.x, lift.y)
		g.stroke()
		g.setLineDash([])
		g.beginPath()
		const N = 60
		for (let n = 0; n <= N; n++) {
			const a = (n / N) * Math.PI * 2
			const rr = shapeR(isl.cell, a) * k
			const x = lift.x + Math.cos(a) * rr
			const y = lift.y + Math.sin(a) * rr
			if (n) g.lineTo(x, y)
			else g.moveTo(x, y)
		}
		g.closePath()
		g.shadowColor = rgbCss(isl.tint, 0.8)
		g.shadowBlur = 24
		g.fillStyle = rgbCss(mixRgb(isl.tint, [0.02, 0.03, 0.08], 0.55), 0.88)
		g.fill()
		g.shadowBlur = 0
		g.lineWidth = 2
		g.strokeStyle = rgbCss(mixRgb(isl.tint, [1, 1, 1], 0.5), 1)
		g.stroke()
		if (fontsOk) {
			g.fillStyle = "#fff"
			g.textAlign = "center"
			g.textBaseline = "middle"
			g.font = `800 ${clamp(R * 0.3, 12, 17)}px ${FONT}`
			g.fillText(isl.name, lift.x, lift.y, R * 1.8)
		}
		g.restore()
	}

	function drawNames() {
		if (!fontsOk) return
		const ph = small()
		const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
		const byNear = islands
			.filter((i) => i.on)
			.sort((a, b) => (b.bridge ? 1 : 0) - (a.bridge ? 1 : 0) || Math.hypot(a.sx - W / 2, a.sy - H / 2) - Math.hypot(b.sx - W / 2, b.sy - H / 2))
		for (const isl of byNear) {
			const st1 = islandCam(isl).s
			let a = 1 - smooth(Math.max(fitS * 1.3, st1 * 0.42), st1 * 0.8, cur.s)
			a *= 1 - 0.55 * isl.dim
			if (isl.bridge) a *= smooth(0.55, 1, isl.bridge.grow) * (isl.bridge.to ? 1 : isl.bridge.grow)
			if (a <= 0.01) continue
			const z = smooth(fitS * 1.25, fitS * 2.2, cur.s)
			const sr = isl.sr
			let size = clamp(sr * (ph ? 0.2 : 0.22), ph ? 12 : 15, ph ? 22 : 40) * (1 - z) + (ph ? 13 : 15) * z
			if (isl.bridge) size = Math.max(size, ph ? 14 : 17)
			const pd = hooks.current.pad()
			g.font = `800 ${size}px ${FONT}`
			const room = Math.max(sr * (ph ? 1.8 : 2.1), isl.bridge ? 180 : ph ? 72 : 120)
			let lines = [isl.name]
			const words = isl.name.split(" ")
			if (g.measureText(isl.name).width > room && words.length > 1 && z < 0.5) {
				let best = 1
				let bw = Number.POSITIVE_INFINITY
				for (let k = 1; k < words.length; k++) {
					const w = Math.max(g.measureText(words.slice(0, k).join(" ")).width, g.measureText(words.slice(k).join(" ")).width)
					if (w < bw) {
						bw = w
						best = k
					}
				}
				lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")]
			}
			const tw = Math.max(...lines.map((l) => g.measureText(l).width))
			if (tw > room) size = Math.max(ph ? 10 : 11, (size * room) / tw)
			const sub = Math.max(ph ? 9.5 : 11, size * 0.4)
			g.font = `800 ${size}px ${FONT}`
			const half = Math.max(...lines.map((l) => g.measureText(l).width)) / 2 + 12
			const lead = size * 1.02
			const lx = z > 0 ? clamp(isl.sx, pd.l + half, W - Math.max(pd.r, 60) - half) : isl.sx
			let y = z > 0 ? clamp(isl.sy, pd.t + 24, H - 50) : isl.sy + (isl.logo ? size * 0.5 : 0) - ((lines.length - 1) * lead) / 2
			const box = { x0: lx - half + 6, x1: lx + half - 6, y0: y - size, y1: y + size * 0.3 + (lines.length - 1) * lead }
			if (z > 0.3 && placed.some((b) => b.x0 < box.x1 && b.x1 > box.x0 && b.y0 < box.y1 && b.y1 > box.y0)) continue
			placed.push(box)
			g.save()
			g.globalAlpha = a
			g.textAlign = "center"
			g.textBaseline = "alphabetic"
			if (isl.logo) {
				const e = image(isl.logo, "w154")
				if (e.ok) {
					const L = size * 1.7
					g.shadowColor = "rgba(0,0,0,.5)"
					g.shadowBlur = 16
					g.beginPath()
					g.roundRect(lx - L / 2, y - size * 1.1 - L, L, L, L * 0.24)
					g.save()
					g.clip()
					g.drawImage(e.im, lx - L / 2, y - size * 1.1 - L, L, L)
					g.restore()
					g.shadowBlur = 0
				}
			}
			g.shadowColor = "rgba(3,6,14,.85)"
			g.shadowBlur = size * 0.9
			g.font = `800 ${size}px ${FONT}`
			;(g as unknown as { letterSpacing: string }).letterSpacing = `${-size * 0.015}px`
			g.fillStyle = "#fff"
			lines.forEach((l, k) => g.fillText(l, lx, y + k * lead))
			y += (lines.length - 1) * lead
			if ((sr > (ph ? 34 : 46) || isl.bridge) && z < 0.5) {
				y += sub * 1.55
				g.font = `500 ${sub}px ${FONT}`
				;(g as unknown as { letterSpacing: string }).letterSpacing = "0px"
				g.fillStyle = "rgba(235,240,255,.78)"
				const n = isl.count.toLocaleString("en")
				const line = isl.bridge
					? isl.bridge.kind === "both"
						? `${n} ${isl.count === 1 ? "title" : "titles"} in both, ${isl.fit}% your taste`
						: `${n} titles between the two, ${isl.fit}% your taste`
					: `${n} titles, ${isl.fit}% your taste`
				g.fillText(line, lx, y, Math.max(sr * 1.8, isl.bridge ? 240 : 0))
			}
			g.restore()
		}
	}

	// ------------------------------------------------------------ queries

	function nearest(x: number, y: number, minW: number, reach: number) {
		let best: Drawn | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const d of drawn) {
			if (d.w < minW || d.a < 0.9) continue
			const dx = Math.max(0, Math.abs(x - d.cx) - d.w / 2)
			const dy = Math.max(0, Math.abs(y - d.cy) - d.h / 2)
			const edge = Math.hypot(dx, dy)
			if (edge > reach) continue
			const v = Math.hypot(x - d.cx, y - d.cy) / (0.6 + d.w / 200)
			if (v < bd) {
				bd = v
				best = d
			}
		}
		return best
	}
	function neighbor(d: { isl: Isl; i: number }, dx: number, dy: number) {
		const x0 = d.isl.pos.x[d.i]
		const y0 = d.isl.pos.y[d.i]
		const w0 = d.isl.pos.w[d.i]
		let best: { isl: Isl; i: number; it: W } | null = null
		let bv = Number.POSITIVE_INFINITY
		for (const isl of live())
			for (let i = 0; i < isl.items.length; i++) {
				if (isl === d.isl && i === d.i) continue
				const w = isl.pos.w[i]
				if (w < w0 * 0.35 || w > w0 * 2.9 || !hooks.current.pass(isl.items[i])) continue
				const vx = isl.pos.x[i] - x0
				const vy = isl.pos.y[i] - y0
				const dist = Math.hypot(vx, vy)
				const cos = (vx * dx + vy * dy) / Math.max(dist, 1e-6)
				if (cos < 0.45) continue
				const v = dist * (2 - cos) * (1 + Math.abs(Math.log(w / w0)) * 0.4)
				if (v < bv) {
					bv = v
					best = { isl, i, it: isl.items[i] }
				}
			}
		return best
	}
	function posterCam(isl: Isl, i: number, px: number, at = hooks.current.center()): Cam {
		const s = clamp(px / (isl.pos.w[i] || 1), fitS, maxS)
		return { x: isl.pos.x[i] - (at.x - W / 2) / s, y: isl.pos.y[i] - (at.y - H / 2) / s, s }
	}

	const ro = new ResizeObserver(() => resize())
	ro.observe(c2)
	resize()

	return {
		setWorld(next: World, looks: (c: Cell) => Look, key: string) {
			const first = !world
			world = next
			surfKey = key
			picks = new Set()
			lift = null
			islands = next.cells.map((c, n) => build(c, looks(c), n < COLS * COLS - 1 ? n : -1))
			hoverKey = null
			hoverIsl = null
			computeScales()
			const h = homeCam()
			if (first) {
				Object.assign(cur, h)
				Object.assign(tgt, h)
			} else flyTo(h, 600)
			paintSurfaces()
			wake()
		},
		refilter() {
			for (const isl of islands) if (!isl.loaded) fallback(isl)
			wake()
		},
		setTree,
		invalidate: wake,
		repad() {
			resize()
		},
		islands: () => islands,
		island: (id: string) => islands.find((x) => x.id === id && !(x.bridge && x.bridge.to === 0)) ?? null,
		drawn: () => drawn,
		find: (k: string) => drawn.find((d) => d.it.k === k) ?? null,
		nearest,
		neighbor,
		act: ACT,
		pointer: () => pointer,
		lens: () => ({ ...lens }),
		size: () => ({ w: W, h: H }),
		busy: () => !!flight || !!drag || !!pinch || Math.abs(vel.x) > 0 || Math.abs(vel.y) > 0 || Math.abs(Math.log(tgt.s / cur.s)) > 0.01,
		view() {
			const fi = focusIsland()
			return { cam: { ...cur, w: W, h: H }, tgt: { ...tgt }, fit: fitS, max: maxS, stops: stopsOf(fi), focus: fi }
		},
		frames: () => frames.slice(),
		stepZoom(dir: 1 | -1, at?: { x: number; y: number }) {
			const c = at ?? hooks.current.center()
			stepZoom(dir, c.x, c.y)
		},
		overview() {
			flyTo(homeCam(), 700)
		},
		flyToIsland(isl: Isl) {
			flyTo(islandCam(isl))
		},
		flyToPoster(isl: Isl, i: number, px?: number) {
			flyTo(posterCam(isl, i, px ?? ACT() * 1.35))
		},
		glideToPoster(isl: Isl, i: number, px?: number) {
			const w = isl.pos.w[i] * cur.s
			glideTo(posterCam(isl, i, Math.max(px ?? ACT() * 1.1, w)))
		},
		panBy(dx: number, dy: number) {
			flight = null
			tgt.x += dx / tgt.s
			tgt.y += dy / tgt.s
			clampTgt()
			wake()
		},
		flyTo,
		islandCam,
		/** Frame two islands together (after letting a bridge go). */
		frameBoth(a: Isl, b: Isl) {
			const p = hooks.current.pad()
			const ra = a.cell.r ?? 100
			const rb = b.cell.r ?? 100
			const x0 = Math.min(a.cell.cx - ra, b.cell.cx - rb)
			const x1 = Math.max(a.cell.cx + ra, b.cell.cx + rb)
			const y0 = Math.min(a.cell.cy - ra, b.cell.cy - rb)
			const y1 = Math.max(a.cell.cy + ra, b.cell.cy + rb)
			const s = clamp(Math.min((W - p.l - p.r) / ((x1 - x0) * 1.25), (H - p.t - p.b) / ((y1 - y0) * 1.25)), fitS, maxS)
			flyTo({ x: (x0 + x1) / 2 - (p.l - p.r) / 2 / s, y: (y0 + y1) / 2 - (p.t - p.b) / 2 / s, s }, 800)
		},
		setPicks(ids: string[]) {
			picks = new Set(ids)
			wake()
		},
		addBridge,
		removeBridge,
		bridge: bridgeOf,
		subscribe(fn: () => void) {
			listeners.add(fn)
			return () => listeners.delete(fn)
		},
		destroy() {
			dead = true
			cancelAnimationFrame(raf)
			raf = 0
			ro.disconnect()
			offImg()
			ground.destroy()
			c2.removeEventListener("wheel", onWheel)
			c2.removeEventListener("pointerdown", onDown)
			c2.removeEventListener("pointermove", onMove)
			c2.removeEventListener("pointerup", onUp)
			c2.removeEventListener("pointercancel", onUp)
			c2.removeEventListener("pointerleave", onLeave)
		},
		glKind: () => ground.kind,
		hasGL: () => ground.kind > 0,
	}
}
