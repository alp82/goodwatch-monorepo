// PROTOTYPE - throwaway. The round-6 map engine (#180): camera, input, posters and words. The ground (sea, islands,
// light) is drawn by sea6.ts in WebGL under a transparent 2D canvas that holds the posters and the islands' names.
//
// Camera. The camera always glides toward a target: every frame it moves a fixed share of the way in log-zoom, along
// the one path that keeps the zoom's fixed point still, so a zoom stays anchored under the pointer however fast the
// target moves. Drags move the camera 1:1 and leave inertia behind; flights (tap an island, a step toward another
// island, history) arc out and back in. Readable levels ("stops") come from the island under the pointer: the whole
// map, the whole island, then each ring of its fractal at the size where its posters become readable. A mouse wheel
// notch goes straight to the next stop; trackpads and pinches zoom freely and spring to the nearest stop when you
// let go. So from the whole map, one notch frames an island and a second makes its first posters big enough to
// open.
//
// Posters. Each island's fractal (round 5's layout, reused as is) is drawn breadth first; a poster shows once it is
// big enough to see and fades in over the next few pixels, so every stop reveals one more ring. At most MAX posters
// are drawn, only on screen, with TMDB's smallest image that is sharp enough.
import type { Cell, World } from "~/ui/prototype-rec-explorer-4/geo"
import { type Placed, extent, place, roots } from "~/ui/prototype-rec-explorer-5/fractal"
import { type Sea, type SeaIsland, makeSea } from "./sea6"
import {
	COLS,
	SLOT,
	hexRgb,
	image,
	luminous,
	makeAtlas,
	mixRgb,
	onImage,
	paintSurface,
	poster,
	rgbCss,
	slotRect,
	slotUv,
} from "./surface6"
import { BRANCH, type Config6, type TreeRes, type W, firstCount } from "./wire6"

const MAX = 240
const FONT = "Gabarito, system-ui, sans-serif"

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
	/** Screen center and radius this frame, and whether it's on screen. */
	sx: number
	sy: number
	sr: number
	on: boolean
	emph: number
}

export type Drawn = {
	isl: Isl
	i: number
	it: W
	gen: number
	/** Screen rect (CSS px), top left, and center. */
	x: number
	y: number
	w: number
	h: number
	cx: number
	cy: number
	a: number
}

