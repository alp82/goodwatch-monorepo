// PROTOTYPE - throwaway. Core and edges (existing components): clusters relative to your taste. You stand in the
// middle; distance from you is how far a title is from your taste, and the direction is its mood. Three bands:
// your core, your edges, and the unexplored. Only your core is open at first. Pan outward (or tap the button) and
// the next band's fog lifts and its titles stream in.
import { useEffect, useMemo, useRef, useState } from "react"
import {
	type Cam,
	Stage,
	type StageHandle,
	drawYou,
	fogFill,
	haloText,
} from "../Stage"
import { Header, PeekDock, ZoomControls } from "../kit2"
import { Store } from "../store"
import type { Ex } from "../useExplorer2"
import { useTiles } from "../useTiles"
import { S0, type W } from "../wire"

const easeOut = (t: number) => 1 - (1 - t) ** 3

export default function Rings({ ex }: { ex: Ex }) {
	const stage = useRef<StageHandle>(null)
	const store = useMemo(() => new Store(), [])
	const bands = ex.data.meta?.bands ?? []
	const sectors = ex.data.meta?.sectors ?? []
	const [open, setOpen] = useState(1) // how many bands are open
	const openR = useRef({
		from: bands[0]?.r1 ?? 360,
		to: bands[0]?.r1 ?? 360,
		t0: 0,
	})
	const openRef = useRef(open)
	openRef.current = open
	const accept = (w: W) =>
		Math.hypot(w.x ?? 0, w.y ?? 0) <= (bands[openRef.current - 1]?.r1 ?? 0) + 8
	const tiles = useTiles(stage, store, ex, "rings", accept)
	const [sel, setSel] = useState<number | null>(null)

	const unlock = (k: number, fly = false) => {
		if (k <= openRef.current || k > bands.length) return
		const r = openR.current
		const now = performance.now()
		const cur =
			r.from + (r.to - r.from) * easeOut(Math.min(1, (now - r.t0) / 900))
		openR.current = { from: cur, to: bands[k - 1].r1, t0: now }
		openRef.current = k
		setOpen(k)
		tiles.reset()
		tiles.onView()
		if (fly) {
			const c = stage.current?.camera()
			if (c)
				stage.current?.flyTo(
					0,
					0,
					Math.max(S0 * 1.1, Math.min(c.w, c.h) / (bands[k - 1].r1 * 2.25)),
					1100,
				)
		}
		stage.current?.redraw()
	}

	const onView = () => {
		tiles.onView()
		const c = stage.current?.camera()
		if (!c) return
		// Walking outward past the edge of what's open opens the next band.
		const d = Math.hypot(c.x, c.y)
		const k = openRef.current
		if (k < bands.length && d > bands[k - 1].r1 * 0.92) unlock(k + 1)
	}

	const hooks = useMemo(
		() => ({
			under: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const ox = -c.x * c.scale + c.w / 2
				const oy = -c.y * c.scale + c.h / 2
				ctx.lineWidth = 1
				// Mood sectors as spokes, bands as rings.
				const R = (bands[bands.length - 1]?.r1 ?? 1000) * c.scale
				ctx.strokeStyle = "rgba(255,255,255,.07)"
				ctx.beginPath()
				for (const s of sectors) {
					ctx.moveTo(ox + Math.cos(s.a0) * 30, oy + Math.sin(s.a0) * 30)
					ctx.lineTo(ox + Math.cos(s.a0) * R, oy + Math.sin(s.a0) * R)
				}
				ctx.stroke()
				for (const b of bands) {
					ctx.strokeStyle =
						b.id === "core" ? "rgba(251,191,36,.35)" : "rgba(214,179,106,.2)"
					ctx.setLineDash(b.id === "core" ? [] : [6, 8])
					ctx.beginPath()
					ctx.arc(ox, oy, b.r1 * c.scale, 0, Math.PI * 2)
					ctx.stroke()
				}
				ctx.setLineDash([])
			},
			over: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const ox = -c.x * c.scale + c.w / 2
				const oy = -c.y * c.scale + c.h / 2
				// Mood names just inside the open edge.
				const r = openR.current
				const cur =
					r.from +
					(r.to - r.from) *
						easeOut(Math.min(1, (performance.now() - r.t0) / 900))
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				ctx.font = "700 15px system-ui, sans-serif"
				const lr = (cur - 26 / c.scale) * c.scale
				for (const s of sectors) {
					if ((s.a1 - s.a0) * lr < s.name.length * 9 + 12) continue
					const a = (s.a0 + s.a1) / 2
					const x = ox + Math.cos(a) * lr
					const y = oy + Math.sin(a) * lr
					if (x < -80 || y < -20 || x > c.w + 80 || y > c.h + 20) continue
					haloText(ctx, s.name, x, y, s.color)
				}
				drawYou(ctx, ox, oy)
				return performance.now() - r.t0 < 950
			},
			top: (ctx: CanvasRenderingContext2D, c: Cam) => {
				// Band names on the rings, above the fog.
				const ox = -c.x * c.scale + c.w / 2
				const oy = -c.y * c.scale + c.h / 2
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				for (let k = 0; k < bands.length; k++) {
					const b = bands[k]
					const isOpen = k < openRef.current
					const y = isOpen
						? oy - b.r1 * c.scale + 16
						: oy - ((b.r0 + b.r1) / 2) * c.scale
					if (y < -20 || y > c.h + 20) continue
					ctx.font = isOpen
						? "600 13px system-ui, sans-serif"
						: "700 16px system-ui, sans-serif"
					haloText(
						ctx,
						isOpen ? b.name : `${b.name}: pan out to open`,
						ox,
						y,
						isOpen ? "#fde68a" : "#d6d3d1",
					)
				}
			},
			fog: (fctx: CanvasRenderingContext2D, c: Cam) => {
				const r = openR.current
				const t = Math.min(1, (performance.now() - r.t0) / 900)
				const cur = (r.from + (r.to - r.from) * easeOut(t)) * c.scale
				const ox = -c.x * c.scale + c.w / 2
				const oy = -c.y * c.scale + c.h / 2
				fogFill(fctx, c)
				const g = fctx.createRadialGradient(
					ox,
					oy,
					Math.max(0, cur - 30),
					ox,
					oy,
					cur + 50,
				)
				g.addColorStop(0, "rgba(0,0,0,1)")
				g.addColorStop(1, "rgba(0,0,0,0)")
				fctx.fillStyle = g
				fctx.fillRect(0, 0, c.w, c.h)
				fctx.globalCompositeOperation = "source-over"
				return t < 1
			},
		}),
		[bands, sectors],
	)

	const [initial] = useState(() => ({ x: 0, y: 0, scale: S0 * 2 ** 1.2 }))
	useEffect(() => {
		// One opening moment: settle into your core.
		const t = setTimeout(() => {
			const c = stage.current?.camera()
			if (c) stage.current?.flyTo(0, 0, S0 * 2 ** 2.3, 1400)
		}, 300)
		return () => clearTimeout(t)
	}, [])

	const next = bands[open]
	return (
		<div className="rx2-stage rx-atlas-bg text-white">
			<Stage
				ref={stage}
				className="absolute inset-0"
				store={store}
				hooks={hooks}
				levels
				selected={sel}
				queue={ex.queue}
				initial={initial}
				minScale={S0 * 0.5}
				maxScale={30}
				bounds={{ x0: -1150, y0: -1150, x1: 1150, y1: 1150 }}
				onTap={(i) => setSel(i)}
				onView={onView}
				ariaLabel="Your taste in rings: your core in the middle, your edges, and the unexplored"
			/>
			<Header
				ex={ex}
				title="Explore"
				sub="You're in the middle. The closer a title, the closer it is to your taste; its direction is its mood."
			/>
			<PeekDock
				ex={ex}
				it={sel == null ? null : store.items[sel]}
				onClose={() => setSel(null)}
			/>
			<div
				className={`absolute inset-x-3 rx2-bottom z-10 flex justify-center gap-2 md:inset-x-auto md:left-6 ${sel != null ? "hidden md:flex" : ""}`}
			>
				{next ? (
					<button
						type="button"
						onClick={() => unlock(open + 1, true)}
						className="h-11 rounded-full bg-amber-500 px-5 text-sm font-bold text-black shadow-2xl hover:bg-amber-400"
					>
						{open === 1 ? "Open your edges" : "Go into the unexplored"}
					</button>
				) : (
					<span className="rounded-full border border-white/10 bg-black/70 px-4 py-2.5 text-sm text-gray-300">
						Everything is open. Pinch or scroll to zoom.
					</span>
				)}
			</div>
			<ZoomControls
				className={`absolute bottom-40 right-4 z-10 md:bottom-6 ${sel != null ? "hidden md:flex" : ""}`}
				onIn={() => stage.current?.zoomBy(2)}
				onOut={() => stage.current?.zoomBy(0.5)}
				onYou={() => stage.current?.flyTo(0, 0, S0 * 2 ** 2.5, 900)}
			/>
		</div>
	)
}
