// PROTOTYPE - throwaway. The round-4 map (#180): one canvas, drawn only when something moves.
// Semantic zoom per region, decided by how big the region is on screen:
//   level 0: a color field with a big label, sized by how many titles, tinted by fit to your taste;
//   levels 1-3: a few, then more of the region's best picks as posters (they glide to their new places);
//   past the deepest level: the caller opens the cinematic close-up of the poster under the pointer.
// Switching grouping keeps the posters on screen and flies each one to the region it now belongs to.
// Input: drag (with inertia), wheel and pinch to zoom around the pointer, tap a region to fly in, tap a poster.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { HEAT } from "~/ui/prototype-rec-explorer-2/Stage"
import { type Cell, LEVELS, type World, grid, hit, shapeOf } from "./geo"
import type { W } from "./wire4"

export const TMDB = "https://image.tmdb.org/t/p"
const FONT = "'Big Shoulders Display','Gabarito',system-ui,sans-serif"
const BODY = "'Noto Sans','Gabarito',system-ui,sans-serif"

export type Cam = { x: number; y: number; s: number; w: number; h: number }
export type View = {
	cam: Cam
	fit: number
	region: number
	max: number
	/** The region at the middle of the screen, once zoomed in past the overview. */
	focus: Cell | null
}
export type MapHandle = {
	flyTo: (x: number, y: number, s: number, ms?: number) => void
	flyToCell: (c: Cell, ms?: number) => void
	overview: (ms?: number) => void
	zoomBy: (f: number) => void
	panBy: (dx: number, dy: number) => void
	view: () => View
	subscribe: (fn: () => void) => () => void
	world: () => World
	redraw: () => void
	/** Screen rect of a title's poster if it is on screen. */
	posterRect: (k: string) => { x: number; y: number; w: number; h: number } | null
}
export type Pad = { t: number; r: number; b: number; l: number }
type Props = {
	world: World
	/** Screen space the controls cover; the overview fits the map inside the rest. */
	pad: Pad
	pass: (it: W) => boolean
	rev: number
	current: string | null
	onPoster: (it: W, cell: Cell, rect: { x: number; y: number; w: number; h: number }) => void
	onCell: (cell: Cell) => void
	className?: string
	label: string
}

// ---------------------------------------------------------------- images

