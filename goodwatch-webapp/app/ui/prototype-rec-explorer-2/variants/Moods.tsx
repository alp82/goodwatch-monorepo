// PROTOTYPE - throwaway. Mood rooms (bolder): clusters by mood. Nine rooms laid out like a floor plan, light
// moods at the top and dark ones at the bottom, each lit in its own color with shelves by genre. You start in the
// room your taste lives in; the others wait behind fog. Walk into one, or tap it, and its lights come on and its
// titles stream in.
import { useMemo, useRef, useState } from "react"
import {
	type Cam,
	Stage,
	type StageHandle,
	drawYou,
	fogFill,
	haloText,
} from "../Stage"
import { FilterChips, PeekDock, WhoNote, ZoomControls } from "../kit2"
import { Store } from "../store"
import type { Ex } from "../useExplorer2"
import { useTiles } from "../useTiles"
import { S0, type W } from "../wire"

type Room = NonNullable<NonNullable<Ex["data"]["meta"]>["rooms"]>[number]
const inRoom = (r: Room, x: number, y: number, pad = 0) =>
	x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad

export default function Moods({ ex }: { ex: Ex }) {
	const stage = useRef<StageHandle>(null)
	const store = useMemo(() => new Store(), [])
	const rooms = (ex.data.meta?.rooms ?? []) as Room[]
	const you = ex.data.you
	const home = rooms.find((r) => inRoom(r, you.x, you.y)) ?? rooms[0]
	const [open, setOpen] = useState<string[]>(() => (home ? [home.id] : []))
	const openRef = useRef(open)
	openRef.current = open
	const lit = useRef(new Map<string, number>(home ? [[home.id, 0]] : []))
	const accept = (w: W) =>
		rooms.some(
			(r) => openRef.current.includes(r.id) && inRoom(r, w.x ?? 0, w.y ?? 0),
		)
	const tiles = useTiles(stage, store, ex, "moods", accept)
	const [sel, setSel] = useState<number | null>(null)

	const unlock = (r: Room, fly = false) => {
		if (!openRef.current.includes(r.id)) {
			openRef.current = [...openRef.current, r.id]
			setOpen(openRef.current)
			lit.current.set(r.id, performance.now())
			tiles.reset()
		}
		if (fly) {
			const c = stage.current?.camera()
			if (c)
				stage.current?.flyTo(
					(r.x0 + r.x1) / 2,
					(r.y0 + r.y1) / 2,
					Math.min(c.w / (r.x1 - r.x0), c.h / (r.y1 - r.y0)) * 0.85,
					900,
				)
		}
		tiles.onView()
		stage.current?.redraw()
	}
	const onView = () => {
		tiles.onView()
		const c = stage.current?.camera()
		if (!c) return
		// Walking into a room, close enough to see its shelves, turns its lights on.
		const r = rooms.find((q) => inRoom(q, c.x, c.y))
		if (r && !openRef.current.includes(r.id) && c.scale > S0 * 1.6) unlock(r)
	}

	const hooks = useMemo(
		() => ({
			under: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const sx = (x: number) => (x - c.x) * c.scale + c.w / 2
				const sy = (y: number) => (y - c.y) * c.scale + c.h / 2
				for (const r of rooms) {
					const x0 = sx(r.x0)
					const y0 = sy(r.y0)
					const x1 = sx(r.x1)
					const y1 = sy(r.y1)
					if (x1 < 0 || y1 < 0 || x0 > c.w || y0 > c.h) continue
					// The room is washed in its mood color, brighter along the top like a lit ceiling.
					ctx.fillStyle = `${r.color}0d`
					ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
					ctx.fillStyle = `${r.color}1f`
					ctx.fillRect(x0, y0, x1 - x0, Math.min(y1 - y0, 30 * c.scale))
					ctx.strokeStyle = `${r.color}88`
					ctx.lineWidth = 1.5
					ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
					// Shelves: a hairline and the genre name.
					if (c.scale > S0 * 1.4) {
						ctx.font = "600 12px system-ui, sans-serif"
						ctx.textAlign = "left"
						ctx.textBaseline = "bottom"
						for (const s of r.subs) {
							const a = sx(s.x0)
							const b = sy(s.y0)
							if (b < -20 || b > c.h + 20) continue
							ctx.fillStyle = `${r.color}55`
							ctx.fillRect(a, b + 20 * c.scale - 3 * c.scale, sx(s.x1) - a, 1)
							ctx.fillStyle = `${r.color}cc`
							if (c.scale > S0 * 2.2)
								ctx.fillText(s.name, a + 2, b + 20 * c.scale - 5 * c.scale)
						}
					}
				}
			},
			over: (ctx: CanvasRenderingContext2D, c: Cam) => {
				drawYou(
					ctx,
					(you.x - c.x) * c.scale + c.w / 2,
					(you.y - c.y) * c.scale + c.h / 2,
				)
			},
			fog: (fctx: CanvasRenderingContext2D, c: Cam, now: number) => {
				fogFill(fctx, c, "rgba(6,5,8,.9)")
				fctx.fillStyle = "#000"
				let again = false
				for (const r of rooms) {
					const t0 = lit.current.get(r.id)
					if (t0 == null) continue
					const t = Math.min(1, (now - t0) / 800)
					if (t < 1) again = true
					fctx.globalAlpha = t0 === 0 ? 1 : t
					const pad = 18
					fctx.fillRect(
						(r.x0 - pad - c.x) * c.scale + c.w / 2,
						(r.y0 - pad - c.y) * c.scale + c.h / 2,
						(r.x1 - r.x0 + pad * 2) * c.scale,
						(r.y1 - r.y0 + pad * 2) * c.scale,
					)
				}
				fctx.globalAlpha = 1
				fctx.globalCompositeOperation = "source-over"
				return again
			},
			top: (ctx: CanvasRenderingContext2D, c: Cam) => {
				// Room names above the fog: big when far, pinned to the room's top-left when close.
				ctx.textAlign = "left"
				ctx.textBaseline = "top"
				for (const r of rooms) {
					const x0 = (r.x0 - c.x) * c.scale + c.w / 2
					const y0 = (r.y0 - c.y) * c.scale + c.h / 2
					const w = (r.x1 - r.x0) * c.scale
					const h = (r.y1 - r.y0) * c.scale
					if (x0 + w < 0 || y0 + h < 0 || x0 > c.w || y0 > c.h) continue
					const isOpen = openRef.current.includes(r.id)
					const size = Math.max(18, Math.min(64, w * 0.12))
					ctx.font = `900 ${size}px 'Big Shoulders Display', system-ui, sans-serif`
					const x = Math.max(x0 + 10, Math.min(12, x0 + w - 160))
					const y = Math.max(y0 + 8, Math.min(8, y0 + h - size - 30))
					haloText(
						ctx,
						r.name,
						x,
						y,
						isOpen ? r.color : `${r.color}aa`,
						"rgba(0,0,0,.9)",
						6,
					)
					ctx.font = "600 12px system-ui, sans-serif"
					haloText(
						ctx,
						isOpen ? `${r.count.toLocaleString()} titles` : "Tap to open",
						x + 2,
						y + size + 2,
						isOpen ? "#d6d3d1" : "#e7e5e4",
						"rgba(0,0,0,.9)",
						4,
					)
				}
			},
		}),
		[rooms, you],
	)

	const onTap = (i: number | null, wx: number, wy: number) => {
		const r = rooms.find((q) => inRoom(q, wx, wy))
		if (r && !openRef.current.includes(r.id)) {
			unlock(r, true)
			return
		}
		setSel(i)
	}

	const bounds = useMemo(() => {
		const xs = rooms.flatMap((r) => [r.x0, r.x1])
		const ys = rooms.flatMap((r) => [r.y0, r.y1])
		return {
			x0: Math.min(...xs),
			y0: Math.min(...ys),
			x1: Math.max(...xs),
			y1: Math.max(...ys),
		}
	}, [rooms])

	return (
		<div className="rx2-stage bg-stone-950 text-white">
			<Stage
				ref={stage}
				className="absolute inset-0"
				store={store}
				hooks={hooks}
				levels
				bg="ink"
				selected={sel}
				queue={ex.queue}
				initial={{ x: you.x, y: you.y, scale: S0 * 2 ** 2.2 }}
				minScale={S0 * 0.4}
				maxScale={30}
				bounds={bounds}
				onTap={onTap}
				onView={onView}
				ariaLabel="Rooms of films and shows by mood"
			/>
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/85 via-black/40 to-transparent px-4 pb-10 pt-3 md:px-8 md:pt-4">
				<h1 className="rx2-display text-4xl font-black leading-none md:text-6xl">
					Moods
				</h1>
				<p className="mt-1 max-w-md text-sm text-gray-300">
					Nine rooms, light moods up top, dark ones below. Walk into a room or
					tap it to turn its lights on.
				</p>
				<div className="pointer-events-auto mt-3">
					<FilterChips ex={ex} />
					<WhoNote
						ex={ex}
						className="mt-2"
						extra={`${open.length} of ${rooms.length} rooms open.`}
					/>
				</div>
			</div>
			<div
				className={`absolute inset-x-3 rx2-bottom z-10 flex justify-center md:inset-x-auto md:left-6 ${sel != null ? "hidden md:flex" : ""}`}
			>
				<nav
					aria-label="Rooms"
					className="flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-black/70 p-1.5 backdrop-blur rx2-scroll-x"
				>
					{rooms.map((r) => (
						<button
							key={r.id}
							type="button"
							onClick={() => unlock(r, true)}
							className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-semibold text-gray-100 hover:bg-white/20"
						>
							<span
								className="h-2.5 w-2.5 rounded-full"
								style={{
									background: r.color,
									opacity: open.includes(r.id) ? 1 : 0.35,
								}}
							/>
							{r.name}
						</button>
					))}
				</nav>
			</div>
			<PeekDock
				ex={ex}
				it={sel == null ? null : store.items[sel]}
				onClose={() => setSel(null)}
			/>
			<ZoomControls
				className={`absolute bottom-40 right-4 z-10 md:bottom-6 ${sel != null ? "hidden md:flex" : ""}`}
				onIn={() => stage.current?.zoomBy(2)}
				onOut={() => stage.current?.zoomBy(0.5)}
				onYou={() => stage.current?.flyTo(you.x, you.y, S0 * 2 ** 2.2, 900)}
			/>
		</div>
	)
}
