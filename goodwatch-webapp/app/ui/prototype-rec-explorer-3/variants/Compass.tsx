// PROTOTYPE - throwaway. Compass (existing look, round 2's canvas): the title you stand on in the middle and four
// opposing directions around it, two titles each. The two axes are picked per title (of seven: bleaker/more hopeful,
// faster/slower, tenser/gentler, fantastical/grounded, funnier/serious, cerebral/heartfelt, stranger/straighter) so
// the four arms land as far apart as possible. Take one and the map walks that way; the path stays as a gold line.
// Zoomed out you see the path and the four words; at the normal distance each arm says what it changes; zoomed in,
// titles and matches appear under the posters.
import { useEffect, useMemo, useRef, useState } from "react"
import {
	type Cam,
	Stage,
	type StageHandle,
	haloText,
} from "~/ui/prototype-rec-explorer-2/Stage"
import { ZoomControls } from "~/ui/prototype-rec-explorer-2/kit2"
import { type Item, Store } from "~/ui/prototype-rec-explorer-2/store"
import { PathStrip, PeekDock, Top } from "../kit3"
import { type Ex3, useWalk } from "../useExplorer3"
import type { Opt, Turn, W } from "../wire"

type Side = "n" | "e" | "s" | "w"
const DIR: Record<Side, [number, number]> = {
	n: [0, -1],
	e: [1, 0],
	s: [0, 1],
	w: [-1, 0],
}
// How far the arms reach: roomier on wide screens, where labels sit on the map; tight on phones, where they don't.
type Geo = { ns: number; ew: number; wide: boolean }
const WIDE: Geo = { ns: 29, ew: 25, wide: true }
const NARROW: Geo = { ns: 22, ew: 20, wide: false }
const STEP = 86
const ORDER: Side[] = ["n", "w", "e", "s"]

type Arm = { opt: Opt; side: Side; ids: number[] }
type Spot = { i: number; x: number; y: number; t: string }

/** Where an arm's titles sit: pairs side by side above and below, stacked left and right. */
function armSpot(side: Side, j: number, cx: number, cy: number, g: Geo) {
	const [dx, dy] = DIR[side]
	if (dy) return { x: cx + (j === 0 ? -6 : 6), y: cy + dy * g.ns }
	return { x: cx + dx * g.ew, y: cy + (j === 0 ? -8.5 : 8.5) }
}
const ARROW: Record<Side, string> = { n: "↑", w: "←", e: "→", s: "↓" }

const wrapCache = new Map<string, string[]>()
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
	const key = `${ctx.font}|${max}|${text}`
	const hit = wrapCache.get(key)
	if (hit) return hit
	const out: string[] = []
	let line = ""
	for (const word of text.split(" ")) {
		const next = line ? `${line} ${word}` : word
		if (ctx.measureText(next).width > max && line) {
			out.push(line)
			line = word
		} else line = next
	}
	if (line) out.push(line)
	wrapCache.set(key, out)
	return out
}

