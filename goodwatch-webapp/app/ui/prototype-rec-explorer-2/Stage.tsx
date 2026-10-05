// PROTOTYPE - throwaway. The Explorer's canvas, rebuilt for speed (round 2 of #180).
// Round 1 drew every title every frame, dimmed or not. This one draws only what the store holds (a few thousand
// at most, streamed in as you move), culls to the screen, and budgets each frame:
// - level of detail by on-screen size: dot, then a poster-shaped tile in the match color, then the poster, then
//   the poster with its title and match underneath when only a few are on screen;
// - at most MAX_POSTERS images per frame; the rest draw as tiles;
// - images pre-decoded off the main thread (img.decode) at the smallest TMDB width that is sharp (w92/w154/w342);
// - no per-frame allocations in the hot loop, no canvas filters, no shadow blur (glows are one cached sprite);
// - fog of war drawn on a quarter-resolution canvas and scaled up, which also softens its edges for free.
// Variants add their own drawing through hooks (labels, regions, lines, doors, fog shapes) that run each frame.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import type { Score } from "~/server/scores.server"
import { getVibeColorValue } from "~/utils/ratings"
import type { Item, Store } from "./store"
import { POSTER, S0 } from "./wire"

export type Cam = { x: number; y: number; scale: number; w: number; h: number }
export type Hook = (
	ctx: CanvasRenderingContext2D,
	cam: Cam,
	now: number,
) => boolean | undefined | void
export type Hooks = { under?: Hook; over?: Hook; fog?: Hook; top?: Hook }

export type StageHandle = {
	flyTo: (x: number, y: number, scale?: number, ms?: number) => void
	camera: () => Cam
	zoomBy: (f: number) => void
	redraw: () => void
	toScreen: (x: number, y: number) => { x: number; y: number }
}

export type StageProps = {
	store: Store
	hooks?: Hooks
	/** Pyramid levels: titles fade in at their zoom level, and far-out representatives draw larger. */
	levels?: boolean
	selected?: number | null
	queue?: Set<string>
	initial: { x: number; y: number; scale: number }
	minScale?: number
	maxScale?: number
	bounds?: { x0: number; y0: number; x1: number; y1: number }
	onTap?: (
		i: number | null,
		wx: number,
		wy: number,
		sx: number,
		sy: number,
	) => void
	/** The camera moved; called at most once per frame. Read the camera from the handle. */
	onView?: () => void
	bg?: "atlas" | "night" | "ink"
	className?: string
	ariaLabel?: string
}

const MAX_POSTERS = 420
const CAPTION_MAX = 40

// ---------------------------------------------------------------- images
const MAX_INFLIGHT = 16
let inflight = 0
let onImage: (() => void) | null = null
const queue: { it: Item; s: number; d: number }[] = []
let wantN = 0
const wantIt: Item[] = []
const wantS = new Uint8Array(4096)
const wantD = new Float32Array(4096)

function want(it: Item, s: number, d: number) {
	if (wantN >= 4096 || !it.urls.length || it.im[s]) return
	wantIt[wantN] = it
	wantS[wantN] = s
	wantD[wantN] = d
	wantN++
}
function pump() {
	// Nearest the middle of the screen first; whatever scrolled away since last frame is dropped.
	if (wantN) {
		queue.length = 0
		for (let k = 0; k < wantN; k++)
			queue.push({ it: wantIt[k], s: wantS[k], d: wantD[k] })
		queue.sort((a, b) => a.d - b.d)
		if (queue.length > 200) queue.length = 200
		wantN = 0
	}
	while (inflight < MAX_INFLIGHT && queue.length) {
		const { it, s } = queue.shift() as { it: Item; s: number }
		if (it.im[s]) continue
		const el = new Image()
		el.decoding = "async"
		const e = { el, ok: false, failed: false }
		it.im[s] = e
		inflight++
		el.src = it.urls[s]
		el.decode()
			.then(() => {
				e.ok = true
			})
			.catch(() => {
				e.failed = true
			})
			.finally(() => {
				inflight--
				onImage?.()
				pump()
			})
	}
}
/** The sharpest decoded image at or below the wanted size, else any decoded one. */
function best(it: Item, s: number) {
	for (let k = s; k >= 0; k--)
		if (it.im[k]?.ok) return (it.im[k] as { el: HTMLImageElement }).el
	for (let k = s + 1; k < 3; k++)
		if (it.im[k]?.ok) return (it.im[k] as { el: HTMLImageElement }).el
	return null
}