export type Hooks = {
	pass: (it: W) => boolean
	/** Screen area the chrome leaves free, for framing. */
	pad: () => Pad
	/** Where "the middle" is (the drawer takes the right side, for instance). */
	center: () => { x: number; y: number }
	/** Key of the title whose card is showing, and whether it's pinned. */
	active: () => { k: string; pinned: boolean } | null
	/** The card's rect on screen, for the thread of light from poster to card. */
	card: () => DOMRect | null
	onTapPoster: (d: Drawn) => void
	onTapIsland: (isl: Isl) => void
	onTapWater: () => void
	onHover: (d: Drawn | null) => void
	onLongPress: (d: Drawn) => void
	needTree: (isl: Isl) => void
	/** After every drawn frame, so overlays can follow their posters. */
	onFrame: () => void
	/** When the pointer moved (attention point changes). */
	onPointer: () => void
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

function shapeR(c: Cell, a: number) {
	const r = c.r ?? 100
	const s = c.seed ?? 0
	return r * (1 + 0.055 * Math.sin(3 * a + s) + 0.035 * Math.sin(5 * a + s * 2.3) + 0.03 * Math.sin(2 * a + s * 0.7))
}
export const islandDist = (c: Cell, x: number, y: number) => Math.hypot(x - c.cx, y - c.cy) - shapeR(c, Math.atan2(y - c.cy, x - c.cx))

/** A soft shadow sprite, drawn under every poster. */
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

/** A soft glow in an island's light, drawn behind a lifted poster (cached per color). */
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

export type Engine = ReturnType<typeof makeEngine>

export function makeEngine(glc: HTMLCanvasElement, c2: HTMLCanvasElement, cfg: Config6, hooks: { current: Hooks }) {
	const g = c2.getContext("2d") as CanvasRenderingContext2D
	const atlas = makeAtlas()
	let sea: Sea | null = null
	try {
		sea = makeSea(glc, atlas)
	} catch {
		sea = null
	}
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
	/** Which way the last free zoom (trackpad, pinch) went: 1 in, -1 out. */
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
	const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	const surfaces = new Map<string, Promise<{ tile: HTMLCanvasElement; avg: RGB } | null>>()
	const frames: number[] = []
	let prevCam = { x: 0, y: 0, s: 0 }
	let fontsOk = false
	document.fonts?.load(`800 24px ${FONT}`).then(() => {
		fontsOk = true
		dirty = true
	})
	/** Poster width (CSS px) at which a title is close enough to open. */
	const ACT = () => (small() ? 92 : 118)
	/** Poster width at which a poster starts to show. */
	const SHOW = () => (small() ? 14 : 16)
	/** Poster width past which a poster dissolves, so diving deeper passes through it to its children. */
	const BIG = () => Math.max(small() ? 300 : 440, Math.min(W, H) * 0.62)

	const offImg = onImage(() => {
		dirty = true
	})

	// ------------------------------------------------------------ islands

	const branch = BRANCH[cfg.arr]
	function build(c: Cell, look: Look, n: number): Isl {
		const n1 = firstCount(c.count)
		const r = c.r ?? 100
		const rt = roots(cfg.arr, branch, n1, c.cx, c.cy + 0.02 * r, 0.8 * r)
		const isl: Isl = {
			cell: c,
			id: c.id,
			name: look.name,
			count: c.count,
			fit: c.fit,
			color: look.color,
			tint: luminous(hexRgb(look.color)),
			logo: look.logo,
			slot: n < COLS * COLS ? n : -1,
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
		}
		fallback(isl)
		return isl
	}
	function fallback(isl: Isl) {
		const items = isl.cell.items.filter(hooks.current.pass).slice(0, isl.n1)
		isl.items = items
		isl.par = items.map(() => -1)
		isl.gen = items.map(() => 1)
		isl.pos = place(cfg.arr, isl.roots, isl.w1, isl.par, isl.gen)
	}
	function setTree(id: string, t: TreeRes) {
		const isl = islands.find((x) => x.id === id)
		if (!isl || !t.items.length || isl.loaded) return
		isl.items = t.items
		isl.par = t.par
		isl.gen = t.gen
		isl.pos = place(cfg.arr, isl.roots, isl.w1, t.par, t.gen)
		isl.loaded = true
		dirty = true
	}
	function paintSurfaces(key: string) {
		const todo = islands.filter((i) => i.slot >= 0)
		let k = 0
		const next = (): Promise<void> => {
			const isl = todo[k++]
			if (!isl) return Promise.resolve()
			const sk = `${cfg.surface}|${key}|${isl.id}`
			let p = surfaces.get(sk)
			if (!p) {
				p = paintSurface(isl.cell.items, cfg.surface, isl.color).catch(() => null)
				surfaces.set(sk, p)
			}
			return p.then((res) => {
				if (res && islands.includes(isl)) {
					const r = slotRect(isl.slot)
					sea?.tile(res.tile, r.x, r.y)
					isl.tint = luminous(mixRgb(res.avg, hexRgb(isl.color), 0.45))
					dirty = true
				}
				return next()
			})
		}
		void next()
		void next()
		void next()
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
	/** The camera that frames an island's first posters and their rings (centered in the free area). */
	const ext = extent(cfg.arr, branch)
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
	/** Readable levels near an island: whole map, whole island, then each ring at the size where it can open. */
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
	function islandAt(sx: number, sy: number, reach = 0.25): Isl | null {
		const p = toWorld(sx, sy)
		let best: Isl | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const isl of islands) {
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

	// ------------------------------------------------------------ camera

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
		// The world point that sits at the same screen spot in both cameras stays put all the way.
		const fx = (tgt.x * tgt.s - cur.x * cur.s) / (tgt.s - cur.s)
		const fy = (tgt.y * tgt.s - cur.y * cur.s) / (tgt.s - cur.s)
		const ns = Math.exp(l0 + (l1 - l0) * k)
		cur.x = fx - ((fx - cur.x) * cur.s) / ns
		cur.y = fy - ((fy - cur.y) * cur.s) / ns
		cur.s = ns
	}
	/** Zoom to scale s keeping the screen point (sx, sy) over the same spot of the map. */
	function zoomAt(s: number, sx: number, sy: number) {
		flight = null
		const a = toWorld(sx, sy, cur)
		tgt.s = clamp(s, fitS * 0.8, maxS)
		tgt.x = a.x - (sx - W / 2) / tgt.s
		tgt.y = a.y - (sy - H / 2) / tgt.s
		clampTgt()
		wake()
	}
	/**
	 * Zoom in to s at the pointer, but never into open water: when no poster that is readable at s would sit under
	 * or right next to the pointer, the nearest one is drawn in under it instead. So a wheel notch always lands on a
	 * title, however the pointer sat between posters.
	 */
	function zoomInAt(s: number, sx: number, sy: number) {
		s = clamp(s, fitS * 0.8, maxS)
		const a = toWorld(sx, sy, cur)
		const minW = ACT() * 0.92
		const big = BIG()
		let best = -1
		let bIsl: Isl | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const isl of islands) {
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
		// Put the nearest readable poster under the pointer, kept inside the free area.
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
		const t = { ...to }
		const ts = tgt
		ts.x = t.x
		ts.y = t.y
		ts.s = t.s
		clampTgt()
		flight = { from: { ...cur }, to: { ...tgt }, t0: performance.now(), ms: reduce ? 1 : (ms ?? 700 + 260 * Math.min(1.5, hop)), hop }
		wake()
	}
	function stepFlight(now: number) {
		const f = flight as Flight
		const t = clamp((now - f.t0) / f.ms, 0, 1)
		const e = ease(t)
		const ls = Math.log(f.from.s) + (Math.log(f.to.s) - Math.log(f.from.s)) * e - f.hop * Math.sin(Math.PI * e)
		// Move in screen terms: the path covers the same share of the way at every zoom.
		const u = f.hop > 0 ? e : e
		cur.x = f.from.x + (f.to.x - f.from.x) * u
		cur.y = f.from.y + (f.to.y - f.from.y) * u
		cur.s = Math.exp(ls)
		if (t >= 1) {
			cur.x = f.to.x
			cur.y = f.to.y
			cur.s = f.to.s
			flight = null
		}
	}

	/** Spring to the nearest readable level once zooming stops, and (focus) glide to center the nearest poster. */
	function settle() {
		if (!snapPt || drag || pts.size) return
		const pt = snapPt
		snapPt = null
		const isl = islandAt(pt.x, pt.y, 0.3) ?? focusIsland()
		const st = stopsOf(isl)
		const l = Math.log(tgt.s)
		// Spring toward the level the gesture was heading for, unless it barely left the last one.
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
		if (cfg.activation === "focus") magnet()
	}
	function magnet() {
		const c = hooks.current.center()
		const d = nearest(c.x, c.y, ACT() * 0.7, 1e9)
		if (!d) return
		const k = tgt.s / cur.s
		const s = Math.max(tgt.s, (ACT() * 1.08) / (d.isl.pos.w[d.i] || 1))
		const wx = d.isl.pos.x[d.i]
		const wy = d.isl.pos.y[d.i]
		void k
		glideTo({ x: wx - (c.x - W / 2) / s, y: wy - (c.y - H / 2) / s, s })
	}

	// ------------------------------------------------------------ public camera moves

	function stepZoom(dir: 1 | -1, sx: number, sy: number) {
		const isl = islandAt(sx, sy, 0.3) ?? (dir > 0 ? islandAt(sx, sy, 1.2) : focusIsland())
		const st = stopsOf(isl)
		const base = flight ? flight.to.s : tgt.s
		let next: number | null = null
		if (dir > 0) next = st.find((s) => s > base * 1.12) ?? null
		else next = [...st].reverse().find((s) => s < base / 1.12) ?? null
		if (next == null) next = dir > 0 ? base * 1.7 : base / 1.7
		// From the whole map into an island: frame the island rather than whatever is under the pointer.
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
	let drag: { x: number; y: number; t: number; moved: number; id: number } | null = null
	let pinch: { d: number; cx: number; cy: number } | null = null
	let lastMove = { x: 0, y: 0, t: 0 }
	let press: ReturnType<typeof setTimeout> | null = null
	let pressed = false
	let pointer: { x: number; y: number; mouse: boolean; t: number } | null = null
	let lastTap = { t: 0, x: 0, y: 0 }
	let trackpadUntil = 0
	const local = (e: { clientX: number; clientY: number }) => {
		const r = c2.getBoundingClientRect()
		return { x: e.clientX - r.left, y: e.clientY - r.top }
	}

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
		if (cfg.activation === "focus") {
			snapPt = p
			snapAt = now + 380
		}
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
			drag = { x: p.x, y: p.y, t: performance.now(), moved: 0, id: e.pointerId }
			lastMove = { x: p.x, y: p.y, t: performance.now() }
			pressed = false
			if (e.pointerType !== "mouse") {
				const d = hitPoster(p.x, p.y)
				if (d && press == null)
					press = setTimeout(() => {
						press = null
						if (drag && drag.moved < 8) {
							pressed = true
							hooks.current.onLongPress(d)
						}
					}, 380)
			}
		} else if (pts.size === 2) {
			if (press) clearTimeout(press)
			press = null
			drag = null
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
		}
		if (!pts.has(e.pointerId)) {
			// Hover.
			if (e.pointerType === "mouse") {
				const d = hitPoster(p.x, p.y)
				const k = d ? d.it.k : null
				const hi = d ? null : islandAt(p.x, p.y, 0.05)
				if (k !== hoverKey || hi !== hoverIsl) {
					hoverKey = k
					hoverIsl = hi
					c2.style.cursor = d || hi ? "pointer" : "grab"
					hooks.current.onHover(d)
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
		if (pinch) {
			if (pts.size < 2) pinch = null
			if (pts.size === 1) {
				const [id, q] = [...pts.entries()][0]
				drag = { x: q.x, y: q.y, t: performance.now(), moved: 99, id }
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
			// Double tap / double click: one level in.
			if (now - lastTap.t < 300 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
				lastTap = { t: 0, x: 0, y: 0 }
				stepZoom(1, p.x, p.y)
				return
			}
			lastTap = { t: now, x: p.x, y: p.y }
			const d = hitPoster(p.x, p.y)
			if (d) return hooks.current.onTapPoster(d)
			const isl = islandAt(p.x, p.y, 0.04)
			const st = isl ? stopsOf(isl) : []
			if (isl && cur.s < st[1] * 0.8) return hooks.current.onTapIsland(isl)
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
			hooks.current.onHover(null)
			dirty = true
		}
		hooks.current.onPointer()
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
				if (Math.abs(vel.x) <= 8 && Math.abs(vel.y) <= 8) {
					vel = { x: 0, y: 0 }
					if (cfg.activation === "focus") {
						snapPt = hooks.current.center()
						snapAt = now
					}
				}
			} else if (!drag && !pinch) clampTgt()
			approach(dt)
			if (snapPt && now >= snapAt) settle()
		}
		const moved = cur.x !== prevCam.x || cur.y !== prevCam.y || cur.s !== prevCam.s
		prevCam = { ...cur }
		// Emphasis: the island in the middle (or under the pointer) glows a little more.
		const fi = hoverIsl ?? (cur.s > fitS * 1.4 ? focusIsland() : null)
		let emphMoving = false
		for (const isl of islands) {
			const want = isl === fi ? 1 : 0
			const ne = isl.emph + (want - isl.emph) * (1 - Math.exp(-dt * 8))
			if (Math.abs(ne - isl.emph) > 0.002) emphMoving = true
			isl.emph = Math.abs(want - ne) < 0.003 ? want : ne
		}
		const s0 = stopsOf(focusIsland())
		const deep = smooth(s0[1] ?? fitS * 3, (s0[2] ?? fitS * 6) * 1.1, cur.s)
		if (sea)
			sea.draw({
				w: W,
				h: H,
				dpr: gdpr,
				cam: cur,
				fit: fitS,
				time: reduce ? 0 : (now - t0) / 1000,
				deep,
				style: cfg.surface,
				islands: islands.map(
					(isl): SeaIsland => ({
						x: isl.cell.cx,
						y: isl.cell.cy,
						r: isl.cell.r ?? 100,
						seed: isl.cell.seed ?? 0,
						c: isl.tint,
						e: isl.emph,
						uv: isl.slot >= 0 ? slotUv(isl.slot) : null,
					}),
				),
			})
		if (moved || dirty || emphMoving) {
			dirty = false
			draw2d()
			for (const fn of listeners) fn()
			hooks.current.onFrame()
		}
		const busy = !!flight || moved || emphMoving || !!snapPt || Math.abs(vel.x) > 0 || Math.abs(vel.y) > 0
		// wake() may already have asked for the next frame during this one; never ask twice (that doubles every frame).
		if (!raf && (!reduce || busy || dirty)) raf = requestAnimationFrame(frame)
	}

	// ------------------------------------------------------------ 2D: posters and names

	function draw2d() {
		g.setTransform(dpr, 0, 0, dpr, 0, 0)
		g.clearRect(0, 0, W, H)
		if (!sea) drawFallbackGround()
		const out: Drawn[] = []
		const act = hooks.current.active()
		const show = SHOW()
		for (const isl of islands) {
			const r = isl.cell.r ?? 100
			isl.sx = W / 2 + (isl.cell.cx - cur.x) * cur.s
			isl.sy = H / 2 + (isl.cell.cy - cur.y) * cur.s
			isl.sr = r * cur.s
			isl.on = isl.sx + isl.sr * 1.15 > 0 && isl.sx - isl.sr * 1.15 < W && isl.sy + isl.sr * 1.15 > 0 && isl.sy - isl.sr * 1.15 < H
			if (!isl.on) continue
			const st1 = islandCam(isl).s
			if (cur.s > st1 * 0.45 && !isl.loaded) hooks.current.needTree(isl)
			if (isl.w1 * cur.s < show * 0.9) continue
			for (let i = 0; i < isl.items.length && out.length < MAX; i++) {
				const w = isl.pos.w[i] * cur.s
				if (w < show * 0.9) {
					if (isl.gen[i] > 1) break
					continue
				}
				const it = isl.items[i]
				if (!hooks.current.pass(it)) continue
				const h = w * 1.5
				const cx = W / 2 + (isl.pos.x[i] - cur.x) * cur.s
				const cy = H / 2 + (isl.pos.y[i] - cur.y) * cur.s
				if (cx + w < -20 || cx - w > W + 20 || cy + h < -20 || cy - h > H + 20) continue
				const big = BIG()
				if (w > big && !(act && act.k === it.k && w < big * 1.6)) continue
				const fade = act && act.k === it.k ? 1 : 1 - smooth(big * 0.72, big, w)
				out.push({ isl, i, it, gen: isl.gen[i], x: cx - w / 2, y: cy - h / 2, w, h, cx, cy, a: smooth(show * 0.9, show * 2, w) * fade })
			}
		}
		drawn = out
		// Parents over children; the active and hovered posters last.
		const order = [...out].sort((a, b) => b.gen - a.gen)
		const lift = (d: Drawn) => (act && d.it.k === act.k ? 2 : d.it.k === hoverKey ? 1 : 0)
		order.sort((a, b) => lift(a) - lift(b))
		const dimOthers = act?.pinned ? 0.55 : 1
		if (act?.pinned && cfg.activation === "pin") spotlight(act.k, out)
		for (const d of order) drawPoster(d, lift(d), act && lift(d) < 2 ? dimOthers : 1)
		if (act) thread(act.k)
		drawNames()
	}

	function drawPoster(d: Drawn, lift: number, dim: number) {
		const k = lift === 2 ? 1.06 : lift === 1 ? 1.035 : 1
		const w = d.w * k
		const h = d.h * k
		const x = d.cx - w / 2
		const y = d.cy - h / 2
		const a = d.a * dim
		if (a <= 0.01) return
		g.globalAlpha = a * (0.55 + lift * 0.15)
		g.drawImage(shadow, x - w * 0.35, y - h * 0.2 + w * 0.08, w * 1.7, h * 1.36)
		g.globalAlpha = a
		const rr = Math.max(2, w * 0.05)
		if (lift) {
			// A glow in the island's light behind the lifted poster.
			// (A prerendered sprite: canvas shadowBlur on a big poster costs tens of milliseconds a frame.)
			g.globalAlpha = a * (lift === 2 ? 1 : 0.65)
			g.drawImage(glowSprite(d.isl.tint), x - w * 0.5, y - h * 0.34, w * 2, h * 1.68)
			g.globalAlpha = a
		}
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
				g.fillText(d.it.t.length > 22 ? `${d.it.t.slice(0, 20)}…` : d.it.t, d.cx, d.cy, w * 0.86)
			}
		}
		// A sheen from the top and a fine edge, so posters read as printed cards in the light.
		if (w > 36) {
			const gr = g.createLinearGradient(x, y, x, y + h * 0.5)
			gr.addColorStop(0, "rgba(255,255,255,.10)")
			gr.addColorStop(1, "rgba(255,255,255,0)")
			g.fillStyle = gr
			g.fillRect(x, y, w, h * 0.5)
		}
		g.restore()
		if (lift === 2 && cfg.activation === "focus") reticle(d, x, y, w, h)
		g.lineWidth = lift === 2 ? 2 : 1
		g.strokeStyle = lift === 2 ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.14)"
		g.beginPath()
		g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, rr)
		g.stroke()
		g.globalAlpha = 1
	}

	/** The focus ring: corner brackets of light around the poster in focus, breathing slowly. */
	function reticle(d: Drawn, x: number, y: number, w: number, h: number) {
		const t = (performance.now() - t0) / 1000
		const o = 7 + (reduce ? 0 : Math.sin(t * 2.4) * 2)
		const L = Math.min(w, h) * 0.18
		const x0 = x - o
		const y0 = y - o
		const x1 = x + w + o
		const y1 = y + h + o
		g.save()
		g.lineCap = "round"
		g.beginPath()
		for (const [cx, cy, sx, sy] of [
			[x0, y0, 1, 1],
			[x1, y0, -1, 1],
			[x1, y1, -1, -1],
			[x0, y1, 1, -1],
		]) {
			g.moveTo(cx + sx * L, cy)
			g.lineTo(cx, cy)
			g.lineTo(cx, cy + sy * L)
		}
		g.strokeStyle = rgbCss(d.isl.tint, 0.35)
		g.lineWidth = 9
		g.stroke()
		g.strokeStyle = rgbCss(d.isl.tint, 0.6)
		g.lineWidth = 5
		g.stroke()
		g.strokeStyle = "rgba(255,255,255,.95)"
		g.lineWidth = 2.5
		g.stroke()
		g.restore()
		dirty = true
	}

	/** Pin: the night falls around the pinned poster, a pool of its island's light stays under it. */
	let spot = 0
	let spotK: string | null = null
	function spotlight(k: string, out: Drawn[]) {
		const d = out.find((x) => x.it.k === k)
		if (!d) return
		if (spotK !== k) {
			spotK = k
			spot = 0
		}
		spot = Math.min(1, spot + 0.08)
		if (spot < 1) dirty = true
		const e = spot * spot * (3 - 2 * spot)
		const r0 = d.h * 0.7
		const r1 = Math.max(W, H) * 0.75
		const gr = g.createRadialGradient(d.cx, d.cy, r0, d.cx, d.cy, r1)
		gr.addColorStop(0, "rgba(2,4,10,0)")
		gr.addColorStop(0.18, `rgba(2,4,10,${0.45 * e})`)
		gr.addColorStop(1, `rgba(2,4,10,${0.78 * e})`)
		g.fillStyle = gr
		g.fillRect(0, 0, W, H)
		const pool = g.createRadialGradient(d.cx, d.cy + d.h * 0.1, 0, d.cx, d.cy + d.h * 0.1, d.h * 1.1)
		pool.addColorStop(0, rgbCss(d.isl.tint, 0.32 * e))
		pool.addColorStop(1, rgbCss(d.isl.tint, 0))
		g.fillStyle = pool
		g.fillRect(d.cx - d.h * 1.2, d.cy - d.h * 1.1, d.h * 2.4, d.h * 2.4)
	}

	/** A thread of light from the active poster to its card. */
	function thread(k: string) {
		const d = drawn.find((x) => x.it.k === k)
		const r = hooks.current.card()
		if (!d || !r) return
		const b = c2.getBoundingClientRect()
		const rx = r.left - b.left
		const ry = r.top - b.top
		// Poster edge facing the card, card edge facing the poster.
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

	function drawNames() {
		if (!fontsOk) return
		const ph = small()
		// Nearest the middle first; a signpost that would sit on one already drawn is left out.
		const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
		const byNear = islands.filter((i) => i.on).sort((a, b) => Math.hypot(a.sx - W / 2, a.sy - H / 2) - Math.hypot(b.sx - W / 2, b.sy - H / 2))
		for (const isl of byNear) {
			const st1 = islandCam(isl).s
			const a = 1 - smooth(Math.max(fitS * 1.3, st1 * 0.42), st1 * 0.8, cur.s)
			if (a <= 0.01) continue
			// Zoomed in, the neighbors' names shrink to quiet signposts.
			const z = smooth(fitS * 1.25, fitS * 2.2, cur.s)
			let size = clamp(isl.sr * (ph ? 0.2 : 0.22), ph ? 12 : 15, ph ? 22 : 40) * (1 - z) + (ph ? 13 : 15) * z
			const pd = hooks.current.pad()
			// Long names on small islands get a smaller size, never a squeeze.
			g.font = `800 ${size}px ${FONT}`
			const room = Math.max(isl.sr * (ph ? 1.8 : 2.1), ph ? 72 : 120)
			// A long name on a small island breaks into two lines before it gets smaller.
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
			if (isl.sr > (ph ? 34 : 46) && z < 0.5) {
				y += sub * 1.55
				g.font = `500 ${sub}px ${FONT}`
				;(g as unknown as { letterSpacing: string }).letterSpacing = "0px"
				g.fillStyle = "rgba(235,240,255,.72)"
				g.fillText(`${isl.count.toLocaleString("en")} titles, ${isl.fit}% your taste`, lx, y, isl.sr * 1.8)
			}
			g.restore()
		}
	}

	function drawFallbackGround() {
		g.fillStyle = "#070b16"
		g.fillRect(0, 0, W, H)
		for (const isl of islands) {
			const r = (isl.cell.r ?? 100) * cur.s
			const x = W / 2 + (isl.cell.cx - cur.x) * cur.s
			const y = H / 2 + (isl.cell.cy - cur.y) * cur.s
			const gr = g.createRadialGradient(x, y, 0, x, y, r * 1.3)
			gr.addColorStop(0, rgbCss(isl.tint, 0.45))
			gr.addColorStop(0.75, rgbCss(isl.tint, 0.25))
			gr.addColorStop(1, rgbCss(isl.tint, 0))
			g.fillStyle = gr
			g.beginPath()
			g.arc(x, y, r * 1.3, 0, Math.PI * 2)
			g.fill()
		}
	}

	// ------------------------------------------------------------ queries

	/** The readable poster nearest a screen point, within reach px of its edge. */
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
	/** The poster next to d in a direction, for the arrow keys: any island, on screen or not, of a similar size. */
	function neighbor(d: { isl: Isl; i: number }, dx: number, dy: number) {
		const x0 = d.isl.pos.x[d.i]
		const y0 = d.isl.pos.y[d.i]
		const w0 = d.isl.pos.w[d.i]
		let best: { isl: Isl; i: number; it: W } | null = null
		let bv = Number.POSITIVE_INFINITY
		for (const isl of islands)
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
	/** Camera that shows poster i of an island at width px, centered on the given screen point. */
	function posterCam(isl: Isl, i: number, px: number, at = hooks.current.center()): Cam {
		const s = clamp(px / (isl.pos.w[i] || 1), fitS, maxS)
		return { x: isl.pos.x[i] - (at.x - W / 2) / s, y: isl.pos.y[i] - (at.y - H / 2) / s, s }
	}

	const onResize = () => resize()
	const ro = new ResizeObserver(onResize)
	ro.observe(c2)
	resize()

	const api = {
		setWorld(next: World, looks: (c: Cell) => Look, key: string) {
			const first = !world
			world = next
			islands = next.cells.map((c, n) => build(c, looks(c), n))
			hoverKey = null
			hoverIsl = null
			computeScales()
			const h = homeCam()
			if (first) {
				Object.assign(cur, h)
				Object.assign(tgt, h)
			} else flyTo(h, 600)
			paintSurfaces(key)
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
		island: (id: string) => islands.find((x) => x.id === id) ?? null,
		drawn: () => drawn,
		find: (k: string) => drawn.find((d) => d.it.k === k) ?? null,
		nearest,
		neighbor,
		act: ACT,
		pointer: () => pointer,
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
		/** Keep a poster in view (pinned card with the map moving): nudge only if it left the free area. */
		panBy(dx: number, dy: number) {
			flight = null
			tgt.x += dx / tgt.s
			tgt.y += dy / tgt.s
			clampTgt()
			wake()
		},
		flyTo,
		islandCam,
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
			sea?.destroy()
			c2.removeEventListener("wheel", onWheel)
			c2.removeEventListener("pointerdown", onDown)
			c2.removeEventListener("pointermove", onMove)
			c2.removeEventListener("pointerup", onUp)
			c2.removeEventListener("pointercancel", onUp)
			c2.removeEventListener("pointerleave", onLeave)
		},
		hasGL: () => !!sea,
	}
	return api
}

export const SLOT_SIZE = SLOT