type Img = { im: HTMLImageElement; ok: boolean }
const IMGS = new Map<string, Img>()
let wake: (() => void) | null = null
function image(path: string, size: "w154" | "w342" | "w500") {
	const key = size + path
	let e = IMGS.get(key)
	if (!e) {
		const im = new Image()
		im.decoding = "async"
		e = { im, ok: false }
		const ent = e
		im.src = `${TMDB}/${size}${path}`
		im
			.decode()
			.then(() => {
				ent.ok = true
				wake?.()
			})
			.catch(() => {})
		IMGS.set(key, e)
	}
	return e
}
function bestImage(path: string, px: number) {
	const want = px < 120 ? "w154" : px < 280 ? "w342" : "w500"
	const e = image(path, want)
	if (e.ok) return e.im
	for (const s of ["w500", "w342", "w154"] as const) {
		const o = IMGS.get(s + path)
		if (o?.ok) return o.im
	}
	return null
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

type Drawn = { it: W; cell: Cell; x: number; y: number; w: number; h: number }
type LevelState = { lvl: number; prev: number; t0: number }

export const MapCanvas = forwardRef<MapHandle, Props>(function MapCanvas(
	{ world, pad, pass, rev, current, onPoster, onCell, className = "", label },
	ref,
) {
	const cv = useRef<HTMLCanvasElement>(null)
	const eng = useRef<ReturnType<typeof makeEngine> | null>(null)
	const props = useRef({ pass, current, onPoster, onCell, pad })
	props.current = { pass, current, onPoster, onCell, pad }

	useEffect(() => {
		const e = makeEngine(cv.current as HTMLCanvasElement, props, world)
		eng.current = e
		return e.destroy
	}, [])
	useEffect(() => {
		eng.current?.setWorld(world)
	}, [world])
	useEffect(() => {
		eng.current?.invalidate()
	}, [rev, pass, current])
	useEffect(() => {
		eng.current?.repad()
	}, [pad.t, pad.r, pad.b, pad.l])

	useImperativeHandle(ref, () => ({
		flyTo: (x, y, s, ms) => eng.current?.flyTo(x, y, s, ms),
		flyToCell: (c, ms) => eng.current?.flyToCell(c, ms),
		overview: (ms) => eng.current?.overview(ms),
		zoomBy: (f) => eng.current?.zoomBy(f),
		panBy: (dx, dy) => eng.current?.panBy(dx, dy),
		view: () => (eng.current as ReturnType<typeof makeEngine>).view(),
		subscribe: (fn) => eng.current?.subscribe(fn) ?? (() => {}),
		world: () => (eng.current as ReturnType<typeof makeEngine>).world(),
		redraw: () => eng.current?.invalidate(),
		posterRect: (k) => eng.current?.posterRect(k) ?? null,
	}))

	return (
		<canvas
			ref={cv}
			className={className}
			style={{ touchAction: "none", display: "block" }}
			role="img"
			aria-label={label}
		/>
	)
})

function makeEngine(
	canvas: HTMLCanvasElement,
	props: { current: Pick<Props, "pass" | "current" | "onPoster" | "onCell" | "pad"> },
	initial: World,
) {
	const ctx = canvas.getContext("2d", { alpha: true }) as CanvasRenderingContext2D
	let W = 1
	let H = 1
	let dpr = 1
	let world = initial
	const cam: Cam = { x: world.w / 2, y: world.h / 2, s: 1, w: 1, h: 1 }
	let fitS = 1
	let regionS = 2
	let maxS = 10
	let minPx = 84
	let raf = 0
	let dirty = true
	let fly: { from: Cam; to: { x: number; y: number; s: number }; t0: number; ms: number } | null = null
	let vel = { x: 0, y: 0 }
	let hover: Drawn | null = null
	let drawn: Drawn[] = []
	const levels = new Map<string, LevelState>()
	const listeners = new Set<() => void>()
	const itemsCache = new WeakMap<Cell, { stamp: unknown; items: W[] }>()
	const gridCache = new Map<string, ReturnType<typeof grid>>()
	// Grouping or filter switch in progress.
	let trans: {
		t0: number
		old: World
		posters: { it: W; x: number; y: number; w: number; h: number; to: Cell | null }[]
		src: Map<string, { x: number; y: number; box: Cell["box"] | null }>
	} | null = null

	const visible = (c: Cell) => {
		const stamp = props.current.pass
		const hit = itemsCache.get(c)
		if (hit && hit.stamp === stamp) return hit.items
		const items = c.items.filter(stamp)
		itemsCache.set(c, { stamp, items })
		return items
	}
	const gridOf = (c: Cell, n: number) => {
		const k = `${c.id}|${n}|${c.inner.x}|${c.inner.w}`
		let g = gridCache.get(k)
		if (!g) {
			g = grid(c.inner, n)
			gridCache.set(k, g)
		}
		return g
	}

	const pad = () => props.current.pad
	const computeScales = () => {
		const p = pad()
		fitS = Math.min((W - p.l - p.r) / world.w, (H - p.t - p.b) / world.h) * 0.97
		const fits = world.cells.map((c) => Math.min(W / c.box.w, H / c.box.h) * 0.82).sort((a, b) => a - b)
		regionS = Math.max(fitS * 1.6, fits[Math.floor(fits.length / 2)] ?? fitS * 2)
		let minPw = Number.POSITIVE_INFINITY
		const top = LEVELS[world.kind][3]
		for (const c of world.cells) {
			const n = Math.min(top, Math.max(1, c.items.length))
			const g = gridOf(c, n)
			if (g.w > 0) minPw = Math.min(minPw, g.w)
		}
		maxS = clamp((H * 0.5) / (1.5 * (Number.isFinite(minPw) ? minPw : 20)), regionS * 1.5, fitS * 40)
		minPx = W < 640 ? 62 : 84
	}

	const resize = () => {
		const r = canvas.getBoundingClientRect()
		W = Math.max(1, r.width)
		H = Math.max(1, r.height)
		dpr = Math.min(2, window.devicePixelRatio || 1)
		canvas.width = Math.round(W * dpr)
		canvas.height = Math.round(H * dpr)
		const first = cam.w === 1
		cam.w = W
		cam.h = H
		computeScales()
		if (first) home()
		invalidate()
	}

	/** The camera at the overview: the whole map inside the part of the screen the controls leave free. */
	const homeCam = () => {
		const p = pad()
		return { x: world.w / 2 - (p.l - p.r) / 2 / fitS, y: world.h / 2 - (p.t - p.b) / 2 / fitS, s: fitS }
	}
	const home = () => {
		const h = homeCam()
		cam.x = h.x
		cam.y = h.y
		cam.s = h.s
	}
	const clampCam = () => {
		cam.s = clamp(cam.s, fitS * 0.7, maxS)
		const mx = Math.max(0, world.w / 2 - W / 2 / cam.s + W * 0.25 / cam.s)
		const my = Math.max(0, world.h / 2 - H / 2 / cam.s + H * 0.25 / cam.s)
		cam.x = clamp(cam.x, world.w / 2 - mx, world.w / 2 + mx)
		cam.y = clamp(cam.y, world.h / 2 - my, world.h / 2 + my)
	}

	function invalidate() {
		dirty = true
		if (!raf) raf = requestAnimationFrame(frame)
	}
	wake = invalidate

	const toWorld = (sx: number, sy: number) => ({ x: cam.x + (sx - W / 2) / cam.s, y: cam.y + (sy - H / 2) / cam.s })
	const toScreen = (x: number, y: number) => ({ x: W / 2 + (x - cam.x) * cam.s, y: H / 2 + (y - cam.y) * cam.s })

	const flyTo = (x: number, y: number, s: number, ms = 650) => {
		vel = { x: 0, y: 0 }
		const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
		fly = { from: { ...cam }, to: { x, y, s: clamp(s, fitS * 0.7, maxS) }, t0: performance.now(), ms: reduce ? 1 : ms }
		invalidate()
	}
	const flyToCell = (c: Cell, ms = 700) => {
		const p = pad()
		const f = c.frame ?? c.box
		const s = Math.min((W - p.l - p.r) / (f.w * 1.1), (H - p.t - p.b) / (f.h * 1.1))
		// Go at least deep enough that the region shows posters.
		const z = clamp(Math.max(s, fitS * 1.6), fitS, maxS)
		flyTo(f.x + f.w / 2 - (p.l - p.r) / 2 / z, f.y + f.h / 2 - (p.t - p.b) / 2 / z, z, ms)
	}
	const overview = (ms = 650) => {
		const h = homeCam()
		flyTo(h.x, h.y, h.s, ms)
	}
	const zoomAt = (f: number, sx: number, sy: number) => {
		const before = toWorld(sx, sy)
		cam.s = clamp(cam.s * f, fitS * 0.7, maxS)
		const after = toWorld(sx, sy)
		cam.x += before.x - after.x
		cam.y += before.y - after.y
		clampCam()
		invalidate()
	}
	const zoomBy = (f: number) => flyTo(cam.x, cam.y, cam.s * f, 320)
	const panBy = (dx: number, dy: number) => flyTo(cam.x + dx / cam.s, cam.y + dy / cam.s, cam.s, 220)

	const focusCell = () => {
		if (cam.s < fitS * 1.25) return null
		const p = pad()
		const w = toWorld(p.l + (W - p.l - p.r) / 2, p.t + (H - p.t - p.b) / 2)
		return hit(world, w.x, w.y)
	}

	// ------------------------------------------------------------ levels

	const pickLevel = (c: Cell, n: number) => {
		const lv = LEVELS[world.kind]
		let want = 0
		// The overview is color fields only.
		const deep = cam.s > fitS * 1.3
		for (let L = 3; L >= 1 && deep; L--) {
			const k = Math.min(lv[L], n)
			if (!k) continue
			if (L > 1 && k === Math.min(lv[L - 1], n)) continue
			const pw = gridOf(c, k).w * cam.s
			if (pw >= minPx) {
				want = L
				break
			}
		}
		const st = levels.get(c.id)
		if (!st) {
			levels.set(c.id, { lvl: want, prev: want, t0: 0 })
			return want
		}
		if (want < st.lvl && deep) {
			// Hysteresis: only drop a level once clearly too small.
			const k = Math.min(lv[st.lvl], n)
			if (k && gridOf(c, k).w * cam.s > minPx * 0.86) want = st.lvl
		}
		if (want !== st.lvl) {
			st.prev = st.lvl
			st.lvl = want
			st.t0 = performance.now()
		}
		return st.lvl
	}

	// ------------------------------------------------------------ drawing

	const setWorldTransform = () => ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (W / 2 - cam.x * cam.s), dpr * (H / 2 - cam.y * cam.s))
	const setScreen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

	function drawPoster(it: W, x: number, y: number, w: number, h: number, a: number, cell: Cell | null) {
		ctx.globalAlpha = a
		const im = it.p ? bestImage(it.p, w * dpr) : null
		ctx.fillStyle = "#1c1917"
		ctx.fillRect(x, y, w, h)
		if (im) ctx.drawImage(im, x, y, w, h)
		const ring = it.r ? "#a3e635" : it.f & 4 ? "#f59e0b" : null
		if (ring) {
			ctx.strokeStyle = ring
			ctx.lineWidth = 2.5
			ctx.strokeRect(x - 1, y - 1, w + 2, h + 2)
		}
		if (w >= 96 && cell) {
			// Taste match, bottom left.
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

	function label(c: Cell, lvl: number, lt: number, a: number) {
		// Screen-space label: big at the overview, a header once posters show.
		const p0 = toScreen(c.label.x, c.label.y)
		const boxW = c.box.w * cam.s
		const boxH = c.box.h * cam.s
		if (c.kind === "sector") return
		const big = clamp(c.label.size * cam.s, 13, 72)
		const head = c.kind === "blob" ? clamp(c.label.size * cam.s * 0.55, 14, 34) : clamp((c.inner.y - c.box.y) * cam.s * 0.5, 13, 34)
		// The label glides from its overview size to the header size as posters arrive.
		const st = levels.get(c.id)
		const from = st && st.prev > 0 ? head : big
		const to = lvl > 0 ? head : big
		const size = from + (to - from) * ease(lt)
		let y = p0.y
		if (c.kind === "blob") {
			const top = toScreen(c.cx, c.cy - (c.r ?? 0) * 0.66).y
			const y0 = st && st.prev > 0 ? top : p0.y
			const y1 = lvl > 0 ? top : p0.y
			y = y0 + (y1 - y0) * ease(lt)
		}
		// Small islands may carry a label a little wider than themselves.
		const maxW = c.kind === "blob" ? Math.max(boxW * 0.95, 96) : boxW * 0.9
		ctx.globalAlpha = a
		ctx.textAlign = c.label.align
		ctx.textBaseline = "top"
		// One line if it fits, else two, else smaller; never wider than the region.
		let fs = size
		let lines = [c.region.name]
		ctx.font = `900 ${fs}px ${FONT}`
		let tw = ctx.measureText(c.region.name).width
		if (tw > maxW) {
			const words = c.region.name.split(" ")
			if (words.length > 1) {
				let best = 1
				let bw = Number.POSITIVE_INFINITY
				for (let k = 1; k < words.length; k++) {
					const w = Math.max(ctx.measureText(words.slice(0, k).join(" ")).width, ctx.measureText(words.slice(k).join(" ")).width)
					if (w < bw) {
						bw = w
						best = k
					}
				}
				if (boxH > fs * 3.2) {
					lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")]
					tw = bw
				}
			}
			if (tw > maxW) {
				fs = Math.max(11, (fs * maxW) / tw)
				ctx.font = `900 ${fs}px ${FONT}`
				tw = Math.max(...lines.map((l) => ctx.measureText(l).width))
			}
		}
		if (tw > maxW * 1.05 || fs * lines.length > boxH * 0.8) {
			ctx.globalAlpha = 1
			return
		}
		if (c.kind === "blob" && lvl === 0 && lines.length > 1) y -= fs * 0.5
		ctx.fillStyle = "#fff"
		lines.forEach((l, k) => ctx.fillText(l, p0.x, y + k * fs * 0.95))
		let ly = y + fs * (0.95 * (lines.length - 1) + 1.02)
		// Second line: how many titles and how well they fit.
		const room = boxH - (ly - toScreen(c.box.x, c.box.y).y)
		const sub = Math.min(16, fs * 0.36 + 4)
		if (room > sub * 1.6 && fs >= 15) {
			const line = `${c.count.toLocaleString("en")} titles, ${c.fit}% your taste`
			let ss = sub
			ctx.font = `600 ${ss}px ${BODY}`
			const lw = ctx.measureText(line).width
			if (lw > maxW) {
				ss = (ss * maxW) / lw
				ctx.font = `600 ${ss}px ${BODY}`
			}
			if (ss >= 10) {
				ctx.fillStyle = "rgba(255,255,255,.75)"
				ctx.fillText(line, p0.x, ly)
				ly += ss * 1.45
			}
			if (lvl === 0 && room > sub * 4 && c.region.line) {
				ctx.font = `italic 500 ${Math.min(15, sub)}px ${BODY}`
				if (ctx.measureText(c.region.line).width <= maxW) {
					ctx.fillStyle = "rgba(255,255,255,.55)"
					ctx.fillText(c.region.line, p0.x, ly)
				}
			}
		}
		// The board is ranked by fit: the fit reads large in each tile's corner.
		if (world.kind === "tiles" && lvl === 0 && boxW > 90) {
			const b = toScreen(c.box.x + c.box.w, c.box.y + c.box.h)
			const big = Math.min(boxH * 0.34, 96)
			ctx.font = `900 ${big}px ${FONT}`
			ctx.textAlign = "right"
			ctx.textBaseline = "bottom"
			ctx.fillStyle = "rgba(255,255,255,.28)"
			ctx.fillText(`${c.fit}%`, b.x - boxW * 0.06, b.y - boxH * 0.03)
		}
		ctx.globalAlpha = 1
	}

	function drawRings() {
		const r = world.rings
		if (!r) return
		setWorldTransform()
		// "You" in the middle.
		const inner = r.radii[0][0] - 6
		const g = ctx.createRadialGradient(r.cx, r.cy, 0, r.cx, r.cy, inner)
		g.addColorStop(0, "rgba(251,191,36,.95)")
		g.addColorStop(1, "rgba(251,191,36,.15)")
		ctx.fillStyle = g
		ctx.beginPath()
		ctx.arc(r.cx, r.cy, inner, 0, Math.PI * 2)
		ctx.fill()
		setScreen()
		const c = toScreen(r.cx, r.cy)
		ctx.fillStyle = "#1c1917"
		ctx.textAlign = "center"
		ctx.textBaseline = "middle"
		ctx.font = `900 ${clamp(inner * cam.s * 0.42, 12, 40)}px ${FONT}`
		ctx.fillText("You", c.x, c.y)
		// Band names along the top.
		const names = ["Near you", "A step out", "Unexplored"]
		ctx.font = `700 ${clamp(14 * cam.s, 11, 18)}px ${BODY}`
		r.radii.forEach(([a, b], k) => {
			const p = toScreen(r.cx, r.cy - (a + b) / 2)
			ctx.fillStyle = "rgba(12,10,9,.7)"
			const t = names[k]
			const tw = ctx.measureText(t).width
			ctx.beginPath()
			ctx.roundRect(p.x - tw / 2 - 8, p.y - 11, tw + 16, 22, 11)
			ctx.fill()
			ctx.fillStyle = k === 0 ? "#fcd34d" : "rgba(255,255,255,.8)"
			ctx.fillText(t, p.x, p.y + 1)
		})
		// Region names outside the outer ring.
		const outer = r.radii[2][1]
		const seen = new Set<string>()
		const placed: { x0: number; y0: number; x1: number; y1: number }[] = []
		const byCount = [...world.cells].sort((a, b) => b.region.count - a.region.count)
		for (const cell of byCount) {
			if (seen.has(cell.region.id) || !cell.sector) continue
			seen.add(cell.region.id)
			const regionCells = world.cells.filter((x) => x.region.id === cell.region.id)
			const a0 = Math.min(...regionCells.map((x) => x.sector?.a0 ?? 0))
			const a1 = Math.max(...regionCells.map((x) => x.sector?.a1 ?? 0))
			const am = (a0 + a1) / 2
			const p = toScreen(r.cx + Math.cos(am) * (outer + 18), r.cy + Math.sin(am) * (outer + 18))
			const fs = clamp(30 * cam.s, 12, 44)
			const arcPx = (a1 - a0) * (outer + 18) * cam.s
			ctx.font = `900 ${fs}px ${FONT}`
			const t = cell.region.name
			const tw = ctx.measureText(t).width
			if (tw > arcPx * 1.6 && fs < 16) continue
			ctx.textAlign = Math.cos(am) > 0.25 ? "left" : Math.cos(am) < -0.25 ? "right" : "center"
			ctx.textBaseline = Math.sin(am) > 0.25 ? "top" : Math.sin(am) < -0.25 ? "bottom" : "middle"
			const bx0 = ctx.textAlign === "left" ? p.x : ctx.textAlign === "right" ? p.x - tw : p.x - tw / 2
			const by0 = ctx.textBaseline === "top" ? p.y : ctx.textBaseline === "bottom" ? p.y - fs * 1.5 : p.y - fs * 0.8
			const bb = { x0: bx0 - 4, y0: by0 - 2, x1: bx0 + tw + 4, y1: by0 + fs * 1.6 }
			if (placed.some((q) => q.x0 < bb.x1 && q.x1 > bb.x0 && q.y0 < bb.y1 && q.y1 > bb.y0)) continue
			placed.push(bb)
			ctx.fillStyle = cell.region.color
			ctx.fillText(t, p.x, p.y)
			ctx.font = `600 ${clamp(fs * 0.4, 10, 14)}px ${BODY}`
			ctx.fillStyle = "rgba(255,255,255,.6)"
			const dy = ctx.textBaseline === "bottom" ? -fs : ctx.textBaseline === "top" ? fs : fs * 0.75
			ctx.fillText(`${cell.region.count.toLocaleString("en")} titles`, p.x, p.y + dy)
		}
	}

	function drawCells(wd: World, now: number, a: number, morph: Map<string, { x: number; y: number; box: Cell["box"] | null }> | null, e: number) {
		const cur = props.current.current
		const vx0 = cam.x - W / 2 / cam.s
		const vx1 = cam.x + W / 2 / cam.s
		const vy0 = cam.y - H / 2 / cam.s
		const vy1 = cam.y + H / 2 / cam.s
		const out: { c: Cell; lvl: number; lt: number; n: number; a: number }[] = []
		for (const c of wd.cells) {
			const b = c.box
			let ca = a
			setWorldTransform()
			if (morph) {
				const src = morph.get(c.id)
				if (src) {
					const k = src.box ? 1 : 0.2 + 0.8 * e
					const tx = src.x + (c.cx - src.x) * e
					const ty = src.y + (c.cy - src.y) * e
					if (src.box) {
						// Same region before and after: morph the box.
						const sx = (src.box.w + (b.w - src.box.w) * e) / b.w
						const sy = (src.box.h + (b.h - src.box.h) * e) / b.h
						ctx.translate(tx, ty)
						ctx.scale(sx, sy)
						ctx.translate(-c.cx, -c.cy)
					} else {
						ctx.translate(tx, ty)
						ctx.scale(k, k)
						ctx.translate(-c.cx, -c.cy)
						ca = a * e
					}
				} else ca = a * e
			} else if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue
			const path = shapeOf(c)
			ctx.globalAlpha = ca
			ctx.fillStyle = c.fill
			ctx.fill(path)
			ctx.lineWidth = (c.id === cur ? 3 : 1.25) / cam.s
			ctx.strokeStyle = c.id === cur ? "#fbbf24" : c.rim
			ctx.stroke(path)
			ctx.globalAlpha = 1
			if (morph) continue
			const items = visible(c)
			const lvl = pickLevel(c, items.length)
			const st = levels.get(c.id) as LevelState
			const lt = st.t0 ? clamp((now - st.t0) / 320, 0, 1) : 1
			out.push({ c, lvl, lt, n: items.length, a: ca })
		}
		return out
	}

	function frame(now: number) {
		raf = 0
		let animating = false
		if (fly) {
			const t = clamp((now - fly.t0) / fly.ms, 0, 1)
			const k = ease(t)
			const ls = Math.log(fly.from.s) + (Math.log(fly.to.s) - Math.log(fly.from.s)) * k
			cam.s = Math.exp(ls)
			cam.x = fly.from.x + (fly.to.x - fly.from.x) * k
			cam.y = fly.from.y + (fly.to.y - fly.from.y) * k
			if (t >= 1) fly = null
			animating = true
		} else if (Math.abs(vel.x) + Math.abs(vel.y) > 0.05) {
			cam.x -= vel.x / cam.s
			cam.y -= vel.y / cam.s
			vel.x *= 0.9
			vel.y *= 0.9
			clampCam()
			animating = true
		}
		setScreen()
		ctx.clearRect(0, 0, W, H)

		let te = 1
		if (trans) {
			te = ease(clamp((now - trans.t0) / 760, 0, 1))
			if (te >= 1) trans = null
			animating = true
		}
		if (trans) {
			// Old map sinks away while the new regions grow from where their titles used to be.
			drawCells(trans.old, now, (1 - te) * (1 - te), null, 1)
			drawCells(world, now, 1, trans.src, te)
			setScreen()
			for (const p of trans.posters) {
				let x = p.x
				let y = p.y
				let w = p.w
				let h = p.h
				if (p.to) {
					const c = toScreen(p.to.cx, p.to.cy)
					const k = 1 - 0.7 * te
					x = p.x + (c.x - p.w * k / 2 - p.x) * te
					y = p.y + (c.y - p.h * k / 2 - p.y) * te
					w = p.w * k
					h = p.h * k
				}
				drawPoster(p.it, x, y, w, h, p.to ? 1 - te * te : 1 - te, null)
			}
			if (world.kind === "rings") {
				ctx.globalAlpha = te
				drawRings()
				ctx.globalAlpha = 1
			}
			drawn = []
		} else {
			const cells = drawCells(world, now, 1, null, 1)
			if (world.kind === "rings") drawRings()
			setScreen()
			const next: Drawn[] = []
			const lv = LEVELS[world.kind]
			for (const { c, lvl, lt, n } of cells) {
				const st = levels.get(c.id) as LevelState
				if (lt < 1) animating = true
				const items = visible(c)
				const nNow = Math.min(lv[lvl], n)
				const nPrev = Math.min(lv[st.prev], n)
				const gNow = gridOf(c, nNow)
				const gPrev = lt < 1 ? gridOf(c, nPrev) : null
				const e = ease(lt)
				const count = Math.max(nNow, lt < 1 ? nPrev : 0)
				for (let j = 0; j < count; j++) {
					const inNow = j < nNow
					const inPrev = gPrev != null && j < nPrev
					let wx: number
					let wy: number
					let ww: number
					let a = 1
					if (inNow && inPrev && gPrev) {
						wx = gPrev.pts[j].x + (gNow.pts[j].x - gPrev.pts[j].x) * e
						wy = gPrev.pts[j].y + (gNow.pts[j].y - gPrev.pts[j].y) * e
						ww = gPrev.w + (gNow.w - gPrev.w) * e
					} else if (inNow) {
						wx = gNow.pts[j].x
						wy = gNow.pts[j].y
						ww = gNow.w
						a = gPrev ? e : 1
					} else if (gPrev) {
						wx = gPrev.pts[j].x
						wy = gPrev.pts[j].y
						ww = gPrev.w
						a = 1 - e
					} else continue
					const sw = ww * cam.s
					const sh = sw * 1.5
					const p = toScreen(wx, wy)
					const x = p.x - sw / 2
					const y = p.y - sh / 2
					if (x > W || y > H || x + sw < 0 || y + sh < 0) continue
					const it = items[j]
					drawPoster(it, x, y, sw, sh, a, c)
					if (inNow) next.push({ it, cell: c, x, y, w: sw, h: sh })
				}
			}
			drawn = next
			for (const { c, lvl, lt } of cells) label(c, lvl, lt, 1)
			// Hovered poster: its title under it.
			if (hover && drawn.some((d) => d.it.k === hover?.it.k)) {
				const d = drawn.find((x) => x.it.k === hover?.it.k) as Drawn
				ctx.strokeStyle = "#fbbf24"
				ctx.lineWidth = 3
				ctx.strokeRect(d.x - 1.5, d.y - 1.5, d.w + 3, d.h + 3)
				ctx.font = `700 13px ${BODY}`
				const t = `${d.it.t}${d.it.yr ? ` (${d.it.yr})` : ""}`
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
		}
		const g = window as unknown as { __rx4f?: number[] }
		if (g.__rx4f) g.__rx4f.push(performance.now() - now)
		for (const fn of listeners) fn()
		dirty = false
		if (animating) invalidate()
	}

	// ------------------------------------------------------------ world switch

	const setWorld = (next: World) => {
		if (next === world) return
		const old = world
		// Where each new region's titles sat on the old map.
		const whereOld = new Map<string, Cell>()
		for (const c of old.cells) for (const it of c.items) if (!whereOld.has(it.k)) whereOld.set(it.k, c)
		const src = new Map<string, { x: number; y: number; box: Cell["box"] | null }>()
		// Same regions (a filter changed): morph in place and keep the camera. A new grouping starts at the overview.
		const shared = next.cells.filter((c) => old.cells.some((o) => o.id === c.id)).length
		const sameKind = old.kind === next.kind && old.w === next.w && old.h === next.h && shared >= next.cells.length * 0.6
		for (const c of next.cells) {
			const same = sameKind ? old.cells.find((o) => o.id === c.id) : null
			if (same) {
				src.set(c.id, { x: same.cx, y: same.cy, box: same.box })
				continue
			}
			let x = 0
			let y = 0
			let n = 0
			for (const it of c.items) {
				const o = whereOld.get(it.k)
				if (!o) continue
				x += o.cx
				y += o.cy
				n++
			}
			src.set(c.id, n ? { x: x / n, y: y / n, box: null } : { x: c.cx, y: c.cy, box: null })
		}
		// Posters on screen now fly to the region they belong to in the new layout.
		const whereNew = new Map<string, Cell>()
		for (const c of next.cells) for (const it of c.items) if (!whereNew.has(it.k)) whereNew.set(it.k, c)
		const posters = drawn.slice(0, 80).map((d) => ({ it: d.it, x: d.x, y: d.y, w: d.w, h: d.h, to: whereNew.get(d.it.k) ?? null }))
		world = next
		levels.clear()
		gridCache.clear()
		const keepCam = sameKind
		computeScales()
		trans = { t0: performance.now(), old, posters, src: keepCam ? src : remap(src, old, next) }
		if (!keepCam) {
			home()
			fly = null
		}
		clampCam()
		invalidate()
	}
	// Old coordinates into the new world's frame, when the two worlds differ in size.
	const remap = (src: Map<string, { x: number; y: number; box: Cell["box"] | null }>, old: World, next: World) => {
		const out = new Map<string, { x: number; y: number; box: Cell["box"] | null }>()
		for (const [k, v] of src) out.set(k, { x: (v.x / old.w) * next.w, y: (v.y / old.h) * next.h, box: null })
		return out
	}

	// ------------------------------------------------------------ input

	const pts = new Map<number, { x: number; y: number }>()
	let mode: "none" | "pan" | "pinch" = "none"
	let moved = 0
	let last = { x: 0, y: 0, t: 0 }
	let pinch = { d: 1, s: 1, wx: 0, wy: 0 }
	let over = 0
	const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
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
	const nearestPoster = (x: number, y: number) => {
		let best: Drawn | null = null
		let bd = Number.POSITIVE_INFINITY
		for (const d of drawn) {
			const dd = Math.hypot(d.x + d.w / 2 - x, d.y + d.h / 2 - y)
			if (dd < bd) {
				bd = dd
				best = d
			}
		}
		return best
	}
	/** Zooming past the deepest level opens the close-up of the poster under the pointer. */
	const overzoom = (amount: number, x: number, y: number) => {
		if (cam.s < maxS * 0.98) {
			over = 0
			return false
		}
		over += amount
		if (over < 180) return true
		over = 0
		const d = posterAt(x, y) ?? nearestPoster(x, y)
		if (d) props.current.onPoster(d.it, d.cell, { x: d.x, y: d.y, w: d.w, h: d.h })
		return true
	}

	const down = (e: PointerEvent) => {
		canvas.setPointerCapture(e.pointerId)
		const p = local(e)
		pts.set(e.pointerId, p)
		fly = null
		vel = { x: 0, y: 0 }
		if (pts.size === 2) {
			const [a, b] = [...pts.values()]
			const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
			const w = toWorld(mid.x, mid.y)
			pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: cam.s, wx: w.x, wy: w.y }
			mode = "pinch"
		} else {
			mode = "pan"
			moved = 0
			last = { ...p, t: performance.now() }
		}
	}
	const move = (e: PointerEvent) => {
		const p = local(e)
		if (!pts.has(e.pointerId)) {
			if (e.pointerType === "mouse") {
				const d = posterAt(p.x, p.y)
				if ((d?.it.k ?? null) !== (hover?.it.k ?? null)) {
					hover = d
					invalidate()
				}
				canvas.style.cursor = d || hitCell(p.x, p.y) ? "pointer" : "grab"
			}
			return
		}
		const prev = pts.get(e.pointerId) as { x: number; y: number }
		pts.set(e.pointerId, p)
		if (mode === "pinch" && pts.size >= 2) {
			const [a, b] = [...pts.values()]
			const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
			const want = pinch.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)
			if (want > maxS && overzoom((want / maxS - 1) * 30, mid.x, mid.y)) return
			cam.s = clamp(want, fitS * 0.7, maxS)
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
			cam.x -= dx / cam.s
			cam.y -= dy / cam.s
			clampCam()
			const t = performance.now()
			const dt = Math.max(1, t - last.t)
			vel = { x: (dx / dt) * 16, y: (dy / dt) * 16 }
			last = { ...p, t }
			hover = null
			invalidate()
		}
	}
	const hitCell = (x: number, y: number) => {
		const w = toWorld(x, y)
		return hit(world, w.x, w.y)
	}
	const up = (e: PointerEvent) => {
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
		if (was === "pan" && moved < 8) {
			vel = { x: 0, y: 0 }
			const d = posterAt(p.x, p.y)
			if (d) {
				props.current.onPoster(d.it, d.cell, { x: d.x, y: d.y, w: d.w, h: d.h })
				return
			}
			const c = hitCell(p.x, p.y)
			if (c) props.current.onCell(c)
			return
		}
		if (performance.now() - last.t > 80) vel = { x: 0, y: 0 }
		invalidate()
	}
	const wheel = (e: WheelEvent) => {
		e.preventDefault()
		const p = local(e)
		const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
		if (dy < 0 && overzoom(-dy, p.x, p.y)) return
		fly = null
		zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0022)), p.x, p.y)
	}
	const leave = () => {
		if (hover) {
			hover = null
			invalidate()
		}
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
	document.fonts?.load(`900 40px 'Big Shoulders Display'`).then(invalidate, () => {})

	const view = (): View => ({ cam: { ...cam }, fit: fitS, region: regionS, max: maxS, focus: focusCell() })
	// For the verification scripts: the camera, and each region's zoom level.
	;(window as unknown as { __rx4?: unknown }).__rx4 = {
		view,
		levels: () => Object.fromEntries([...levels].map(([k, v]) => [k, v.lvl])),
		cells: () => world.cells.map((c) => ({ id: c.id, ...toScreen(c.cx, c.cy) })),
		drawn: () => drawn.map((d) => ({ k: d.it.k, x: d.x, y: d.y, w: d.w, h: d.h, cell: d.cell.id })),
	}
	return {
		setWorld,
		invalidate,
		repad: () => {
			computeScales()
			invalidate()
		},
		flyTo,
		flyToCell,
		overview,
		zoomBy,
		panBy,
		world: () => world,
		view,
		subscribe: (fn: () => void) => {
			listeners.add(fn)
			return () => listeners.delete(fn)
		},
		posterRect: (k: string) => {
			const d = drawn.find((x) => x.it.k === k)
			return d ? { x: d.x, y: d.y, w: d.w, h: d.h } : null
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
			if (wake === invalidate) wake = null
		},
	}
}
