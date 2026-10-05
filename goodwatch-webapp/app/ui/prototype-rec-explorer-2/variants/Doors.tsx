// PROTOTYPE - throwaway. Choose a direction (bolder): paths that unlock. You start in a room of the fifteen titles
// closest to your taste. Eight doors lead out: darker, lighter, faster, slower, stranger, funnier, tenser, more
// grounded, each showing what's behind it. Walking through one opens a new room next to this one, one step further
// that way in taste, so the map you draw is the path you took. Rooms you've been to stay lit; everything else is fog.
import { useEffect, useMemo, useRef, useState } from "react"
import { DIRECTIONS } from "~/ui/prototype-rec-explorer/model"
import {
	type Cam,
	Stage,
	type StageHandle,
	drawYou,
	fogFill,
	fogHole,
	haloText,
} from "../Stage"
import { Crumbs, FilterChips, PeekDock, WhoNote, ZoomControls } from "../kit2"
import { Store } from "../store"
import type { Ex } from "../useExplorer2"
import type { W } from "../wire"

const ANGLE: Record<string, number> = {
	lighter: -90,
	funnier: -45,
	faster: 0,
	tenser: 45,
	darker: 90,
	stranger: 135,
	slower: 180,
	grounded: -135,
}
const rad = (d: string) => (ANGLE[d] * Math.PI) / 180
const ROOM_R = 44
const STEP = 190
const DOOR_W = 26
const DOOR_H = 34
const TMDB = "https://image.tmdb.org/t/p/w154"

type Room = {
	id: number
	path: string[]
	name: string
	cx: number
	cy: number
	items: number[]
	from: number | null
	t0: number
}
type Door = {
	dir: string
	label: string
	name: string
	poster: HTMLImageElement | null
	x: number
	y: number
}

