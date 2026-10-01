// The Explorer's map engine: the camera and its zoom stops, input (wheel, drag, pinch, taps), the islands and their
// trees, level of detail, and the frame loop. Two canvases: the sea (islands, shorelines, fog) underneath, drawn by
// the sea renderer, and the poster layer on top (lit posters, dots, names), drawn here in Canvas 2D. Cards and
// captions are DOM overlays the page positions from `drawn()`.
//
// Frame budget: at most 240 posters are drawn, titles below about 16 px become dots or are skipped, images load at the
// size they're shown, and the loop stops when nothing moves (the sea stops its fog after 10 idle seconds).
//
// Combining islands: lit islands and a bridge set the focus layout (focus.ts), and every island springs to its place,
// size, and look there; a bridge is an island of its own that rises between the two it joins and sinks when let go.
import type { BridgeKind, ExplorerTitle, ExplorerTree } from "~/domain/explorer"
import { type Cam, nextStop, settleStop, zoomAbout } from "./camera"
import { luminous, mixRgb } from "./color"
import { layOutFocus } from "./focus"
import { beginImageFrame, onImageReady } from "./images"
import {
	BRANCHING,
	type IslandInput,
	type MapIsland,
	NEUTRAL_LOOK,
	TREE_EXTENT,
	makeBridge,
	makeIsland,
	showTopTitles,
	showTree,
} from "./island"
import {
	type Drawn,
	FAR,
	FONT,
	type Lens,
	clamp,
	paintBand,
	paintNames,
	paintPool,
	paintPoster,
	paintRing,
	paintSeed,
	paintThread,
	risen,
	smooth,
} from "./paint"
import { loadBackdropImages, paintBackdropTile } from "./sea/backdrop"
import { createSeaRenderer } from "./sea/renderer"
import type { BackdropTile, IslandShape, SeaRenderer } from "./sea/types"
import { type World, shoreDistance, shoreRadius } from "./world"

export type { Drawn } from "./paint"

/** At most this many titles are drawn at once. */
const MAX_DRAWN = 240
/** The poster layer's device pixel ratio cap. */
const PIXEL_RATIO_CAP = 2

export interface Pad {
	t: number
	r: number
	b: number
	l: number
}

export interface EngineHooks {
	/** Whether a title passes On my services and Not seen yet; titles that don't are hidden, never dimmed. */
	visible: (title: ExplorerTitle) => boolean
	/** Room the controls take on each side of the view. */
	pad: () => Pad
	/** The focus without a mouse: the middle of the free part of the view. */
	center: () => { x: number; y: number }
	/** The active title and the island it's on. */
	active: () => { key: number; pinned: boolean; island: string } | null
	/** Where the card of the active title is on screen, if it floats beside it. */
	card: () => DOMRect | null
	onTapPoster: (d: Drawn) => void
	onTapIsland: (island: MapIsland) => void
	onDoubleTapIsland: (island: MapIsland) => void
	onTapWater: () => void
	onLongPress: (d: Drawn) => void
	/** An island is close enough that its tree should load. */
	needTree: (island: MapIsland) => void
	/** A frame was drawn. */
	onFrame: () => void
	/** The mouse moved over the map. */
	onPointer: () => void
	/** The mouse is over an island out at the map (or left it). */
	onHoverIsland: (island: MapIsland | null) => void
}

interface Flight {
	from: Cam
	to: Cam
	t0: number
	ms: number
	hop: number
}

const ease = (t: number) =>
	t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
/** Rises past 1 a little and settles: how a bridge grows. */
const backOut = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2
const isActive = (d: Drawn, a: { key: number; island?: string }) =>
	d.title.key === a.key && (!a.island || a.island === d.island.id)

export type MapEngine = ReturnType<typeof createMapEngine>

