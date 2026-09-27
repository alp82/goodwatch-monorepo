// PROTOTYPE - throwaway. Follow the thread (existing components): a neighborhood graph that grows as you visit.
// You start in the dark with the dozen titles closest to your taste. Tapping a title visits it: the titles most
// like it (nearest neighbors by title analysis, fetched from the server) light up around it, linked to it, and the
// fog pulls back. Titles you've visited leave a gold trail you can jump back along. "Wander" follows the most
// promising unvisited thread for you.
import { useEffect, useMemo, useRef, useState } from "react"
import {
	type Cam,
	Stage,
	type StageHandle,
	drawYou,
	fogFill,
	fogHole,
} from "../Stage"
import { Crumbs, Header, PeekDock, ZoomControls } from "../kit2"
import { Store } from "../store"
import type { Ex } from "../useExplorer2"
import type { W } from "../wire"

const TMDB = "https://image.tmdb.org/t/p/w92"
const SPACING = 14

export default function Trail({ ex }: { ex: Ex }) {
	const stage = useRef<StageHandle>(null)
	const store = useMemo(() => new Store(), [])
	const edges = useRef<number[]>([]) // flat pairs
	const parent = useRef(new Map<number, number>())
	const expanded = useRef(new Map<number, number>()) // index -> time
	const [visited, setVisited] = useState<number[]>([])
	const visitedRef = useRef<number[]>([])
	const [sel, setSel] = useState<number | null>(null)
	const [busy, setBusy] = useState(false)

	/** Put new titles around an anchor, fanned out away from where we came from, clear of existing posters. */
	const place = (
		ws: W[],
		ax: number,
		ay: number,
		away: number,
		spread: number,
		r0: number,
	) => {
		const out: { x: number; y: number }[] = []
		ws.forEach((_, j) => {
			const m = ws.length
			let a = away + (m > 1 ? (j / (m - 1) - 0.5) * spread : 0)
			let r = r0 + (j % 2) * 13
			let x = ax + Math.cos(a) * r
			let y = ay + Math.sin(a) * r
			for (let tries = 0; tries < 24; tries++) {
				const clash =
					store.near(x, y, SPACING).length > 0 ||
					out.some((p) => Math.hypot(p.x - x, p.y - y) < SPACING)
				if (!clash) break
				r += 5
				a += tries % 2 ? 0.17 : -0.23
				x = ax + Math.cos(a) * r
				y = ay + Math.sin(a) * r
			}
			out.push({ x, y })
		})
		return out
	}

	const expand = async (i: number, fly = true) => {
		if (expanded.current.has(i)) return
		expanded.current.set(i, performance.now())
		setBusy(true)
		try {
			const r = await ex.api("near", { k: store.items[i].k, n: 14 })
			const fresh = r.items.filter((w) => !store.index.has(w.k)).slice(0, 8)
			// Titles already on the map get a link, which is what turns the trail into a graph.
			for (const w of r.items.slice(0, 8)) {
				const j = store.index.get(w.k)
				if (j != null && j !== i) edges.current.push(i, j)
			}
			const px = store.x[i]
			const py = store.y[i]
			const from = parent.current.get(i)
			const away =
				from == null
					? Math.atan2(py, px)
					: Math.atan2(py - store.y[from], px - store.x[from])
			const pos = place(fresh, px, py, away, Math.PI * 1.25, 30)
			const ids = store.add(fresh, performance.now(), (_, j) => pos[j])
			store.filter(ex.pass)
			for (const j of ids) {
				parent.current.set(j, i)
				edges.current.push(i, j)
			}
			if (fly) {
				const c = stage.current?.camera()
				if (c)
					stage.current?.flyTo(
						px + Math.cos(away) * 22,
						py + Math.sin(away) * 22,
						Math.max(c.scale, 3.2),
						700,
					)
			}
			stage.current?.redraw()
		} finally {
			setBusy(false)
		}
	}

	const visit = (i: number) => {
		setSel(i)
		if (!visitedRef.current.includes(i)) {
			visitedRef.current = [...visitedRef.current, i]
			setVisited(visitedRef.current)
		}
		void expand(i)
	}

	useEffect(() => {
		let live = true
		ex.api("start", { n: 13 }).then((r) => {
			if (!live) return
			const ids = store.add(r.items, performance.now(), (_, j) => {
				const a = j * 2.39996 - Math.PI / 2
				const rr = 26 + 10 * Math.sqrt(j + 0.5)
				return { x: Math.cos(a) * rr, y: Math.sin(a) * rr }
			})
			store.filter(ex.pass)
			for (const j of ids) edges.current.push(-1, j)
			stage.current?.redraw()
		})
		return () => {
			live = false
		}
	}, [])
	useEffect(() => {
		store.filter(ex.pass)
		stage.current?.redraw()
	}, [ex.filterKey, ex.rev])

	const wander = () => {
		// The best-matching title on the edge of what you've lit up.
		let best = -1
		for (let i = 0; i < store.n; i++) {
			if (expanded.current.has(i) || !store.shown(i)) continue
			if (best < 0 || store.items[i].m > store.items[best].m) best = i
		}
		if (best >= 0) visit(best)
	}

	const hooks = useMemo(
		() => ({
			under: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const E = edges.current
				const hx = c.w / 2 - c.x * c.scale
				const hy = c.h / 2 - c.y * c.scale
				ctx.strokeStyle = "rgba(255,255,255,.16)"
				ctx.lineWidth = 1
				ctx.beginPath()
				for (let k = 0; k < E.length; k += 2) {
					const a = E[k]
					const b = E[k + 1]
					if ((a >= 0 && !store.shown(a)) || !store.shown(b)) continue
					ctx.moveTo(
						a < 0 ? hx : store.x[a] * c.scale + hx,
						a < 0 ? hy : store.y[a] * c.scale + hy,
					)
					ctx.lineTo(store.x[b] * c.scale + hx, store.y[b] * c.scale + hy)
				}
				ctx.stroke()
				// The trail: where you've been, in order.
				const V = visitedRef.current
				if (V.length) {
					ctx.strokeStyle = "rgba(251,191,36,.85)"
					ctx.lineWidth = 2.5
					ctx.setLineDash([7, 6])
					ctx.beginPath()
					ctx.moveTo(hx, hy)
					for (const i of V)
						ctx.lineTo(store.x[i] * c.scale + hx, store.y[i] * c.scale + hy)
					ctx.stroke()
					ctx.setLineDash([])
				}
			},
			over: (ctx: CanvasRenderingContext2D, c: Cam) => {
				drawYou(ctx, c.w / 2 - c.x * c.scale, c.h / 2 - c.y * c.scale)
			},
			fog: (fctx: CanvasRenderingContext2D, c: Cam, now: number) => {
				fogFill(fctx, c)
				let again = false
				fogHole(fctx, c, 0, 0, 95)
				for (let i = 0; i < store.n; i++) {
					if (!store.shown(i)) continue
					const t = Math.min(1, (now - store.born[i]) / 700)
					if (t < 1) again = true
					fogHole(fctx, c, store.x[i], store.y[i], 34 * t, 0.85)
				}
				for (const [i, t0] of expanded.current) {
					const t = Math.min(1, (now - t0) / 900)
					if (t < 1) again = true
					fogHole(fctx, c, store.x[i], store.y[i], 70 * t)
				}
				fctx.globalCompositeOperation = "source-over"
				return again
			},
		}),
		[store],
	)

	const it = sel == null ? null : store.items[sel]
	return (
		<div className="rx2-stage rx-atlas-bg text-white">
			<Stage
				ref={stage}
				className="absolute inset-0"
				store={store}
				hooks={hooks}
				selected={sel}
				queue={ex.queue}
				initial={{ x: 0, y: 0, scale: 3.4 }}
				minScale={0.35}
				maxScale={30}
				onTap={(i) => (i == null ? setSel(null) : visit(i))}
				ariaLabel="A growing map of titles, linked to the ones most like them"
			/>
			<Header
				ex={ex}
				title="Explore"
				sub="Start from the titles closest to your taste. Tap one and the titles most like it light up around it."
			/>
			<PeekDock
				ex={ex}
				it={it}
				onClose={() => setSel(null)}
				extra={
					it && (
						<p className="text-xs text-amber-200/90">
							{busy
								? "Lighting up similar titles…"
								: "Similar titles are lit up around it. Tap one to keep going."}
						</p>
					)
				}
			/>
			<div
				className={`absolute inset-x-3 rx2-bottom z-10 flex flex-col items-center gap-2 md:inset-x-auto md:left-6 md:items-start ${sel != null ? "hidden md:flex" : ""}`}
			>
				<Crumbs
					label="Your trail"
					items={visited.map((i, k) => ({
						key: store.items[i].k,
						name: store.items[i].t,
						poster: `${TMDB}${store.items[i].p}`,
						current: k === visited.length - 1,
					}))}
					onPick={(k) => {
						const i = visited[k]
						setSel(i)
						stage.current?.flyTo(
							store.x[i],
							store.y[i],
							Math.max(3.2, stage.current.camera().scale),
							700,
						)
					}}
				/>
				<button
					type="button"
					onClick={wander}
					className="h-11 rounded-full bg-amber-500 px-5 text-sm font-bold text-black shadow-2xl hover:bg-amber-400"
				>
					{visited.length ? "Wander further" : "Wander for me"}
				</button>
			</div>
			<ZoomControls
				className={`absolute bottom-40 right-4 z-10 md:bottom-6 ${sel != null ? "hidden md:flex" : ""}`}
				onIn={() => stage.current?.zoomBy(2)}
				onOut={() => stage.current?.zoomBy(0.5)}
				onYou={() => stage.current?.flyTo(0, 0, 3.4, 900)}
			/>
		</div>
	)
}