export default function Doors({ ex }: { ex: Ex }) {
	const stage = useRef<StageHandle>(null)
	const store = useMemo(() => new Store(), [])
	const rooms = useRef<Room[]>([])
	const [cur, setCur] = useState(0)
	const curRef = useRef(0)
	const doors = useRef<Door[]>([])
	const [doorList, setDoorList] = useState<Door[]>([])
	const [sel, setSel] = useState<number | null>(null)
	const [busy, setBusy] = useState(false)
	const doorsAt = useRef(0)

	const placeRoom = (ws: W[], cx: number, cy: number) =>
		ws.map((_, j) => {
			const a = (j + 2) * 2.39996
			const r = 10.5 * Math.sqrt(j + 2)
			return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
		})

	/** What's behind each door of a room: the next room's name and its best poster. */
	const loadDoors = async (room: Room) => {
		const back = room.path[room.path.length - 1]
		const dirs = DIRECTIONS.filter(
			(d) => !back || rad(d.id) !== rad(back) + Math.PI,
		)
		const out = await Promise.all(
			dirs.map(async (d) => {
				const r = await ex
					.api<{ name: string; items: W[] }>("room", {
						path: [...room.path, d.id].join(","),
						n: 3,
					})
					.catch(() => null)
				let poster: HTMLImageElement | null = null
				const first = r?.items.find((w) => w.p)
				if (first) {
					poster = new Image()
					poster.src = `${TMDB}${first.p}`
					poster.decode().then(
						() => stage.current?.redraw(),
						() => {},
					)
				}
				const dist = ROOM_R + 40
				return {
					dir: d.id,
					label: d.label,
					name: r?.name ?? "",
					poster,
					x: room.cx + Math.cos(rad(d.id)) * dist,
					y: room.cy + Math.sin(rad(d.id)) * dist,
				}
			}),
		)
		if (curRef.current !== room.id) return
		doors.current = out
		doorsAt.current = performance.now()
		setDoorList(out)
		stage.current?.redraw()
	}

	const open = async (path: string[], from: number | null) => {
		setBusy(true)
		try {
			const r = await ex.api<{ name: string; items: W[] }>("room", {
				path: path.join(","),
				n: 15,
			})
			let cx = 0
			let cy = 0
			if (from != null) {
				const f = rooms.current[from]
				const a = rad(path[path.length - 1])
				let d = STEP
				// Keep rooms apart when a path loops back near an earlier one.
				for (let k = 0; k < 6; k++) {
					cx = f.cx + Math.cos(a) * d
					cy = f.cy + Math.sin(a) * d
					if (
						!rooms.current.some(
							(q) => Math.hypot(q.cx - cx, q.cy - cy) < STEP * 0.8,
						)
					)
						break
					d += 90
				}
			}
			const fresh = r.items.filter((w) => !store.index.has(w.k))
			const pos = placeRoom(fresh, cx, cy)
			const ids = store.add(fresh, performance.now(), (_, j) => pos[j])
			store.filter(ex.pass)
			const room: Room = {
				id: rooms.current.length,
				path,
				name: from == null ? "Your room" : r.name,
				cx,
				cy,
				items: ids,
				from,
				t0: performance.now(),
			}
			rooms.current.push(room)
			curRef.current = room.id
			setCur(room.id)
			doors.current = []
			setDoorList([])
			const c = stage.current?.camera()
			if (from != null)
				stage.current?.flyTo(
					cx,
					cy,
					Math.max(2.6, Math.min(c?.scale ?? 3, 4)),
					900,
				)
			void loadDoors(room)
		} finally {
			setBusy(false)
		}
	}

	const started = useRef(false)
	useEffect(() => {
		if (started.current) return
		started.current = true
		void open([], null)
	}, [])
	useEffect(() => {
		store.filter(ex.pass)
		stage.current?.redraw()
	}, [ex.filterKey, ex.rev])

	const go = (dir: string) => {
		if (busy) return
		const room = rooms.current[curRef.current]
		setSel(null)
		void open([...room.path, dir], room.id)
	}
	const back = (k: number) => {
		const room = rooms.current[k]
		curRef.current = k
		setCur(k)
		stage.current?.flyTo(room.cx, room.cy, 3, 800)
		doors.current = []
		setDoorList([])
		void loadDoors(room)
	}

	const hooks = useMemo(
		() => ({
			under: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const sx = (x: number) => (x - c.x) * c.scale + c.w / 2
				const sy = (y: number) => (y - c.y) * c.scale + c.h / 2
				// The paths you walked.
				ctx.strokeStyle = "rgba(251,191,36,.7)"
				ctx.lineWidth = 2.5
				ctx.setLineDash([8, 7])
				ctx.beginPath()
				for (const r of rooms.current) {
					if (r.from == null) continue
					const f = rooms.current[r.from]
					ctx.moveTo(sx(f.cx), sy(f.cy))
					ctx.lineTo(sx(r.cx), sy(r.cy))
				}
				ctx.stroke()
				ctx.setLineDash([])
				// Room floors.
				for (const r of rooms.current) {
					const here = r.id === curRef.current
					ctx.fillStyle = here
						? "rgba(251,191,36,.07)"
						: "rgba(255,255,255,.03)"
					ctx.strokeStyle = here
						? "rgba(251,191,36,.45)"
						: "rgba(255,255,255,.12)"
					ctx.lineWidth = here ? 2 : 1
					ctx.beginPath()
					ctx.arc(sx(r.cx), sy(r.cy), (ROOM_R + 8) * c.scale, 0, Math.PI * 2)
					ctx.fill()
					ctx.stroke()
				}
			},
			over: (ctx: CanvasRenderingContext2D, c: Cam, now: number) => {
				const sx = (x: number) => (x - c.x) * c.scale + c.w / 2
				const sy = (y: number) => (y - c.y) * c.scale + c.h / 2
				// Doors: arches that glow, with a glimpse of what's behind.
				// The doors breathe for a few seconds after they appear, then hold still.
				const pulsing = now - doorsAt.current < 4000
				const pulse = pulsing
					? 0.6 + 0.3 * Math.sin((now - doorsAt.current) / 320)
					: 0.75
				ctx.textAlign = "center"
				for (const d of doors.current) {
					const x = sx(d.x)
					const y = sy(d.y)
					const w = DOOR_W * c.scale
					const h = DOOR_H * c.scale
					if (x < -w || y < -h || x > c.w + w || y > c.h + h) continue
					ctx.save()
					ctx.beginPath()
					ctx.moveTo(x - w / 2, y + h / 2)
					ctx.lineTo(x - w / 2, y - h / 2 + w / 2)
					ctx.arc(x, y - h / 2 + w / 2, w / 2, Math.PI, 0)
					ctx.lineTo(x + w / 2, y + h / 2)
					ctx.closePath()
					ctx.fillStyle = "#0b0a0f"
					ctx.fill()
					ctx.clip()
					if (d.poster?.complete && d.poster.naturalWidth) {
						ctx.globalAlpha = 0.55
						ctx.drawImage(d.poster, x - w / 2, y - h / 2, w, w * 1.5)
						ctx.globalAlpha = 1
					}
					ctx.restore()
					ctx.lineWidth = 2
					ctx.strokeStyle = `rgba(253,230,138,${pulse})`
					ctx.beginPath()
					ctx.moveTo(x - w / 2, y + h / 2)
					ctx.lineTo(x - w / 2, y - h / 2 + w / 2)
					ctx.arc(x, y - h / 2 + w / 2, w / 2, Math.PI, 0)
					ctx.lineTo(x + w / 2, y + h / 2)
					ctx.stroke()
					ctx.textBaseline = "top"
					ctx.font = `800 ${Math.max(13, Math.min(22, 5 * c.scale))}px 'Big Shoulders Display', system-ui, sans-serif`
					haloText(
						ctx,
						d.label,
						x,
						y + h / 2 + 4,
						"#fde68a",
						"rgba(0,0,0,.9)",
						5,
					)
					if (c.scale > 2.2 && d.name) {
						ctx.font = "500 11px system-ui, sans-serif"
						haloText(
							ctx,
							d.name,
							x,
							y + h / 2 + 8 + Math.max(13, Math.min(22, 5 * c.scale)),
							"#d6d3d1",
							"rgba(0,0,0,.9)",
							4,
						)
					}
				}
				// Names of the other rooms (the current one is the page title).
				ctx.textBaseline = "bottom"
				ctx.font = "900 20px 'Big Shoulders Display', system-ui, sans-serif"
				for (const r of rooms.current)
					if (r.id !== curRef.current)
						haloText(
							ctx,
							r.name,
							sx(r.cx),
							sy(r.cy - ROOM_R - 10),
							"#d6d3d1",
							"rgba(0,0,0,.9)",
							6,
						)
				const home = rooms.current[0]
				if (home) drawYou(ctx, sx(home.cx), sy(home.cy))
				return doors.current.length > 0 && pulsing
			},
			fog: (fctx: CanvasRenderingContext2D, c: Cam, now: number) => {
				fogFill(fctx, c, "rgba(5,4,8,.93)")
				let again = false
				for (const r of rooms.current) {
					const t = Math.min(1, (now - r.t0) / 900)
					if (t < 1) again = true
					fogHole(fctx, c, r.cx, r.cy, (ROOM_R + 95) * t)
					if (r.from != null) {
						const f = rooms.current[r.from]
						for (let k = 1; k < 6; k++)
							fogHole(
								fctx,
								c,
								f.cx + ((r.cx - f.cx) * k) / 6,
								f.cy + ((r.cy - f.cy) * k) / 6,
								48 * t,
								0.8,
							)
					}
				}
				fctx.globalCompositeOperation = "source-over"
				return again
			},
		}),
		[store],
	)

	const onTap = (i: number | null, wx: number, wy: number) => {
		const d = doors.current.find(
			(q) =>
				Math.abs(q.x - wx) < DOOR_W * 0.7 && Math.abs(q.y - wy) < DOOR_H * 0.7,
		)
		if (d) return go(d.dir)
		setSel(i)
	}

	const room = rooms.current[cur]
	return (
		<div className="rx2-stage bg-stone-950 text-white">
			<Stage
				ref={stage}
				className="absolute inset-0"
				store={store}
				hooks={hooks}
				bg="ink"
				selected={sel}
				queue={ex.queue}
				initial={{ x: 0, y: 0, scale: 3 }}
				minScale={0.3}
				maxScale={30}
				onTap={onTap}
				ariaLabel="Rooms of titles joined by the directions you chose"
			/>
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/90 via-black/50 to-transparent px-4 pb-10 pt-3 md:px-8 md:pt-4">
				<h1 className="rx2-display text-4xl font-black leading-none text-amber-400 md:text-6xl">
					{room?.name ?? "Your room"}
				</h1>
				<p className="mt-1 max-w-md text-sm text-gray-300">
					{room && room.path.length
						? `${room.path.map((d) => DIRECTIONS.find((x) => x.id === d)?.label.toLowerCase()).join(", then ")} from your taste.`
						: "The titles closest to your taste. Pick a door to walk one step in that direction."}
				</p>
				<div className="pointer-events-auto mt-3">
					<FilterChips ex={ex} />
					<WhoNote ex={ex} className="mt-2" />
				</div>
			</div>
			<div
				className={`absolute inset-x-3 rx2-bottom z-10 flex flex-col items-center gap-2 md:inset-x-auto md:left-6 md:items-start ${sel != null ? "hidden md:flex" : ""}`}
			>
				{rooms.current.length > 1 && (
					<Crumbs
						label="Rooms you've been to"
						items={rooms.current.map((r) => ({
							key: String(r.id),
							name: r.name,
							current: r.id === cur,
						}))}
						onPick={back}
					/>
				)}
				<nav
					aria-label="Doors"
					className="grid w-full max-w-md grid-cols-4 gap-1.5 rounded-2xl border border-white/10 bg-black/75 p-1.5 backdrop-blur"
				>
					{(doorList.length
						? doorList
						: DIRECTIONS.map((d) => ({ dir: d.id, label: d.label, name: "" }))
					).map((d) => (
						<button
							key={d.dir}
							type="button"
							disabled={busy || !doorList.length}
							onClick={() => go(d.dir)}
							title={d.name}
							className="flex h-10 items-center justify-center rounded-xl bg-white/10 px-2 text-xs font-bold text-amber-100 hover:bg-amber-500 hover:text-black disabled:opacity-40"
						>
							{d.label}
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
				className={`absolute bottom-60 right-4 z-10 md:bottom-6 ${sel != null ? "hidden md:flex" : ""}`}
				onIn={() => stage.current?.zoomBy(2)}
				onOut={() => stage.current?.zoomBy(0.5)}
				onYou={() => stage.current?.flyTo(0, 0, 3, 900)}
			/>
		</div>
	)
}
