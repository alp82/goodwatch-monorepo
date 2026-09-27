// PROTOTYPE - throwaway. The round-9 map engine (#180): round 8's engine (map8.ts: camera, lens, `lit` posters, the
// ground in WebGL2, WebGL1 or Canvas 2D, bridges, lighting, pulling and pushing islands) on a focus layout:
//   placement  every island has a place and a size it springs toward (lx, ly, f); what you're interested in decides
//              them. Normally that's where the map put it, at its own size. A lit island grows a little and the rest
//              shrink a little. A bridge rises between the islands it joins (their midpoint, or the middle of three),
//              grows into the main thing on screen, the islands it joins are drawn in against its shore, and every
//              other island shrinks and moves aside. The places come from a small relaxation solved once per change
//              (circles that push each other apart, kept inside the map, the others pulled toward home); the islands
//              then spring there, and a light pass each frame keeps shores apart while they move;
//   styling    focus drives saturation, brightness and level of detail: islands in focus are vivid and their first
//              posters show at a readable size right away (growing into the room their smaller posters will take;
//              those appear once zooming in has caught up); the rest go grey, dim, and simplify to their color and
//              name.
// Undoing (letting go, separating) is the same thing in reverse: everything springs back to the normal map.
import type { Cell, World } from "~/ui/prototype-rec-explorer-4/geo"
import {
	type Placed,
	extent,
	place,
	roots,
} from "~/ui/prototype-rec-explorer-5/fractal"
import {
	COLS,
	hexRgb,
	image,
	luminous,
	makeAtlas,
	mixRgb,
	onImage,
	paintSurface,
	poster,
	rgbCss,
} from "~/ui/prototype-rec-explorer-6/surface6"
import {
	BRANCH,
	type BlendRes,
	type Config8,
	type GlLevel,
	type TreeRes,
	type W,
	firstCount,
} from "~/ui/prototype-rec-explorer-8/wire8"
import { type Ground, type SeaFrame, type SeaIsland9, makeGround } from "./sea9"

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
	/** Lit (selected) for combining, animated 0..1. */
	pick: number
	/** Pushed out of place (gather), in world units; springs back when let go. */
	dx: number
	dy: number
	/** Held up to push (gather): it shrinks a little, as if lifted (animated 0..1). */
	hold: number
	/** Where the focus layout puts it: offset from its place on the map (world units) and scale, as drawn now... */
	lx: number
	ly: number
	f: number
	/** ...their velocities (springs)... */
	vx: number
	vy: number
	vf: number
	/** ...and where they're headed. */
	tx: number
	ty: number
	tf: number
	/** How far its first posters may grow (times w1) before they'd touch each other or the shore. */
	boost: number
	/** Out of focus: grey, dim, color and name only (animated 0..1). */
	mute: number
	/** In focus: vivid, posters readable from far out (animated 0..1). */
	vivid: number
	tMute: number
	tVivid: number
	/** Its part in the focus layout: bridge, joined, lit, other (out of focus), or none (no focus). */
	role: "B" | "J" | "L" | "O" | "N"
	/** Center and radius in world units as drawn this frame (for the minimap). */
	wx: number
	wy: number
	wr: number
	/** A bridge: the islands it joins (two or three); grow rises 0..1 as it forms and sinks back to 0 when let go. */
	bridge: {
		of: string[]
		kind: BlendRes["kind"]
		grow: number
		to: 0 | 1
	} | null
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
	/** The active title, and the island it's on (a title can be on a bridge and on an island it joins). */
	active: () => { k: string; pinned: boolean; isl?: string } | null
	card: () => DOMRect | null
	onTapPoster: (d: Drawn) => void
	onTapIsland: (isl: Isl) => void
	onDoubleTapIsland: (isl: Isl) => void
	onTapWater: () => void
	onLongPress: (d: Drawn) => void
	needTree: (isl: Isl) => void
	onFrame: () => void
	onPointer: () => void
	/** Combine these islands (a pull or a push landed). */
	onCombine: (list: Isl[]) => void
	/** A pull or push in progress: from which island, over which (null, null when it ends). */
	onReach: (from: Isl | null, over: Isl | null) => void
	/** The mouse is over an island at island level (or left it). */
	onHoverIsland: (isl: Isl | null) => void
	/** What two islands would share, if known (for the count at the end of a pull). */
	pairOf: (a: string, b: string) => { c: number; kind: BlendRes["kind"] } | null
}

/** A bridge that isn't there yet: a band of light from an island toward another, and where its label goes. */
export type Ghost = {
	key: string
	from: string
	to: string
	/** Draw the outline of the bridge island where it would rise. */
	island: boolean
	/** 0..1, how present it is (hovered ones brighter). */
	hot: number
}
export type GhostAt = {
	key: string
	x: number
	y: number
	on: boolean
	edge: boolean
}

export type Look = {
	id: string
	name: string
	color: string
	logo: string | null
}