export default function Compass({ ex }: { ex: Ex3 }) {
	const stage = useRef<StageHandle>(null)
	const store = useMemo(() => new Store(), [])
	const walk = useWalk()
	const here = useRef<Spot | null>(null)
	const past = useRef<Spot[]>([])
	const arms = useRef<Arm[]>([])
	const [armList, setArmList] = useState<Arm[]>([])
	const [busy, setBusy] = useState(true)
	const [sel, setSel] = useState<number | null>(null)
	const geo = useRef<Geo>(WIDE)
	const lastAxis = useRef("")
	const labelBoxes = useRef<{ side: Side; x0: number; y0: number; x1: number; y1: number }[]>([])

	const fit = (cx: number, cy: number, ms = 800) => {
		const c = stage.current?.camera()
		if (!c || !c.w) return
		const wide = geo.current.wide
		const left = wide ? 540 : 0
		const top = wide ? 30 : 175
		const bottom = wide ? 90 : 215
		const scale = Math.max(
			3,
			Math.min(
				12,
				(c.w - left) / (wide ? 88 : 56),
				(c.h - top - bottom) / (wide ? 118 : 64),
			),
		)
		// Put the compass in the free part of the screen.
		const sx = left + (c.w - left) / 2
		const sy = top + (c.h - top - bottom) / 2
		stage.current?.flyTo(
			cx - (sx - c.w / 2) / scale,
			cy - (sy - c.h / 2) / scale,
			scale,
			ms,
		)
	}

	const load = async (at: W | null) => {
		setBusy(true)
		try {
			const t = await ex.api<Turn>("turn", {
				mode: "compass",
				at: at?.k ?? "",
				last: lastAxis.current,
				...walk.params(),
			})
			const now = performance.now()
			if (!here.current) geo.current = window.innerWidth >= 1024 ? WIDE : NARROW
			if (!here.current && t.here) {
				const [i] = store.add([t.here], now, () => ({ x: 0, y: 0 }))
				here.current = { i, x: 0, y: 0, t: t.here.t }
				walk.show([t.here])
				walk.step(t.here, "")
			}
			const h = here.current as Spot
			const next: Arm[] = t.options.map((opt) => {
				const side = opt.side as Side
				const ids = store.add(opt.items, now, (_, j) => armSpot(side, j, h.x, h.y, geo.current))
				return { opt, side, ids }
			})
			walk.show(t.options.flatMap((o) => o.items))
			walk.offered(
				t.options.map((o) => o.items[0]),
				t.spread,
			)
			arms.current = next
			setArmList(next)
			store.filter(ex.pass)
			fit(h.x, h.y)
		} finally {
			setBusy(false)
		}
	}
	const started = useRef(false)
	useEffect(() => {
		if (started.current) return
		started.current = true
		// Wait a frame so the stage knows its size.
		requestAnimationFrame(() => void load(null))
	}, [])
	const filters = useRef(ex.filterKey)
	useEffect(() => {
		store.filter(ex.pass)
		stage.current?.redraw()
		if (filters.current === ex.filterKey) return
		filters.current = ex.filterKey
		for (const a of arms.current) for (const i of a.ids) store.hide(i)
		arms.current = []
		setArmList([])
		const h = here.current
		if (h) void load(store.items[h.i])
	}, [ex.filterKey, ex.rev])

	/** Walk one step: the chosen title glides to its new spot, the rest of this turn fades away. */
	const take = (arm: Arm, i: number) => {
		if (busy) return
		const h = here.current as Spot
		const [dx, dy] = DIR[arm.side]
		let d = STEP
		let nx = h.x + dx * d
		let ny = h.y + dy * d
		const spots = [...past.current, h]
		for (let k = 0; k < 8; k++) {
			if (!spots.some((p) => Math.hypot(p.x - nx, p.y - ny) < STEP * 0.8)) break
			d += 60
			nx = h.x + dx * d
			ny = h.y + dy * d
		}
		for (const a of arms.current) for (const j of a.ids) if (j !== i) store.hide(j)
		store.hide(h.i)
		past.current.push(h)
		const w = store.items[i]
		here.current = { i, x: nx, y: ny, t: w.t }
		arms.current = []
		setArmList([])
		setSel(null)
		walk.step(w, arm.opt.label)
		lastAxis.current = arm.opt.id
		const fx = store.x[i]
		const fy = store.y[i]
		const t0 = performance.now()
		const tick = (now: number) => {
			const k = Math.min(1, (now - t0) / 650)
			const e = 1 - (1 - k) ** 3
			store.move(i, fx + (nx - fx) * e, fy + (ny - fy) * e)
			stage.current?.redraw()
			if (k < 1) requestAnimationFrame(tick)
		}
		requestAnimationFrame(tick)
		fit(nx, ny, 650)
		void load(w)
	}
	const backTo = (k: number) => {
		const path = walk.pathRef.current
		if (busy || k >= path.length - 1) return
		const spot = past.current[k]
		if (!spot) return
		for (const a of arms.current) for (const j of a.ids) store.hide(j)
		const h = here.current as Spot
		store.hide(h.i)
		// Everything after that step drops off the path.
		past.current = past.current.slice(0, k)
		store.hide(spot.i, false)
		here.current = spot
		arms.current = []
		setArmList([])
		walk.backTo(k)
		fit(spot.x, spot.y)
		void load(store.items[spot.i])
	}

	const hooks = useMemo(
		() => ({
			under: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const sx = (x: number) => (x - c.x) * c.scale + c.w / 2
				const sy = (y: number) => (y - c.y) * c.scale + c.h / 2
				const h = here.current
				if (!h) return
				// The path so far: a gold line through where you stood.
				const pts = [...past.current, h]
				if (pts.length > 1) {
					ctx.strokeStyle = "rgba(251,191,36,.55)"
					ctx.lineWidth = 2
					ctx.setLineDash([6, 6])
					ctx.beginPath()
					pts.forEach((p, k) =>
						k ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y)),
					)
					ctx.stroke()
					ctx.setLineDash([])
				}
				ctx.font = "600 12px system-ui, sans-serif"
				ctx.textAlign = "left"
				ctx.textBaseline = "middle"
				// Names of where you stood; the newest wins when two would overlap.
				const placed: [number, number, number, number][] = []
				for (let k = past.current.length - 1; k >= 0; k--) {
					const p = past.current[k]
					const x = sx(p.x)
					const y = sy(p.y)
					ctx.fillStyle = "#fbbf24"
					ctx.beginPath()
					ctx.arc(x, y, 5, 0, Math.PI * 2)
					ctx.fill()
					const w = ctx.measureText(p.t).width
					const box: [number, number, number, number] = [x + 10, y - 8, x + 14 + w, y + 8]
					if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue
					placed.push(box)
					haloText(ctx, p.t, x + 10, y, "#e7e5e4", "rgba(0,0,0,.9)", 4)
				}
				// Faint spokes from here to each arm.
				ctx.strokeStyle = "rgba(253,230,138,.16)"
				ctx.lineWidth = 1.5
				ctx.beginPath()
				for (const a of arms.current) {
					const s = armSpot(a.side, 0, h.x, h.y, geo.current)
					const e = armSpot(a.side, 1, h.x, h.y, geo.current)
					ctx.moveTo(sx(h.x), sy(h.y))
					ctx.lineTo(sx((s.x + e.x) / 2), sy((s.y + e.y) / 2))
				}
				ctx.stroke()
			},
			over: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const sx = (x: number) => (x - c.x) * c.scale + c.w / 2
				const sy = (y: number) => (y - c.y) * c.scale + c.h / 2
				const h = here.current
				labelBoxes.current = []
				if (!h) return
				// Where you stand: a gold frame.
				const pw = 10 * c.scale
				ctx.strokeStyle = "#fbbf24"
				ctx.lineWidth = 3
				ctx.strokeRect(sx(store.x[h.i]) - pw / 2 - 4, sy(store.y[h.i]) - pw * 0.75 - 4, pw + 8, pw * 1.5 + 8)
				// Phones carry the words in the buttons below; far out, the path is the story.
				if (!geo.current.wide || c.scale < 2.6) return
				const words = Math.max(14, Math.min(28, 3.4 * c.scale))
				const detail = c.scale >= 4.6
				for (const a of arms.current) {
					const s0 = armSpot(a.side, 0, h.x, h.y, geo.current)
					const s1 = armSpot(a.side, 1, h.x, h.y, geo.current)
					const vertical = a.side === "n" || a.side === "s"
					const cx = sx((s0.x + s1.x) / 2)
					const edge = vertical
						? a.side === "n"
							? sy(s0.y) - pw * 0.75 - 8
							: sy(s0.y) + pw * 0.75 + 8
						: sy(s1.y) + pw * 0.75 + 8
					const up = a.side === "n"
					ctx.textAlign = "center"
					ctx.font = `900 ${words}px 'Big Shoulders Display', system-ui, sans-serif`
					const lines = detail
						? (() => {
								ctx.font = "500 12px system-ui, sans-serif"
								const l = wrap(ctx, a.opt.line, Math.min(250, 26 * c.scale)).slice(0, 3)
								ctx.font = `900 ${words}px 'Big Shoulders Display', system-ui, sans-serif`
								return l
							})()
						: []
					const lh = 15
					const block = words + 4 + lines.length * lh
					const y0 = up ? edge - block : edge
					ctx.textBaseline = "top"
					haloText(ctx, a.opt.label, cx, y0, "#fcd34d", "rgba(0,0,0,.92)", 6)
					const tw = ctx.measureText(a.opt.label).width
					ctx.font = "500 12px system-ui, sans-serif"
					lines.forEach((l, k) =>
						haloText(ctx, l, cx, y0 + words + 4 + k * lh, "#e7e5e4", "rgba(0,0,0,.92)", 4),
					)
					labelBoxes.current.push({
						side: a.side,
						x0: cx - Math.max(tw, 120) / 2,
						x1: cx + Math.max(tw, 120) / 2,
						y0,
						y1: y0 + block,
					})
				}
			},
		}),
		[store],
	)

	const onTap = (i: number | null, _wx: number, _wy: number, px: number, py: number) => {
		if (i != null) return setSel(i)
		const box = labelBoxes.current.find(
			(b) => px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1,
		)
		const arm = box && arms.current.find((a) => a.side === box.side)
		if (arm) take(arm, arm.ids[0])
		else setSel(null)
	}
	const selArm = sel == null ? null : arms.current.find((a) => a.ids.includes(sel))
	const bySide = (s: Side) => armList.find((a) => a.side === s)
	return (
		<div className="rx2-stage bg-stone-950 text-white">
			<Stage
				ref={stage}
				className="absolute inset-0"
				store={store}
				hooks={hooks}
				selected={sel}
				initial={{ x: 0, y: 0, scale: 6 }}
				minScale={0.6}
				maxScale={30}
				onTap={onTap}
				ariaLabel="The title you stand on and four directions around it"
			/>
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/90 via-black/60 to-transparent px-4 pb-8 pt-3 md:px-8 md:pt-5 lg:inset-x-auto lg:bottom-0 lg:left-0 lg:w-[33rem] lg:bg-gradient-to-r lg:pb-0">
				<div className="pointer-events-auto">
					<Top
						ex={ex}
						title="Compass"
						sub={
							<span className="hidden md:inline">
								Four opposite directions from the title you're on, chosen so each leads somewhere the others don't. Tap a direction to walk that way.
							</span>
						}
					/>
					<PathStrip path={walk.path} onPick={backTo} start={null} className="mt-3 w-fit max-w-full" />
					{/* The four directions as buttons, laid out like the compass. */}
					<nav aria-label="Directions" className="mt-4 hidden w-72 grid-cols-3 grid-rows-3 gap-1.5 lg:grid">
						{ORDER.map((s) => {
							const a = bySide(s)
							const place = { n: "col-start-2 row-start-1", w: "col-start-1 row-start-2", e: "col-start-3 row-start-2", s: "col-start-2 row-start-3" }[s]
							return (
								<button
									key={s}
									type="button"
									disabled={!a || busy}
									onClick={() => a && take(a, a.ids[0])}
									className={`${place} flex h-12 items-center justify-center rounded-xl bg-white/10 px-1.5 text-center text-xs font-bold leading-tight text-amber-100 hover:bg-amber-400 hover:text-black disabled:opacity-40`}
								>
									{a?.opt.label ?? "…"}
								</button>
							)
						})}
					</nav>
				</div>
			</div>
			{/* Phone: the four turns with what each changes. */}
			<nav
				aria-label="Directions"
				className={`absolute inset-x-3 rx2-bottom z-10 grid grid-cols-2 gap-1.5 lg:hidden ${sel != null ? "hidden" : ""}`}
			>
				{ORDER.map((s) => {
					const a = bySide(s)
					return (
						<button
							key={s}
							type="button"
							disabled={!a || busy}
							onClick={() => a && take(a, a.ids[0])}
							className="flex min-h-12 flex-col justify-center rounded-xl border border-white/10 bg-black/80 px-2.5 py-1.5 text-left backdrop-blur disabled:opacity-40"
						>
							<span className="rx2-display truncate text-lg font-black leading-none text-amber-300">
								{ARROW[s]} {a?.opt.label ?? "…"}
							</span>
							<span className="mt-0.5 truncate text-[11px] leading-snug text-stone-300">
								{a?.opt.line.split(".")[0]}
							</span>
						</button>
					)
				})}
			</nav>
			<PeekDock
				ex={ex}
				it={sel == null ? null : (store.items[sel] as Item)}
				onClose={() => setSel(null)}
				go={
					selArm && sel != null
						? { label: `Go this way: ${selArm.opt.label.toLowerCase()}`, onGo: () => take(selArm, sel) }
						: undefined
				}
			/>
			<ZoomControls
				className={`absolute bottom-6 right-4 z-10 hidden lg:flex ${sel != null ? "lg:hidden" : ""}`}
				onIn={() => stage.current?.zoomBy(2)}
				onOut={() => stage.current?.zoomBy(0.5)}
				onYou={() => here.current && fit(here.current.x, here.current.y)}
				youLabel="Back to here"
			/>
		</div>
	)
}