// ---------------------------------------------------------------- colors and sprites
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
const hex = (h: string) => [
	Number.parseInt(h.slice(1, 3), 16),
	Number.parseInt(h.slice(3, 5), 16),
	Number.parseInt(h.slice(5, 7), 16),
]
function ramp(stops: string[], t: number) {
	const c = stops.map(hex)
	const x = Math.max(0, Math.min(0.999, t)) * (c.length - 1)
	const k = Math.floor(x)
	const f = x - k
	return `rgb(${lerp(c[k][0], c[k + 1][0], f)},${lerp(c[k][1], c[k + 1][1], f)},${lerp(c[k][2], c[k + 1][2], f)})`
}
/** Far from your taste is warm grey, close is gold (the atlas palette). */
export const HEAT = Array.from({ length: 100 }, (_, m) =>
	ramp(["#3f3a36", "#78716c", "#d6b36a", "#fbbf24"], (m - 50) / 49),
)
const VIBE = Array.from({ length: 11 }, (_, s) =>
	s ? getVibeColorValue(s as Score) : "#fff",
)

let glowSprite: HTMLCanvasElement | null = null
function glow() {
	if (glowSprite) return glowSprite
	const c = document.createElement("canvas")
	c.width = c.height = 128
	const g = c.getContext("2d") as CanvasRenderingContext2D
	const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64)
	grad.addColorStop(0, "rgba(251,191,36,.55)")
	grad.addColorStop(0.5, "rgba(245,158,11,.18)")
	grad.addColorStop(1, "rgba(245,158,11,0)")
	g.fillStyle = grad
	g.fillRect(0, 0, 128, 128)
	glowSprite = c
	return c
}
let holeSprite: HTMLCanvasElement | null = null
/** A soft white disc, for cutting holes in the fog. */
export function hole() {
	if (holeSprite) return holeSprite
	const c = document.createElement("canvas")
	c.width = c.height = 64
	const g = c.getContext("2d") as CanvasRenderingContext2D
	const grad = g.createRadialGradient(32, 32, 10, 32, 32, 32)
	grad.addColorStop(0, "rgba(0,0,0,1)")
	grad.addColorStop(1, "rgba(0,0,0,0)")
	g.fillStyle = grad
	g.fillRect(0, 0, 64, 64)
	holeSprite = c
	return c
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

// ---------------------------------------------------------------- measurements (read by the scratch perf scripts)
type Perf = {
	draw: Float32Array
	frame: Float32Array
	n: number
	last: number
	visible: number
	posters: number
	top: { x: number; y: number } | null
	cam: Cam | null
}
const perf = (): Perf => {
	const w = window as unknown as { __ex2?: Perf }
	w.__ex2 ??= {
		draw: new Float32Array(2000),
		frame: new Float32Array(2000),
		n: 0,
		last: 0,
		visible: 0,
		posters: 0,
		top: null,
		cam: null,
	}
	return w.__ex2
}

export const Stage = forwardRef<StageHandle, StageProps>(
	function Stage(props, ref) {
		const wrap = useRef<HTMLDivElement>(null)
		const canvas = useRef<HTMLCanvasElement>(null)
		const fogCanvas = useRef<HTMLCanvasElement | null>(null)
		const P = useRef(props)
		P.current = props
		const cam = useRef<Cam>({
			x: props.initial.x,
			y: props.initial.y,
			scale: props.initial.scale,
			w: 0,
			h: 0,
		})
		const flight = useRef<{
			fx: number
			fy: number
			fs: number
			tx: number
			ty: number
			ts: number
			t0: number
			ms: number
		} | null>(null)
		const vel = useRef<{ vx: number; vy: number } | null>(null)
		const raf = useRef(0)
		const viewed = useRef(false)
		// Hit boxes of what the last frame drew, top-most last.
		const hitN = useRef(0)
		const hit = useRef({
			i: new Int32Array(4096),
			x: new Float32Array(4096),
			y: new Float32Array(4096),
			w: new Float32Array(4096),
			h: new Float32Array(4096),
		})
		// Per-frame scratch, sized once.
		const vis = useRef({
			i: new Int32Array(8192),
			sx: new Float32Array(8192),
			sy: new Float32Array(8192),
			w: new Float32Array(8192),
			a: new Float32Array(8192),
		})

		const clampScale = (s: number) =>
			Math.max(P.current.minScale ?? 0.3, Math.min(P.current.maxScale ?? 30, s))
		const request = () => {
			if (!raf.current) raf.current = requestAnimationFrame(draw)
		}
		const flyTo = (x: number, y: number, scale?: number, ms = 700) => {
			const c = cam.current
			flight.current = {
				fx: c.x,
				fy: c.y,
				fs: c.scale,
				tx: x,
				ty: y,
				ts: clampScale(scale ?? c.scale),
				t0: performance.now(),
				ms,
			}
			vel.current = null
			request()
		}
		useImperativeHandle(ref, () => ({
			flyTo,
			camera: () => cam.current,
			zoomBy: (f: number) =>
				flyTo(cam.current.x, cam.current.y, cam.current.scale * f, 300),
			redraw: request,
			toScreen: (x: number, y: number) => {
				const c = cam.current
				return {
					x: (x - c.x) * c.scale + c.w / 2,
					y: (y - c.y) * c.scale + c.h / 2,
				}
			},
		}))

		function draw(now: number) {
			raf.current = 0
			const t0 = performance.now()
			const cv = canvas.current
			const p = P.current
			if (!cv) return
			const ctx = cv.getContext("2d", {
				alpha: false,
			}) as CanvasRenderingContext2D
			const c = cam.current
			const store = p.store
			let again = false
			let moved = false

			if (flight.current) {
				const f = flight.current
				const t = Math.min(1, (now - f.t0) / f.ms)
				const e = easeOut(t)
				c.scale = Math.exp(
					Math.log(f.fs) + (Math.log(f.ts) - Math.log(f.fs)) * e,
				)
				c.x = f.fx + (f.tx - f.fx) * e
				c.y = f.fy + (f.ty - f.fy) * e
				if (t >= 1) flight.current = null
				else again = true
				moved = true
			} else if (vel.current) {
				const v = vel.current
				c.x -= v.vx / c.scale
				c.y -= v.vy / c.scale
				v.vx *= 0.9
				v.vy *= 0.9
				if (Math.abs(v.vx) + Math.abs(v.vy) < 0.3) vel.current = null
				else again = true
				moved = true
			}
			if (p.bounds && !flight.current) {
				c.x = Math.max(p.bounds.x0, Math.min(p.bounds.x1, c.x))
				c.y = Math.max(p.bounds.y0, Math.min(p.bounds.y1, c.y))
			}
			if (moved || viewed.current) {
				viewed.current = false
				p.onView?.()
			}

			const dpr = window.devicePixelRatio || 1
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			ctx.globalAlpha = 1
			ctx.fillStyle =
				p.bg === "night" ? "#05070c" : p.bg === "ink" ? "#07060a" : "#0c0a09"
			ctx.fillRect(0, 0, c.w, c.h)
			if (p.hooks?.under?.(ctx, c, now)) again = true

			store.prepare()
			const camLevel = Math.log2(c.scale / S0)
			const natural = POSTER * c.scale
			const halfW = c.w / 2
			const halfH = c.h / 2
			const V = vis.current
			let vn = 0
			const order = store.order
			const X = store.x
			const Y = store.y
			const L = store.level
			const F = store.flags
			const B = store.born
			// Pass 1: cull and size.
			for (let k = 0; k < order.length; k++) {
				const i = order[k]
				if (F[i] !== 1) continue
				let a = 1
				let w = natural
				if (p.levels) {
					const l = L[i]
					const la = l === 0 ? 1 : (camLevel - l + 0.45) / 0.3
					if (la <= 0) continue
					if (la < 1) {
						a = la
						again = again || !!flight.current
					}
					// Far out, established representatives draw large enough to read as posters.
					if (l <= Math.max(camLevel, 0) + 0.2) {
						const bw = 38 - 4 * l
						if (bw > w) w = bw
					}
				}
				const age = now - B[i]
				if (age < 380) {
					a *= age / 380
					again = true
				}
				const sx = (X[i] - c.x) * c.scale + halfW
				const sy = (Y[i] - c.y) * c.scale + halfH
				const hw = w * 0.5 + 2
				if (sx < -hw || sx > c.w + hw || sy < -hw * 1.5 || sy > c.h + hw * 1.5)
					continue
				if (vn >= V.i.length) break
				V.i[vn] = i
				V.sx[vn] = sx
				V.sy[vn] = sy
				V.w[vn] = w
				V.a[vn] = a
				vn++
			}
			// Posters for the top-most MAX_POSTERS poster-sized titles; everything else is a dot or a tile.
			let posterFrom = 0
			{
				let count = 0
				for (let k = vn - 1; k >= 0; k--) {
					if (V.w[k] >= 15) count++
					if (count > MAX_POSTERS) {
						posterFrom = k + 1
						break
					}
				}
			}
			// Pass 2: dots and tiles.
			let curA = 1
			for (let k = 0; k < vn; k++) {
				const w = V.w[k]
				if (w >= 15 && k >= posterFrom) continue
				const it = store.items[V.i[k]]
				const a = V.a[k] * 0.9
				if (a !== curA) {
					ctx.globalAlpha = a
					curA = a
				}
				ctx.fillStyle = HEAT[it.m] ?? HEAT[50]
				if (w < 6) {
					const r = Math.max(1.6, Math.min(3.2, w * 0.45))
					ctx.fillRect(V.sx[k] - r, V.sy[k] - r, r * 2, r * 2)
				} else ctx.fillRect(V.sx[k] - w / 2, V.sy[k] - w * 0.75, w, w * 1.5)
			}
			// Pass 3: posters.
			const g = glow()
			let posters = 0
			let hn = 0
			const H = hit.current
			const sel = p.selected ?? -1
			let glows = 0
			for (let k = posterFrom; k < vn; k++) {
				const w0 = V.w[k]
				if (w0 < 15) {
					if (hn < H.i.length) {
						H.i[hn] = V.i[k]
						H.x[hn] = V.sx[k] - Math.max(w0, 10) / 2
						H.y[hn] = V.sy[k] - Math.max(w0, 10) * 0.75
						H.w[hn] = Math.max(w0, 10)
						H.h[hn] = Math.max(w0, 10) * 1.5
						hn++
					}
					continue
				}
				const i = V.i[k]
				const it = store.items[i]
				const isSel = i === sel
				const w = isSel ? w0 * 1.2 : w0
				const h = w * 1.5
				const x = V.sx[k] - w / 2
				const y = V.sy[k] - h / 2
				const need = w * dpr
				const s = need <= 92 ? 0 : need <= 154 ? 1 : 2
				if (!it.im[s])
					want(it, s, Math.abs(V.sx[k] - halfW) + Math.abs(V.sy[k] - halfH))
				const im = best(it, s)
				const a = V.a[k]
				if (a !== curA) {
					ctx.globalAlpha = a
					curA = a
				}
				if (it.m >= 97 && glows < 24 && w < 160) {
					glows++
					ctx.drawImage(g, x - w * 0.45, y - w * 0.45, w * 1.9, h + w * 0.9)
				}
				if (im) ctx.drawImage(im, x, y, w, h)
				else {
					ctx.fillStyle = HEAT[it.m] ?? HEAT[50]
					ctx.fillRect(x, y, w, h)
				}
				// Rings: your rating in its vibe color, Want to See amber, Watch next sky, selected white.
				const ring = isSel
					? "#fff"
					: it.r
						? VIBE[it.r]
						: p.queue?.has(it.k)
							? "#38bdf8"
							: it.f & 4
								? "#f59e0b"
								: null
				if (ring) {
					ctx.strokeStyle = ring
					ctx.lineWidth = isSel ? 3 : Math.max(1.5, Math.min(3, w * 0.04))
					ctx.strokeRect(x - 1, y - 1, w + 2, h + 2)
				}
				posters++
				if (hn < H.i.length) {
					H.i[hn] = i
					H.x[hn] = x
					H.y[hn] = y
					H.w[hn] = w
					H.h[hn] = h
					hn++
				}
			}
			if (curA !== 1) ctx.globalAlpha = 1
			// Close up: title and match under each poster, and the match as a chip on it.
			if (posters <= CAPTION_MAX && natural >= 90) {
				ctx.font = "600 12px system-ui, sans-serif"
				ctx.textAlign = "left"
				ctx.textBaseline = "top"
				for (let k = posterFrom; k < vn; k++) {
					const w = V.w[k]
					if (w < 90) continue
					const it = store.items[V.i[k]]
					const x = V.sx[k] - w / 2
					const y = V.sy[k] + w * 0.75 + 5
					ctx.fillStyle = "#f5f5f4"
					ctx.fillText(caption(ctx, it, w), x, y)
					ctx.fillStyle = HEAT[it.m] ?? "#a8a29e"
					ctx.font = "700 11px system-ui, sans-serif"
					ctx.fillText(`${it.m}% your taste`, x, y + 16)
					ctx.fillStyle = "#a8a29e"
					ctx.font = "500 11px system-ui, sans-serif"
					ctx.fillText(`${it.yr || ""}`, x + w - 30, y + 16)
					ctx.font = "600 12px system-ui, sans-serif"
				}
			}
			hitN.current = hn
			if (p.hooks?.over?.(ctx, c, now)) again = true

			// Fog of war at quarter resolution.
			if (p.hooks?.fog) {
				let fc = fogCanvas.current
				if (!fc) {
					fc = document.createElement("canvas")
					fogCanvas.current = fc
				}
				const fw = Math.max(1, Math.ceil(c.w / 4))
				const fh = Math.max(1, Math.ceil(c.h / 4))
				if (fc.width !== fw || fc.height !== fh) {
					fc.width = fw
					fc.height = fh
				}
				const fctx = fc.getContext("2d") as CanvasRenderingContext2D
				fctx.setTransform(0.25, 0, 0, 0.25, 0, 0)
				fctx.globalCompositeOperation = "source-over"
				fctx.clearRect(0, 0, c.w, c.h)
				if (p.hooks.fog(fctx, c, now)) again = true
				ctx.drawImage(fc, 0, 0, c.w, c.h)
			}

			if (p.hooks?.top?.(ctx, c, now)) again = true
			wantN > 0 && pump()

			// Measurements for the perf scripts, and the poster nearest the middle for tap checks.
			const pf = perf()
			const k = pf.n % 2000
			pf.draw[k] = performance.now() - t0
			pf.frame[k] = pf.last ? now - pf.last : 0
			pf.last = now
			pf.n++
			pf.visible = vn
			pf.posters = posters
			pf.cam = c
			let top = -1
			let td = Number.POSITIVE_INFINITY
			for (let j = 0; j < hn; j++) {
				if (H.w[j] < 20) continue
				const d =
					(H.x[j] + H.w[j] / 2 - halfW) ** 2 +
					(H.y[j] + H.h[j] / 2 - c.h * 0.55) ** 2
				if (d < td) {
					td = d
					top = j
				}
			}
			const r = cv.getBoundingClientRect()
			pf.top =
				top >= 0
					? {
							x: r.left + H.x[top] + H.w[top] / 2,
							y: r.top + H.y[top] + H.h[top] / 2,
						}
					: null
			if (again) request()
			else pf.last = 0
		}

		// ---- sizing ----
		useEffect(() => {
			const el = wrap.current
			const cv = canvas.current
			if (!el || !cv) return
			onImage = request
			const resize = () => {
				const r = el.getBoundingClientRect()
				const dpr = window.devicePixelRatio || 1
				cv.width = Math.max(1, Math.round(r.width * dpr))
				cv.height = Math.max(1, Math.round(r.height * dpr))
				cv.style.width = `${r.width}px`
				cv.style.height = `${r.height}px`
				cam.current.w = r.width
				cam.current.h = r.height
				viewed.current = true
				request()
			}
			resize()
			const ro = new ResizeObserver(resize)
			ro.observe(el)
			return () => {
				ro.disconnect()
				cancelAnimationFrame(raf.current)
				raf.current = 0
			}
		}, [])
		useEffect(() => {
			request()
		})

		// ---- input: drag to pan, wheel or pinch to zoom, tap to pick, double-click to zoom in ----
		useEffect(() => {
			const cv = canvas.current
			if (!cv) return
			const pts = new Map<number, { x: number; y: number }>()
			let mode: "none" | "pan" | "pinch" = "none"
			let start = { x: 0, y: 0, t: 0 }
			let moved = 0
			let last = { x: 0, y: 0, t: 0 }
			let v = { x: 0, y: 0 }
			let pinch = { d: 1, scale: 1, wx: 0, wy: 0 }
			const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
				const r = cv.getBoundingClientRect()
				return { x: e.clientX - r.left, y: e.clientY - r.top }
			}
			const toWorld = (sx: number, sy: number) => {
				const c = cam.current
				return {
					x: (sx - c.w / 2) / c.scale + c.x,
					y: (sy - c.h / 2) / c.scale + c.y,
				}
			}
			const pick = (sx: number, sy: number) => {
				const H = hit.current
				for (let j = hitN.current - 1; j >= 0; j--)
					if (
						sx >= H.x[j] - 3 &&
						sx <= H.x[j] + H.w[j] + 3 &&
						sy >= H.y[j] - 3 &&
						sy <= H.y[j] + H.h[j] + 3
					)
						return H.i[j]
				return null
			}
			const down = (e: PointerEvent) => {
				cv.setPointerCapture(e.pointerId)
				const pt = local(e)
				pts.set(e.pointerId, pt)
				flight.current = null
				vel.current = null
				if (pts.size === 2) {
					const [a, b] = [...pts.values()]
					const w = toWorld((a.x + b.x) / 2, (a.y + b.y) / 2)
					pinch = {
						d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
						scale: cam.current.scale,
						wx: w.x,
						wy: w.y,
					}
					mode = "pinch"
					moved = 99
					return
				}
				mode = "pan"
				start = { x: pt.x, y: pt.y, t: performance.now() }
				last = { ...start }
				v = { x: 0, y: 0 }
				moved = 0
			}
			const move = (e: PointerEvent) => {
				const prev = pts.get(e.pointerId)
				if (!prev) return
				const pt = local(e)
				pts.set(e.pointerId, pt)
				const c = cam.current
				if (mode === "pinch" && pts.size >= 2) {
					const [a, b] = [...pts.values()]
					const mx = (a.x + b.x) / 2
					const my = (a.y + b.y) / 2
					c.scale = clampScale(
						pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d),
					)
					c.x = pinch.wx - (mx - c.w / 2) / c.scale
					c.y = pinch.wy - (my - c.h / 2) / c.scale
					viewed.current = true
					request()
					return
				}
				moved = Math.max(moved, Math.hypot(pt.x - start.x, pt.y - start.y))
				if (mode === "pan" && moved > 4) {
					c.x -= (pt.x - prev.x) / c.scale
					c.y -= (pt.y - prev.y) / c.scale
					const t = performance.now()
					const dt = Math.max(1, t - last.t)
					v = { x: ((pt.x - prev.x) / dt) * 16, y: ((pt.y - prev.y) / dt) * 16 }
					last = { x: pt.x, y: pt.y, t }
					viewed.current = true
					request()
				}
			}
			const up = (e: PointerEvent) => {
				if (!pts.has(e.pointerId)) return
				const pt = local(e)
				pts.delete(e.pointerId)
				if (mode === "pinch") {
					if (!pts.size) mode = "none"
					else {
						const [only] = [...pts.values()]
						start = { x: only.x, y: only.y, t: performance.now() }
						mode = "pan"
					}
					return
				}
				if (mode === "pan") {
					if (moved < 7 && performance.now() - start.t < 600) {
						const w = toWorld(pt.x, pt.y)
						P.current.onTap?.(pick(pt.x, pt.y), w.x, w.y, pt.x, pt.y)
					} else if (
						performance.now() - last.t < 70 &&
						Math.hypot(v.x, v.y) > 2
					) {
						vel.current = { vx: v.x, vy: v.y }
						request()
					}
				}
				mode = "none"
			}
			const wheel = (e: WheelEvent) => {
				e.preventDefault()
				const pt = local(e)
				const c = cam.current
				flight.current = null
				const w = toWorld(pt.x, pt.y)
				c.scale = clampScale(
					c.scale *
						Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0016),
				)
				c.x = w.x - (pt.x - c.w / 2) / c.scale
				c.y = w.y - (pt.y - c.h / 2) / c.scale
				viewed.current = true
				request()
			}
			const dbl = (e: MouseEvent) => {
				const pt = local(e)
				const w = toWorld(pt.x, pt.y)
				flyTo(w.x, w.y, cam.current.scale * 2, 350)
			}
			const noGhost = (e: TouchEvent) => e.cancelable && e.preventDefault()
			cv.addEventListener("pointerdown", down)
			cv.addEventListener("pointermove", move)
			cv.addEventListener("pointerup", up)
			cv.addEventListener("pointercancel", up)
			cv.addEventListener("wheel", wheel, { passive: false })
			cv.addEventListener("dblclick", dbl)
			cv.addEventListener("touchend", noGhost, { passive: false })
			return () => {
				cv.removeEventListener("pointerdown", down)
				cv.removeEventListener("pointermove", move)
				cv.removeEventListener("pointerup", up)
				cv.removeEventListener("pointercancel", up)
				cv.removeEventListener("wheel", wheel)
				cv.removeEventListener("dblclick", dbl)
				cv.removeEventListener("touchend", noGhost)
			}
		}, [])

		return (
			<div
				ref={wrap}
				className={`overflow-hidden ${props.className ?? "relative"}`}
			>
				<canvas
					ref={canvas}
					role="img"
					aria-label={props.ariaLabel ?? "Explorer map"}
					className="absolute inset-0 block touch-none select-none cursor-grab active:cursor-grabbing"
				/>
			</div>
		)
	},
)

