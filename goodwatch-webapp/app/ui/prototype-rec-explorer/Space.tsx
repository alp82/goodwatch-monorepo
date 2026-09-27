// PROTOTYPE - throwaway. A pannable, zoomable canvas of posters for /prototype/rec-explorer.
// Hand-written (no new dependencies): pointer pan, wheel and pinch zoom, tap, draggable markers,
// animated re-layouts, and level of detail (dots far out, small posters mid, sharp posters close).
// Two draw modes: "free" places every title at its point; "mosaic" snaps titles into a grid whose
// cells subdivide as you zoom, showing the best match per cell.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react"
import type { PoolItem } from "~/ui/prototype-rec-taste/model"
import type { Pt } from "./math"
import { POSTER_W, img } from "./model"

export type Marker = { id: string; x: number; y: number; label: string; color: string; draggable?: boolean; kind?: "you" | "seed" | "pin" }
export type Label = { x: number; y: number; text: string; weight: number; sub?: string }
export type Camera = { x: number; y: number; scale: number; w: number; h: number }
export type SpaceHandle = {
	flyTo: (x: number, y: number, scale?: number, ms?: number) => void
	fit: (pts?: Pt[], pad?: number, ms?: number) => void
	camera: () => Camera
	toScreen: (p: Pt) => Pt
	zoomBy: (f: number) => void
}

export type SpaceProps = {
	items: PoolItem[]
	pos: Pt[]
	alpha: Float32Array // 0 hides
	size?: Float32Array // poster size multiplier
	ring?: (string | null)[]
	glow?: Uint8Array
	order: number[] // draw order, last on top
	dot?: (string | null)[] // dot colors; null falls back
	gray?: Uint8Array // 1 = draw poster desaturated
	labels?: Label[]
	markers?: Marker[]
	trail?: Pt[]
	lines?: [Pt, Pt][]
	selected?: number | null
	mode?: "free" | "mosaic"
	priority?: Float32Array // mosaic: higher wins a cell
	onTap?: (i: number | null, at: Pt) => void
	onMarkerDrag?: (id: string, p: Pt, phase: "move" | "end") => void
	onCamera?: (c: Camera) => void
	initial?: { x: number; y: number; scale: number } | "fit"
	minScale?: number
	maxScale?: number
	style?: "posters" | "stars"
	className?: string
	ariaLabel?: string
}