export function createMapEngine(
	seaCanvas: HTMLCanvasElement,
	canvas: HTMLCanvasElement,
	hooks: { current: EngineHooks },
	prefs: { reducedMotion: boolean },
) {
	const g = canvas.getContext("2d") as CanvasRenderingContext2D
	const reduce = prefs.reducedMotion
	const sea: SeaRenderer = createSeaRenderer(seaCanvas, {
		reducedMotion: reduce,
	})
	let W = 1
	let H = 1
	let dpr = 1
	let world: World | null = null
	let islands: MapIsland[] = []
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
	let hoverKey: number | null = null
	let hoverIsland: MapIsland | null = null
	let dirty = true
	let raf = 0
	let last = performance.now()
	let prevCam = { x: 0, y: 0, s: 0 }
	/** The camera is zooming fast: posters keep the size they have loaded until it slows down. */
	let zooming = false
	let fontsReady = false
	let notes: ReadonlyMap<string, string> = new Map()
	let layoutBox: { x0: number; y0: number; x1: number; y1: number } | null =
		null
	/** Lit islands: picked, or being combined while their bridge loads. */
	let lit: string[] = []
	/** A bridge that isn't there yet (hovering an island while another is lit): 0 to 1 as it fades in and out. */
	let preview: { from: string; to: string; a: number; want: number } | null =
		null
	let previewAt: { x: number; y: number } | null = null
	const t0 = performance.now()
	const listeners = new Set<() => void>()
	/** Frame intervals and the poster layer's work per frame, for measuring the budget in development. */
	const stats = { intervals: [] as number[], work: [] as number[] }
	const tiles = new Map<string, Promise<BackdropTile | null>>()
	let worldKey = ""

	document.fonts?.load(`800 24px ${FONT}`).then(() => {
		fontsReady = true
		wake()
	})
	const phone = () => W < 640
	/** A poster this wide (CSS pixels) is close enough to open its card. */
	const ACT = () => (phone() ? 92 : 118)
	/** Titles narrower than this aren't drawn. */
	const SHOW = () => (phone() ? 14 : 16)
	/** Posters wider than this fade out: they'd fill the view. */
	const BIG = () => Math.max(phone() ? 300 : 440, Math.min(W, H) * 0.62)

	const offImages = onImageReady(() => wake())

	// ------------------------------------------------------------ the lens (the pool of light)

	const lens = { x: 0, y: 0, r: 300, on: false }
	function lensTarget() {
		const a = hooks.current.active()
		if (a?.pinned) {
			const d = drawn.find((x) => isActive(x, a))
			if (d) return { x: d.cx, y: d.cy }
		}
		if (pointer?.mouse && !phone()) return { x: pointer.x, y: pointer.y }
		return hooks.current.center()
	}
	function stepLens(dt: number) {
		const t = lensTarget()
		const R = phone()
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

	// ------------------------------------------------------------ islands as drawn

	/** How big an island is drawn: its focus scale, and a bridge's growth as it rises. */
	const V = (island: MapIsland) =>
		island.look.scale * (island.bridge ? backOut(island.bridge.grow) : 1)
	/** The islands on the map: all but a bridge that is sinking. */
	const live = () => islands.filter((i) => !i.bridge || i.bridge.to === 1)
	const bridgeOf = () => islands.find((i) => i.bridge?.to === 1) ?? null
	/** An island's radius as drawn, in world units. */
	const rOf = (island: MapIsland) => island.shape.r * V(island)
	const cX = (island: MapIsland) => island.shape.cx + island.look.dx
	const cY = (island: MapIsland) => island.shape.cy + island.look.dy
	/** A poster's center and width in world units, as drawn. */
	const PX = (island: MapIsland, i: number) =>
		cX(island) + (island.pos.x[i] - island.shape.cx) * V(island)
	const PY = (island: MapIsland, i: number) =>
		cY(island) + (island.pos.y[i] - island.shape.cy) * V(island)
	const PW = (island: MapIsland, i: number) => island.pos.w[i] * V(island)
	/** How far (x, y) is from the island's shore, in its own radii (negative inside). */
	const distN = (island: MapIsland, x: number, y: number) => {
		const s = Math.max(V(island), 1e-3)
		const { shape } = island
		return (
			shoreDistance(
				shape,
				shape.cx + (x - cX(island)) / s,
				shape.cy + (y - cY(island)) / s,
			) / shape.r
		)
	}

	/** Paints an island's surface from its first titles' backdrops (once per grouping and filters) and tints it to match. */
	function paintSurface(island: MapIsland): Promise<void> {
		const id = `${worldKey}|${island.id}`
		let job = tiles.get(id)
		if (!job) {
			const paths = island.top
				.map((t) => t.backdrop)
				.filter((b): b is string => !!b)
			job = loadBackdropImages(paths)
				.then((images) => paintBackdropTile(images, island.base))
				.catch(() => null)
			tiles.set(id, job)
		}
		return job.then((tile) => {
			if (!tile || !islands.includes(island)) return
			island.backdrop = tile
			island.tint = luminous(mixRgb(tile.average, island.base, 0.45))
			wake()
		})
	}
	/** Paints every island's surface, three at a time. */
	function paintSurfaces() {
		const key = worldKey
		const todo = [...islands]
		const next = (): Promise<void> => {
			const island = todo.shift()
			if (!island || key !== worldKey) return Promise.resolve()
			return paintSurface(island).then(next)
		}
		void next()
		void next()
		void next()
	}

	// ------------------------------------------------------------ the focus layout

	let layoutKey = ""
	/**
	 * Where every island goes, how big, and how it looks, for what's in focus now (the bridge, the islands it joins, lit
	 * islands). A sinking bridge keeps its look while it goes.
	 */
	function relayout(force = false) {
		if (!world) return
		const br = bridgeOf()
		const shown = live()
		const key = `${br?.id ?? ""}|${lit.join(",")}|${shown.length}`
		if (key === layoutKey && !force) return
		layoutKey = key
		const S = Math.min(world.w, world.h)
		const ph = phone()
		// The bridge's name goes above it: how tall it'll be (world units), from the size it'll be drawn at.
		const fontPx = clamp(
			S * 0.33 * fitS * (ph ? 0.2 : 0.22),
			ph ? 12 : 15,
			ph ? 22 : 40,
		)
		const bridgeHead = br
			? (fontPx * ((br.name.length > 18 ? 2 : 1) * 1.02 + 0.8) + 14) / fitS
			: 0
		const out = layOutFocus({
			w: world.w,
			h: world.h,
			islands: shown.map((i) => ({
				id: i.id,
				cx: i.shape.cx,
				cy: i.shape.cy,
				r: i.shape.r,
				joins: i.bridge?.of,
			})),
			lit,
			bridgeHead,
		})
		for (const island of shown) {
			island.target = out.looks.get(island.id) ?? { ...NEUTRAL_LOOK }
			island.role = out.roles.get(island.id) ?? "none"
		}
		layoutBox = out.box
		wake()
	}
	/** Two islands whose shores meet on the way to their places push apart (the bigger, more focused one moves less). */
	function nudge() {
		const list = live()
		const S = world ? Math.min(world.w, world.h) : 1000
		const gap = S * 0.01
		const weight = (i: MapIsland) =>
			i.role === "bridge"
				? 1e6
				: i.role === "joined" || i.role === "lit"
					? 4
					: 1
		for (let a = 0; a < list.length; a++)
			for (let b = a + 1; b < list.length; b++) {
				const A = list[a]
				const B = list[b]
				// Never further apart than where they're headed (neighbors on the normal map may sit closer than this).
				const at = Math.hypot(
					B.shape.cx + B.target.dx - A.shape.cx - A.target.dx,
					B.shape.cy + B.target.dy - A.shape.cy - A.target.dy,
				)
				const want = Math.min((rOf(A) + rOf(B)) * 1.06 + gap, at * 0.99)
				const vx = cX(B) - cX(A)
				const vy = cY(B) - cY(A)
				const d = Math.hypot(vx, vy)
				if (d >= want || d < 1e-3) continue
				const o = (want - d) * 0.5
				const wa = weight(B) / (weight(A) + weight(B))
				const wb = weight(A) / (weight(A) + weight(B))
				A.look.dx -= (vx / d) * o * wa
				A.look.dy -= (vy / d) * o * wa
				B.look.dx += (vx / d) * o * wb
				B.look.dy += (vy / d) * o * wb
			}
	}

	// ------------------------------------------------------------ scales and stops

	function computeScales() {
		if (!world) return
		const p = hooks.current.pad()
		fitS = Math.min((W - p.l - p.r) / world.w, (H - p.t - p.b) / world.h) * 0.96
		const minW = Math.min(...islands.map((x) => x.w1).filter((w) => w > 0), 1e9)
		maxS = Math.max(fitS * 6, (ACT() * 2.4) / (minW / 8))
	}
	/** The whole map; when the focus layout spills over the map's edges, all of it. */
	function homeCam(): Cam {
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
	/** Framing an island's titles, where its look is taking it. */
	function islandCam(island: MapIsland): Cam {
		const p = hooks.current.pad()
		const fw = W - p.l - p.r
		const fh = H - p.t - p.b
		let x0 = Number.POSITIVE_INFINITY
		let x1 = Number.NEGATIVE_INFINITY
		let y0 = Number.POSITIVE_INFINITY
		let y1 = Number.NEGATIVE_INFINITY
		const k = island.target.scale
		const ox = island.shape.cx + island.target.dx
		const oy = island.shape.cy + island.target.dy
		for (const r of island.roots) {
			const rx = ox + (r.x - island.shape.cx) * k
			const ry = oy + (r.y - island.shape.cy) * k
			x0 = Math.min(x0, rx - TREE_EXTENT.hw * island.w1 * k)
			x1 = Math.max(x1, rx + TREE_EXTENT.hw * island.w1 * k)
			y0 = Math.min(y0, ry - TREE_EXTENT.hh * island.w1 * k)
			y1 = Math.max(y1, ry + TREE_EXTENT.hh * island.w1 * k)
		}
		const s = Math.min(fw / ((x1 - x0) * 1.06), fh / ((y1 - y0) * 1.06))
		const cx = (x0 + x1) / 2
		const cy = (y0 + y1) / 2
		return { x: cx - (p.l - p.r) / 2 / s, y: cy - (p.t - p.b) / 2 / s, s }
	}
	/**
	 * The zoom stops near an island: the overview, the island framed, then each generation of its tree at the size
	 * where its posters are big enough to open their cards. Two wheel notches from the overview reach the first posters.
	 */
	function stopsOf(island: MapIsland | null) {
		const out = [fitS]
		if (island) {
			out.push(islandCam(island).s)
			const deepest = island.loaded
				? Math.max(...island.generation)
				: BRANCHING.length + 1
			for (let gen = 1; gen <= deepest; gen++)
				out.push(
					(ACT() * 1.08) / (island.w1 * island.target.scale * 0.5 ** (gen - 1)),
				)
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
	function islandAt(sx: number, sy: number, reach = 0.25): MapIsland | null {
		const p = toWorld(sx, sy)
		let best: MapIsland | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const island of live()) {
			// Small islands (out of focus) get a little more reach, so they're still easy to hit.
			const d = distN(island, p.x, p.y) * Math.min(1, V(island) * 1.4)
			if (d < reach && d < bd) {
				bd = d
				best = island
			}
		}
		return best
	}
	function focusIsland(): MapIsland | null {
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
	/** Eases the camera toward its target, zooming about the point that stays put. */
	function approach(dt: number) {
		const k = reduce ? 1 : 1 - Math.exp(-dt * 13)
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
		Object.assign(tgt, zoomAbout(cur, clamp(s, fitS * 0.8, maxS), sx, sy, W, H))
		clampTgt()
		wake()
	}
	/** Zooms in to a poster stop, centering the poster nearest the point so it lands under it, big enough for its card. */
	function zoomInAt(want: number, sx: number, sy: number) {
		const s = clamp(want, fitS * 0.8, maxS)
		const a = toWorld(sx, sy, cur)
		const minW = ACT() * 0.92
		const big = BIG()
		let best = -1
		let bestIsland: MapIsland | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const island of islands) {
			if (distN(island, a.x, a.y) > 0.6) continue
			for (let i = 0; i < island.titles.length; i++) {
				const w = PW(island, i) * s
				if (w < minW || w > big || !hooks.current.visible(island.titles[i]))
					continue
				const dx =
					Math.max(0, Math.abs(a.x - PX(island, i)) - PW(island, i) / 2) * s
				const dy =
					Math.max(0, Math.abs(a.y - PY(island, i)) - PW(island, i) * 0.75) * s
				const d = Math.hypot(dx, dy)
				if (d < bd) {
					bd = d
					best = i
					bestIsland = island
				}
			}
		}
		if (!bestIsland || bd <= 28) return zoomAt(s, sx, sy)
		const p = hooks.current.pad()
		const pw = PW(bestIsland, best) * s
		const px = clamp(sx, p.l + pw * 0.6, W - p.r - pw * 0.6)
		const py = clamp(sy, p.t + pw * 0.8, H - p.b - pw * 0.8)
		flight = null
		tgt.s = s
		tgt.x = PX(bestIsland, best) - (px - W / 2) / s
		tgt.y = PY(bestIsland, best) - (py - H / 2) / s
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
	/** A camera flight: out a little and back in when the way is long, so the person keeps their bearings. */
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
			Object.assign(cur, f.to)
			flight = null
		}
	}
	/**
	 * After a free zoom (trackpad, pinch), the camera stays where it was let go: it settles on a stop only from close
	 * by, about the point of the gesture, and goes back to the whole map from further out than that.
	 */
	function settle() {
		if (!snapPt || drag || pts.size) return
		const pt = snapPt
		snapPt = null
		const dir = gestureDir
		gestureDir = 0
		const home = homeCam()
		if (tgt.s < Math.min(fitS, home.s) * 0.999) return glideTo(home)
		const island = islandAt(pt.x, pt.y, 0.3) ?? focusIsland()
		const best = settleStop(stopsOf(island), tgt.s, dir)
		if (best != null && Math.abs(Math.log(best / tgt.s)) > 0.004)
			zoomAt(best, pt.x, pt.y)
	}
	/**
	 * One step in or out. A wheel notch is `anchored`: what's under the cursor stays there, so a notch back returns to
	 * where it was. A button, a key, or a double tap frames the island, then centers the nearest poster.
	 */
	function stepZoom(dir: 1 | -1, sx: number, sy: number, anchored = false) {
		const island =
			islandAt(sx, sy, 0.3) ?? (dir > 0 ? islandAt(sx, sy, 1.2) : focusIsland())
		const st = stopsOf(island)
		const base = flight ? flight.to.s : tgt.s
		const next = nextStop(st, base, dir) ?? (dir > 0 ? base * 1.7 : base / 1.7)
		if (dir < 0 && next <= fitS * 1.01) return glideTo(homeCam())
		if (!anchored && dir > 0) {
			if (island && base < st[1] * 0.9 && next === st[1])
				return glideTo(islandCam(island))
			if (st.length > 2 && next >= st[2] * 0.98) return zoomInAt(next, sx, sy)
		}
		zoomAt(next, sx, sy)
	}
	function panBy(dx: number, dy: number) {
		cur.x -= dx / cur.s
		cur.y -= dy / cur.s
		tgt.x -= dx / tgt.s
		tgt.y -= dy / tgt.s
		wake()
	}

	// ------------------------------------------------------------ input

	const pts = new Map<number, { x: number; y: number }>()
	let drag: {
		x: number
		y: number
		t: number
		moved: number
		id: number
	} | null = null
	let pinch: { d: number; cx: number; cy: number } | null = null
	/** The scale a pinch started at, for the way it went as a whole (fingers jitter as they lift). */
	let pinchFrom = 1
	let lastMove = { x: 0, y: 0, t: 0 }
	let press: ReturnType<typeof setTimeout> | null = null
	let pressed = false
	let pointer: { x: number; y: number; mouse: boolean } | null = null
	let lastTap = { t: 0, x: 0, y: 0 }
	let trackpadUntil = 0
	const local = (e: { clientX: number; clientY: number }) => {
		const r = canvas.getBoundingClientRect()
		return { x: e.clientX - r.left, y: e.clientY - r.top }
	}
	/** Zoomed out far enough that a tap on an island means the island, not the posters on it. */
	const islandLevel = (island: MapIsland) => cur.s < stopsOf(island)[1] * 0.8

	function onWheel(e: WheelEvent) {
		e.preventDefault()
		const p = local(e)
		pointer = { x: p.x, y: p.y, mouse: true }
		// The mode is read first: Firefox gives a mouse wheel's lines as pixels when the delta is read before it.
		const mode = e.deltaMode
		const dy = e.deltaY * (mode === 1 ? 33 : mode === 2 ? 400 : 1)
		if (!dy) return
		const now = performance.now()
		// A mouse wheel's notch steps from stop to stop; a trackpad (small deltas, or pinch with ctrl) zooms freely.
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
		stepZoom(dy < 0 ? 1 : -1, p.x, p.y, true)
	}
	function hitPoster(x: number, y: number) {
		for (let k = drawn.length - 1; k >= 0; k--) {
			const d = drawn[k]
			if (d.a > 0.5 && x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h)
				return d
		}
		return null
	}
	function onDown(e: PointerEvent) {
		// A drag over the map never selects the card's text.
		if (e.pointerType === "mouse") e.preventDefault()
		canvas.setPointerCapture?.(e.pointerId)
		const p = local(e)
		pts.set(e.pointerId, p)
		flight = null
		vel = { x: 0, y: 0 }
		if (pts.size === 1) {
			const d = hitPoster(p.x, p.y)
			drag = { x: p.x, y: p.y, t: performance.now(), moved: 0, id: e.pointerId }
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
			drag = null
			const [a, b] = [...pts.values()]
			pinch = {
				d: Math.hypot(a.x - b.x, a.y - b.y),
				cx: (a.x + b.x) / 2,
				cy: (a.y + b.y) / 2,
			}
			pinchFrom = cur.s
		}
	}
	function onMove(e: PointerEvent) {
		const p = local(e)
		if (e.pointerType === "mouse") {
			pointer = { x: p.x, y: p.y, mouse: true }
			hooks.current.onPointer()
			wake()
		}
		if (!pts.has(e.pointerId)) {
			if (e.pointerType === "mouse") {
				const d = hitPoster(p.x, p.y)
				const key = d ? d.title.key : null
				const over = d ? null : islandAt(p.x, p.y, 0.05)
				if (key !== hoverKey || over !== hoverIsland) {
					if (over !== hoverIsland)
						hooks.current.onHoverIsland(over && islandLevel(over) ? over : null)
					hoverKey = key
					hoverIsland = over
					canvas.style.cursor = d || over ? "pointer" : "grab"
					dirty = true
				}
			}
			return
		}
		const prev = pts.get(e.pointerId) as { x: number; y: number }
		pts.set(e.pointerId, p)
		if (pts.size >= 2 && pinch) {
			const [a, b] = [...pts.values()]
			const d = Math.hypot(a.x - b.x, a.y - b.y)
			const cx = (a.x + b.x) / 2
			const cy = (a.y + b.y) / 2
			const f = d / Math.max(pinch.d, 1)
			const at = toWorld(pinch.cx, pinch.cy, cur)
			const ns = clamp(cur.s * f, fitS * 0.7, maxS * 1.1)
			cur.s = ns
			cur.x = at.x - (cx - W / 2) / ns
			cur.y = at.y - (cy - H / 2) / ns
			Object.assign(tgt, cur)
			gestureDir = ns > pinchFrom * 1.02 ? 1 : ns < pinchFrom / 1.02 ? -1 : 0
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
				canvas.style.cursor = "grabbing"
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
		if (pinch) {
			if (pts.size < 2) pinch = null
			if (pts.size === 1) {
				// The finger that stays down pans on, without a jump.
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
		canvas.style.cursor = "grab"
		if (pressed || e.type !== "pointerup") return
		const now = performance.now()
		if (d0.moved < 8 && now - d0.t < 450) {
			vel = { x: 0, y: 0 }
			const d = hitPoster(p.x, p.y)
			const island = islandAt(p.x, p.y, 0.04)
			if (
				now - lastTap.t < 300 &&
				Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30
			) {
				lastTap = { t: 0, x: 0, y: 0 }
				// A double tap goes into an island, or one step closer.
				if (island && !d && islandLevel(island))
					hooks.current.onDoubleTapIsland(island)
				else stepZoom(1, p.x, p.y)
				return
			}
			lastTap = { t: now, x: p.x, y: p.y }
			if (d) return hooks.current.onTapPoster(d)
			if (island && islandLevel(island))
				return hooks.current.onTapIsland(island)
			return hooks.current.onTapWater()
		}
		if (now - lastMove.t > 70) vel = { x: 0, y: 0 }
		wake()
	}
	function onLeave() {
		pointer = null
		if (hoverKey != null || hoverIsland) {
			if (hoverIsland) hooks.current.onHoverIsland(null)
			hoverKey = null
			hoverIsland = null
		}
		hooks.current.onPointer()
		wake()
	}
	const noMenu = (e: Event) => e.preventDefault()
	canvas.style.cursor = "grab"
	canvas.addEventListener("wheel", onWheel, { passive: false })
	canvas.addEventListener("pointerdown", onDown)
	canvas.addEventListener("pointermove", onMove)
	canvas.addEventListener("pointerup", onUp)
	canvas.addEventListener("pointercancel", onUp)
	canvas.addEventListener("pointerleave", onLeave)
	canvas.addEventListener("contextmenu", noMenu)

	// ------------------------------------------------------------ frame

	function wake() {
		if (dead) return
		dirty = true
		if (!raf) raf = requestAnimationFrame(frame)
	}
	function resize() {
		const r = canvas.getBoundingClientRect()
		W = Math.max(1, r.width)
		H = Math.max(1, r.height)
		dpr = Math.min(PIXEL_RATIO_CAP, window.devicePixelRatio || 1)
		canvas.width = Math.round(W * dpr)
		canvas.height = Math.round(H * dpr)
		const was = fitS
		computeScales()
		// The room kept for a bridge's name depends on the scale.
		if (lit.length || bridgeOf()) relayout(true)
		// At the overview, stay at the overview.
		if (world && Math.abs(cur.s - was) < was * 0.01) {
			const h = homeCam()
			Object.assign(cur, h)
			Object.assign(tgt, h)
		}
		wake()
	}

	/** Springs every island toward its look, and eases its emphasis; true while anything still moves. */
	function stepIslands(dt: number) {
		let moving = false
		const focus = hoverIsland ?? (cur.s > fitS * 1.4 ? focusIsland() : null)
		// A touch of overshoot, settled in about three quarters of a second.
		const om = 7.5
		const ze = 0.8
		const h = Math.min(dt, 1 / 30)
		for (const island of islands) {
			const wantE = island === focus ? 1 : 0
			if (island.emph !== wantE) {
				const n = reduce
					? wantE
					: island.emph + (wantE - island.emph) * (1 - Math.exp(-dt * 8))
				island.emph = Math.abs(wantE - n) < 0.003 ? wantE : n
				moving = true
			}
			const { look, target } = island
			for (const key of ["mute", "vivid", "lit"] as const) {
				if (look[key] === target[key]) continue
				const n = reduce
					? target[key]
					: look[key] + (target[key] - look[key]) * (1 - Math.exp(-dt * 6))
				look[key] = Math.abs(target[key] - n) < 0.003 ? target[key] : n
				moving = true
			}
			if (
				look.dx !== target.dx ||
				look.dy !== target.dy ||
				look.scale !== target.scale ||
				island.vx ||
				island.vy ||
				island.vs
			) {
				island.vx +=
					(om * om * (target.dx - look.dx) - 2 * ze * om * island.vx) * h
				island.vy +=
					(om * om * (target.dy - look.dy) - 2 * ze * om * island.vy) * h
				island.vs +=
					(om * om * (target.scale - look.scale) - 2 * ze * om * island.vs) * h
				look.dx += island.vx * h
				look.dy += island.vy * h
				look.scale += island.vs * h
				const settled =
					Math.abs(target.dx - look.dx) * cur.s < 0.2 &&
					Math.abs(target.dy - look.dy) * cur.s < 0.2 &&
					Math.abs(island.vx) * cur.s < 2 &&
					Math.abs(island.vy) * cur.s < 2 &&
					Math.abs(target.scale - look.scale) < 0.002 &&
					Math.abs(island.vs) < 0.01
				if (reduce || settled) {
					look.dx = target.dx
					look.dy = target.dy
					look.scale = target.scale
					island.vx = island.vy = island.vs = 0
				}
				moving = true
			}
			if (island.bridge) {
				const b = island.bridge
				const next = reduce
					? b.to
					: clamp(b.grow + (b.to ? 1 : -1) * dt * (b.to ? 1.15 : 3), 0, 1)
				if (next !== b.grow) moving = true
				b.grow = next
			}
		}
		// While they move, shores keep apart (the targets never overlap; this holds for the way there too).
		if (moving && !reduce) nudge()
		if (preview) {
			const p = preview
			const was = p.a
			const next = reduce
				? p.want
				: p.a + (p.want - p.a) * (1 - Math.exp(-dt * 9))
			p.a = Math.abs(p.want - next) < 0.004 ? p.want : next
			if (p.a <= 0 && p.want === 0) preview = null
			// It shimmers while it's shown (it holds still with reduced motion).
			if (!reduce || p.a !== was) moving = true
		}
		// A bridge that has sunk is gone.
		const before = islands.length
		islands = islands.filter(
			(i) => !(i.bridge && i.bridge.to === 0 && i.bridge.grow <= 0),
		)
		if (islands.length !== before) moving = true
		return moving
	}
	/** 1 out at the map, 0 once in among the titles: focus styling is for the map (inside, every island shows). */
	const mapLevel = () => 1 - smooth(fitS * 1.6, fitS * 3.2, cur.s)

	function seaIslands(): IslandShape[] {
		const ml = mapLevel()
		return islands.map((island) => {
			// Out of focus: toward grey and darker; in focus: a little brighter and more vivid.
			const m = island.look.mute * ml
			const vivid = island.look.vivid
			const t = island.tint
			const l = 0.3 * t[0] + 0.59 * t[1] + 0.11 * t[2]
			const k = (1 - 0.5 * m) * (1 + 0.08 * vivid)
			return {
				x: cX(island),
				y: cY(island),
				radius: island.shape.r * V(island),
				seed: island.shape.seed,
				color: [
					(t[0] + (l - t[0]) * 0.75 * m) * k,
					(t[1] + (l - t[1]) * 0.75 * m) * k,
					(t[2] + (l - t[2]) * 0.75 * m) * k,
				],
				backdrop: island.backdrop,
				emphasis:
					island.emph * (1 - m) +
					1.05 * island.look.lit +
					0.2 * vivid -
					0.8 * m,
				saturation: 1 + 0.16 * vivid - 0.88 * m,
				// Out at the map, the night closes in around a bridge, so it's what the person sees first.
				spotlight: island.bridge
					? 0.5 *
						smooth(0, 1, island.bridge.grow) *
						(island.bridge.to ? 1 : island.bridge.grow) *
						ml
					: 0,
			}
		})
	}

	function frame(now: number) {
		raf = 0
		if (dead) return
		const dt = Math.min(0.05, (now - last) / 1000)
		if (now - last < 200) {
			stats.intervals.push(now - last)
			if (stats.intervals.length > 600) stats.intervals.shift()
		}
		last = now
		if (!world) return
		const started = performance.now()
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
		// More than e times a second is fast; the first frame after it slows down draws the posters at their size.
		const fast =
			prevCam.s > 0 && dt > 0 && Math.abs(Math.log(cur.s / prevCam.s)) > dt
		if (zooming && !fast) dirty = true
		zooming = fast
		prevCam = { ...cur }
		const islandsMoving = stepIslands(dt)
		const lensMoving = stepLens(dt)
		const st = stopsOf(focusIsland())
		sea.setIslands(seaIslands())
		sea.setCamera({
			x: cur.x,
			y: cur.y,
			scale: cur.s,
			overviewScale: fitS,
			depth: smooth(st[1] ?? fitS * 3, (st[2] ?? fitS * 6) * 1.1, cur.s),
			width: W,
			height: H,
		})
		const seaMoving = sea.draw(now)
		if (moved || dirty || islandsMoving || lensMoving) {
			dirty = false
			drawPosters()
			for (const fn of listeners) fn()
			hooks.current.onFrame()
		}
		stats.work.push(performance.now() - started)
		if (stats.work.length > 600) stats.work.shift()
		const busy =
			!!flight ||
			moved ||
			islandsMoving ||
			lensMoving ||
			!!snapPt ||
			Math.abs(vel.x) > 0 ||
			Math.abs(vel.y) > 0
		if (!raf && (busy || dirty || seaMoving)) raf = requestAnimationFrame(frame)
	}

	// ------------------------------------------------------------ the poster layer

	/** Which titles show this frame, where, and how big: level of detail by zoom and by distance from the focus. */
	function layOutPosters(): Drawn[] {
		const out: Drawn[] = []
		const act = hooks.current.active()
		const show = SHOW()
		const ml = mapLevel()
		const big = BIG()
		for (const island of islands) {
			const v = V(island)
			island.sx = W / 2 + (cX(island) - cur.x) * cur.s
			island.sy = H / 2 + (cY(island) - cur.y) * cur.s
			island.sr = island.shape.r * cur.s * v
			const reach = island.sr * 1.15
			island.on =
				island.sx + reach > 0 &&
				island.sx - reach < W &&
				island.sy + reach > 0 &&
				island.sy - reach < H
			if (!island.on) continue
			if (
				(cur.s > islandCam(island).s * 0.45 || island.look.vivid > 0.3) &&
				!island.loaded
			)
				hooks.current.needTree(island)
			// Out of focus, out at the map: color and name only.
			const pm = 1 - island.look.mute * ml
			if (pm <= 0.01) continue
			// In focus, the first posters show at a readable size from far out, grown into the room of the smaller
			// posters around them; those come in once zooming has caught up with that size.
			const nat1 = island.w1 * v * cur.s
			const floor1 =
				island.boost * island.w1 * v * fitS * smooth(0, 1, island.look.vivid)
			const w1s = Math.max(nat1, floor1)
			const b1 = w1s / Math.max(nat1, 1e-6)
			const kids = floor1 > 0 ? smooth(0.72, 1, nat1 / floor1) : 1
			if (w1s < show * 0.9) continue
			// A bridge's posters come up once it has nearly risen, and go first as it sinks.
			const rise = risen(island, 0.7)
			if (rise <= 0.01) continue
			for (let i = 0; i < island.titles.length && out.length < MAX_DRAWN; i++) {
				const first = island.generation[i] === 1
				if (!first && kids < 0.01) break
				const rw = PW(island, i) * cur.s * (first ? b1 : 1)
				if (rw < show * 0.9) {
					// Breadth first: once one child is too small, so are the rest.
					if (!first) break
					continue
				}
				const title = island.titles[i]
				if (!hooks.current.visible(title)) continue
				const cx = W / 2 + (PX(island, i) - cur.x) * cur.s
				const cy = H / 2 + (PY(island, i) - cur.y) * cur.s
				if (
					cx + rw < -20 ||
					cx - rw > W + 20 ||
					cy + rw * 1.5 < -20 ||
					cy - rw * 1.5 > H + 20
				)
					continue
				const isAct = !!act && act.key === title.key && act.island === island.id
				if (rw > big && !(isAct && rw < big * 1.6)) continue
				const fade = isAct ? 1 : 1 - smooth(big * 0.72, big, rw)
				const t = isAct ? 1 : closeness(cx, cy)
				const w = rw * (FAR + (1 - FAR) * t)
				const h = w * 1.5
				out.push({
					island,
					i,
					title,
					generation: island.generation[i],
					x: cx - w / 2,
					y: cy - h / 2,
					w,
					h,
					cx,
					cy,
					a:
						smooth(show * 0.9, show * 2, rw) *
						fade *
						pm *
						rise *
						(first ? 1 : kids),
					t,
				})
			}
		}
		return out
	}

	function drawPosters() {
		beginImageFrame(zooming)
		g.setTransform(dpr, 0, 0, dpr, 0, 0)
		g.clearRect(0, 0, W, H)
		drawn = layOutPosters()
		const act = hooks.current.active()
		paintPreview()
		paintCauseways()
		paintPool(g, lens, smooth(fitS * 1.3, fitS * 2.4, cur.s), W, H)
		// Far ones first, the ones at the focus on top; the hovered and active posters last.
		const lift = (d: Drawn) =>
			act && isActive(d, act) ? 2 : d.title.key === hoverKey ? 1 : 0
		const order = [...drawn].sort(
			(a, b) => lift(a) - lift(b) || a.t - b.t || b.generation - a.generation,
		)
		const dimOthers = act?.pinned ? 0.55 : 1
		const budget = { left: 10 }
		for (const d of order) {
			const l = lift(d)
			const a = d.a * (act && l < 2 ? dimOthers : 1)
			if (a > 0.01) paintPoster(g, d, l, a, lens, dpr, budget)
		}
		if (act) {
			const d = drawn.find((x) => isActive(x, act))
			const r = hooks.current.card()
			if (d && r) {
				const b = canvas.getBoundingClientRect()
				paintThread(g, d, {
					x: r.left - b.left,
					y: r.top - b.top,
					w: r.width,
					h: r.height,
				})
			}
		}
		paintRings()
		if (fontsReady)
			paintNames(g, islands, {
				W,
				H,
				phone: phone(),
				pad: hooks.current.pad(),
				scale: cur.s,
				fit: fitS,
				show: SHOW(),
				mapLevel: mapLevel(),
				islandScale: (island) => islandCam(island).s,
				notes,
			})
		// Keep reading the next dots' colors.
		if (budget.left <= 0) dirty = true
	}

	// ------------------------------------------------------------ combining, drawn

	/** The point on an island's shore (as drawn now) toward (x, y), in world units. */
	function shore(island: MapIsland, x: number, y: number, k = 0.985) {
		const a = Math.atan2(y - cY(island), x - cX(island))
		const r = shoreRadius(island.shape, a) * V(island) * k
		return { x: cX(island) + Math.cos(a) * r, y: cY(island) + Math.sin(a) * r }
	}
	const onScreen = (p: { x: number; y: number }) => toScreen(p.x, p.y)
	/** Where a bridge of these islands would rise: between them, as they sit now. */
	const seedOf = (a: MapIsland, b: MapIsland) => ({
		x: (cX(a) + cX(b)) / 2,
		y: (cY(a) + cY(b)) / 2,
	})

	/** The preview of a bridge: two bands of light from the islands meeting in a seed of light where it would rise. */
	function paintPreview() {
		previewAt = null
		if (!preview || preview.a < 0.01) return
		const A = islands.find((x) => x.id === preview?.from && !x.bridge)
		const B = islands.find((x) => x.id === preview?.to && !x.bridge)
		if (!A || !B) return
		const al = preview.a
		const wide = clamp(Math.min(rOf(A), rOf(B)) * cur.s * 0.12, 3, 18)
		const sp = seedOf(A, B)
		const c = toScreen(sp.x, sp.y)
		const mid = mixRgb(A.tint, B.tint, 0.5)
		const now = performance.now() - t0
		const drift = reduce ? 0 : -(now / 40)
		paintBand(
			g,
			onScreen(shore(A, sp.x, sp.y)),
			c,
			A.tint,
			mid,
			wide,
			al * 0.8,
			drift,
		)
		paintBand(
			g,
			onScreen(shore(B, sp.x, sp.y)),
			c,
			B.tint,
			mid,
			wide,
			al * 0.8,
			drift,
		)
		const pulse = reduce ? 1 : 0.85 + 0.15 * Math.sin(now / 260)
		const R = clamp(Math.min(rOf(A), rOf(B)) * cur.s * 0.42, 18, 60) * pulse
		paintSeed(g, c, mid, R, al)
		previewAt = c
	}
	/** A bridge's causeways: a band of light from each island it joins to its shore, reaching out as it rises. */
	function paintCauseways() {
		for (const island of islands) {
			const b = island.bridge
			if (!b || b.grow <= 0.01) continue
			for (const id of b.of) {
				const o = islands.find((x) => x.id === id)
				if (!o) continue
				const A = onScreen(shore(o, cX(island), cY(island)))
				const B = onScreen(shore(island, cX(o), cY(o)))
				const k = smooth(0, 0.8, b.grow)
				const wide = clamp(Math.min(rOf(o), rOf(island)) * cur.s * 0.16, 3, 26)
				paintBand(
					g,
					A,
					{ x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k },
					o.tint,
					island.tint,
					wide,
					b.to ? 1 : b.grow,
					0,
				)
			}
		}
	}
	/** Lit islands wear a bright shoreline; the ones a bridge joins a fainter one. */
	function paintRings() {
		const joined = new Set(bridgeOf()?.bridge?.of ?? [])
		for (const island of islands) {
			if (island.bridge || island.look.lit < 0.02 || !island.on) continue
			const k = island.look.lit * (joined.has(island.id) ? 0.4 : 1)
			if (k < 0.02) continue
			const pts: { x: number; y: number }[] = []
			const N = 72
			for (let n = 0; n <= N; n++) {
				const a = (n / N) * Math.PI * 2
				const rr = shoreRadius(island.shape, a) * cur.s * V(island) + 5
				pts.push({
					x: island.sx + Math.cos(a) * rr,
					y: island.sy + Math.sin(a) * rr,
				})
			}
			paintRing(g, pts, island.tint, k)
		}
	}

	// ------------------------------------------------------------ queries

	/** The drawn title nearest (x, y), at least minW wide, within reach of its edge. */
	function nearest(x: number, y: number, minW: number, reach: number) {
		let best: Drawn | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const d of drawn) {
			if (d.w < minW || d.a < 0.9) continue
			const dx = Math.max(0, Math.abs(x - d.cx) - d.w / 2)
			const dy = Math.max(0, Math.abs(y - d.cy) - d.h / 2)
			if (Math.hypot(dx, dy) > reach) continue
			const v = Math.hypot(x - d.cx, y - d.cy) / (0.6 + d.w / 200)
			if (v < bd) {
				bd = v
				best = d
			}
		}
		return best
	}
	/** The title next to one in a direction (arrow keys): near it, about as big, and roughly that way. */
	function neighbor(
		d: { island: MapIsland; i: number },
		dx: number,
		dy: number,
	) {
		const x0 = PX(d.island, d.i)
		const y0 = PY(d.island, d.i)
		const w0 = PW(d.island, d.i)
		let best: { island: MapIsland; i: number; title: ExplorerTitle } | null =
			null
		let bv = Number.POSITIVE_INFINITY
		for (const island of live())
			for (let i = 0; i < island.titles.length; i++) {
				if (island === d.island && i === d.i) continue
				const w = PW(island, i)
				if (
					w < w0 * 0.35 ||
					w > w0 * 2.9 ||
					!hooks.current.visible(island.titles[i])
				)
					continue
				const vx = PX(island, i) - x0
				const vy = PY(island, i) - y0
				const dist = Math.hypot(vx, vy)
				const cos = (vx * dx + vy * dy) / Math.max(dist, 1e-6)
				if (cos < 0.45) continue
				const v = dist * (2 - cos) * (1 + Math.abs(Math.log(w / w0)) * 0.4)
				if (v < bv) {
					bv = v
					best = { island, i, title: island.titles[i] }
				}
			}
		return best
	}
	function posterCam(
		island: MapIsland,
		i: number,
		px: number,
		at = hooks.current.center(),
	): Cam {
		// Where the poster is headed (its island's look may still be moving it).
		const k = island.target.scale
		const x =
			island.shape.cx +
			island.target.dx +
			(island.pos.x[i] - island.shape.cx) * k
		const y =
			island.shape.cy +
			island.target.dy +
			(island.pos.y[i] - island.shape.cy) * k
		const s = clamp(px / (island.pos.w[i] * k || 1), fitS, maxS)
		return { x: x - (at.x - W / 2) / s, y: y - (at.y - H / 2) / s, s }
	}

	const ro = new ResizeObserver(() => resize())
	ro.observe(canvas)
	resize()

	return {
		/** Shows a grouping's islands, laid out in `next`; `key` names the grouping and filters for cached surfaces. */
		setWorld(next: World, inputs: IslandInput[], key: string) {
			const first = !world
			world = next
			worldKey = key
			layoutBox = null
			layoutKey = ""
			lit = []
			preview = null
			notes = new Map()
			const byId = new Map(inputs.map((input) => [input.id, input]))
			islands = next.islands.flatMap((shape) => {
				const input = byId.get(shape.id)
				if (!input) return []
				const island = makeIsland(input, shape)
				showTopTitles(island, hooks.current.visible)
				return [island]
			})
			hoverKey = null
			hoverIsland = null
			computeScales()
			const h = homeCam()
			if (first) {
				Object.assign(cur, h)
				Object.assign(tgt, h)
			} else flyTo(h, 600)
			paintSurfaces()
			wake()
		},
		/** The filters changed: islands without their tree show their first titles that pass them. */
		refilter() {
			for (const island of islands) showTopTitles(island, hooks.current.visible)
			wake()
		},
		setTree(id: string, tree: ExplorerTree) {
			const island = islands.find((x) => x.id === id)
			if (island && showTree(island, tree)) wake()
		},
		invalidate: wake,
		repad: resize,
		/** The islands on the map, a rising bridge among them (a sinking one is left out). */
		islands: live,
		island: (id: string) => live().find((x) => x.id === id) ?? null,
		drawn: () => drawn,
		/** A drawn title, on the given island if it's on more than one. */
		find: (key: number, island?: string) =>
			(island
				? drawn.find((d) => d.title.key === key && d.island.id === island)
				: null) ??
			drawn.find((d) => d.title.key === key) ??
			null,
		nearest,
		neighbor,
		/** A poster this wide is close enough to open its card. */
		activationWidth: ACT,
		pointer: () => pointer,
		size: () => ({ w: W, h: H }),
		busy: () =>
			!!flight ||
			!!drag ||
			!!pinch ||
			Math.abs(vel.x) > 0 ||
			Math.abs(vel.y) > 0 ||
			Math.abs(Math.log(tgt.s / cur.s)) > 0.01,
		view() {
			const focus = focusIsland()
			return {
				cam: { ...cur, w: W, h: H },
				fit: fitS,
				max: maxS,
				stops: stopsOf(focus),
				focus,
				world,
			}
		},
		stepZoom(dir: 1 | -1, at?: { x: number; y: number }) {
			const c = at ?? hooks.current.center()
			stepZoom(dir, c.x, c.y)
		},
		overview() {
			flyTo(homeCam(), 700)
		},
		flyToIsland(island: MapIsland) {
			flyTo(islandCam(island))
		},
		flyToPoster(island: MapIsland, i: number, px?: number) {
			flyTo(posterCam(island, i, px ?? ACT() * 1.35))
		},
		glideToPoster(island: MapIsland, i: number, px?: number) {
			const w = PW(island, i) * cur.s
			glideTo(posterCam(island, i, Math.max(px ?? ACT() * 1.1, w)))
		},
		/** Flies to a zoom level, keeping the point at the focus where it is. */
		zoomTo(s: number) {
			const c = hooks.current.center()
			flyTo(
				{
					x: cur.x + (c.x - W / 2) / cur.s - (c.x - W / 2) / s,
					y: cur.y + (c.y - H / 2) / cur.s - (c.y - H / 2) / s,
					s,
				},
				600,
			)
		},
		panBy(dx: number, dy: number) {
			flight = null
			tgt.x += dx / tgt.s
			tgt.y += dy / tgt.s
			clampTgt()
			wake()
		},
		flyTo,
		/** Lights islands (picked, or being combined while their bridge loads); the focus layout follows. */
		setLit(ids: readonly string[]) {
			const next = ids.filter((id) => islands.some((i) => i.id === id))
			if (next.join(",") === lit.join(",")) return
			lit = next
			relayout()
		},
		/**
		 * Raises a bridge between two islands with its titles: it rises between them and grows into the main thing on
		 * screen, the two stay medium beside it, and the rest shrink and grey. A bridge already up sinks.
		 */
		raiseBridge(
			a: string,
			b: string,
			tree: ExplorerTree & { kind: BridgeKind },
		): MapIsland | null {
			const A = live().find((x) => x.id === a && !x.bridge)
			const B = live().find((x) => x.id === b && !x.bridge)
			if (!world || !A || !B) return null
			// At most one bridge sinks while the next rises (the sea's atlas holds 16 surfaces).
			islands = islands.filter((i) => !(i.bridge && i.bridge.to === 0))
			for (const i of islands) if (i.bridge) i.bridge.to = 0
			const island = makeBridge([A, B], tree, seedOf(A, B))
			islands.push(island)
			void paintSurface(island)
			computeScales()
			relayout()
			// Out at the map, framing the new layout: the bridge is the main thing on screen.
			flyTo(homeCam(), reduce ? 1 : 950)
			return island
		},
		/** Lets the bridge go: it sinks and every island springs back. False when there's none. */
		lowerBridge() {
			const br = bridgeOf()
			if (!br?.bridge) return false
			br.bridge.to = 0
			relayout()
			return true
		},
		bridge: bridgeOf,
		/** Previews the bridge two islands would make (null hides it). */
		setPreview(pair: { from: string; to: string } | null) {
			if (!pair) {
				if (preview) preview.want = 0
			} else if (preview?.from === pair.from && preview.to === pair.to)
				preview.want = 1
			else preview = { ...pair, a: reduce ? 1 : 0.5, want: 1 }
			wake()
		},
		/** Where the preview's seed of light is on screen, for its label. */
		previewAnchor: () => (preview && preview.want > 0 ? previewAt : null),
		/** The focus layout's bounds in world units (null on the normal map). */
		layoutBox: () => layoutBox,
		/** Each island's center and radius as drawn now, in world units (for the minimap). */
		circles: () =>
			live().map((island) => ({
				island,
				x: cX(island),
				y: cY(island),
				r: rOf(island),
			})),
		/** The scale that frames an island's titles. */
		islandLevel: (island: MapIsland) => islandLevel(island),
		/** A line under an island's name in place of its size and taste (for example what it shares with another). */
		setNotes(next: ReadonlyMap<string, string>) {
			notes = next
			wake()
		},
		subscribe(fn: () => void) {
			listeners.add(fn)
			return () => {
				listeners.delete(fn)
			}
		},
		seaKind: () => sea.kind,
		stats: () => ({
			intervals: stats.intervals.slice(),
			work: stats.work.slice(),
		}),
		toScreen,
		shoreRadius: (island: MapIsland, a: number) =>
			shoreRadius(island.shape, a) * V(island),
		destroy() {
			dead = true
			cancelAnimationFrame(raf)
			raf = 0
			ro.disconnect()
			offImages()
			sea.dispose()
			canvas.removeEventListener("wheel", onWheel)
			canvas.removeEventListener("pointerdown", onDown)
			canvas.removeEventListener("pointermove", onMove)
			canvas.removeEventListener("pointerup", onUp)
			canvas.removeEventListener("pointercancel", onUp)
			canvas.removeEventListener("pointerleave", onLeave)
			canvas.removeEventListener("contextmenu", noMenu)
		},
	}
}
