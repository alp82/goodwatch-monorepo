// PROTOTYPE - throwaway. The round-5 map (#180): one canvas, drawn only when something moves.
// Islands as round 4 lays them out (organic shapes placed by similarity), with three changes:
//   zoomed out  each island shows its identity (emblems.ts), no posters;
//   zooming in  each island's fractal (fractal.ts): its first posters, then around each a ring of half-size posters,
//               then smaller ones around those. A poster shows once it is big enough to read and fades in over the
//               next few pixels, so every zoom step reveals exactly one more ring. Only what is on screen is
//               looked at, at most MAX posters are drawn, and small posters load TMDB's smallest images;
//   close-up    the map itself turns cinematic ("cinema"): the island's ground becomes the title's backdrop and the
//               title stands in it with its closest titles around, while the shoreline and the neighboring islands
//               stay in view. flood/marquee pull the camera back and magnify the title's family; lens is a fisheye.
// Input: drag with inertia, wheel and pinch around the pointer, tap an island to fly in, tap a poster to open it,
// keep zooming into a big poster to open it, zoom out of the close-up to leave it.
import { HEAT } from "~/ui/prototype-rec-explorer-2/Stage"
import type { Cell, World } from "~/ui/prototype-rec-explorer-4/geo"
import type { Config } from "./config"
import { type Look, mix, over, under } from "./emblems"
import { type Placed, RATIO, place, roots, slots } from "./fractal"
import { BRANCH, type TreeRes, type W, firstCount } from "./wire5"

export const TMDB = "https://image.tmdb.org/t/p"
const BODY = "'Noto Sans','Gabarito',system-ui,sans-serif"
const MAX = 190

export type Pad = { t: number; r: number; b: number; l: number }
export type Rect = { x: number; y: number; w: number; h: number }

export type Island = {
	cell: Cell
	look: Look
	n1: number
	w1: number
	roots: { x: number; y: number }[]
	items: W[]
	par: number[]
	gen: number[]
	pos: Placed
	kids: number[][]
	loaded: boolean
	asked: boolean
	/** Outline in world units, x y pairs. */
	outline: Float32Array
	/** Outline on screen this frame. */
	scr: Float32Array
	sx: number
	sy: number
	R: number
	on: boolean
}

export type Hooks = {
	pass: (it: W) => boolean
	current: () => string | null
	pad: () => Pad
	/** The part of the screen the close-up keeps free of its panel. */
	cinePad: () => Pad
	onPoster: (isl: Island, i: number, rect: Rect) => void
	onIsland: (isl: Island) => void
	needTree: (isl: Island) => void
	onCineOut: () => void
	onSwipe: (dir: 1 | -1) => void
}

export type View = {
	cam: { x: number; y: number; s: number; w: number; h: number }
	fit: number
	max: number
	/** Zoom where each ring of the island in the middle becomes readable: first posters, half size, quarter size. */
	stops: number[]
	focus: Cell | null
	cine: boolean
}

type Drawn = {
	isl: Island
	i: number
	x: number
	y: number
	w: number
	h: number
	fam: boolean
}
type Img = { im: HTMLImageElement; ok: boolean }
const IMGS = new Map<string, Img>()
let wakeImg: (() => void) | null = null
function image(path: string, size: string) {
	const key = size + path
	let e = IMGS.get(key)
	if (!e) {
		const im = new Image()
		im.decoding = "async"
		e = { im, ok: false }
		const ent = e
		im.src = `${TMDB}/${size}${path}`
		im.decode()
			.then(() => {
				ent.ok = true
				wakeImg?.()
			})
			.catch(() => {})
		IMGS.set(key, e)
	}
	return e
}
const SIZES = ["w92", "w185", "w342", "w500", "w780"]
function bestImage(path: string, px: number, big = false) {
	const want = big
		? px < 400
			? "w500"
			: "w780"
		: px < 100
			? "w92"
			: px < 190
				? "w185"
				: px < 350
					? "w342"
					: "w500"
	const e = image(path, want)
	if (e.ok) return e.im
	for (let k = SIZES.length - 1; k >= 0; k--) {
		const o = IMGS.get(SIZES[k] + path)
		if (o?.ok) return o.im
	}
	return null
}
function backdrop(path: string, px: number) {
	const e = image(path, px > 900 ? "w1280" : "w780")
	if (e.ok) return e.im
	for (const s of ["w1280", "w780", "w300"]) {
		const o = IMGS.get(s + path)
		if (o?.ok) return o.im
	}
	return null
}

const ease = (t: number) =>
	t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function outlineOf(c: Cell) {
	const N = 72
	const out = new Float32Array(N * 2)
	const r = c.r ?? 100
	const s = c.seed ?? 0
	for (let k = 0; k < N; k++) {
		const a = (k / N) * Math.PI * 2
		const rr =
			r *
			(1 +
				0.055 * Math.sin(3 * a + s) +
				0.035 * Math.sin(5 * a + s * 2.3) +
				0.03 * Math.sin(2 * a + s * 0.7))
		out[2 * k] = c.cx + Math.cos(a) * rr
		out[2 * k + 1] = c.cy + Math.sin(a) * rr
	}
	return out
}
function inPoly(p: Float32Array, x: number, y: number) {
	let inside = false
	const n = p.length / 2
	for (let i = 0, j = n - 1; i < n; j = i++) {
		const xi = p[2 * i]
		const yi = p[2 * i + 1]
		const xj = p[2 * j]
		const yj = p[2 * j + 1]
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
			inside = !inside
	}
	return inside
}

type Fam = { i: number; ox: number; oy: number; k: number }
type Cine = {
	isl: Island
	i: number
	e: number
	to: 0 | 1
	t0: number
	e0: number
	fam: Fam[]
	/** The title that was in the close-up a moment ago, fading out. */
	swap: { isl: Island; i: number; t0: number; dir: number; fam: Fam[] } | null
	/** Where the camera goes once the close-up has closed. */
	back: { x: number; y: number; s: number } | null
}

export type Engine = ReturnType<typeof makeEngine>