// ---- image cache (module scope, shared by variants) ----
type Entry = { img: HTMLImageElement; ok: boolean; failed?: boolean }
const cache = new Map<string, Entry>()
const queue: string[] = []
let inflight = 0
let onLoaded: (() => void) | null = null
const MAX_INFLIGHT = 48
// Each frame lists what it wants, best first; whatever scrolled away is dropped from the queue.
let wanted: string[] = []
function want(url: string) {
	if (!url || cache.has(url)) return
	wanted.push(url)
}
function commitWanted() {
	const seen = new Set<string>()
	queue.length = 0
	for (const u of wanted) {
		if (seen.has(u)) continue
		seen.add(u)
		queue.push(u)
		if (queue.length >= 300) break
	}
	wanted = []
}
function pump() {
	while (inflight < MAX_INFLIGHT && queue.length) {
		const url = queue.shift() as string
		if (cache.has(url)) continue
		const im = new Image()
		im.decoding = "async"
		const e: Entry = { img: im, ok: false }
		cache.set(url, e)
		inflight++
		im.onload = () => {
			e.ok = true
			inflight--
			onLoaded?.()
			pump()
		}
		im.onerror = () => {
			e.failed = true
			inflight--
			pump()
		}
		im.src = url
	}
}
const ready = (url: string) => {
	const e = cache.get(url)
	return e?.ok ? e.img : null
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

export const Space = forwardRef<SpaceHandle, SpaceProps>(function Space(props, ref) {
	const wrap = useRef<HTMLDivElement>(null)
	const canvas = useRef<HTMLCanvasElement>(null)
	const P = useRef(props)
	P.current = props
	const cam = useRef<Camera>({ x: 0, y: 0, scale: 1, w: 0, h: 0 })
	const inited = useRef(false)
	const flight = useRef<{ from: Camera; to: { x: number; y: number; scale: number }; t0: number; ms: number } | null>(null)
	const shown = useRef<{ x: Float32Array; y: Float32Array; fx: Float32Array; fy: Float32Array; t0: number } | null>(null)
	const raf = useRef(0)
	const velocity = useRef<{ vx: number; vy: number } | null>(null)
	const frames = useRef<number[]>([])

	const clampScale = (s: number) => {
		const p = P.current
		return Math.max(p.minScale ?? 0.25, Math.min(p.maxScale ?? 40, s))
	}
	const toScreen = (p: Pt): Pt => {
		const c = cam.current
		return { x: (p.x - c.x) * c.scale + c.w / 2, y: (p.y - c.y) * c.scale + c.h / 2 }
	}
	const toWorld = (sx: number, sy: number): Pt => {
		const c = cam.current
		return { x: (sx - c.w / 2) / c.scale + c.x, y: (sy - c.h / 2) / c.scale + c.y }
	}

	const request = useCallback(() => {
		if (raf.current) return
		raf.current = requestAnimationFrame(draw)
	}, [])

	const fitTo = (pts: Pt[], padIn?: number) => {
		const c = cam.current
		const pad = padIn ?? Math.min(40, c.w * 0.04)
		let x0 = Number.POSITIVE_INFINITY
		let y0 = Number.POSITIVE_INFINITY
		let x1 = Number.NEGATIVE_INFINITY
		let y1 = Number.NEGATIVE_INFINITY
		for (const p of pts) {
			x0 = Math.min(x0, p.x)
			y0 = Math.min(y0, p.y)
			x1 = Math.max(x1, p.x)
			y1 = Math.max(y1, p.y)
		}
		if (!Number.isFinite(x0)) return { x: 0, y: 0, scale: 1 }
		const scale = Math.min((c.w - pad * 2) / Math.max(1, x1 - x0 + POSTER_W), (c.h - pad * 2) / Math.max(1, y1 - y0 + POSTER_W * 1.5))
		return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, scale: clampScale(scale) }
	}

	const flyTo = (x: number, y: number, scale?: number, ms = 700) => {
		flight.current = { from: { ...cam.current }, to: { x, y, scale: clampScale(scale ?? cam.current.scale) }, t0: performance.now(), ms }
		velocity.current = null
		request()
	}

	useImperativeHandle(ref, () => ({
		flyTo,
		fit: (pts, pad, ms = 700) => {
			const t = fitTo(pts ?? P.current.pos, pad)
			flyTo(t.x, t.y, t.scale, ms)
		},
		camera: () => ({ ...cam.current }),
		toScreen,
		zoomBy: (f: number) => flyTo(cam.current.x, cam.current.y, cam.current.scale * f, 300),
	}))

	// ---- animated positions ----
	const current = (i: number): Pt => {
		const s = shown.current
		const p = P.current.pos[i]
		if (!s || !p) return p ?? { x: 0, y: 0 }
		const t = Math.min(1, (performance.now() - s.t0) / 750)
		if (t >= 1) return p
		const e = easeOut(t)
		return { x: s.fx[i] + (p.x - s.fx[i]) * e, y: s.fy[i] + (p.y - s.fy[i]) * e }
	}
	const prevPos = useRef<Pt[] | null>(null)
	useEffect(() => {
		const prev = prevPos.current
		const pos = props.pos
		if (prev && prev !== pos && prev.length === pos.length) {
			const fx = new Float32Array(pos.length)
			const fy = new Float32Array(pos.length)
			// Start from wherever each poster is on screen right now.
			for (let i = 0; i < pos.length; i++) {
				const s = shown.current
				let p = prev[i]
				if (s) {
					const t = Math.min(1, (performance.now() - s.t0) / 750)
					if (t < 1) {
						const e = easeOut(t)
						p = { x: s.fx[i] + (prev[i].x - s.fx[i]) * e, y: s.fy[i] + (prev[i].y - s.fy[i]) * e }
					}
				}
				fx[i] = p.x
				fy[i] = p.y
			}
			shown.current = { x: new Float32Array(0), y: new Float32Array(0), fx, fy, t0: performance.now() }
		}
		prevPos.current = pos
		request()
	})

	// ---- drawing ----
	const bbox = useRef<{ pos: Pt[]; x0: number; y0: number; x1: number; y1: number } | null>(null)
	const hitCells = useRef<{ i: number; x: number; y: number; w: number; h: number }[]>([])
	const mosaicCache = useRef<{ key: unknown; levels: Map<number, Map<string, number>> } | null>(null)

	function draw(now: number) {
		raf.current = 0
		const t0 = performance.now()
		const cv = canvas.current
		const p = P.current
		if (!cv) return
		const ctx = cv.getContext("2d")
		if (!ctx) return
		const c = cam.current
		let again = false
		hitCells.current = []

		if (flight.current) {
			const f = flight.current
			const t = Math.min(1, (now - f.t0) / f.ms)
			const e = easeOut(t)
			// Zoom in log space so flights feel even.
			const ls = Math.log(f.from.scale) + (Math.log(f.to.scale) - Math.log(f.from.scale)) * e
			c.scale = Math.exp(ls)
			c.x = f.from.x + (f.to.x - f.from.x) * e
			c.y = f.from.y + (f.to.y - f.from.y) * e
			if (t >= 1) flight.current = null
			else again = true
			p.onCamera?.({ ...c })
		} else if (velocity.current) {
			const v = velocity.current
			c.x -= v.vx / c.scale
			c.y -= v.vy / c.scale
			v.vx *= 0.92
			v.vy *= 0.92
			if (Math.abs(v.vx) + Math.abs(v.vy) < 0.3) velocity.current = null
			else again = true
			p.onCamera?.({ ...c })
		}
		if (shown.current && now - shown.current.t0 < 760) again = true
		// Keep the middle of the screen over the titles, so you can't pan off into nothing.
		if (!bbox.current || bbox.current.pos !== p.pos) {
			let x0 = Number.POSITIVE_INFINITY
			let y0 = Number.POSITIVE_INFINITY
			let x1 = Number.NEGATIVE_INFINITY
			let y1 = Number.NEGATIVE_INFINITY
			for (const q of p.pos) {
				if (q.x < x0) x0 = q.x
				if (q.x > x1) x1 = q.x
				if (q.y < y0) y0 = q.y
				if (q.y > y1) y1 = q.y
			}
			bbox.current = { pos: p.pos, x0, y0, x1, y1 }
		}
		if (!flight.current) {
			const b = bbox.current
			c.x = Math.max(b.x0, Math.min(b.x1, c.x))
			c.y = Math.max(b.y0, Math.min(b.y1, c.y))
		}

		const dpr = window.devicePixelRatio || 1
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		ctx.clearRect(0, 0, c.w, c.h)
		const stars = p.style === "stars"
		const baseW = POSTER_W * c.scale
		// Featured titles are enlarged when far out so they read as posters; close up everyone is near equal.
		const boost = Math.max(0.2, Math.min(1, (44 - baseW) / 30))
		const margin = 80
		const inView = (sx: number, sy: number, r: number) => sx > -r - margin && sy > -r * 1.5 - margin && sx < c.w + r + margin && sy < c.h + r * 1.5 + margin

		// Trail and lines under the posters.
		const line = (pts: Pt[], color: string, width: number, dash: number[] = []) => {
			if (pts.length < 2) return
			ctx.save()
			ctx.strokeStyle = color
			ctx.lineWidth = width
			ctx.setLineDash(dash)
			ctx.beginPath()
			pts.forEach((q, k) => {
				const s = toScreen(q)
				if (k) ctx.lineTo(s.x, s.y)
				else ctx.moveTo(s.x, s.y)
			})
			ctx.stroke()
			ctx.restore()
		}
		for (const [a, b] of p.lines ?? []) line([a, b], stars ? "rgba(253,230,138,.28)" : "rgba(255,255,255,.18)", 1)
		if (p.trail) line(p.trail, "rgba(251,191,36,.85)", 2.5, [6, 6])

		const posters: { i: number; sx: number; sy: number; w: number }[] = []
		const font = getComputedStyle(cv).fontFamily

		if (p.mode === "mosaic") {
			// Cell width on screen stays between ~48 and ~96 px; cells halve as you zoom in.
			const level = Math.max(0, Math.round(Math.log2((64 / baseW) * 1)))
			const cw = POSTER_W * 2 ** level
			const chh = cw * 1.5
			const mk = mosaicCache.current?.key as unknown[] | undefined
			if (!mk || mk[0] !== p.pos || mk[1] !== p.priority || mk[2] !== p.alpha) mosaicCache.current = { key: [p.pos, p.priority, p.alpha], levels: new Map() }
			const mc = mosaicCache.current as { key: unknown; levels: Map<number, Map<string, number>> }
			let cells = mc.levels.get(level)
			if (!cells) {
				cells = new Map()
				for (let i = 0; i < p.items.length; i++) {
					if (!(p.alpha[i] > 0.02)) continue
					const q = p.pos[i]
					const k = `${Math.floor(q.x / cw)},${Math.floor(q.y / chh)}`
					const cur = cells.get(k)
					if (cur == null || (p.priority?.[i] ?? 0) > (p.priority?.[cur] ?? 0)) cells.set(k, i)
				}
				mc.levels.set(level, cells)
			}
			const sw = cw * c.scale
			const sh = chh * c.scale
			const gap = Math.max(1, sw * 0.04)
			for (const [k, i] of cells) {
				const [gx, gy] = k.split(",").map(Number)
				const s = toScreen({ x: gx * cw, y: gy * chh })
				if (s.x > c.w + margin || s.y > c.h + margin || s.x + sw < -margin || s.y + sh < -margin) continue
				const it = p.items[i]
				const url = img(it, sw * dpr > 170 ? "w342" : sw * dpr > 100 ? "w185" : "w92")
				const im = ready(url) ?? ready(img(it, "w185")) ?? ready(img(it, "w92"))
				if (!im) want(url)
				ctx.globalAlpha = p.alpha[i]
				if (im) ctx.drawImage(im, s.x + gap / 2, s.y + gap / 2, sw - gap, sh - gap)
				else {
					ctx.fillStyle = p.dot?.[i] ?? "#292524"
					ctx.globalAlpha = p.alpha[i] * 0.35
					ctx.fillRect(s.x + gap / 2, s.y + gap / 2, sw - gap, sh - gap)
				}
				const r = p.ring?.[i]
				if (r || p.selected === i) {
					ctx.globalAlpha = 1
					ctx.strokeStyle = p.selected === i ? "#fff" : (r as string)
					ctx.lineWidth = p.selected === i ? 3 : 2
					ctx.strokeRect(s.x + gap / 2 + 1, s.y + gap / 2 + 1, sw - gap - 2, sh - gap - 2)
				}
				hitCells.current.push({ i, x: s.x, y: s.y, w: sw, h: sh })
			}
			ctx.globalAlpha = 1
		} else {
			// Dots first, posters on top.
			for (const i of p.order) {
				const a = p.alpha[i]
				if (!(a > 0.01)) continue
				const q = current(i)
				const s = toScreen(q)
				const w = baseW * (1 + ((p.size?.[i] ?? 1) - 1) * boost)
				if (!inView(s.x, s.y, w)) continue
				if (w >= (stars ? 30 : 16)) {
					posters.push({ i, sx: s.x, sy: s.y, w })
					continue
				}
				// Level of detail: a dot, brighter and larger for better matches.
				const r = stars ? Math.max(0.8, Math.min(3.2, w * 0.16)) : Math.max(1.4, Math.min(5, w * 0.32))
				ctx.globalAlpha = a
				ctx.fillStyle = p.dot?.[i] ?? "#a8a29e"
				if (stars) {
					ctx.beginPath()
					ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
					ctx.fill()
					if (p.glow?.[i]) {
						ctx.globalAlpha = a * 0.25
						ctx.beginPath()
						ctx.arc(s.x, s.y, r * 3.2, 0, Math.PI * 2)
						ctx.fill()
					}
				} else if (w >= 7) {
					// Mid distance: a tiny poster-shaped tile.
					ctx.fillRect(s.x - w / 2, s.y - w * 0.75, w, w * 1.5)
				} else {
					ctx.beginPath()
					ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
					ctx.fill()
				}
				if (p.ring?.[i]) {
					ctx.globalAlpha = Math.max(0.35, a)
					ctx.strokeStyle = p.ring[i] as string
					ctx.lineWidth = 1.5
					ctx.beginPath()
					ctx.arc(s.x, s.y, r + 2.2, 0, Math.PI * 2)
					ctx.stroke()
				}
			}
			ctx.globalAlpha = 1
			// Level-of-detail budget: past ~450 posters on screen, the least relevant draw as plain tiles.
			const BUDGET = 450
			if (posters.length > BUDGET) {
				const tiles = posters.splice(0, posters.length - BUDGET)
				for (const { i, sx, sy, w } of tiles) {
					ctx.globalAlpha = p.alpha[i] * 0.8
					ctx.fillStyle = p.dot?.[i] ?? "#a8a29e"
					ctx.fillRect(sx - w / 2, sy - w * 0.75, w, w * 1.5)
				}
				ctx.globalAlpha = 1
			}
			for (let k = posters.length - 1; k >= 0; k--) {
				const { i, w } = posters[k]
				const ww = p.selected === i ? w * 1.25 : w
				const dim = p.alpha[i] < 0.5
				const url = img(p.items[i], dim ? "w92" : ww * dpr > 190 ? "w342" : ww * dpr > 100 ? "w185" : "w92")
				if (!ready(url)) want(url)
			}
			for (const { i, sx, sy, w } of posters) {
				const it = p.items[i]
				const sel = p.selected === i
				const ww = sel ? w * 1.25 : w
				const h = ww * 1.5
				const x = sx - ww / 2
				const y = sy - h / 2
				const size = p.alpha[i] < 0.5 ? "w92" : ww * dpr > 190 ? "w342" : ww * dpr > 100 ? "w185" : "w92"
				const url = img(it, size)
				const im = ready(url) ?? ready(img(it, "w185")) ?? ready(img(it, "w92")) ?? ready(img(it, "w342"))
				ctx.globalAlpha = p.alpha[i]
				if (p.glow?.[i]) {
					ctx.save()
					ctx.shadowColor = "rgba(245,158,11,.75)"
					ctx.shadowBlur = Math.min(28, ww * 0.35)
					ctx.fillStyle = "#000"
					ctx.fillRect(x, y, ww, h)
					ctx.restore()
				}
				const radius = Math.min(6, ww * 0.06)
				if (im) {
					if (ww > 44) {
						ctx.save()
						ctx.beginPath()
						ctx.roundRect(x, y, ww, h, radius)
						ctx.clip()
						ctx.drawImage(im, x, y, ww, h)
						ctx.restore()
					} else ctx.drawImage(im, x, y, ww, h)
					// Filtered-out titles: darkened with a plain overlay (canvas filters are too slow here).
					if (p.gray?.[i]) {
						ctx.fillStyle = "rgba(0,0,0,.45)"
						ctx.fillRect(x, y, ww, h)
					}
				} else {
					ctx.fillStyle = p.dot?.[i] ?? "#292524"
					ctx.globalAlpha = p.alpha[i] * 0.3
					ctx.fillRect(x, y, ww, h)
					ctx.globalAlpha = p.alpha[i]
					if (ww > 60) {
						ctx.fillStyle = "rgba(255,255,255,.6)"
						ctx.font = `600 ${Math.min(13, ww / 8)}px ${font}`
						ctx.fillText(it.title.slice(0, 18), x + 6, y + h - 8, ww - 12)
					}
				}
				const ring = sel ? "#fff" : p.ring?.[i]
				if (ring) {
					ctx.globalAlpha = sel ? 1 : Math.max(0.35, p.alpha[i])
					ctx.strokeStyle = ring
					ctx.lineWidth = sel ? 3 : Math.max(1.5, Math.min(3, ww * 0.04))
					ctx.beginPath()
					ctx.roundRect(x - 1, y - 1, ww + 2, h + 2, radius + 1)
					ctx.stroke()
				}
				hitCells.current.push({ i, x, y, w: ww, h })
			}
			ctx.globalAlpha = 1
		}
		commitWanted()
		pump()

		// Region labels: large when far out, fading as you get close.
		for (const l of p.labels ?? []) {
			const s = toScreen(l)
			if (s.x < -300 || s.x > c.w + 300 || s.y < -60 || s.y > c.h + 60) continue
			const fade = Math.max(0, Math.min(1, (6.5 - c.scale * (stars ? 0.9 : 1)) / 4.5))
			if (fade <= 0.02) continue
			const size = Math.round(13 + 11 * l.weight)
			ctx.globalAlpha = (stars ? 0.75 : 0.95) * fade
			ctx.font = `${stars ? 500 : 700} ${size}px ${font}`
			ctx.textAlign = "center"
			ctx.textBaseline = "bottom"
			ctx.lineWidth = 4
			ctx.strokeStyle = "rgba(0,0,0,.85)"
			ctx.strokeText(l.text, s.x, s.y)
			ctx.fillStyle = stars ? "#fde68a" : "#fafaf9"
			ctx.fillText(l.text, s.x, s.y)
			if (l.sub) {
				ctx.font = `500 ${Math.round(size * 0.55)}px ${font}`
				ctx.globalAlpha = 0.6 * fade
				ctx.fillStyle = "#d6d3d1"
				ctx.fillText(l.sub, s.x, s.y + size * 0.75)
			}
			ctx.textAlign = "start"
			ctx.textBaseline = "alphabetic"
		}
		ctx.globalAlpha = 1

		// Markers on top.
		for (const m of p.markers ?? []) {
			const s = toScreen(m)
			const r = m.kind === "pin" ? 7 : 22
			ctx.save()
			ctx.strokeStyle = m.color
			ctx.fillStyle = m.color
			ctx.lineWidth = 2.5
			ctx.shadowColor = m.color
			ctx.shadowBlur = 18
			ctx.beginPath()
			ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
			ctx.stroke()
			ctx.shadowBlur = 0
			ctx.beginPath()
			ctx.arc(s.x, s.y, m.kind === "pin" ? 3 : 5, 0, Math.PI * 2)
			ctx.fill()
			if (m.kind !== "pin")
				for (const [dx, dy] of [
					[0, -1],
					[0, 1],
					[-1, 0],
					[1, 0],
				]) {
					ctx.beginPath()
					ctx.moveTo(s.x + dx * (r + 3), s.y + dy * (r + 3))
					ctx.lineTo(s.x + dx * (r + 12), s.y + dy * (r + 12))
					ctx.stroke()
				}
			ctx.font = `700 12px ${font}`
			const tw = ctx.measureText(m.label).width
			const ly = s.y + r + 16
			ctx.fillRect(s.x - tw / 2 - 6, ly - 2, tw + 12, 19)
			ctx.fillStyle = "#000"
			ctx.textAlign = "center"
			ctx.textBaseline = "top"
			ctx.fillText(m.label, s.x, ly + 1)
			ctx.restore()
		}

		// Test hook: the poster nearest the middle of the canvas, for tap checks.
		let top: { i: number; x: number; y: number; w: number; h: number } | undefined
		let topD = Number.POSITIVE_INFINITY
		for (const h of hitCells.current) {
			const d = (h.x + h.w / 2 - c.w / 2) ** 2 + (h.y + h.h / 2 - c.h * 0.6) ** 2
			if (d < topD && p.alpha[h.i] > 0.5) {
				topD = d
				top = h
			}
		}
		if (c.w > 300) {
			const r = cv.getBoundingClientRect()
			;(window as unknown as { __explorerTop?: Pt | null }).__explorerTop = top ? { x: r.left + top.x + top.w / 2, y: r.top + top.y + top.h / 2 } : null
			;(window as unknown as { __explorerCam?: Camera }).__explorerCam = { ...c }
		}
		frames.current.push(now)
		if (frames.current.length > 120) frames.current.shift()
		// Test hook: how long each draw takes, for the frame-budget check.
		const w = window as unknown as { __explorerDrawMs?: number[] }
		w.__explorerDrawMs = [...(w.__explorerDrawMs ?? []).slice(-199), performance.now() - t0]
		;(window as unknown as { __explorerFrames?: number[] }).__explorerFrames = frames.current
		if (again) request()
	}
	// ---- sizing ----
	useEffect(() => {
		const el = wrap.current
		const cv = canvas.current
		if (!el || !cv) return
		onLoaded = () => request()
		const resize = () => {
			const r = el.getBoundingClientRect()
			const dpr = window.devicePixelRatio || 1
			cv.width = Math.max(1, Math.round(r.width * dpr))
			cv.height = Math.max(1, Math.round(r.height * dpr))
			cv.style.width = `${r.width}px`
			cv.style.height = `${r.height}px`
			cam.current.w = r.width
			cam.current.h = r.height
			if (!inited.current && r.width > 0) {
				inited.current = true
				const init = P.current.initial ?? "fit"
				if (init === "fit") Object.assign(cam.current, fitTo(P.current.pos))
				else Object.assign(cam.current, { x: init.x, y: init.y, scale: clampScale(init.scale) })
				P.current.onCamera?.({ ...cam.current })
			}
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
	}, [request])

	// ---- input ----
	useEffect(() => {
		const cv = canvas.current
		if (!cv) return
		const pointers = new Map<number, Pt>()
		let mode: "none" | "pan" | "pinch" | "marker" = "none"
		let start = { x: 0, y: 0, t: 0 }
		let moved = 0
		let last = { x: 0, y: 0, t: 0 }
		let pinch = { d: 1, scale: 1, world: { x: 0, y: 0 } }
		let markerId = ""
		const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
			const r = cv.getBoundingClientRect()
			return { x: e.clientX - r.left, y: e.clientY - r.top }
		}
		const hitMarker = (pt: Pt) =>
			(P.current.markers ?? []).find((m) => {
				if (!m.draggable) return false
				const s = toScreen(m)
				return Math.hypot(s.x - pt.x, s.y - pt.y) < 34
			})
		const hitItem = (pt: Pt): number | null => {
			const cells = hitCells.current
			for (let k = cells.length - 1; k >= 0; k--) {
				const h = cells[k]
				if (pt.x >= h.x && pt.x <= h.x + h.w && pt.y >= h.y && pt.y <= h.y + h.h) return h.i
			}
			// Dots: nearest within 14 px.
			let best: number | null = null
			let bd = 14 * 14
			const p = P.current
			for (const i of p.order) {
				if (!(p.alpha[i] > 0.15)) continue
				const s = toScreen(current(i))
				const d = (s.x - pt.x) ** 2 + (s.y - pt.y) ** 2
				if (d < bd) {
					bd = d
					best = i
				}
			}
			return best
		}
		const down = (e: PointerEvent) => {
			cv.setPointerCapture(e.pointerId)
			const pt = local(e)
			pointers.set(e.pointerId, pt)
			flight.current = null
			velocity.current = null
			if (pointers.size === 2) {
				const [a, b] = [...pointers.values()]
				const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
				pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: cam.current.scale, world: toWorld(mid.x, mid.y) }
				mode = "pinch"
				moved = 99
				return
			}
			const m = hitMarker(pt)
			if (m) {
				mode = "marker"
				markerId = m.id
			} else mode = "pan"
			start = { x: pt.x, y: pt.y, t: performance.now() }
			last = { ...start }
			moved = 0
		}
		const move = (e: PointerEvent) => {
			if (!pointers.has(e.pointerId)) return
			const pt = local(e)
			const prev = pointers.get(e.pointerId) as Pt
			pointers.set(e.pointerId, pt)
			const c = cam.current
			if (mode === "pinch" && pointers.size >= 2) {
				const [a, b] = [...pointers.values()]
				const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
				c.scale = clampScale(pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d))
				c.x = pinch.world.x - (mid.x - c.w / 2) / c.scale
				c.y = pinch.world.y - (mid.y - c.h / 2) / c.scale
				P.current.onCamera?.({ ...c })
				request()
				return
			}
			moved = Math.max(moved, Math.hypot(pt.x - start.x, pt.y - start.y))
			if (mode === "marker") {
				P.current.onMarkerDrag?.(markerId, toWorld(pt.x, pt.y), "move")
				request()
				return
			}
			if (mode === "pan" && moved > 3) {
				c.x -= (pt.x - prev.x) / c.scale
				c.y -= (pt.y - prev.y) / c.scale
				const t = performance.now()
				const dt = Math.max(1, t - last.t)
				velocity.current = null
				last = { x: pt.x, y: pt.y, t }
				;(cv as unknown as { _v?: Pt })._v = { x: ((pt.x - prev.x) / dt) * 16, y: ((pt.y - prev.y) / dt) * 16 }
				P.current.onCamera?.({ ...c })
				request()
			}
		}
		const up = (e: PointerEvent) => {
			if (!pointers.has(e.pointerId)) return
			const pt = local(e)
			pointers.delete(e.pointerId)
			if (mode === "pinch") {
				if (pointers.size === 0) mode = "none"
				else {
					// One finger left: continue as a pan without a jump.
					const [only] = [...pointers.values()]
					start = { x: only.x, y: only.y, t: performance.now() }
					mode = "pan"
				}
				return
			}
			if (mode === "marker") {
				P.current.onMarkerDrag?.(markerId, toWorld(pt.x, pt.y), "end")
				mode = "none"
				return
			}
			if (mode === "pan") {
				if (moved < 6 && performance.now() - start.t < 500) P.current.onTap?.(hitItem(pt), pt)
				else {
					const v = (cv as unknown as { _v?: Pt })._v
					if (v && performance.now() - last.t < 60 && Math.hypot(v.x, v.y) > 2) {
						velocity.current = { vx: v.x, vy: v.y }
						request()
					}
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
			const f = Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0016)
			c.scale = clampScale(c.scale * f)
			c.x = w.x - (pt.x - c.w / 2) / c.scale
			c.y = w.y - (pt.y - c.h / 2) / c.scale
			P.current.onCamera?.({ ...c })
			request()
		}
		const dbl = (e: MouseEvent) => {
			const pt = local(e)
			const w = toWorld(pt.x, pt.y)
			flyTo(w.x, w.y, cam.current.scale * 2, 350)
		}
		cv.addEventListener("pointerdown", down)
		cv.addEventListener("pointermove", move)
		cv.addEventListener("pointerup", up)
		cv.addEventListener("pointercancel", up)
		cv.addEventListener("wheel", wheel, { passive: false })
		cv.addEventListener("dblclick", dbl)
		// A tap opens UI where the finger was; without this the browser's follow-up click lands on it.
		const noGhost = (e: TouchEvent) => e.cancelable && e.preventDefault()
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
	}, [request])

	return (
		<div ref={wrap} className={`overflow-hidden ${props.className ?? "relative"}`}>
			<canvas
				ref={canvas}
				role="img"
				aria-label={props.ariaLabel ?? "Taste space"}
				className="absolute inset-0 block touch-none select-none cursor-grab active:cursor-grabbing"
			/>
		</div>
	)
})