type Cam = { x: number; y: number; s: number }
type Flight = { from: Cam; to: Cam; t0: number; ms: number; hop: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const isA = (d: Drawn, a: { k: string; isl?: string }) =>
	d.it.k === a.k && (!a.isl || a.isl === d.isl.id)
const smooth = (a: number, b: number, v: number) => {
	const t = clamp((v - a) / (b - a), 0, 1)
	return t * t * (3 - 2 * t)
}
const ease = (t: number) =>
	t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
const backOut = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2
const toHex = (c: RGB) =>
	`#${c
		.map((v) =>
			Math.round(clamp(v, 0, 1) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`

function shapeR(c: { r?: number; seed?: number }, a: number) {
	const r = c.r ?? 100
	const s = c.seed ?? 0
	return (
		r *
		(1 +
			0.055 * Math.sin(3 * a + s) +
			0.035 * Math.sin(5 * a + s * 2.3) +
			0.03 * Math.sin(2 * a + s * 0.7))
	)
}
export const islandDist = (c: Cell, x: number, y: number) =>
	Math.hypot(x - c.cx, y - c.cy) - shapeR(c, Math.atan2(y - c.cy, x - c.cx))

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
			avgCanvas = c.getContext("2d", {
				willReadFrequently: true,
			}) as CanvasRenderingContext2D
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

/** How far `lit` shrinks far-away posters. */
const FAR = 0.74

export type Engine = ReturnType<typeof makeEngine>

export function makeEngine(
	glc: HTMLCanvasElement,
	c2: HTMLCanvasElement,
	cfg: Config8,
	gl: GlLevel | null,
	hooks: { current: Hooks },
) {
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
	const reduce =
		typeof window !== "undefined" &&
		!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	const surfaces = new Map<
		string,
		Promise<{ tile: HTMLCanvasElement; avg: RGB } | null>
	>()
	const frames: number[] = []
	let prevCam = { x: 0, y: 0, s: 0 }
	let fontsOk = false
	let picks = new Set<string>()
	let ghosts: (Ghost & { a: number; want: number })[] = []
	/** A line under an island's name in place of its size (the preview variant's shared counts). */
	let notes = new Map<string, string>()
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
			const d = drawn.find((x) => isA(x, a))
			if (d) return { x: d.cx, y: d.cy }
		}
		if (pointer?.mouse && !small()) return { x: pointer.x, y: pointer.y }
		return hooks.current.center()
	}
	function stepLens(dt: number) {
		const t = lensTarget()
		const R = small()
			? Math.min(W, H) * 0.55
			: clamp(Math.min(W, H) * 0.5, 260, 520)
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
		if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3 && Math.abs(dr) < 0.3)
			return false
		lens.x += dx * k
		lens.y += dy * k
		lens.r += dr * k
		return true
	}
	const closeness = (cx: number, cy: number) =>
		1 -
		smooth(lens.r * 0.28, lens.r * 1.25, Math.hypot(cx - lens.x, cy - lens.y))

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
			pos: {
				x: new Float32Array(0),
				y: new Float32Array(0),
				w: new Float32Array(0),
			},
			loaded: false,
			sx: 0,
			sy: 0,
			sr: 0,
			on: false,
			emph: 0,
			pick: 0,
			dx: 0,
			dy: 0,
			hold: 0,
			lx: 0,
			ly: 0,
			f: 1,
			vx: 0,
			vy: 0,
			vf: 0,
			tx: 0,
			ty: 0,
			tf: 1,
			mute: 0,
			vivid: 0,
			tMute: 0,
			tVivid: 0,
			boost: 1,
			role: "N",
			wx: c.cx,
			wy: c.cy,
			wr: c.r ?? 100,
			bridge: null,
		}
		fallback(isl)
		isl.boost = boostOf(isl)
		return isl
	}
	/**
	 * How far an island's first posters may grow into the room around them (the room their smaller posters take once
	 * you zoom in): until two would touch, or one would reach the shore.
	 */
	function boostOf(isl: Isl) {
		const pts = isl.roots
		const w = isl.w1
		if (!pts.length || w <= 0) return 1
		const R = (isl.cell.r ?? 100) * 0.8
		let lim = Number.POSITIVE_INFINITY
		for (let a = 0; a < pts.length; a++)
			for (let b = a + 1; b < pts.length; b++) {
				const dx = Math.abs(pts[a].x - pts[b].x)
				const dy = Math.abs(pts[a].y - pts[b].y)
				lim = Math.min(lim, Math.max(dx / 1.1, dy / (1.5 * 1.1)))
			}
		for (const p of pts) {
			// The poster's far corner on the circle: (a + k/2)^2 + (b + 3k/4)^2 = R^2.
			const a = Math.abs(p.x - isl.cell.cx)
			const b = Math.abs(p.y - isl.cell.cy)
			const A = 0.8125
			const B = a + 1.5 * b
			const C = a * a + b * b - R * R
			const disc = B * B - 4 * A * C
			if (disc > 0) lim = Math.min(lim, (-B + Math.sqrt(disc)) / (2 * A))
		}
		return clamp(lim / w, 1, 6)
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
			p = paintSurface(
				isl.bridge ? isl.items : isl.cell.items,
				"backdrop",
				isl.color,
			).catch(() => null)
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

	// ------------------------------------------------------------ geometry as drawn (the focus layout moves and scales)

	/** How big it's drawn: its focus scale, a bridge's rise, and the little shrink of an island held up to push. */
	const V = (isl: Isl) => isl.f * growOf(isl) * (1 - 0.16 * isl.hold)
	const cX = (isl: Isl) => isl.cell.cx + isl.lx + isl.dx
	const cY = (isl: Isl) => isl.cell.cy + isl.ly + isl.dy
	/** A poster's center and width in world units, as drawn. */
	const PX = (isl: Isl, i: number) =>
		cX(isl) + (isl.pos.x[i] - isl.cell.cx) * V(isl)
	const PY = (isl: Isl, i: number) =>
		cY(isl) + (isl.pos.y[i] - isl.cell.cy) * V(isl)
	const PW = (isl: Isl, i: number) => isl.pos.w[i] * V(isl)
	/** How far (x, y) is from the island's shore, in its own radii (negative inside). */
	const distN = (isl: Isl, x: number, y: number) => {
		const s = Math.max(V(isl), 1e-3)
		return (
			islandDist(
				isl.cell,
				isl.cell.cx + (x - cX(isl)) / s,
				isl.cell.cy + (y - cY(isl)) / s,
			) / (isl.cell.r ?? 100)
		)
	}

	// ------------------------------------------------------------ bridges

	const bridgeOf = () =>
		islands.find((i) => i.bridge && i.bridge.to === 1) ?? null
	/** Where a bridge of these islands would rise: between them, as they sit now. */
	function seedOf(list: Isl[]) {
		return {
			x: list.reduce((a, o) => a + cX(o), 0) / list.length,
			y: list.reduce((a, o) => a + cY(o), 0) / list.length,
		}
	}
	function addBridge(list: Isl[], res: BlendRes, name: string) {
		for (const i of islands) if (i.bridge) i.bridge.to = 0
		const at = seedOf(list)
		// Its own radius; the focus layout scales it up to the main thing on screen.
		const r = Math.max(52, Math.min(...list.map((o) => o.cell.r ?? 100)) * 0.62)
		let mix = hexRgb(list[0].color)
		list.slice(1).forEach((o, n) => {
			mix = mixRgb(mix, hexRgb(o.color), 1 / (n + 2))
		})
		const color = toHex(mix)
		const ms = res.items.map((x) => x.m).sort((a, b) => a - b)
		const fit = ms[Math.floor(ms.length / 2)] ?? 60
		const id = list.map((i) => i.id).join("+")
		const cell: Cell = {
			id,
			region: {
				id,
				name,
				color,
				count: res.count,
				fit,
				bands: [0, 0, 0],
				x: 0,
				y: 0,
				line: "",
				items: res.items.slice(0, 12),
			},
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
			seed: list.reduce(
				(a, o, n) => a + (o.cell.seed ?? 0) * (1 - n * 0.3),
				1.3,
			),
		}
		const used = new Set(
			islands
				.filter((i) => !(i.bridge && i.bridge.to === 0 && i.bridge.grow < 0.05))
				.map((i) => i.slot),
		)
		let slot = -1
		for (let s = COLS * COLS - 1; s >= 0; s--)
			if (!used.has(s)) {
				slot = s
				break
			}
		const isl = build(cell, { id, name, color, logo: null }, slot)
		let tint = list[0].tint
		list.slice(1).forEach((o, n) => {
			tint = mixRgb(tint, o.tint, 1 / (n + 2))
		})
		isl.tint = luminous(tint)
		isl.bridge = { of: list.map((i) => i.id), kind: res.kind, grow: 0, to: 1 }
		isl.n1 = res.gen.filter((x) => x === 1).length || 1
		const rt = roots(ARR, branch, isl.n1, at.x, at.y + 0.02 * r, 0.8 * r)
		isl.w1 = rt.w
		isl.roots = rt.pts
		isl.items = res.items
		isl.par = res.par
		isl.gen = res.gen
		isl.pos = place(ARR, isl.roots, isl.w1, res.par, res.gen)
		isl.loaded = true
		isl.boost = boostOf(isl)
		// It starts at the size of the islands it joins and grows from there.
		isl.f = 1
		islands.push(isl)
		void paintOne(isl)
		computeScales()
		relayout()
		// Out at the map, framing the new layout: the bridge is the main thing on screen.
		flyTo(homeCam(), reduce ? 1 : 950)
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
		if (any) {
			relayout()
			wake()
		}
		return any
	}

	// ------------------------------------------------------------ the focus layout

	/** Bounding box of the focus layout's targets (world units), when it isn't the normal map. */
	let layoutBox: { x0: number; y0: number; x1: number; y1: number } | null =
		null
	let layoutKey = ""
	/**
	 * Where every island goes, and how big, for what's in focus now (the bridge, the islands it joins, lit islands).
	 * Circles in world units: the bridge sits still, the islands it joins keep to its shore, the rest are pulled
	 * toward their own place; all push each other apart and stay inside the map.
	 */
	function relayout(force = false) {
		if (!world) return
		const br = bridgeOf()
		const lit = islands.filter((i) => !i.bridge && picks.has(i.id))
		const key = `${br?.id ?? ""}|${lit.map((i) => i.id).join(",")}`
		if (key === layoutKey && !force) return
		layoutKey = key
		const WW = world.w
		const HH = world.h
		const S = Math.min(WW, HH)
		const m = S * 0.02
		const gap = S * 0.022
		const joined = new Set(br?.bridge?.of ?? [])
		type Body = {
			isl: Isl
			x: number
			y: number
			hx: number
			hy: number
			r: number
			w: number
			home: number
			phantom?: boolean
		}
		const bodies: Body[] = []
		let B: Body | null = null
		const rB = br ? S * (joined.size > 2 ? 0.3 : 0.33) : 0
		// The bridge's name goes above it: how tall it'll be (world units), from the size it'll be drawn at.
		const ph = small()
		const fontPx = clamp(
			rB * fitS * (ph ? 0.2 : 0.22),
			ph ? 12 : 15,
			ph ? 22 : 40,
		)
		const headB = br
			? (fontPx * ((br.name.length > 18 ? 2 : 1) * 1.02 + 0.8) + 14) / fitS
			: 0
		for (const isl of islands) {
			if (isl.bridge && isl.bridge.to === 0) continue
			const r0 = isl.cell.r ?? 100
			let role: Isl["role"] = "N"
			if (isl === br) role = "B"
			else if (joined.has(isl.id)) role = "J"
			else if (lit.includes(isl)) role = "L"
			else if (br || lit.length) role = "O"
			isl.role = role
			let tf = 1
			let mute = 0
			let vivid = 0
			if (role === "B") {
				tf = rB / r0
				vivid = 1
			} else if (role === "J") {
				// Medium: big islands come down, small ones come up, next to a bridge that stays the biggest.
				tf = clamp(r0, rB * 0.42, rB * 0.62) / r0
				vivid = 1
			} else if (role === "L") {
				tf = br ? Math.min(0.95, (rB * 0.6) / r0) : 1.14
				vivid = br ? 0.8 : 1
			} else if (role === "O") {
				tf = br ? 0.5 : 0.93
				mute = br ? 1 : 0.2
			}
			isl.tf = tf
			isl.tMute = mute
			isl.tVivid = vivid
			const b: Body = {
				isl,
				x: isl.cell.cx,
				y: isl.cell.cy,
				hx: isl.cell.cx,
				hy: isl.cell.cy,
				r: r0 * tf * 1.08,
				// Heavier ones move less when two push each other.
				w: role === "B" ? 1e9 : role === "J" || role === "L" ? 4 : 1,
				home: role === "O" ? 0.05 : role === "L" && br ? 0.03 : 0,
			}
			if (role === "B") {
				// Between the islands it joins, kept whole inside the map.
				// Between the islands it joins, a little toward the middle of the map (they're drawn in after it), so
				// it's the main thing on screen wherever they are.
				const at = {
					x: isl.cell.cx + (WW / 2 - isl.cell.cx) * 0.35,
					y: isl.cell.cy + (HH / 2 - isl.cell.cy) * 0.35,
				}
				// Room above it for its name.
				b.x = clamp(at.x, b.r + m, WW - b.r - m)
				b.y = clamp(at.y, b.r + m + Math.min(headB, S * 0.14), HH - b.r - m)
				if (WW < 2 * (b.r + m)) b.x = WW / 2
				if (HH < 2 * (b.r + m)) b.y = HH / 2
				B = b
			}
			// A lit island (no bridge) stays where it is, unless its name would have no room above it.
			if (role === "L" && !br) {
				b.w = 1e6
				b.y = Math.max(b.y, Math.min(HH / 2, b.r + m + S * 0.075))
			}
			bodies.push(b)
		}
		const Bb = B as Body | null
		const dJ = (b: Body) => (Bb ? Bb.r + b.r + gap * 1.6 : 0)
		// Start: the islands a bridge joins against its shore, facing where they were; the rest out of its way.
		if (Bb)
			for (const b of bodies) {
				if (b === Bb) continue
				let vx = b.x - Bb.x
				let vy = b.y - Bb.y
				let d = Math.hypot(vx, vy)
				if (d < 1e-3) {
					vx = 1
					vy = 0
					d = 1
				}
				if (b.isl.role === "J") {
					b.x = Bb.x + (vx / d) * dJ(b)
					b.y = Bb.y + (vy / d) * dJ(b)
				} else if (d < Bb.r + b.r + gap) {
					b.x = Bb.x + (vx / d) * (Bb.r + b.r + gap)
					b.y = Bb.y + (vy / d) * (Bb.r + b.r + gap)
				}
			}
		// Its name is kept clear: fixed circles along the top of its shore, where the name goes.
		if (Bb)
			for (const f of [-0.6, -0.2, 0.2, 0.6]) {
				const r = headB * 0.55
				const y = Bb.y - Bb.r - r
				bodies.push({
					isl: Bb.isl,
					x: Bb.x + f * Bb.r,
					y,
					hx: 0,
					hy: 0,
					r,
					w: 1e9,
					home: 0,
					phantom: true,
				})
			}
		const sep = () => {
			for (let i = 0; i < bodies.length; i++)
				for (let j = i + 1; j < bodies.length; j++) {
					const a = bodies[i]
					const c = bodies[j]
					// Two fixed ones (the bridge and the room for its name) never move.
					if (a.w >= 1e9 && c.w >= 1e9) continue
					const want = a.r + c.r + gap
					let vx = c.x - a.x
					let vy = c.y - a.y
					let d = Math.hypot(vx, vy)
					if (d >= want) continue
					if (d < 1e-3) {
						vx = Math.cos(i * 2.4 + j)
						vy = Math.sin(i * 2.4 + j)
						d = 1
					}
					const o = want - d
					// The room for the bridge's name pushes out from the bridge's middle, as the bridge does, so
					// nothing gets caught between the two.
					if ((a.phantom || c.phantom) && Bb) {
						const q = a.phantom ? c : a
						const p = a.phantom ? a : c
						const ux = q.x - Bb.x
						const uy = q.y - Bb.y
						const ul = Math.hypot(ux, uy) || 1
						if (q.isl.role === "J") {
							// An island the bridge joins slides around its shore, away from the name.
							let tx = -uy / ul
							let ty = ux / ul
							if ((q.x - p.x) * tx + (q.y - p.y) * ty < 0) {
								tx = -tx
								ty = -ty
							}
							q.x += tx * o
							q.y += ty * o
						} else {
							q.x += (ux / ul) * o
							q.y += (uy / ul) * o
						}
						continue
					}
					const wa = c.w / (a.w + c.w)
					const wc = a.w / (a.w + c.w)
					a.x -= (vx / d) * o * wa
					a.y -= (vy / d) * o * wa
					c.x += (vx / d) * o * wc
					c.y += (vy / d) * o * wc
				}
		}
		const hug = () => {
			if (!Bb) return
			for (const b of bodies) {
				if (b.isl.role !== "J") continue
				const vx = b.x - Bb.x
				const vy = b.y - Bb.y
				const d = Math.hypot(vx, vy) || 1
				b.x = Bb.x + (vx / d) * dJ(b)
				b.y = Bb.y + (vy / d) * dJ(b)
			}
		}
		if (bodies.some((b) => b.isl.role !== "N")) {
			for (let it = 0; it < 260; it++) {
				for (const b of bodies)
					if (b.home) {
						b.x += (b.hx - b.x) * b.home
						b.y += (b.hy - b.y) * b.home
					}
				hug()
				sep()
				for (const b of bodies) {
					if (b.w >= 1e9) continue
					// Islands in focus wear their names above them: room for that at the top.
					const head = b.isl.role === "J" || b.isl.role === "L" ? S * 0.075 : 0
					b.x = WW > 2 * (b.r + m) ? clamp(b.x, b.r + m, WW - b.r - m) : WW / 2
					b.y =
						HH > 2 * (b.r + m) + head
							? clamp(b.y, b.r + m + head, HH - b.r - m)
							: HH / 2
				}
			}
			// Whatever the map's edges couldn't hold: no overlaps, even if a little spills over (the camera frames it).
			for (let it = 0; it < 80; it++) {
				hug()
				sep()
			}
		}
		let box = { x0: 0, y0: 0, x1: WW, y1: HH }
		for (const b of bodies) {
			if (b.phantom) continue
			b.isl.tx = b.x - b.isl.cell.cx
			b.isl.ty = b.y - b.isl.cell.cy
			const rr = b.r * 1.04
			box = {
				x0: Math.min(box.x0, b.x - rr),
				y0: Math.min(box.y0, b.y - rr),
				x1: Math.max(box.x1, b.x + rr),
				y1: Math.max(box.y1, b.y + rr),
			}
		}
		layoutBox = br || lit.length ? box : null
		wake()
	}

	// ------------------------------------------------------------ scales and stops

	function computeScales() {
		if (!world) return
		const p = hooks.current.pad()
		fitS = Math.min((W - p.l - p.r) / world.w, (H - p.t - p.b) / world.h) * 0.96
		const minW = Math.min(...islands.map((x) => x.w1).filter((w) => w > 0), 1e9)
		maxS = Math.max(fitS * 6, (ACT() * 2.4) / (minW / 8))
	}
	/** The whole map; with a focus layout that spills over the map's edges, all of it. */
	const homeCam = (): Cam => {
		const p = hooks.current.pad()
		const w = world as World
		const b = layoutBox ?? { x0: 0, y0: 0, x1: w.w, y1: w.h }
		const s =
			b.x1 - b.x0 > w.w + 1 || b.y1 - b.y0 > w.h + 1
				? Math.min(
						(W - p.l - p.r) / (b.x1 - b.x0),
						(H - p.t - p.b) / (b.y1 - b.y0),
					) * 0.96
				: fitS
		return {
			x: (b.x0 + b.x1) / 2 - (p.l - p.r) / 2 / s,
			y: (b.y0 + b.y1) / 2 - (p.t - p.b) / 2 / s,
			s,
		}
	}
	const ext = extent(ARR, branch)
	/** Framing an island's titles, where the focus layout is taking it (a camera flight and the springs end together). */
	function islandCam(isl: Isl): Cam {
		const p = hooks.current.pad()
		const fw = W - p.l - p.r
		const fh = H - p.t - p.b
		let x0 = Number.POSITIVE_INFINITY
		let x1 = Number.NEGATIVE_INFINITY
		let y0 = Number.POSITIVE_INFINITY
		let y1 = Number.NEGATIVE_INFINITY
		const k = isl.tf
		const ox = isl.cell.cx + isl.tx
		const oy = isl.cell.cy + isl.ty
		for (const r of isl.roots) {
			const rx = ox + (r.x - isl.cell.cx) * k
			const ry = oy + (r.y - isl.cell.cy) * k
			x0 = Math.min(x0, rx - ext.hw * isl.w1 * k)
			x1 = Math.max(x1, rx + ext.hw * isl.w1 * k)
			y0 = Math.min(y0, ry - ext.hh * isl.w1 * k)
			y1 = Math.max(y1, ry + ext.hh * isl.w1 * k)
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
			for (let gen = 1; gen <= deepest; gen++)
				out.push((ACT() * 1.08) / (isl.w1 * isl.tf * 0.5 ** (gen - 1)))
		}
		const clean: number[] = []
		for (const s of out.sort((a, b) => a - b))
			if (!clean.length || s > clean[clean.length - 1] * 1.3)
				clean.push(Math.min(s, maxS))
		return clean
	}
	const toWorld = (sx: number, sy: number, c: Cam = cur) => ({
		x: c.x + (sx - W / 2) / c.s,
		y: c.y + (sy - H / 2) / c.s,
	})
	const toScreen = (x: number, y: number) => ({
		x: W / 2 + (x - cur.x) * cur.s,
		y: H / 2 + (y - cur.y) * cur.s,
	})
	const scr = (q: { x: number; y: number }) => toScreen(q.x, q.y)
	const live = () => islands.filter((i) => !i.bridge || i.bridge.to === 1)
	function islandAt(
		sx: number,
		sy: number,
		reach = 0.25,
		not?: Isl | null,
	): Isl | null {
		const p = toWorld(sx, sy)
		let best: Isl | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const isl of live()) {
			if (isl === not) continue
			// Small islands (out of focus) get a little more reach, so they're still easy to hit.
			const d = distN(isl, p.x, p.y) * Math.min(1, V(isl) * 1.4)
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
			if (
				Math.abs(tgt.x - cur.x) * cur.s < 0.05 &&
				Math.abs(tgt.y - cur.y) * cur.s < 0.05
			) {
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
	function zoomInAt(want: number, sx: number, sy: number) {
		const s = clamp(want, fitS * 0.8, maxS)
		const a = toWorld(sx, sy, cur)
		const minW = ACT() * 0.92
		const big = BIG()
		let best = -1
		let bIsl: Isl | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const isl of live()) {
			if (distN(isl, a.x, a.y) > 0.6) continue
			for (let i = 0; i < isl.items.length; i++) {
				const w = PW(isl, i) * s
				if (w < minW || w > big || !hooks.current.pass(isl.items[i])) continue
				const dx = Math.max(0, Math.abs(a.x - PX(isl, i)) - PW(isl, i) / 2) * s
				const dy =
					Math.max(0, Math.abs(a.y - PY(isl, i)) - PW(isl, i) * 0.75) * s
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
		const pw = PW(bIsl, best) * s
		const px = clamp(sx, p.l + pw * 0.6, W - p.r - pw * 0.6)
		const py = clamp(sy, p.t + pw * 0.8, H - p.b - pw * 0.8)
		flight = null
		tgt.s = s
		tgt.x = PX(bIsl, best) - (px - W / 2) / s
		tgt.y = PY(bIsl, best) - (py - H / 2) / s
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
		const hop =
			Math.max(0, Math.log(Math.min(cur.s, to.s)) - Math.log(sHop)) * 0.9
		tgt.x = to.x
		tgt.y = to.y
		tgt.s = to.s
		clampTgt()
		flight = {
			from: { ...cur },
			to: { ...tgt },
			t0: performance.now(),
			ms: reduce ? 1 : (ms ?? 700 + 260 * Math.min(1.5, hop)),
			hop,
		}
		wake()
	}
	function stepFlight(now: number) {
		const f = flight as Flight
		const t = clamp((now - f.t0) / f.ms, 0, 1)
		const e = ease(t)
		const ls =
			Math.log(f.from.s) +
			(Math.log(f.to.s) - Math.log(f.from.s)) * e -
			f.hop * Math.sin(Math.PI * e)
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
		for (const s of st)
			if (Math.abs(Math.log(s) - l) < Math.abs(Math.log(best) - l)) best = s
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
		if (
			Math.abs(Math.log(best) - l) < reach &&
			Math.abs(Math.log(best) - l) > 0.004
		) {
			if (st.length > 2 && best >= st[2] * 0.98 && best >= tgt.s)
				zoomInAt(best, pt.x, pt.y)
			else zoomAt(best, pt.x, pt.y)
		}
	}
	function stepZoom(dir: 1 | -1, sx: number, sy: number) {
		const isl =
			islandAt(sx, sy, 0.3) ?? (dir > 0 ? islandAt(sx, sy, 1.2) : focusIsland())
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
		if (dir > 0 && st.length > 2 && next >= st[2] * 0.98)
			return zoomInAt(next, sx, sy)
		zoomAt(next, sx, sy)
	}

	// ------------------------------------------------------------ input

	const pts = new Map<number, { x: number; y: number; type: string }>()
	let drag: {
		x: number
		y: number
		t: number
		moved: number
		id: number
		grab: Isl | null
	} | null = null
	let pinch: { d: number; cx: number; cy: number } | null = null
	let lastMove = { x: 0, y: 0, t: 0 }
	let press: ReturnType<typeof setTimeout> | null = null
	let pressed = false
	let pointer: { x: number; y: number; mouse: boolean; t: number } | null = null
	let lastTap = { t: 0, x: 0, y: 0 }
	let trackpadUntil = 0
	/**
	 * A pull (stretch: a band of light from an island to the pointer) or a push (gather: the island itself follows
	 * the pointer) in progress; over is the island it would combine with.
	 */
	let reach: {
		mode: "pull" | "push"
		src: Isl
		x: number
		y: number
		x0: number
		y0: number
		over: Isl | null
		pid: number
	} | null = null
	/** A band let go without landing, pulling back into its island (0..1 over its retreat). */
	let band: { src: Isl; x: number; y: number; t0: number } | null = null
	/** Two fingers, each on an island, pinching them together (gather). */
	let pair: {
		a: { isl: Isl; pid: number; x0: number; y0: number }
		b: { isl: Isl; pid: number; x0: number; y0: number }
		over: boolean
	} | null = null
	/** Two fingers just landed on two islands; which way they move decides between gathering and zooming. */
	let pendPair: { a: Isl; pa: number; b: Isl; pb: number; d0: number } | null =
		null
	const local = (e: { clientX: number; clientY: number }) => {
		const r = c2.getBoundingClientRect()
		return { x: e.clientX - r.left, y: e.clientY - r.top }
	}
	/** Zoomed out far enough that a tap on an island means the island, not the posters on it. */
	const islandLevel = (isl: Isl) => cur.s < stopsOf(isl)[1] * 0.8
	const grabbable = (isl: Isl | null): isl is Isl =>
		!!isl &&
		!isl.bridge &&
		(cfg.gesture === "stretch" || cfg.gesture === "gather") &&
		islandLevel(isl)
	const rOf = (isl: Isl) => (isl.cell.r ?? 100) * V(isl)

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
			if (d.a > 0.5 && x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h)
				return d
		}
		return null
	}
	/** The island a pushed island overlaps most (its shore well into the other's), if any. */
	function pushedInto(src: Isl) {
		let best: Isl | null = null
		let bv = 0
		for (const o of live()) {
			if (o === src || o.bridge) continue
			const d = Math.hypot(cX(src) - cX(o), cY(src) - cY(o))
			// Shores touching is enough: pushing deep into another island isn't needed.
			const v = (rOf(src) + rOf(o)) * 1.02 - d
			// ...but it has to have moved toward it (neighbors that already touch don't count until then).
			const rest = Math.hypot(
				cX(src) - src.dx - cX(o) + o.dx,
				cY(src) - src.dy - cY(o) + o.dy,
			)
			if (v > bv && d < rest * 0.85) {
				bv = v
				best = o
			}
		}
		return best
	}
	function endReach(landed: boolean) {
		const r = reach
		if (!r) return
		reach = null
		if (r.mode === "pull" && !landed)
			band = { src: r.src, x: r.x, y: r.y, t0: performance.now() }
		c2.style.cursor = "grab"
		hooks.current.onReach(null, null)
		if (landed && r.over) hooks.current.onCombine([r.src, r.over])
		wake()
	}
	function onDown(e: PointerEvent) {
		c2.setPointerCapture?.(e.pointerId)
		const p = local(e)
		pts.set(e.pointerId, { ...p, type: e.pointerType })
		flight = null
		vel = { x: 0, y: 0 }
		if (pts.size === 1) {
			const d = hitPoster(p.x, p.y)
			const isl = d ? null : islandAt(p.x, p.y, 0.04)
			drag = {
				x: p.x,
				y: p.y,
				t: performance.now(),
				moved: 0,
				id: e.pointerId,
				grab: grabbable(isl) ? isl : null,
			}
			lastMove = { x: p.x, y: p.y, t: performance.now() }
			pressed = false
			if (d && e.pointerType !== "mouse" && press == null)
				press = setTimeout(() => {
					press = null
					if (drag && drag.moved < 8) {
						pressed = true
						hooks.current.onLongPress(d)
					}
				}, 380)
		} else if (pts.size === 2) {
			if (press) clearTimeout(press)
			press = null
			const first = drag
			const firstIsl = first?.grab ?? null
			drag = null
			// Two fingers on two islands (gather): if they close in, they pinch the islands together; if they open, zoom.
			const isl = islandAt(p.x, p.y, 0.04, firstIsl)
			if (
				cfg.gesture === "gather" &&
				firstIsl &&
				grabbable(isl) &&
				isl !== firstIsl &&
				first
			) {
				const q = pts.get(first.id) ?? { x: first.x, y: first.y }
				if (reach) {
					reach.src.dx = 0
					reach.src.dy = 0
					reach = null
					hooks.current.onReach(null, null)
				}
				pendPair = {
					a: firstIsl,
					pa: first.id,
					b: isl,
					pb: e.pointerId,
					d0: Math.hypot(q.x - p.x, q.y - p.y),
				}
			}
			if (reach) endReach(false)
			const [a, b] = [...pts.values()]
			pinch = {
				d: Math.hypot(a.x - b.x, a.y - b.y),
				cx: (a.x + b.x) / 2,
				cy: (a.y + b.y) / 2,
			}
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
		if (pair) {
			if (!pts.has(e.pointerId)) return
			pts.set(e.pointerId, { ...p, type: e.pointerType })
			for (const s of [pair.a, pair.b])
				if (s.pid === e.pointerId) {
					s.isl.dx = (p.x - s.x0) / cur.s
					s.isl.dy = (p.y - s.y0) / cur.s
				}
			const A = pair.a.isl
			const B = pair.b.isl
			const d = Math.hypot(cX(A) - cX(B), cY(A) - cY(B))
			// Fingers are blunt: close enough (shores nearly touching, or brought well together) counts.
			const rest = Math.hypot(
				cX(A) - A.dx - cX(B) + B.dx,
				cY(A) - A.dy - cY(B) + B.dy,
			)
			const over = d < (rOf(A) + rOf(B)) * 1.12 || d < rest * 0.55
			if (over !== pair.over) {
				pair.over = over
				hooks.current.onReach(A, over ? B : null)
			}
			wake()
			return
		}
		if (reach && e.pointerId === reach.pid) {
			reach.x = p.x
			reach.y = p.y
			let over: Isl | null
			if (reach.mode === "push") {
				const S = reach.src
				S.dx = (p.x - reach.x0) / cur.s
				S.dy = (p.y - reach.y0) / cur.s
				// The island under the pointer, if any (what you aim at is what you get); else the one it's pushed into.
				const under = islandAt(p.x, p.y, 0.2, S)
				over = under && !under.bridge ? under : pushedInto(S)
				if (over && over === under) {
					// It docks against the other island's shore rather than sinking into it.
					const vx = cX(S) - cX(over)
					const vy = cY(S) - cY(over)
					const d = Math.hypot(vx, vy) || 1
					const want = (rOf(S) + rOf(over)) * 0.96
					if (d < want) {
						S.dx = cX(over) + (vx / d) * want - S.cell.cx - S.lx
						S.dy = cY(over) + (vy / d) * want - S.cell.cy - S.ly
					}
				}
			} else {
				over = islandAt(p.x, p.y, 0.15, reach.src)
				if (over?.bridge) over = null
			}
			if (over !== reach.over) {
				reach.over = over
				hooks.current.onReach(reach.src, over)
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
					if (hi !== hoverIsl)
						hooks.current.onHoverIsland(hi && islandLevel(hi) ? hi : null)
					hoverKey = k
					hoverIsl = hi
					c2.style.cursor = d
						? "pointer"
						: hi
							? grabbable(hi)
								? "grab"
								: "pointer"
							: "grab"
					dirty = true
				}
			}
			return
		}
		const prev = pts.get(e.pointerId) as { x: number; y: number; type: string }
		pts.set(e.pointerId, { ...p, type: e.pointerType })
		if (pts.size >= 2 && pinch && pendPair) {
			const P = pendPair
			const qa = pts.get(P.pa)
			const qb = pts.get(P.pb)
			if (qa && qb) {
				const d = Math.hypot(qa.x - qb.x, qa.y - qb.y)
				if (P.d0 - d > 10) {
					pendPair = null
					pinch = null
					pair = {
						a: { isl: P.a, pid: P.pa, x0: qa.x, y0: qa.y },
						b: { isl: P.b, pid: P.pb, x0: qb.x, y0: qb.y },
						over: false,
					}
					hooks.current.onReach(P.a, null)
					wake()
					return
				}
				if (d - P.d0 <= 10) return
			}
			pendPair = null
			const [a, b] = [...pts.values()]
			pinch = {
				d: Math.hypot(a.x - b.x, a.y - b.y),
				cx: (a.x + b.x) / 2,
				cy: (a.y + b.y) / 2,
			}
		}
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
			// Pulling from (or pushing) an island rather than panning.
			if (drag.grab && drag.moved > 6 && islandLevel(drag.grab)) {
				const src = drag.grab
				reach = {
					mode: cfg.gesture === "gather" ? "push" : "pull",
					src,
					x: p.x,
					y: p.y,
					x0: drag.x,
					y0: drag.y,
					over: null,
					pid: drag.id,
				}
				band = null
				c2.style.cursor = "grabbing"
				hooks.current.onReach(src, null)
				if (reach.mode === "push") {
					src.dx = (p.x - drag.x) / cur.s
					src.dy = (p.y - drag.y) / cur.s
				}
				wake()
				return
			}
			if (drag.moved > 4) {
				c2.style.cursor = "grabbing"
				panBy(dx, dy)
				const now = performance.now()
				const dtm = Math.max(1, now - lastMove.t)
				vel = {
					x: vel.x * 0.4 + ((p.x - lastMove.x) / dtm) * 1000 * 0.6,
					y: vel.y * 0.4 + ((p.y - lastMove.y) / dtm) * 1000 * 0.6,
				}
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
		if (pair) {
			const P = pair
			pair = null
			drag = null
			hooks.current.onReach(null, null)
			if (P.over && e.type === "pointerup")
				hooks.current.onCombine([P.a.isl, P.b.isl])
			// The other finger, if it stays down, doesn't pan until it's lifted.
			wake()
			return
		}
		if (reach && e.pointerId === reach.pid) {
			if (reach.mode === "push") {
				reach.x = p.x
				reach.y = p.y
			}
			drag = null
			endReach(e.type === "pointerup" && !!reach.over)
			return
		}
		if (pinch) {
			if (pts.size < 2) {
				pinch = null
				pendPair = null
			}
			if (pts.size === 1) {
				const [id, q] = [...pts.entries()][0]
				drag = {
					x: q.x,
					y: q.y,
					t: performance.now(),
					moved: 99,
					id,
					grab: null,
				}
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
			if (
				now - lastTap.t < 300 &&
				Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30
			) {
				lastTap = { t: 0, x: 0, y: 0 }
				if (isl && !d && islandLevel(isl)) hooks.current.onDoubleTapIsland(isl)
				else stepZoom(1, p.x, p.y)
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
			if (hoverIsl) hooks.current.onHoverIsland(null)
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

	/** Animate lit islands, the focus layout (springs), focus styling, bridges, pushed islands and ghosts; true while anything still moves. */
	function stepIslands(dt: number) {
		let moving = false
		const br = bridgeOf()
		const ks = reduce ? 1 : 1 - Math.exp(-dt * 10)
		const fi = hoverIsl ?? (cur.s > fitS * 1.4 ? focusIsland() : null)
		const held = new Set<Isl>()
		if (reach?.mode === "push") held.add(reach.src)
		if (pair) {
			held.add(pair.a.isl)
			held.add(pair.b.isl)
		}
		const reaching = new Set<Isl>()
		if (reach) {
			reaching.add(reach.src)
			if (reach.over) reaching.add(reach.over)
		}
		if (pair) {
			reaching.add(pair.a.isl)
			if (pair.over) reaching.add(pair.b.isl)
		}
		// Springs: a touch of overshoot, settled in about three quarters of a second.
		const om = 7.5
		const ze = 0.8
		const h = Math.min(dt, 1 / 30)
		for (const isl of islands) {
			const wantE = isl === fi ? 1 : 0
			const joined = !!br && !!br.bridge?.of.includes(isl.id)
			const wantP =
				picks.has(isl.id) || reaching.has(isl) ? 1 : joined ? 0.45 : 0
			// Reaching for an island out of focus brings it back into view while you hold it.
			const wantM = reaching.has(isl) ? 0 : isl.tMute
			for (const [key, want, rate] of [
				["emph", wantE, 8],
				["pick", wantP, 7],
				["mute", wantM, 6],
				["vivid", isl.tVivid, 6],
			] as const) {
				const v = isl[key]
				if (v === want) continue
				const n = reduce ? want : v + (want - v) * (1 - Math.exp(-dt * rate))
				moving = true
				isl[key] = Math.abs(want - n) < 0.003 ? want : n
			}
			const wantH = held.has(isl) ? 1 : 0
			if (isl.hold !== wantH) {
				const n = reduce
					? wantH
					: isl.hold + (wantH - isl.hold) * (1 - Math.exp(-dt * 14))
				isl.hold = Math.abs(n - wantH) < 0.01 ? wantH : n
				moving = true
			}
			// The focus layout: where it's going, and how big.
			if (
				isl.lx !== isl.tx ||
				isl.ly !== isl.ty ||
				isl.f !== isl.tf ||
				isl.vx ||
				isl.vy ||
				isl.vf
			) {
				if (reduce) {
					isl.lx = isl.tx
					isl.ly = isl.ty
					isl.f = isl.tf
					isl.vx = isl.vy = isl.vf = 0
				} else {
					isl.vx += (om * om * (isl.tx - isl.lx) - 2 * ze * om * isl.vx) * h
					isl.vy += (om * om * (isl.ty - isl.ly) - 2 * ze * om * isl.vy) * h
					isl.vf += (om * om * (isl.tf - isl.f) - 2 * ze * om * isl.vf) * h
					isl.lx += isl.vx * h
					isl.ly += isl.vy * h
					isl.f += isl.vf * h
					if (
						Math.abs(isl.tx - isl.lx) * cur.s < 0.2 &&
						Math.abs(isl.ty - isl.ly) * cur.s < 0.2 &&
						Math.abs(isl.vx) * cur.s < 2 &&
						Math.abs(isl.vy) * cur.s < 2 &&
						Math.abs(isl.tf - isl.f) < 0.002 &&
						Math.abs(isl.vf) < 0.01
					) {
						isl.lx = isl.tx
						isl.ly = isl.ty
						isl.f = isl.tf
						isl.vx = isl.vy = isl.vf = 0
					}
				}
				moving = true
			}
			if (!held.has(isl)) {
				// Out of the way of an island being pushed (except the one it docks against); otherwise back to its place.
				let tx = 0
				let ty = 0
				if (held.size && !isl.bridge && !reaching.has(isl))
					for (const hh of held) {
						const vx = cX(isl) - isl.dx - cX(hh)
						const vy = cY(isl) - isl.dy - cY(hh)
						const d = Math.hypot(vx, vy) || 1
						// Only when it's pushed well past the shore, so the island it's aimed at can still be reached.
						const over = (rOf(hh) + rOf(isl)) * 0.8 - d
						if (over > 0) {
							tx += (vx / d) * over
							ty += (vy / d) * over
						}
					}
				if (isl.dx !== tx || isl.dy !== ty) {
					isl.dx += (tx - isl.dx) * ks
					isl.dy += (ty - isl.dy) * ks
					if (
						Math.abs(isl.dx - tx) * cur.s < 0.3 &&
						Math.abs(isl.dy - ty) * cur.s < 0.3
					) {
						isl.dx = tx
						isl.dy = ty
					}
					moving = true
				}
			}
			if (isl.bridge) {
				const b = isl.bridge
				const speed = b.to ? 1.15 : 3
				const n = reduce
					? b.to
					: clamp(b.grow + (b.to ? 1 : -1) * dt * speed, 0, 1)
				if (n !== b.grow) moving = true
				b.grow = n
			}
		}
		// While they move, shores keep apart (the targets never overlap; this holds for the way there too).
		if (moving && !reduce && !reach && !pair) nudge()
		for (const isl of islands) {
			isl.wx = cX(isl)
			isl.wy = cY(isl)
			isl.wr = (isl.cell.r ?? 100) * V(isl)
		}
		for (const gh of ghosts) {
			const n = reduce
				? gh.want
				: gh.a + (gh.want - gh.a) * (1 - Math.exp(-dt * 9))
			if (Math.abs(n - gh.a) > 0.003) moving = true
			gh.a = Math.abs(gh.want - n) < 0.004 ? gh.want : n
		}
		const gBefore = ghosts.length
		ghosts = ghosts.filter((gh) => gh.want > 0 || gh.a > 0)
		if (ghosts.length !== gBefore) moving = true
		if (band && performance.now() - band.t0 > 320) band = null
		if (band) moving = true
		// A bridge that has sunk is gone.
		const before = islands.length
		islands = islands.filter(
			(i) => !(i.bridge && i.bridge.to === 0 && i.bridge.grow <= 0),
		)
		if (islands.length !== before) moving = true
		return moving
	}
	/** Two islands whose shores meet on the way to their places push apart (the bigger, more focused one moves less). */
	function nudge() {
		const list = islands.filter((i) => !(i.bridge && i.bridge.to === 0))
		const S = world ? Math.min(world.w, world.h) : 1000
		const gap = S * 0.01
		const wOf = (i: Isl) =>
			i.role === "B" ? 1e6 : i.role === "J" || i.role === "L" ? 4 : 1
		for (let a = 0; a < list.length; a++)
			for (let b = a + 1; b < list.length; b++) {
				const A = list[a]
				const B = list[b]
				// Never further apart than where they're headed (neighbors on the normal map may sit closer than this).
				const at = Math.hypot(
					B.cell.cx + B.tx - A.cell.cx - A.tx,
					B.cell.cy + B.ty - A.cell.cy - A.ty,
				)
				const want = Math.min((rOf(A) + rOf(B)) * 1.06 + gap, at * 0.99)
				const vx = cX(B) - cX(A)
				const vy = cY(B) - cY(A)
				const d = Math.hypot(vx, vy)
				if (d >= want || d < 1e-3) continue
				const o = (want - d) * 0.5
				const wa = wOf(B) / (wOf(A) + wOf(B))
				const wb = wOf(A) / (wOf(A) + wOf(B))
				A.lx -= (vx / d) * o * wa
				A.ly -= (vy / d) * o * wa
				B.lx += (vx / d) * o * wb
				B.ly += (vy / d) * o * wb
			}
	}
	const growOf = (isl: Isl) => (isl.bridge ? backOut(isl.bridge.grow) : 1)
	/** 1 out at the map, 0 once you're in among the titles: focus styling is for the map (inside, every island shows). */
	const mapLevel = () => 1 - smooth(fitS * 1.6, fitS * 3.2, cur.s)

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
		const moved =
			cur.x !== prevCam.x || cur.y !== prevCam.y || cur.s !== prevCam.s
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
			spot: spotOf(),
			islands: islands.map((isl): SeaIsland9 => {
				// Out of focus: toward grey and darker, with less light on the water; in focus: a little more of both.
				const m = isl.mute * mapLevel()
				const l = 0.3 * isl.tint[0] + 0.59 * isl.tint[1] + 0.11 * isl.tint[2]
				const k = (1 - 0.5 * m) * (1 + 0.08 * isl.vivid)
				return {
					x: cX(isl),
					y: cY(isl),
					r: (isl.cell.r ?? 100) * V(isl),
					seed: isl.cell.seed ?? 0,
					c: isl.tint.map((v) => (v + (l - v) * 0.75 * m) * k) as RGB,
					e: isl.emph * (1 - m) + 1.05 * isl.pick + 0.2 * isl.vivid - 0.8 * m,
					slot: isl.slot,
					sat: 1 + 0.16 * isl.vivid - 0.88 * m,
				}
			}),
		})
		// A pull in progress shimmers along its band, so it keeps being drawn.
		const ringing = !!reach || !!pair
		if (moved || dirty || islMoving || lensMoving || ringing) {
			dirty = false
			draw2d()
			for (const fn of listeners) fn()
			hooks.current.onFrame()
		}
		const busy =
			!!flight ||
			moved ||
			islMoving ||
			lensMoving ||
			ringing ||
			!!snapPt ||
			Math.abs(vel.x) > 0 ||
			Math.abs(vel.y) > 0
		if (!raf && (ground.animated ? !reduce || busy || dirty : busy || dirty))
			raf = requestAnimationFrame(frame)
	}

	// ------------------------------------------------------------ 2D: posters and names

	function draw2d() {
		g.setTransform(dpr, 0, 0, dpr, 0, 0)
		g.clearRect(0, 0, W, H)
		const out: Drawn[] = []
		const act = hooks.current.active()
		const show = SHOW()
		const far = FAR
		const ml = mapLevel()
		for (const isl of islands) {
			const r = isl.cell.r ?? 100
			const v = V(isl)
			isl.sx = W / 2 + (cX(isl) - cur.x) * cur.s
			isl.sy = H / 2 + (cY(isl) - cur.y) * cur.s
			isl.sr = r * cur.s * v
			isl.on =
				isl.sx + isl.sr * 1.15 > 0 &&
				isl.sx - isl.sr * 1.15 < W &&
				isl.sy + isl.sr * 1.15 > 0 &&
				isl.sy - isl.sr * 1.15 < H
			if (!isl.on) continue
			const st1 = islandCam(isl).s
			if ((cur.s > st1 * 0.45 || isl.vivid > 0.3) && !isl.loaded)
				hooks.current.needTree(isl)
			// Out of focus, out at the map: color and name only.
			const pm = 1 - isl.mute * ml
			if (pm <= 0.01) continue
			// In focus, the first posters show at a readable size from far out, grown into the room of the smaller
			// posters around them; those come in once zooming has caught up with that size.
			const nat1 = isl.w1 * v * cur.s
			const floor1 = isl.boost * isl.w1 * v * fitS * smooth(0, 1, isl.vivid)
			const w1s = Math.max(nat1, floor1)
			const b1 = w1s / Math.max(nat1, 1e-6)
			const kids = floor1 > 0 ? smooth(0.72, 1, nat1 / floor1) : 1
			if (w1s < show * 0.9) continue
			const rise = isl.bridge
				? smooth(0.7, 1, isl.bridge.grow) *
					(isl.bridge.to ? 1 : isl.bridge.grow)
				: 1
			if (rise <= 0.01) continue
			for (let i = 0; i < isl.items.length && out.length < MAX; i++) {
				const g1 = isl.gen[i] === 1
				if (!g1 && kids < 0.01) break
				const rw = PW(isl, i) * cur.s * (g1 ? b1 : 1)
				if (rw < show * 0.9) {
					if (!g1) break
					continue
				}
				const it = isl.items[i]
				if (!hooks.current.pass(it)) continue
				const cx = W / 2 + (PX(isl, i) - cur.x) * cur.s
				const cy = H / 2 + (PY(isl, i) - cur.y) * cur.s
				if (
					cx + rw < -20 ||
					cx - rw > W + 20 ||
					cy + rw * 1.5 < -20 ||
					cy - rw * 1.5 > H + 20
				)
					continue
				const big = BIG()
				const isAct =
					!!act && act.k === it.k && (!act.isl || act.isl === isl.id)
				if (rw > big && !(isAct && rw < big * 1.6)) continue
				const dis = isAct ? 1 : 1 - smooth(big * 0.72, big, rw)
				const t = isAct ? 1 : closeness(cx, cy)
				const k = far + (1 - far) * t
				const w = rw * k
				const h = w * 1.5
				out.push({
					isl,
					i,
					it,
					gen: isl.gen[i],
					x: cx - w / 2,
					y: cy - h / 2,
					w,
					h,
					cx,
					cy,
					a:
						smooth(show * 0.9, show * 2, rw) *
						dis *
						rise *
						pm *
						(g1 ? 1 : kids),
					t,
				})
			}
		}
		drawn = out
		drawGhosts()
		drawCauseways()
		drawBand()
		pool()
		// Far ones first, the ones at the focus on top; the active and hovered posters last.
		const lift2 = (d: Drawn) =>
			act && isA(d, act) ? 2 : d.it.k === hoverKey ? 1 : 0
		const order = [...out].sort(
			(a, b) => lift2(a) - lift2(b) || a.t - b.t || b.gen - a.gen,
		)
		const dimOthers = act?.pinned ? 0.55 : 1
		const budget = { n: 10 }
		for (const d of order) {
			const l = lift2(d)
			const a = d.a * (act && l < 2 ? dimOthers : 1)
			if (a <= 0.01) continue
			drawLit(d, l, a, budget)
		}
		if (act) thread(act)
		drawRings()
		drawNames()
		// Keep loading the next posters' dots' colors.
		if (budget.n <= 0) dirty = true
	}

	/** lit: a warm pool of light on the ground at the focus, the night deepening away from it (only once you're in). */
	function pool() {
		const z = smooth(fitS * 1.3, fitS * 2.4, cur.s)
		if (z <= 0.01) return
		g.save()
		const night = g.createRadialGradient(
			lens.x,
			lens.y,
			lens.r * 0.45,
			lens.x,
			lens.y,
			lens.r * 1.9,
		)
		night.addColorStop(0, "rgba(2,4,10,0)")
		night.addColorStop(1, `rgba(2,4,10,${0.5 * z})`)
		g.fillStyle = night
		g.fillRect(0, 0, W, H)
		g.globalCompositeOperation = "lighter"
		const warm = g.createRadialGradient(
			lens.x,
			lens.y,
			0,
			lens.x,
			lens.y,
			lens.r * 1.05,
		)
		warm.addColorStop(0, `rgba(255,236,205,${0.11 * z})`)
		warm.addColorStop(1, "rgba(255,236,205,0)")
		g.fillStyle = warm
		g.fillRect(
			lens.x - lens.r * 1.1,
			lens.y - lens.r * 1.1,
			lens.r * 2.2,
			lens.r * 2.2,
		)
		g.restore()
	}

	/** Out at the map, the night closes in around a bridge, so it's what you see first (the ground draws it). */
	function spotOf(): SeaFrame["spot"] {
		const ml = mapLevel()
		if (ml < 0.01) return null
		const b = islands.find((i) => i.bridge && i.bridge.grow > 0.01)
		if (!b?.bridge) return null
		const k =
			smooth(0, 1, b.bridge.grow) * (b.bridge.to ? 1 : b.bridge.grow) * ml
		return { x: cX(b), y: cY(b), r: (b.cell.r ?? 100) * V(b), k: 0.5 * k }
	}

	/** The poster image (or its title on a dark card while it loads), clipped to a rounded rect. */
	function face(
		d: Drawn,
		x: number,
		y: number,
		w: number,
		h: number,
		rr: number,
	) {
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
				g.fillText(
					d.it.t.length > 22 ? `${d.it.t.slice(0, 20)}…` : d.it.t,
					x + w / 2,
					y + h / 2,
					w * 0.86,
				)
			}
		}
	}
	function glowBehind(
		d: Drawn,
		l: number,
		a: number,
		x: number,
		y: number,
		w: number,
		h: number,
	) {
		if (!l) return
		g.globalAlpha = a * (l === 2 ? 1 : 0.65)
		g.drawImage(
			glowSprite(d.isl.tint),
			x - w * 0.5,
			y - h * 0.34,
			w * 2,
			h * 1.68,
		)
		g.globalAlpha = a
	}
	function edge(
		x: number,
		y: number,
		w: number,
		h: number,
		rr: number,
		l: number,
		base: number,
	) {
		g.lineWidth = l === 2 ? 2 : 1
		g.strokeStyle =
			l === 2 ? "rgba(255,255,255,.9)" : `rgba(255,255,255,${base})`
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
		g.drawImage(
			shadow,
			d.cx - w * 0.35 + vx * off,
			d.cy - h / 2 - h * 0.2 + w * 0.06 + vy * off,
			w * 1.7,
			h * 1.36,
		)
		g.globalAlpha = pa
		glowBehind(d, l, pa, d.cx - w / 2, d.cy - h / 2, w, h)
		// A tilt toward the light: none right under it, most at the edge of the pool.
		const tilt = t * smooth(0.04, 0.5, vl) * 0.085
		g.save()
		g.translate(d.cx, d.cy)
		g.transform(
			1 - Math.abs(vx) * tilt * 0.9,
			-vx * vy * tilt * 0.6,
			-vx * tilt * 0.55,
			1 - Math.abs(vy) * tilt * 0.5,
			0,
			0,
		)
		face(d, x, y, w, h, rr)
		if (w > 30) {
			// A sheen on the side facing the light, and the dark of the night on the rest.
			const gr = g.createLinearGradient(
				-vx * w * 0.6,
				-vy * h * 0.6,
				vx * w * 0.6,
				vy * h * 0.6,
			)
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

	/** A thread of light from the active poster to its card (round 6). */
	function thread(a: { k: string; isl?: string }) {
		const d = drawn.find((x) => isA(x, a))
		const r = hooks.current.card()
		if (!d || !r) return
		const b = c2.getBoundingClientRect()
		const rx = r.left - b.left
		const ry = r.top - b.top
		const toRight = rx > d.cx
		const px = toRight ? d.cx + d.w * 0.53 : d.cx - d.w * 0.53
		const py = d.cy
		const inside =
			d.cx > rx - 4 &&
			d.cx < rx + r.width + 4 &&
			d.cy > ry - 4 &&
			d.cy < ry + r.height + 4
		if (inside) return
		const cx = clamp(px, rx, rx + r.width)
		const cy = clamp(py, ry + 24, ry + r.height - 24)
		const ex = cx === rx || cx === rx + r.width ? cx : px
		const ey =
			cx === rx || cx === rx + r.width ? cy : cy < py ? ry + r.height : ry
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

	/** A shore point of island o facing (x, y) in world units, with its push offset. */
	function shore(o: Isl, x: number, y: number, k = 0.985) {
		const a = Math.atan2(y - cY(o), x - cX(o))
		const r = shapeR(o.cell, a) * V(o) * k
		return { x: cX(o) + Math.cos(a) * r, y: cY(o) + Math.sin(a) * r }
	}
	/** A band of light between two screen points: a wide soft glow, a core, and a dotted line of light. */
	function lightBand(
		x0: number,
		y0: number,
		x1: number,
		y1: number,
		c0: RGB,
		c1: RGB,
		wide: number,
		alpha: number,
		dash = true,
		drift = 0,
	) {
		const gr = g.createLinearGradient(x0, y0, x1, y1)
		gr.addColorStop(0, rgbCss(c0, 0.5))
		gr.addColorStop(1, rgbCss(c1, 0.5))
		g.save()
		g.lineCap = "round"
		g.strokeStyle = gr
		g.globalAlpha = alpha * 0.28
		g.lineWidth = wide * 2.2
		g.beginPath()
		g.moveTo(x0, y0)
		g.lineTo(x1, y1)
		g.stroke()
		g.globalAlpha = alpha * 0.75
		g.lineWidth = wide * 0.5
		g.stroke()
		if (dash) {
			g.globalAlpha = alpha
			g.setLineDash([1, Math.max(6, wide * 0.9)])
			g.lineDashOffset = drift
			g.lineWidth = Math.max(1.6, wide * 0.18)
			g.strokeStyle = "rgba(255,255,255,.85)"
			g.stroke()
		}
		g.restore()
	}
	/** A bridge's causeways: a band of light from each island it joins to its shore. */
	function drawCauseways() {
		for (const isl of islands) {
			if (!isl.bridge) continue
			const gw = isl.bridge.grow
			if (gw <= 0.01) continue
			for (const id of isl.bridge.of) {
				const o = islands.find((x) => x.id === id)
				if (!o) continue
				const a = shore(o, cX(isl), cY(isl))
				const b = shore(isl, cX(o), cY(o))
				const A = toScreen(a.x, a.y)
				const B = toScreen(b.x, b.y)
				// It reaches out from the island as the bridge rises.
				const reachK = smooth(0, 0.8, gw)
				const wide = clamp(Math.min(rOf(o), rOf(isl)) * cur.s * 0.16, 3, 26)
				lightBand(
					A.x,
					A.y,
					A.x + (B.x - A.x) * reachK,
					A.y + (B.y - A.y) * reachK,
					o.tint,
					isl.tint,
					wide,
					isl.bridge.to ? 1 : gw,
				)
			}
		}
	}

	/** Lit islands: a bright shoreline just off the shore, and a halo in their own light. */
	function drawRings() {
		for (const isl of islands) {
			if (isl.bridge || isl.pick < 0.02 || !isl.on) continue
			const joined = islands.some(
				(b) => b.bridge?.to === 1 && b.bridge.of.includes(isl.id),
			)
			const k = isl.pick * (joined ? 0.4 : 1)
			if (k < 0.02) continue
			g.save()
			g.beginPath()
			const N = 72
			const grow = V(isl)
			for (let n = 0; n <= N; n++) {
				const a = (n / N) * Math.PI * 2
				const rr = shapeR(isl.cell, a) * cur.s * grow + 5
				const x = isl.sx + Math.cos(a) * rr
				const y = isl.sy + Math.sin(a) * rr
				if (n) g.lineTo(x, y)
				else g.moveTo(x, y)
			}
			g.closePath()
			g.globalAlpha = k
			g.shadowColor = rgbCss(mixRgb(isl.tint, [1, 1, 1], 0.2), 1)
			g.shadowBlur = 22
			g.lineWidth = 3
			g.strokeStyle = rgbCss(mixRgb(isl.tint, [1, 1, 1], 0.55), 1)
			g.stroke()
			g.shadowBlur = 0
			g.lineWidth = 1.4
			g.strokeStyle = "rgba(255,255,255,.95)"
			g.stroke()
			g.restore()
		}
	}

	/** Bridges that aren't there yet: a faint band toward the other island, and the outline of where it would rise. */
	const ghostAt = new Map<string, GhostAt>()
	function drawGhosts() {
		ghostAt.clear()
		const p = hooks.current.pad()
		for (const gh of ghosts) {
			const A = islands.find((x) => x.id === gh.from && !x.bridge)
			const B = islands.find((x) => x.id === gh.to && !x.bridge)
			if (!A || !B || gh.a < 0.01) continue
			const al = gh.a * (0.45 + 0.55 * gh.hot)
			const wide = clamp(Math.min(rOf(A), rOf(B)) * cur.s * 0.12, 3, 18)
			if (gh.island) {
				// Where the bridge would rise, between the two: two bands of light meeting in a seed of light.
				const sp = seedOf([A, B])
				const a = scr(shore(A, sp.x, sp.y))
				const b = scr(shore(B, sp.x, sp.y))
				const c = toScreen(sp.x, sp.y)
				const mid = mixRgb(A.tint, B.tint, 0.5)
				const drift = -((performance.now() - t0) / 40)
				lightBand(a.x, a.y, c.x, c.y, A.tint, mid, wide, al * 0.8, true, drift)
				lightBand(b.x, b.y, c.x, c.y, B.tint, mid, wide, al * 0.8, true, drift)
				const pulse = reduce
					? 1
					: 0.85 + 0.15 * Math.sin((performance.now() - t0) / 260)
				const R = clamp(Math.min(rOf(A), rOf(B)) * cur.s * 0.42, 18, 60) * pulse
				g.save()
				g.globalCompositeOperation = "lighter"
				g.globalAlpha = al
				const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, R)
				gr.addColorStop(0, rgbCss(mixRgb(mid, [1, 1, 1], 0.6), 0.9))
				gr.addColorStop(0.35, rgbCss(mid, 0.45))
				gr.addColorStop(1, rgbCss(mid, 0))
				g.fillStyle = gr
				g.fillRect(c.x - R, c.y - R, 2 * R, 2 * R)
				g.restore()
				ghostAt.set(gh.key, {
					key: gh.key,
					x: c.x,
					y: c.y,
					on: true,
					edge: false,
				})
				continue
			}
			// A band off A's shore toward B; if B is off screen it runs to the edge of the view, where its label waits.
			const bc = toScreen(cX(B), cY(B))
			const box0 = {
				x0: p.l + 70,
				x1: W - p.r - 70,
				y0: p.t + 30,
				y1: H - p.b - 26,
			}
			if (A.sr * 1.6 > Math.min(box0.x1 - box0.x0, box0.y1 - box0.y0)) {
				// Inside A (it fills the view): the label waits at the edge of the view, in B's direction from the middle.
				const cx = (box0.x0 + box0.x1) / 2
				const cy = (box0.y0 + box0.y1) / 2
				const dx = bc.x - cx
				const dy = bc.y - cy
				let t = 1
				if (dx > 0) t = Math.min(t, (box0.x1 - cx) / dx)
				if (dx < 0) t = Math.min(t, (box0.x0 - cx) / dx)
				if (dy > 0) t = Math.min(t, (box0.y1 - cy) / dy)
				if (dy < 0) t = Math.min(t, (box0.y0 - cy) / dy)
				t = clamp(t, 0, 1)
				ghostAt.set(gh.key, {
					key: gh.key,
					x: cx + dx * t,
					y: cy + dy * t,
					on: true,
					edge: true,
				})
				continue
			}
			const a = scr(shore(A, cX(B), cY(B)))
			const b = scr(shore(B, cX(A), cY(A)))
			const box = {
				x0: p.l + 70,
				x1: W - p.r - 70,
				y0: p.t + 30,
				y1: H - p.b - 26,
			}
			const inside = (q: { x: number; y: number }) =>
				q.x > box.x0 && q.x < box.x1 && q.y > box.y0 && q.y < box.y1
			let end = b
			let edge = false
			if (!inside(bc)) {
				// Clip the ray a -> b to the box.
				const dx = b.x - a.x
				const dy = b.y - a.y
				let t = 1
				if (dx > 0) t = Math.min(t, (box.x1 - a.x) / dx)
				if (dx < 0) t = Math.min(t, (box.x0 - a.x) / dx)
				if (dy > 0) t = Math.min(t, (box.y1 - a.y) / dy)
				if (dy < 0) t = Math.min(t, (box.y0 - a.y) / dy)
				t = clamp(t, 0, 1)
				end = { x: a.x + dx * t, y: a.y + dy * t }
				edge = true
			}
			if (Math.hypot(end.x - a.x, end.y - a.y) < 30) {
				// Not enough room for a band (the island fills the view): the label sits at the edge, toward B.
				const d = Math.hypot(bc.x - a.x, bc.y - a.y) || 1
				end = {
					x: clamp(a.x + ((bc.x - a.x) / d) * 60, box.x0, box.x1),
					y: clamp(a.y + ((bc.y - a.y) / d) * 60, box.y0, box.y1),
				}
			} else {
				const fadeTo = mixRgb(B.tint, [1, 1, 1], 0.2)
				lightBand(
					a.x,
					a.y,
					end.x,
					end.y,
					A.tint,
					fadeTo,
					wide,
					al * 0.7,
					true,
					-((performance.now() - t0) / 60),
				)
			}
			const mid = edge ? end : { x: (a.x + end.x) / 2, y: (a.y + end.y) / 2 }
			ghostAt.set(gh.key, { key: gh.key, x: mid.x, y: mid.y, on: true, edge })
		}
	}

	/** A pull in progress: a band of light from the island to the pointer, snapping to the island under it. */
	function drawBand() {
		const now = performance.now()
		let src: Isl | null = null
		let x = 0
		let y = 0
		let al = 1
		let over: Isl | null = null
		if (reach?.mode === "pull") {
			src = reach.src
			x = reach.x
			y = reach.y
			over = reach.over
		} else if (band) {
			// Let go without landing: the band pulls back into its island.
			const t = clamp((now - band.t0) / 320, 0, 1)
			src = band.src
			const s0 = toScreen(cX(src), cY(src))
			x = band.x + (s0.x - band.x) * ease(t)
			y = band.y + (s0.y - band.y) * ease(t)
			al = 1 - t
		}
		// Landed on an island: the ghost of the bridge (Explorer8 shows it) takes over from the band.
		if (!src || over) return
		const wp = toWorld(x, y)
		const a = scr(shore(src, wp.x, wp.y))
		const len = Math.hypot(x - a.x, y - a.y)
		if (len < 4) return
		// Thinner the further it's stretched.
		const wide = clamp(26 - len * 0.04, 6, 20)
		lightBand(
			a.x,
			a.y,
			x,
			y,
			src.tint,
			mixRgb(src.tint, [1, 1, 1], 0.4),
			wide,
			al,
			true,
			-((now - t0) / 25),
		)
		// The loose end: a bead of light under the pointer.
		g.save()
		g.globalAlpha = al * 0.9
		g.drawImage(dotS, x - 18, y - 18, 36, 36)
		g.restore()
	}

	function drawNames() {
		if (!fontsOk) return
		const ph = small()
		const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
		const byNear = islands
			.filter((i) => i.on)
			// Bridges, then lit or held islands, then the ones nearest the middle claim their room first.
			.sort(
				(a, b) =>
					(b.bridge ? 1 : 0) - (a.bridge ? 1 : 0) ||
					(b.pick > 0.5 || b.hold > 0 ? 1 : 0) -
						(a.pick > 0.5 || a.hold > 0 ? 1 : 0) ||
					(b.vivid > 0.5 ? 1 : 0) - (a.vivid > 0.5 ? 1 : 0) ||
					Math.hypot(a.sx - W / 2, a.sy - H / 2) -
						Math.hypot(b.sx - W / 2, b.sy - H / 2),
			)
		for (const isl of byNear) {
			const st1 = islandCam(isl).s
			let a = 1 - smooth(Math.max(fitS * 1.3, st1 * 0.42), st1 * 0.8, cur.s)
			const mm = isl.mute * mapLevel()
			a *= 1 - 0.28 * mm
			if (isl.bridge)
				a *=
					smooth(0.55, 1, isl.bridge.grow) *
					(isl.bridge.to ? 1 : isl.bridge.grow)
			if (a <= 0.01) continue
			const z = smooth(fitS * 1.25, fitS * 2.2, cur.s)
			const sr = isl.sr
			let size =
				clamp(sr * (ph ? 0.2 : 0.22), ph ? 12 : 15, ph ? 22 : 40) * (1 - z) +
				(ph ? 13 : 15) * z
			if (isl.bridge) size = Math.max(size, ph ? 14 : 17)
			const pd = hooks.current.pad()
			g.font = `800 ${size}px ${FONT}`
			const room = Math.max(
				sr * (ph ? 1.8 : 2.1),
				isl.bridge ? 180 : ph ? 72 : 120,
			)
			let lines = [isl.name]
			const words = isl.name.split(" ")
			if (g.measureText(isl.name).width > room && words.length > 1 && z < 0.5) {
				let best = 1
				let bw = Number.POSITIVE_INFINITY
				for (let k = 1; k < words.length; k++) {
					const w = Math.max(
						g.measureText(words.slice(0, k).join(" ")).width,
						g.measureText(words.slice(k).join(" ")).width,
					)
					if (w < bw) {
						bw = w
						best = k
					}
				}
				lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")]
			}
			// An island showing its posters out at the map wears its name above its shore, off the posters, as big as
			// the room above it allows.
			const nat1 = isl.w1 * V(isl) * cur.s
			const floor1 =
				isl.boost * isl.w1 * V(isl) * fitS * smooth(0, 1, isl.vivid)
			const above = z < 0.5 && floor1 > nat1 && floor1 > SHOW() * 1.4
			if (above) {
				const room0 = isl.sy - sr * 1.1 - 8 - pd.t
				const k = lines.length * 1.02 + 0.8
				if (size * k > room0) size = Math.max(ph ? 12 : 15, room0 / k)
			}
			g.font = `800 ${size}px ${FONT}`
			const tw = Math.max(...lines.map((l) => g.measureText(l).width))
			if (tw > room) size = Math.max(ph ? 10 : 11, (size * room) / tw)
			const sub = Math.max(ph ? 9.5 : 11, size * 0.4)
			g.font = `800 ${size}px ${FONT}`
			const half =
				Math.max(...lines.map((l) => g.measureText(l).width)) / 2 + 12
			const lead = size * 1.02
			// The line under the name: size and taste, a bridge's shared count, or the preview's count.
			const note = notes.get(isl.id)
			const n = isl.count.toLocaleString("en")
			const all = isl.bridge && isl.bridge.of.length > 2
			const taste = ph ? "" : `, ${isl.fit}% your taste`
			const subLine = isl.bridge
				? isl.bridge.kind === "both"
					? `${n} ${isl.count === 1 ? "title" : "titles"} in ${all ? "all three" : "both"}${taste}`
					: `${n} titles between ${all ? "the three" : "the two"}${taste}`
				: (note ?? `${n} titles, ${isl.fit}% your taste`)
			g.font = `${note ? 700 : 500} ${note ? sub * 1.08 : sub}px ${FONT}`
			// A bridge's line is wide; keep all of it on screen.
			const room2 = isl.bridge && z < 0.5 ? g.measureText(subLine).width / 2 : 0
			g.font = `800 ${size}px ${FONT}`
			const lx =
				z > 0
					? clamp(isl.sx, pd.l + half, W - Math.max(pd.r, 60) - half)
					: clamp(
							isl.sx,
							Math.max(half, room2) + 6,
							W - Math.max(half, room2) - 6,
						)
			let y =
				z > 0
					? clamp(isl.sy, pd.t + 24, H - 50)
					: isl.sy +
						(isl.logo ? size * 0.5 : 0) -
						((lines.length - 1) * lead) / 2
			// A name pulled far from its island (the island is mostly off screen) says nothing: leave it out.
			if (
				!isl.bridge &&
				Math.hypot(lx - isl.sx, y - isl.sy) > Math.max(sr * 0.75, 40)
			)
				continue
			const withSub =
				(((sr > (ph ? 34 : 46) || isl.bridge) && mm < 0.5) ||
					notes.has(isl.id)) &&
				z < 0.5
			if (above) {
				const below = (lines.length - 1) * lead + (withSub ? sub * 1.55 : 0)
				const top = isl.sy - sr * 1.1 - 8 - sub * 0.4 - below
				y = Math.max(top, pd.t + size)
				if (y > top + 4) y = isl.sy + sr * 1.1 + size + 4
			}
			// As wide as the name or the line under it, whichever is wider.
			g.font = `${note ? 700 : 500} ${note ? sub * 1.08 : sub}px ${FONT}`
			const bh = withSub
				? Math.max(
						half - 6,
						Math.min(
							g.measureText(subLine).width,
							Math.max(sr * 1.8, isl.bridge ? 240 : 0),
						) / 2,
					)
				: half - 6
			g.font = `800 ${size}px ${FONT}`
			const box = {
				x0: lx - bh,
				x1: lx + bh,
				y0: y - size,
				y1:
					y +
					size * 0.3 +
					(lines.length - 1) * lead +
					(withSub ? sub * 1.9 : 0),
			}
			if (
				(z > 0.3 || mm > 0.3) &&
				placed.some(
					(b) =>
						b.x0 < box.x1 && b.x1 > box.x0 && b.y0 < box.y1 && b.y1 > box.y0,
				)
			)
				continue
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
			;(g as unknown as { letterSpacing: string }).letterSpacing =
				`${-size * 0.015}px`
			g.fillStyle =
				mm > 0.01
					? `rgba(${Math.round(255 - 40 * mm)},${Math.round(255 - 34 * mm)},${Math.round(255 - 22 * mm)},1)`
					: "#fff"
			lines.forEach((l, k) => g.fillText(l, lx, y + k * lead))
			y += (lines.length - 1) * lead
			if (withSub) {
				y += sub * 1.55
				g.font = `${note ? 700 : 500} ${note ? sub * 1.08 : sub}px ${FONT}`
				;(g as unknown as { letterSpacing: string }).letterSpacing = "0px"
				g.fillStyle = note ? "#fff4d6" : "rgba(235,240,255,.78)"
				g.fillText(subLine, lx, y, Math.max(sr * 1.8, isl.bridge ? 240 : 0))
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
		const x0 = PX(d.isl, d.i)
		const y0 = PY(d.isl, d.i)
		const w0 = PW(d.isl, d.i)
		let best: { isl: Isl; i: number; it: W } | null = null
		let bv = Number.POSITIVE_INFINITY
		for (const isl of live())
			for (let i = 0; i < isl.items.length; i++) {
				if (isl === d.isl && i === d.i) continue
				const w = PW(isl, i)
				if (w < w0 * 0.35 || w > w0 * 2.9 || !hooks.current.pass(isl.items[i]))
					continue
				const vx = PX(isl, i) - x0
				const vy = PY(isl, i) - y0
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
	function posterCam(
		isl: Isl,
		i: number,
		px: number,
		at = hooks.current.center(),
	): Cam {
		// Where the poster is headed (the focus layout may still be moving it).
		const k = isl.tf
		const x = isl.cell.cx + isl.tx + (isl.pos.x[i] - isl.cell.cx) * k
		const y = isl.cell.cy + isl.ty + (isl.pos.y[i] - isl.cell.cy) * k
		const s = clamp(px / (isl.pos.w[i] * k || 1), fitS, maxS)
		return { x: x - (at.x - W / 2) / s, y: y - (at.y - H / 2) / s, s }
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
			ghosts = []
			notes = new Map()
			layoutKey = ""
			layoutBox = null
			reach = null
			pair = null
			pendPair = null
			band = null
			islands = next.cells.map((c, n) =>
				build(c, looks(c), n < COLS * COLS - 1 ? n : -1),
			)
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
		/** The focus layout's bounding box in world units (null on the normal map). */
		layoutBox: () => layoutBox,
		island: (id: string) =>
			islands.find((x) => x.id === id && !(x.bridge && x.bridge.to === 0)) ??
			null,
		drawn: () => drawn,
		/** A drawn title, on the given island if it's on more than one. */
		find: (k: string, isl?: string) =>
			(isl ? drawn.find((d) => d.it.k === k && d.isl.id === isl) : null) ??
			drawn.find((d) => d.it.k === k) ??
			null,
		nearest,
		neighbor,
		act: ACT,
		pointer: () => pointer,
		lens: () => ({ ...lens }),
		size: () => ({ w: W, h: H }),
		busy: () =>
			!!flight ||
			!!drag ||
			!!pinch ||
			Math.abs(vel.x) > 0 ||
			Math.abs(vel.y) > 0 ||
			Math.abs(Math.log(tgt.s / cur.s)) > 0.01,
		view() {
			const fi = focusIsland()
			return {
				cam: { ...cur, w: W, h: H },
				tgt: { ...tgt },
				fit: fitS,
				max: maxS,
				stops: stopsOf(fi),
				focus: fi,
			}
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
			const w = PW(isl, i) * cur.s
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
		/** Lit (or forming) islands; the focus layout follows. */
		setPicks(ids: string[]) {
			picks = new Set(ids)
			relayout()
			wake()
		},
		/** The ghosts to show; ones that go away fade out, new ones fade in. */
		setGhosts(list: Ghost[]) {
			const keep = new Map(list.map((x) => [x.key, x]))
			for (const gh of ghosts) {
				const n = keep.get(gh.key)
				if (n) {
					Object.assign(gh, n)
					gh.want = 1
					keep.delete(gh.key)
				} else gh.want = 0
			}
			for (const n of keep.values())
				ghosts.push({ ...n, a: n.island ? 0.5 : 0, want: 1 })
			wake()
		},
		ghostAnchors: () => [...ghostAt.values()],
		setNotes(m: Map<string, string>) {
			notes = m
			dirty = true
			wake()
		},
		/** Where a lit island's "Go in" button goes: under its name, on screen. */
		islandLevel: (isl: Isl) => islandLevel(isl),
		reaching: () => !!reach || !!pair,
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