export function makeEngine(
	canvas: HTMLCanvasElement,
	cfg: Config,
	hooks: { current: Hooks },
) {
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
	let W = 1
	let H = 1
	let dpr = 1
	let world: World | null = null
	let islands: Island[] = []
	let old: { islands: Island[]; t0: number } | null = null
	const cam = { x: 0, y: 0, s: 1 }
	let fitS = 1
	let maxS = 10
	let T0 = 44
	let T1 = 62
	let raf = 0
	let fly: {
		from: { x: number; y: number; s: number }
		to: { x: number; y: number; s: number }
		t0: number
		ms: number
	} | null = null
	let vel = { x: 0, y: 0 }
	let hover: Drawn | null = null
	let drawn: Drawn[] = []
	let cine: Cine | null = null
	const listeners = new Set<() => void>()
	// Lens (fisheye) state: strength 0..1, magnification of the flat middle (d0 pre-lens pixels around the center, where
	// the title and its ring sit undistorted), the log curve's scale beyond it, and its screen center.
	const lens = {
		e: 0,
		m: 1,
		a: 1e6,
		d0: 0,
		x: 0,
		y: 0,
		from: { m: 1, a: 1e6, d0: 0 },
		to: { m: 1, a: 1e6, d0: 0 },
	}

	// ------------------------------------------------------------ projection

	let px = 0
	let py = 0
	let pk = 1
	function P(wx: number, wy: number) {
		let x = W / 2 + (wx - cam.x) * cam.s
		let y = H / 2 + (wy - cam.y) * cam.s
		let k = cam.s
		if (lens.e > 0.001) {
			const dx = x - lens.x
			const dy = y - lens.y
			const d = Math.hypot(dx, dy)
			const { m, a, d0, e } = lens
			let g: number
			let gp: number
			if (d <= d0) {
				g = m * d
				gp = m
			} else {
				const u = (m * (d - d0)) / a
				g = m * d0 + a * Math.log1p(u)
				gp = m / (1 + u)
			}
			// Blend with no lens at all, so opening and closing are continuous.
			g = lerp(d, g, e)
			gp = lerp(1, gp, e)
			if (d > 0.01) {
				const t = g / d
				x = lens.x + dx * t
				y = lens.y + dy * t
				k *= Math.sqrt(t * gp)
			} else k *= gp
		}
		px = x
		py = y
		pk = k
	}
	const toWorld = (sx: number, sy: number) => ({
		x: cam.x + (sx - W / 2) / cam.s,
		y: cam.y + (sy - H / 2) / cam.s,
	})

	// ------------------------------------------------------------ islands

	const branch = BRANCH[cfg.arr]
	function buildIsland(c: Cell, look: Look): Island {
		const n1 = firstCount(c.count)
		const r = c.r ?? 100
		const rt = roots(cfg.arr, branch, n1, c.cx, c.cy + 0.07 * r, 0.78 * r)
		const isl: Island = {
			cell: c,
			look,
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
			kids: [],
			loaded: false,
			asked: false,
			outline: outlineOf(c),
			scr: new Float32Array(144),
			sx: 0,
			sy: 0,
			R: 0,
			on: false,
		}
		fallback(isl)
		return isl
	}
	/** Before an island's fractal arrives: its first posters from the map's best picks. */
	function fallback(isl: Island) {
		const pass = hooks.current.pass
		const items = isl.cell.items.filter(pass).slice(0, isl.n1)
		isl.items = items
		isl.par = items.map(() => -1)
		isl.gen = items.map(() => 1)
		isl.pos = place(cfg.arr, isl.roots, isl.w1, isl.par, isl.gen)
		isl.kids = items.map(() => [])
	}
	function setTree(id: string, t: TreeRes) {
		const isl = islands.find((x) => x.cell.id === id)
		if (!isl || !t.items.length) return
		// The close-up keeps its title when the island's first posters are swapped for its full fractal.
		const heroK = cine?.isl === isl ? isl.items[cine.i]?.k : null
		isl.items = t.items
		isl.par = t.par
		isl.gen = t.gen
		isl.pos = place(cfg.arr, isl.roots, isl.w1, t.par, t.gen)
		isl.kids = t.items.map(() => [])
		t.par.forEach((p, i) => p >= 0 && isl.kids[p].push(i))
		isl.loaded = true
		if (cine?.isl === isl) {
			const j = t.items.findIndex((x) => x.k === heroK)
			if (j >= 0) cine.i = j
			cine.fam = family(isl, cine.i)
		}
		invalidate()
	}

	const pad = () => hooks.current.pad()
	function computeScales() {
		if (!world) return
		const p = pad()
		fitS = Math.min((W - p.l - p.r) / world.w, (H - p.t - p.b) / world.h) * 0.97
		const minW = Math.min(...islands.map((x) => x.w1).filter((w) => w > 0), 1e9)
		maxS = Math.max(fitS * 4, 240 / (minW * RATIO ** 3))
		const small = W < 640
		T0 = small ? 44 : 58
		T1 = small ? 56 : 72
	}
	const homeCam = () => {
		const p = pad()
		const w = world as World
		return {
			x: w.w / 2 - (p.l - p.r) / 2 / fitS,
			y: w.h / 2 - (p.t - p.b) / 2 / fitS,
			s: fitS,
		}
	}
	function clampCam() {
		if (!world) return
		cam.s = clamp(cam.s, fitS * 0.7, maxS)
		const mx = Math.max(0, world.w / 2 - W / 2 / cam.s + (W * 0.3) / cam.s)
		const my = Math.max(0, world.h / 2 - H / 2 / cam.s + (H * 0.3) / cam.s)
		cam.x = clamp(cam.x, world.w / 2 - mx, world.w / 2 + mx)
		cam.y = clamp(cam.y, world.h / 2 - my, world.h / 2 + my)
	}

	function setWorld(next: World, looks: (c: Cell) => Look) {
		const first = !world
		if (world && next !== world) old = { islands, t0: performance.now() }
		world = next
		islands = next.cells.map((c) => buildIsland(c, looks(c)))
		cine = null
		lens.e = 0
		hover = null
		computeScales()
		if (first || old) {
			const h = homeCam()
			cam.x = h.x
			cam.y = h.y
			cam.s = h.s
			fly = null
		}
		invalidate()
	}
	/** The same world with the filters' local changes (a title marked as seen) applied. */
	function refilter() {
		for (const isl of islands) if (!isl.loaded) fallback(isl)
		invalidate()
	}

	function invalidate() {
		if (!raf) raf = requestAnimationFrame(frame)
	}
	wakeImg = invalidate

	// ------------------------------------------------------------ camera moves

	const reduce = () =>
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	function flyTo(x: number, y: number, s: number, ms = 650) {
		vel = { x: 0, y: 0 }
		fly = {
			from: { ...cam },
			to: { x, y, s: clamp(s, fitS * 0.7, maxS * 1.5) },
			t0: performance.now(),
			ms: reduce() ? 1 : ms,
		}
		invalidate()
	}
	/** Frame an island's first posters, at the size of the first step. */
	function islandCam(isl: Island) {
		const p = pad()
		const fw = W - p.l - p.r
		const fh = H - p.t - p.b
		let x0 = Number.POSITIVE_INFINITY
		let x1 = Number.NEGATIVE_INFINITY
		let y0 = Number.POSITIVE_INFINITY
		let y1 = Number.NEGATIVE_INFINITY
		for (const r of isl.roots) {
			x0 = Math.min(x0, r.x - isl.w1 * 0.9)
			x1 = Math.max(x1, r.x + isl.w1 * 0.9)
			y0 = Math.min(y0, r.y - isl.w1 * 1.2)
			y1 = Math.max(y1, r.y + isl.w1 * 1.2)
		}
		// The first step's size wins; on a phone some of the island's first posters sit just off screen.
		const fits = Math.min(fw / (x1 - x0), fh / (y1 - y0))
		const s = clamp(
			Math.max(Math.min(fits, stops(isl)[0]), stops(isl)[0] * 0.92),
			fitS * 1.3,
			maxS,
		)
		return {
			x: (x0 + x1) / 2 - (p.l - p.r) / 2 / s,
			y: (y0 + y1) / 2 - (p.t - p.b) / 2 / s,
			s,
		}
	}
	/** One step deeper: zoom so the next ring reads, centered on the poster of the ring before it nearest the middle. */
	function stepTo(L: number) {
		const p = pad()
		const mx = p.l + (W - p.l - p.r) / 2
		const my = p.t + (H - p.t - p.b) / 2
		let best: { isl: Island; i: number } | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const isl of islands) {
			if (!isl.on) continue
			for (let i = 0; i < isl.items.length; i++) {
				if (isl.gen[i] !== L) continue
				P(isl.pos.x[i], isl.pos.y[i])
				const d = Math.hypot(px - mx, py - my)
				if (d < bd) {
					bd = d
					best = { isl, i }
				}
			}
		}
		const f = focusIsland()
		const s = stops(best?.isl ?? f)[L]
		if (!best) return flyTo(cam.x, cam.y, s, 520)
		const { isl, i } = best
		flyTo(
			isl.pos.x[i] - (p.l - p.r) / 2 / s,
			isl.pos.y[i] - (p.t - p.b) / 2 / s,
			s,
			620,
		)
	}
	function flyToIsland(isl: Island, ms = 700) {
		const c = islandCam(isl)
		flyTo(c.x, c.y, c.s, ms)
	}
	function overview(ms = 650) {
		const h = homeCam()
		flyTo(h.x, h.y, h.s, ms)
	}
	function zoomAt(f: number, sx: number, sy: number) {
		const before = toWorld(sx, sy)
		cam.s = clamp(cam.s * f, fitS * 0.7, maxS)
		const after = toWorld(sx, sy)
		cam.x += before.x - after.x
		cam.y += before.y - after.y
		clampCam()
		invalidate()
	}
	const zoomBy = (f: number) => flyTo(cam.x, cam.y, cam.s * f, 360)
	const panBy = (dx: number, dy: number) =>
		flyTo(cam.x + dx / cam.s, cam.y + dy / cam.s, cam.s, 220)

	function focusIsland(): Island | null {
		if (!world || cam.s < fitS * 1.25) return null
		const p = cine ? hooks.current.cinePad() : pad()
		const x = p.l + (W - p.l - p.r) / 2
		const y = p.t + (H - p.t - p.b) / 2
		if (cine) return cine.isl
		let best: Island | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const isl of islands) {
			if (inPoly(isl.scr, x, y)) return isl
			const d = Math.hypot(isl.sx - x, isl.sy - y) / Math.max(1, isl.R)
			if (d < bd) {
				bd = d
				best = isl
			}
		}
		return bd < 1.6 ? best : null
	}
	function stops(isl: Island | null) {
		const ref = isl ?? islands[Math.floor(islands.length / 2)]
		if (!ref) return [fitS * 2, fitS * 4, fitS * 8]
		const P0 = W < 640 ? 88 : 116
		return [0, 1, 2].map((L) =>
			clamp(P0 / (ref.w1 * RATIO ** L), fitS * 1.3, maxS),
		)
	}

	// ------------------------------------------------------------ close-up

	/** The title's closest titles, to stand around it: its children, then its siblings and its parent. */
	function family(isl: Island, i: number): Fam[] {
		const p = isl.par[i]
		const sib =
			p >= 0
				? isl.kids[p]
				: isl.items.map((_, j) => j).filter((j) => isl.par[j] < 0)
		const pass = hooks.current.pass
		const near = [
			...(isl.kids[i] ?? []),
			...sib.filter((j) => j !== i),
			...(p >= 0 ? [p] : []),
		]
			.filter((j) => pass(isl.items[j]))
			.slice(0, 6)
		const ss = slots(near.length)
		return near.map((j, n) => ({ i: j, ox: ss[n].x, oy: ss[n].y, k: RATIO }))
	}
	/** Where the close-up puts the title (flood and marquee): a fixed spot of the free area. */
	function heroSpot() {
		const p = hooks.current.cinePad()
		const aw = W - p.l - p.r
		const ah = H - p.t - p.b
		const small = W < 640
		const h = small
			? clamp(ah * 0.5, 120, 280)
			: cfg.cinema === "marquee"
				? clamp(ah * 0.46, 170, 420)
				: clamp(ah * 0.46, 170, 440)
		const cx = p.l + aw * (cfg.cinema === "marquee" && !small ? 0.66 : 0.5)
		const cy = p.t + ah * 0.5
		return { cx, cy, w: h / 1.5, h, aw, ah, p }
	}
	function cineCam(isl: Island, i: number) {
		const r = isl.cell.r ?? 100
		const spot = heroSpot()
		if (cfg.cinema === "lens") {
			const w = isl.pos.w[i]
			const pre = W < 640 ? 30 : 40
			const s = Math.min(pre / w, (1.05 * Math.max(spot.aw, spot.ah)) / r)
			// The shore sits near the edge of the free area; the title and its ring fill the flat middle.
			const ge =
				(W < 640 ? 0.6 : 0.5) * Math.min(spot.aw, spot.ah) +
				0.15 * Math.abs(spot.aw - spot.ah)
			const Q = 1.65
			const heroW = Math.min(spot.w, (0.7 * ge) / Q)
			const m = Math.max(1, heroW / (w * s))
			const d0 = Q * w * s
			const de = Math.max(r * s, d0 * 1.5)
			let a = 1e6
			if (m * de > ge) {
				let lo = 0.5
				let hi = 1e6
				for (let k = 0; k < 60; k++) {
					const mid = Math.sqrt(lo * hi)
					if (m * d0 + mid * Math.log1p((m * (de - d0)) / mid) > ge) hi = mid
					else lo = mid
				}
				a = lo
			}
			return {
				x: isl.pos.x[i] - (spot.cx - W / 2) / s,
				y: isl.pos.y[i] - (spot.cy - H / 2) / s,
				s,
				m,
				a,
				d0,
			}
		}
		// Flood and marquee: the island fills the free area, its shore near the edges.
		const s =
			cfg.cinema === "marquee" && W >= 640
				? Math.min(spot.aw * 0.9, spot.ah * 1.45) / (2 * r)
				: Math.min(spot.aw, spot.ah) / (2 * r * 0.98)
		const ax =
			cfg.cinema === "marquee" && W >= 640 ? spot.p.l + spot.aw * 0.62 : spot.cx
		const ay =
			cfg.cinema === "marquee" && W >= 640 ? spot.p.t + spot.ah * 0.62 : spot.cy
		return {
			x: isl.cell.cx - (ax - W / 2) / s,
			y: isl.cell.cy - (ay - H / 2) / s,
			s,
			m: 1,
			a: 1e6,
			d0: 0,
		}
	}
	function openCine(isl: Island, i: number): void {
		if (cine && cine.to === 1) {
			moveCine(isl, i, 0)
			return
		}
		const c = cineCam(isl, i)
		const spot = heroSpot()
		lens.x = spot.cx
		lens.y = spot.cy
		lens.from = { m: lens.m, a: lens.a, d0: lens.d0 }
		lens.to = { m: c.m, a: c.a, d0: c.d0 }
		if (cfg.cinema === "lens" && lens.e < 0.01) {
			lens.m = c.m
			lens.a = c.a
			lens.d0 = c.d0
		}
		cine = {
			isl,
			i,
			e: cine?.e ?? 0,
			to: 1,
			t0: performance.now(),
			e0: cine?.e ?? 0,
			fam: family(isl, i),
			swap: null,
			back: null,
		}
		hover = null
		flyTo(c.x, c.y, c.s, 720)
		invalidate()
	}
	function moveCine(isl: Island, i: number, dir: number): void {
		if (!cine) {
			openCine(isl, i)
			return
		}
		const changed = isl !== cine.isl
		cine.swap = {
			isl: cine.isl,
			i: cine.i,
			t0: performance.now(),
			dir,
			fam: cine.fam,
		}
		cine.isl = isl
		cine.i = i
		cine.fam = family(isl, i)
		hover = null
		if (changed || cfg.cinema === "lens") {
			const c = cineCam(isl, i)
			lens.from = { m: lens.m, a: lens.a, d0: lens.d0 }
			lens.to = { m: c.m, a: c.a, d0: c.d0 }
			flyTo(c.x, c.y, c.s, changed ? 760 : 520)
		}
		invalidate()
	}
	function closeCine() {
		if (!cine) return
		const isl = cine.isl
		const i = cine.i
		const w = isl.pos.w[i]
		// Back on the map, the title stays big enough to read with its ring around it.
		const s = clamp((H * 0.3) / 1.5 / w, fitS * 1.3, maxS)
		const p = pad()
		cine.back = {
			x: isl.pos.x[i] - (p.l - p.r) / 2 / s,
			y: isl.pos.y[i] - (p.t - p.b) / 2 / s,
			s,
		}
		cine.to = 0
		cine.t0 = performance.now()
		cine.e0 = cine.e
		lens.from = { m: lens.m, a: lens.a, d0: lens.d0 }
		lens.to = { ...lens.from }
		flyTo(cine.back.x, cine.back.y, cine.back.s, 620)
		invalidate()
	}

	// ------------------------------------------------------------ drawing

	function drawPoster(
		it: W,
		x: number,
		y: number,
		w: number,
		h: number,
		a: number,
		big = false,
	) {
		if (a <= 0.01) return
		ctx.globalAlpha = a
		const im = it.p ? bestImage(it.p, w * dpr, big) : null
		ctx.fillStyle = "#1c1917"
		ctx.fillRect(x, y, w, h)
		if (im) ctx.drawImage(im, x, y, w, h)
		const ring = it.r ? "#a3e635" : it.f & 4 ? "#f59e0b" : null
		if (ring) {
			ctx.strokeStyle = ring
			ctx.lineWidth = big ? 4 : 2.5
			ctx.strokeRect(x - 1, y - 1, w + 2, h + 2)
		}
		if (w >= 96 && !big) {
			const txt = `${it.m}%`
			ctx.font = `800 ${w >= 160 ? 15 : 12}px ${BODY}`
			const tw = ctx.measureText(txt).width
			const ph = w >= 160 ? 22 : 18
			ctx.fillStyle = "rgba(12,10,9,.82)"
			ctx.beginPath()
			ctx.roundRect(x + 6, y + h - ph - 6, tw + 12, ph, ph / 2)
			ctx.fill()
			ctx.fillStyle = HEAT[it.m] ?? "#fbbf24"
			ctx.textBaseline = "middle"
			ctx.textAlign = "left"
			ctx.fillText(txt, x + 12, y + h - 6 - ph / 2 + 1)
		}
		ctx.globalAlpha = 1
	}

	function islandPath(isl: Island) {
		const n = isl.outline.length / 2
		const path = new Path2D()
		let x0 = Number.POSITIVE_INFINITY
		let x1 = Number.NEGATIVE_INFINITY
		let y0 = Number.POSITIVE_INFINITY
		let y1 = Number.NEGATIVE_INFINITY
		for (let k = 0; k < n; k++) {
			P(isl.outline[2 * k], isl.outline[2 * k + 1])
			isl.scr[2 * k] = px
			isl.scr[2 * k + 1] = py
			if (k) path.lineTo(px, py)
			else path.moveTo(px, py)
			if (px < x0) x0 = px
			if (px > x1) x1 = px
			if (py < y0) y0 = py
			if (py > y1) y1 = py
		}
		path.closePath()
		P(isl.cell.cx, isl.cell.cy)
		isl.sx = px
		isl.sy = py
		isl.R = (isl.cell.r ?? 100) * pk
		isl.on = !(x0 > W || x1 < 0 || y0 > H || y1 < 0)
		return { path, x0, x1, y0, y1 }
	}

	function drawBackdrop(
		isl: Island,
		i: number,
		path: Path2D,
		box: { x0: number; x1: number; y0: number; y1: number },
		a: number,
	) {
		const it = isl.items[i]
		if (!it?.b || a <= 0.01) return
		const bw = box.x1 - box.x0
		const bh = box.y1 - box.y0
		const im = backdrop(it.b, Math.max(bw, bh) * dpr)
		ctx.save()
		ctx.clip(path)
		ctx.globalAlpha = a
		ctx.fillStyle = "#0c0a09"
		ctx.fill(path)
		if (im) {
			// Cover the island's box, like object-fit: cover.
			const ir = im.naturalWidth / Math.max(1, im.naturalHeight)
			let w = bw
			let h = bw / ir
			if (h < bh) {
				h = bh
				w = bh * ir
			}
			ctx.drawImage(im, box.x0 + (bw - w) / 2, box.y0 + (bh - h) / 2, w, h)
		}
		// Sink the edges so the shoreline and the title stand out.
		const cx = (box.x0 + box.x1) / 2
		const cy = (box.y0 + box.y1) / 2
		const g = ctx.createRadialGradient(
			cx,
			cy,
			Math.min(bw, bh) * 0.2,
			cx,
			cy,
			Math.max(bw, bh) * 0.62,
		)
		g.addColorStop(0, "rgba(12,10,9,.15)")
		g.addColorStop(1, "rgba(12,10,9,.78)")
		ctx.fillStyle = g
		ctx.fillRect(box.x0, box.y0, bw, bh)
		ctx.restore()
		ctx.globalAlpha = 1
	}

	function frame(now: number) {
		raf = 0
		let animating = false
		if (!world) return
		if (fly) {
			const t = clamp((now - fly.t0) / fly.ms, 0, 1)
			const k = ease(t)
			cam.s = Math.exp(
				Math.log(fly.from.s) + (Math.log(fly.to.s) - Math.log(fly.from.s)) * k,
			)
			cam.x = fly.from.x + (fly.to.x - fly.from.x) * k
			cam.y = fly.from.y + (fly.to.y - fly.from.y) * k
			if (cfg.cinema === "lens" && cine) {
				lens.m = lerp(lens.from.m, lens.to.m, k)
				lens.a = Math.exp(lerp(Math.log(lens.from.a), Math.log(lens.to.a), k))
				lens.d0 = lerp(lens.from.d0, lens.to.d0, k)
			}
			if (t >= 1) fly = null
			animating = true
		} else if (!cine && Math.abs(vel.x) + Math.abs(vel.y) > 0.05) {
			cam.x -= vel.x / cam.s
			cam.y -= vel.y / cam.s
			vel.x *= 0.9
			vel.y *= 0.9
			clampCam()
			animating = true
		}
		if (cine) {
			const t = clamp((now - cine.t0) / (reduce() ? 1 : 700), 0, 1)
			cine.e = lerp(cine.e0, cine.to, ease(t))
			if (t < 1) animating = true
			else if (cine.to === 0) {
				cine = null
				lens.e = 0
			}
			if (cine?.swap && now - cine.swap.t0 > 420) cine.swap = null
			if (cine?.swap) animating = true
		}
		lens.e = cfg.cinema === "lens" && cine ? cine.e : 0

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		ctx.clearRect(0, 0, W, H)
		const cur = hooks.current.current()
		const pass = hooks.current.pass

		// A grouping switch: the old islands sink away while the new ones rise.
		let worldA = 1
		if (old) {
			const t = clamp((now - old.t0) / 520, 0, 1)
			worldA = ease(t)
			ctx.globalAlpha = 1 - worldA
			for (const isl of old.islands) {
				const { path } = islandPath(isl)
				ctx.fillStyle = isl.cell.fill
				ctx.fill(path)
			}
			ctx.globalAlpha = 1
			if (t >= 1) old = null
			animating = true
		}

		const flood = cine && cfg.cinema !== "lens" ? cine : null
		const cineE = cine ? cine.e : 0
		const next: Drawn[] = []
		const cand: {
			isl: Island
			i: number
			x: number
			y: number
			w: number
			h: number
			a: number
		}[] = []
		const paints: { isl: Island; path: Path2D; p1: number; cineA: number }[] =
			[]
		for (const isl of islands) {
			const box = islandPath(isl)
			if (!isl.on) continue
			const { path } = box
			ctx.globalAlpha = worldA
			ctx.fillStyle = isl.cell.fill
			ctx.fill(path)
			const isCine = cine?.isl === isl || cine?.swap?.isl === isl
			// The island under the close-up: its ground turns into the title's backdrop.
			if (cine && isCine) {
				if (cine.swap && cine.swap.isl !== cine.isl && cine.swap.isl === isl) {
					drawBackdrop(
						isl,
						cine.swap.i,
						path,
						box,
						cineE * (1 - clamp((now - cine.swap.t0) / 420, 0, 1)),
					)
				} else if (cine.isl === isl) {
					if (cine.swap && cine.swap.isl === isl)
						drawBackdrop(isl, cine.swap.i, path, box, cineE)
					const fade =
						cine.swap && cine.swap.isl === isl
							? clamp((now - cine.swap.t0) / 420, 0, 1)
							: 1
					drawBackdrop(isl, cine.i, path, box, cineE * fade)
				}
			}
			ctx.globalAlpha = worldA
			ctx.lineWidth =
				isl.cell.id === cur || (cine && cine.isl === isl) ? 3 : 1.5
			ctx.strokeStyle =
				cine && cine.isl === isl
					? mix(isl.look.color, "#ffffff", 0.3)
					: isl.cell.id === cur
						? "#fbbf24"
						: isl.cell.rim
			ctx.stroke(path)
			ctx.globalAlpha = 1
			const p1 = clamp((isl.w1 * pk - T0) / (T1 - T0), 0, 1)
			const cineA =
				cine?.isl === isl
					? cineE
					: cineE * (cfg.cinema === "marquee" ? 1 : 0.35)
			under({
				g: ctx,
				cfg,
				look: isl.look,
				x: isl.sx,
				y: isl.sy,
				R: isl.R,
				p1,
				path,
				cine: cineA,
			})
			paints.push({ isl, path, p1, cineA })
			if (p1 > 0.6 && !isl.loaded && !isl.asked) {
				isl.asked = true
				hooks.current.needTree(isl)
			}
			// Posters: every title of the fractal big enough to read, on screen.
			const hideA = flood && flood.isl === isl ? 1 - cineE : 1
			if (hideA <= 0.01) continue
			const n = isl.items.length
			for (let i = 0; i < n; i++) {
				const it = isl.items[i]
				if (!pass(it) && !(cine && cine.isl === isl && cine.i === i)) continue
				P(isl.pos.x[i], isl.pos.y[i])
				const sw = isl.pos.w[i] * pk
				if (sw < T0) continue
				const sh = sw * 1.5
				const x = px - sw / 2
				const y = py - sh / 2
				if (x > W || y > H || x + sw < 0 || y + sh < 0) continue
				cand.push({
					isl,
					i,
					x,
					y,
					w: sw,
					h: sh,
					a: clamp((sw - T0) / (T1 - T0), 0, 1) * hideA * worldA,
				})
			}
		}
		if (cand.length > MAX) {
			cand.sort((a, b) => b.w - a.w)
			cand.length = MAX
		}
		// Lines from each poster to its children, under the posters.
		if (cfg.lines && cand.length) {
			const at = new Map<string, (typeof cand)[number]>()
			for (const c of cand) at.set(`${c.isl.cell.id}|${c.i}`, c)
			ctx.lineWidth = 1.5
			for (const c of cand) {
				const p = c.isl.par[c.i]
				if (p < 0) continue
				const q = at.get(`${c.isl.cell.id}|${p}`)
				if (!q) continue
				ctx.globalAlpha = Math.min(c.a, q.a) * 0.55
				ctx.strokeStyle = mix(c.isl.look.color, "#ffffff", 0.25)
				ctx.beginPath()
				ctx.moveTo(q.x + q.w / 2, q.y + q.h / 2)
				ctx.lineTo(c.x + c.w / 2, c.y + c.h / 2)
				ctx.stroke()
			}
			ctx.globalAlpha = 1
		}
		const heroKey =
			cine && cfg.cinema === "lens" ? `${cine.isl.cell.id}|${cine.i}` : ""
		let heroDrawn: (typeof cand)[number] | null = null
		// In the lens, nothing outgrows the title under it (its parent would otherwise loom larger).
		let capW = Number.POSITIVE_INFINITY
		if (heroKey && cine) {
			P(cine.isl.pos.x[cine.i], cine.isl.pos.y[cine.i])
			capW = Math.max(T1, cine.isl.pos.w[cine.i] * pk * lerp(8, 0.78, cineE))
		}
		for (const c of cand) {
			if (heroKey && `${c.isl.cell.id}|${c.i}` === heroKey) {
				heroDrawn = c
				continue
			}
			if (c.w > capW) {
				const cx = c.x + c.w / 2
				const cy = c.y + c.h / 2
				c.w = capW
				c.h = capW * 1.5
				c.x = cx - c.w / 2
				c.y = cy - c.h / 2
			}
			drawPoster(c.isl.items[c.i], c.x, c.y, c.w, c.h, c.a)
			if (c.a > 0.5)
				next.push({
					isl: c.isl,
					i: c.i,
					x: c.x,
					y: c.y,
					w: c.w,
					h: c.h,
					fam: false,
				})
		}
		// Lens: the title under the lens last, on top, with its big image.
		if (cine && cfg.cinema === "lens") {
			const isl = cine.isl
			P(isl.pos.x[cine.i], isl.pos.y[cine.i])
			const w = Math.max(isl.pos.w[cine.i] * pk, heroDrawn?.w ?? 0)
			const h = w * 1.5
			frameHero(px - w / 2, py - h / 2, w, h, cineE)
			drawPoster(
				isl.items[cine.i],
				px - w / 2,
				py - h / 2,
				w,
				h,
				1,
				cineE > 0.3,
			)
			next.push({
				isl,
				i: cine.i,
				x: px - w / 2,
				y: py - h / 2,
				w,
				h,
				fam: true,
			})
		}
		for (const p of paints)
			over(
				{
					g: ctx,
					cfg,
					look: p.isl.look,
					x: p.isl.sx,
					y: p.isl.sy,
					R: p.isl.R,
					p1: p.p1,
					path: p.path,
					cine: p.cineA,
				},
				W,
			)

		// Flood and marquee: the title and its family, magnified, standing in the island.
		if (flood) drawFlood(flood, now, next)

		drawn = next
		if (hover) {
			const d = drawn.find((x) => x.isl === hover?.isl && x.i === hover?.i)
			if (d && !(cine && d.isl === cine.isl && d.i === cine.i)) tooltip(d)
		}
		const g = window as unknown as { __rx5f?: number[] }
		if (g.__rx5f) g.__rx5f.push(performance.now() - now)
		for (const fn of listeners) fn()
		if (animating) invalidate()
	}

	/** A soft dark halo and a hairline around the title in the close-up. */
	function frameHero(x: number, y: number, w: number, h: number, a: number) {
		if (a <= 0.01) return
		ctx.globalAlpha = a * 0.5
		ctx.fillStyle = "#000"
		for (const k of [18, 10, 4]) {
			ctx.globalAlpha = a * 0.12
			ctx.beginPath()
			ctx.roundRect(x - k, y - k + 6, w + 2 * k, h + 2 * k, k)
			ctx.fill()
		}
		ctx.globalAlpha = a * 0.5
		ctx.strokeStyle = "rgba(255,255,255,.35)"
		ctx.lineWidth = 1
		ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1)
		ctx.globalAlpha = 1
	}

	function drawFlood(c: Cine, now: number, next: Drawn[]) {
		const spot = heroSpot()
		const e = ease(clamp(c.e, 0, 1))
		const place1 = (
			isl: Island,
			i: number,
			fam: Fam[],
			alpha: number,
			slide: number,
		) => {
			// Where the title sits on the map right now, and where the close-up puts it.
			P(isl.pos.x[i], isl.pos.y[i])
			const cx = lerp(px, spot.cx, e) + slide
			const cy = lerp(py, spot.cy, e)
			const w = lerp(isl.pos.w[i] * pk, spot.w, e)
			const h = w * 1.5
			// Its closest titles glide from their places on the map onto a ring around it.
			for (const f of fam) {
				P(isl.pos.x[f.i], isl.pos.y[f.i])
				const fw = lerp(isl.pos.w[f.i] * pk, f.k * spot.w, e)
				const fx = lerp(px, spot.cx + f.ox * spot.w, e) + slide - fw / 2
				const fy = lerp(py, spot.cy + f.oy * spot.w, e) - (fw * 1.5) / 2
				const fa = alpha * clamp((fw - 20) / 30, 0, 1)
				drawPoster(isl.items[f.i], fx, fy, fw, fw * 1.5, fa)
				if (alpha > 0.9 && fa > 0.5)
					next.push({
						isl,
						i: f.i,
						x: fx,
						y: fy,
						w: fw,
						h: fw * 1.5,
						fam: true,
					})
			}
			frameHero(cx - w / 2, cy - h / 2, w, h, e * alpha)
			drawPoster(isl.items[i], cx - w / 2, cy - h / 2, w, h, alpha, e > 0.3)
			if (alpha > 0.9)
				next.push({ isl, i, x: cx - w / 2, y: cy - h / 2, w, h, fam: true })
		}
		if (c.swap) {
			const t = ease(clamp((now - c.swap.t0) / 420, 0, 1))
			place1(c.swap.isl, c.swap.i, c.swap.fam, 1 - t, -c.swap.dir * 60 * t)
			place1(c.isl, c.i, c.fam, t, c.swap.dir * 60 * (1 - t))
		} else place1(c.isl, c.i, c.fam, 1, 0)
	}

	function tooltip(d: Drawn) {
		const it = d.isl.items[d.i]
		ctx.strokeStyle = "#fbbf24"
		ctx.lineWidth = 3
		ctx.strokeRect(d.x - 1.5, d.y - 1.5, d.w + 3, d.h + 3)
		ctx.font = `700 13px ${BODY}`
		const t = `${it.t}${it.yr ? ` (${it.yr})` : ""}`
		const tw = Math.min(260, ctx.measureText(t).width)
		const x = clamp(d.x + d.w / 2 - tw / 2 - 8, 4, W - tw - 20)
		const y = Math.min(d.y + d.h + 6, H - 28)
		ctx.fillStyle = "rgba(12,10,9,.92)"
		ctx.beginPath()
		ctx.roundRect(x, y, tw + 16, 24, 12)
		ctx.fill()
		ctx.fillStyle = "#fff"
		ctx.textAlign = "left"
		ctx.textBaseline = "middle"
		ctx.fillText(t, x + 8, y + 12.5, 260)
	}

	// ------------------------------------------------------------ input

	const pts = new Map<number, { x: number; y: number }>()
	let mode: "none" | "pan" | "pinch" = "none"
	let moved = 0
	let startX = 0
	let last = { x: 0, y: 0, t: 0 }
	let pinch = { d: 1, s: 1, wx: 0, wy: 0 }
	let over_ = 0
	const local = (e: PointerEvent | WheelEvent) => {
		const r = canvas.getBoundingClientRect()
		return { x: e.clientX - r.left, y: e.clientY - r.top }
	}
	const posterAt = (x: number, y: number) => {
		for (let k = drawn.length - 1; k >= 0; k--) {
			const d = drawn[k]
			if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d
		}
		return null
	}
	const islandAt = (x: number, y: number) => {
		for (const isl of islands) if (isl.on && inPoly(isl.scr, x, y)) return isl
		return null
	}
	/** Pushing further into a poster that already fills most of the view opens it. */
	const bigEnough = (d: Drawn | null) =>
		!!d && d.h >= H * (W < 640 ? 0.42 : 0.55)
	function overzoom(amount: number, x: number, y: number) {
		const d = posterAt(x, y)
		if (!bigEnough(d) && cam.s < maxS * 0.98) {
			over_ = 0
			return false
		}
		over_ += amount
		if (over_ < 150) return true
		over_ = 0
		let t = d
		if (!t) {
			let bd = Number.POSITIVE_INFINITY
			for (const q of drawn) {
				const dd = Math.hypot(q.x + q.w / 2 - x, q.y + q.h / 2 - y)
				if (dd < bd) {
					bd = dd
					t = q
				}
			}
		}
		if (t)
			hooks.current.onPoster(t.isl, t.i, { x: t.x, y: t.y, w: t.w, h: t.h })
		return true
	}

	function down(e: PointerEvent) {
		canvas.setPointerCapture(e.pointerId)
		const p = local(e)
		pts.set(e.pointerId, p)
		if (!cine) fly = null
		vel = { x: 0, y: 0 }
		if (pts.size === 2) {
			const [a, b] = [...pts.values()]
			const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
			const w = toWorld(mid.x, mid.y)
			pinch = {
				d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
				s: cam.s,
				wx: w.x,
				wy: w.y,
			}
			mode = "pinch"
		} else {
			mode = "pan"
			moved = 0
			startX = p.x
			last = { ...p, t: performance.now() }
		}
	}
	function move(e: PointerEvent) {
		const p = local(e)
		if (!pts.has(e.pointerId)) {
			if (e.pointerType === "mouse") {
				const d = posterAt(p.x, p.y)
				if (
					(d ? `${d.isl.cell.id}|${d.i}` : "") !==
					(hover ? `${hover.isl.cell.id}|${hover.i}` : "")
				) {
					hover = d
					invalidate()
				}
				canvas.style.cursor =
					d || islandAt(p.x, p.y) ? "pointer" : cine ? "default" : "grab"
			}
			return
		}
		const prev = pts.get(e.pointerId) as { x: number; y: number }
		pts.set(e.pointerId, p)
		if (mode === "pinch" && pts.size >= 2) {
			const [a, b] = [...pts.values()]
			const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
			const ratio = Math.hypot(a.x - b.x, a.y - b.y) / pinch.d
			if (cine) {
				if (ratio < 0.72) {
					pinch.d = 1e9
					hooks.current.onCineOut()
				}
				return
			}
			if (ratio > 1 && overzoom((ratio - 1) * 40, mid.x, mid.y)) return
			cam.s = clamp(pinch.s * ratio, fitS * 0.7, maxS)
			cam.x = pinch.wx - (mid.x - W / 2) / cam.s
			cam.y = pinch.wy - (mid.y - H / 2) / cam.s
			clampCam()
			invalidate()
			return
		}
		if (mode === "pan") {
			const dx = p.x - prev.x
			const dy = p.y - prev.y
			moved += Math.abs(dx) + Math.abs(dy)
			if (cine) return
			cam.x -= dx / cam.s
			cam.y -= dy / cam.s
			clampCam()
			const t = performance.now()
			vel = {
				x: (dx / Math.max(1, t - last.t)) * 16,
				y: (dy / Math.max(1, t - last.t)) * 16,
			}
			last = { ...p, t }
			hover = null
			invalidate()
		}
	}
	function up(e: PointerEvent) {
		const p = local(e)
		const was = mode
		pts.delete(e.pointerId)
		if (pts.size === 1 && was === "pinch") {
			mode = "pan"
			const [q] = [...pts.values()]
			last = { ...q, t: performance.now() }
			moved = 99
			vel = { x: 0, y: 0 }
			return
		}
		if (pts.size) return
		mode = "none"
		if (was === "pan" && cine && moved >= 8) {
			const dx = p.x - startX
			if (Math.abs(dx) > 60) hooks.current.onSwipe(dx < 0 ? 1 : -1)
			return
		}
		if (was === "pan" && moved < 8) {
			vel = { x: 0, y: 0 }
			const d = posterAt(p.x, p.y)
			if (d) {
				hooks.current.onPoster(d.isl, d.i, { x: d.x, y: d.y, w: d.w, h: d.h })
				return
			}
			const isl = islandAt(p.x, p.y)
			if (isl) hooks.current.onIsland(isl)
			return
		}
		if (performance.now() - last.t > 80) vel = { x: 0, y: 0 }
		invalidate()
	}
	function wheel(e: WheelEvent) {
		e.preventDefault()
		const p = local(e)
		const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
		if (cine) {
			if (dy > 0) {
				over_ += dy
				if (over_ > 220) {
					over_ = 0
					hooks.current.onCineOut()
				}
			} else over_ = 0
			return
		}
		if (dy < 0 && overzoom(-dy, p.x, p.y)) return
		// Stop growing a poster that already fills the view: the next push opens it.
		if (dy < 0 && bigEnough(posterAt(p.x, p.y))) return
		fly = null
		zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0022)), p.x, p.y)
	}
	function leave() {
		if (hover) {
			hover = null
			invalidate()
		}
	}
	function resize() {
		const r = canvas.getBoundingClientRect()
		W = Math.max(1, r.width)
		H = Math.max(1, r.height)
		dpr = Math.min(2, window.devicePixelRatio || 1)
		canvas.width = Math.round(W * dpr)
		canvas.height = Math.round(H * dpr)
		computeScales()
		if (cine) {
			const c = cineCam(cine.isl, cine.i)
			cam.x = c.x
			cam.y = c.y
			cam.s = c.s
			const spot = heroSpot()
			lens.x = spot.cx
			lens.y = spot.cy
			lens.m = c.m
			lens.a = c.a
			lens.d0 = c.d0
		}
		invalidate()
	}
	canvas.addEventListener("pointerdown", down)
	canvas.addEventListener("pointermove", move)
	canvas.addEventListener("pointerup", up)
	canvas.addEventListener("pointercancel", up)
	canvas.addEventListener("pointerleave", leave)
	canvas.addEventListener("wheel", wheel, { passive: false })
	const ro = new ResizeObserver(resize)
	ro.observe(canvas)
	resize()

	const view = (): View => {
		const f = focusIsland()
		return {
			cam: { ...cam, w: W, h: H },
			fit: fitS,
			max: maxS,
			stops: stops(f),
			focus: f?.cell ?? null,
			cine: !!cine,
		}
	}
	// For the verification scripts.
	;(window as unknown as { __rx5?: unknown }).__rx5 = {
		view,
		drawn: () =>
			drawn.map((d) => ({
				k: d.isl.items[d.i].k,
				gen: d.isl.gen[d.i],
				x: d.x,
				y: d.y,
				w: d.w,
				h: d.h,
				cell: d.isl.cell.id,
				fam: d.fam,
			})),
		islands: () =>
			islands.map((i) => ({
				id: i.cell.id,
				x: i.sx,
				y: i.sy,
				R: i.R,
				on: i.on,
				loaded: i.loaded,
				n: i.items.length,
			})),
		cine: () =>
			cine
				? {
						cell: cine.isl.cell.id,
						i: cine.i,
						e: cine.e,
						k: cine.isl.items[cine.i]?.k,
					}
				: null,
	}
	return {
		setWorld,
		setTree,
		refilter,
		invalidate,
		repad: () => {
			computeScales()
			invalidate()
		},
		flyTo,
		flyToIsland,
		stepTo,
		overview,
		zoomBy,
		panBy,
		openCine,
		moveCine,
		closeCine,
		cine: () => (cine && cine.to === 1 ? { isl: cine.isl, i: cine.i } : null),
		island: (id: string) => islands.find((x) => x.cell.id === id) ?? null,
		islands: () => islands,
		view,
		subscribe: (fn: () => void) => {
			listeners.add(fn)
			return () => listeners.delete(fn)
		},
		posterRect: (isl: Island, i: number) => {
			const d = drawn.find((x) => x.isl === isl && x.i === i)
			return d ? { x: d.x, y: d.y, w: d.w, h: d.h } : null
		},
		/** The poster nearest the middle of the free area. */
		centerPoster: () => {
			const p = pad()
			const x = p.l + (W - p.l - p.r) / 2
			const y = p.t + (H - p.t - p.b) / 2
			let best: Drawn | null = null
			let bd = Number.POSITIVE_INFINITY
			for (const d of drawn) {
				const dd =
					Math.hypot(d.x + d.w / 2 - x, d.y + d.h / 2 - y) / Math.sqrt(d.w)
				if (dd < bd) {
					bd = dd
					best = d
				}
			}
			return best
		},
		destroy: () => {
			cancelAnimationFrame(raf)
			ro.disconnect()
			canvas.removeEventListener("pointerdown", down)
			canvas.removeEventListener("pointermove", move)
			canvas.removeEventListener("pointerup", up)
			canvas.removeEventListener("pointercancel", up)
			canvas.removeEventListener("pointerleave", leave)
			canvas.removeEventListener("wheel", wheel)
			if (wakeImg === invalidate) wakeImg = null
		},
	}
}