// Titles cut to fit under a poster, cached per item and width.
const capCache = new WeakMap<Item, { w: number; text: string }>()
function caption(ctx: CanvasRenderingContext2D, it: Item, w: number) {
	const bucket = Math.round(w / 8) * 8
	const hit = capCache.get(it)
	if (hit && hit.w === bucket) return hit.text
	let text = it.t
	if (ctx.measureText(text).width > bucket) {
		while (text.length > 1 && ctx.measureText(`${text}…`).width > bucket)
			text = text.slice(0, -1)
		text = `${text.trimEnd()}…`
	}
	capCache.set(it, { w: bucket, text })
	return text
}

// ---------------------------------------------------------------- drawing helpers for variants

/** The "You" marker: a gold reticle with a label. */
export function drawYou(
	ctx: CanvasRenderingContext2D,
	sx: number,
	sy: number,
	label = "You",
	color = "#fbbf24",
) {
	const r = 20
	ctx.strokeStyle = color
	ctx.fillStyle = color
	ctx.lineWidth = 2.5
	ctx.globalAlpha = 0.25
	ctx.beginPath()
	ctx.arc(sx, sy, r + 6, 0, Math.PI * 2)
	ctx.stroke()
	ctx.globalAlpha = 1
	ctx.beginPath()
	ctx.arc(sx, sy, r, 0, Math.PI * 2)
	ctx.moveTo(sx, sy - r - 3)
	ctx.lineTo(sx, sy - r - 11)
	ctx.moveTo(sx, sy + r + 3)
	ctx.lineTo(sx, sy + r + 11)
	ctx.moveTo(sx - r - 3, sy)
	ctx.lineTo(sx - r - 11, sy)
	ctx.moveTo(sx + r + 3, sy)
	ctx.lineTo(sx + r + 11, sy)
	ctx.stroke()
	ctx.beginPath()
	ctx.arc(sx, sy, 4.5, 0, Math.PI * 2)
	ctx.fill()
	ctx.font = "700 12px system-ui, sans-serif"
	ctx.textAlign = "center"
	ctx.textBaseline = "top"
	const tw = label.length * 7 + 8
	ctx.fillRect(sx - tw / 2 - 2, sy + r + 14, tw + 4, 19)
	ctx.fillStyle = "#000"
	ctx.fillText(label, sx, sy + r + 17)
}

/** Text with a dark halo so it reads over posters. Set font and alignment first. */
export function haloText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	fill: string,
	halo = "rgba(0,0,0,.85)",
	width = 4,
) {
	ctx.lineJoin = "round"
	ctx.lineWidth = width
	ctx.strokeStyle = halo
	ctx.strokeText(text, x, y)
	ctx.fillStyle = fill
	ctx.fillText(text, x, y)
}

let mist: HTMLCanvasElement | null = null
/** A tile of soft noise; on the quarter-resolution fog canvas it reads as drifting mist. */
function mistTile() {
	if (mist) return mist
	const c = document.createElement("canvas")
	c.width = c.height = 96
	const g = c.getContext("2d") as CanvasRenderingContext2D
	const img = g.createImageData(96, 96)
	let s = 1234567
	for (let k = 0; k < 96 * 96; k++) {
		s = (s * 1103515245 + 12345) >>> 0
		const v = (s >>> 16) & 255
		img.data[k * 4] = 60
		img.data[k * 4 + 1] = 52
		img.data[k * 4 + 2] = 44
		img.data[k * 4 + 3] = v < 150 ? 0 : (v - 150) * 0.5
	}
	g.putImageData(img, 0, 0)
	mist = c
	return c
}
/** Fog helper: fill the screen with fog and mist that drifts with the map, then switch to cutting holes. */
export function fogFill(
	fctx: CanvasRenderingContext2D,
	cam: Cam,
	color = "rgba(8,7,6,.92)",
) {
	fctx.fillStyle = color
	fctx.fillRect(0, 0, cam.w, cam.h)
	const pat = fctx.createPattern(mistTile(), "repeat")
	if (pat) {
		const k = Math.max(1, Math.min(6, cam.scale * 3))
		pat.setTransform(
			new DOMMatrix([
				k,
				0,
				0,
				k,
				(-cam.x * cam.scale + cam.w / 2) % (96 * k),
				(-cam.y * cam.scale + cam.h / 2) % (96 * k),
			]),
		)
		fctx.fillStyle = pat
		fctx.fillRect(0, 0, cam.w, cam.h)
	}
	fctx.globalCompositeOperation = "destination-out"
}
export function fogHole(
	fctx: CanvasRenderingContext2D,
	cam: Cam,
	wx: number,
	wy: number,
	wr: number,
	a = 1,
) {
	const sx = (wx - cam.x) * cam.scale + cam.w / 2
	const sy = (wy - cam.y) * cam.scale + cam.h / 2
	const r = wr * cam.scale
	if (sx < -r || sy < -r || sx > cam.w + r || sy > cam.h + r) return
	if (a !== 1) fctx.globalAlpha = a
	fctx.drawImage(hole(), sx - r, sy - r, r * 2, r * 2)
	if (a !== 1) fctx.globalAlpha = 1
}
