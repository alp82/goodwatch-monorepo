// PROTOTYPE - throwaway. Three doors (existing look, round 2's canvas), round 2's "Choose a direction" cut down: you
// stand in a room of five titles and three doors lead on. Of eight directions (darker, lighter, faster, slower,
// stranger, funnier, tenser, more grounded) the page offers the three whose rooms differ most from each other, never
// the way you just came or straight back. Each door shows its best title and says what it changes. Walk through and
// the room you left folds down to one poster on a gold trail.
import { useEffect, useMemo, useRef, useState } from "react"
import {
	type Cam,
	Stage,
	type StageHandle,
	haloText,
} from "~/ui/prototype-rec-explorer-2/Stage"
import { ZoomControls } from "~/ui/prototype-rec-explorer-2/kit2"
import { Store } from "~/ui/prototype-rec-explorer-2/store"
import { PeekDock, TMDB, Top } from "../kit3"
import { type Ex3, useWalk } from "../useExplorer3"
import type { Opt, Turn, W } from "../wire"

const ANGLES = [-140, -90, -40].map((a) => (a * Math.PI) / 180)
const DOOR_D = 48
const DOOR_W = 17
const DOOR_H = 24
const STEP = 118

type Room = {
	id: number
	cx: number
	cy: number
	ids: number[]
	lead: number
	name: string
	line: string
	from: number | null
}
type Door = {
	opt: Opt
	x: number
	y: number
	a: number
	img: HTMLImageElement | null
}

/** Five titles in a gentle arc around the room's center. */
const roomSpot = (j: number, n: number, cx: number, cy: number) => {
	const k = j - (n - 1) / 2
	return { x: cx + k * 12.5, y: cy + Math.abs(k) * 2.5 }
}

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

export default function Doors({ ex }: { ex: Ex3 }) {
	const stage = useRef<StageHandle>(null)
	const store = useMemo(() => new Store(), [])
	const walk = useWalk()
	const rooms = useRef<Room[]>([])
	const doors = useRef<Door[]>([])
	const [doorList, setDoorList] = useState<Door[]>([])
	const [cur, setCur] = useState<Room | null>(null)
	const [busy, setBusy] = useState(true)
	const [sel, setSel] = useState<number | null>(null)
	const wide = useRef(true)
	const last = useRef("")

	const fit = (room: Room, ms = 800) => {
		const c = stage.current?.camera()
		if (!c || !c.w) return
		const w = wide.current
		const left = w ? 540 : 0
		const top = w ? 30 : 175
		const bottom = w ? 90 : 215
		// The room and its doors: about 110 x 95 world units above and around the room's center.
		const bw = w ? 116 : 96
		const bh = w ? 100 : 80
		const scale = Math.max(2, Math.min(12, (c.w - left) / bw, (c.h - top - bottom) / bh))
		const sx = left + (c.w - left) / 2
		const sy = top + (c.h - top - bottom) / 2
		const cy = room.cy - (w ? 30 : 24)
		stage.current?.flyTo(room.cx - (sx - c.w / 2) / scale, cy - (sy - c.h / 2) / scale, scale, ms)
	}

	const setDoors = (room: Room, opts: Opt[]) => {
		const out = opts.map((opt, j) => {
			const a = ANGLES[j] ?? ANGLES[1]
			const lead = opt.items[0]
			let img: HTMLImageElement | null = null
			if (lead?.p) {
				img = new Image()
				img.src = `${TMDB}/w185${lead.p}`
				img.decode().then(
					() => stage.current?.redraw(),
					() => {},
				)
			}
			const d = wide.current ? DOOR_D : DOOR_D - 6
			return { opt, a, img, x: room.cx + Math.cos(a) * d, y: room.cy + Math.sin(a) * d }
		})
		doors.current = out
		setDoorList(out)
	}

	/** Load the doors out of a room (and, the first time, the room itself). */
	const load = async (room: Room | null) => {
		setBusy(true)
		try {
			const t = await ex.api<Turn & { room: W[] }>("turn", {
				mode: "doors",
				room: room ? store.items.filter((_, i) => room.ids.includes(i)).map((w) => w.k).join(",") : "",
				last: last.current,
				...walk.params(),
			})
			let r = room
			if (!r) {
				wide.current = window.innerWidth >= 1024
				const ids = store.add(t.room, performance.now(), (_, j) => roomSpot(j, t.room.length, 0, 0))
				walk.show(t.room)
				r = { id: 0, cx: 0, cy: 0, ids, lead: ids[0], name: "Your room", line: "Five of your closest titles.", from: null }
				rooms.current = [r]
				walk.step(t.room[0], "")
				setCur(r)
				fit(r)
			}
			walk.show(t.options.map((o) => o.items[0]))
			walk.offered(
				t.options.map((o) => o.items[0]),
				t.spread,
			)
			setDoors(r, t.options)
			store.filter(ex.pass)
			stage.current?.redraw()
		} finally {
			setBusy(false)
		}
	}
	const started = useRef(false)
	useEffect(() => {
		if (started.current) return
		started.current = true
		requestAnimationFrame(() => void load(null))
	}, [])
	const filters = useRef(ex.filterKey)
	useEffect(() => {
		store.filter(ex.pass)
		stage.current?.redraw()
		if (filters.current === ex.filterKey) return
		filters.current = ex.filterKey
		const r = rooms.current[rooms.current.length - 1]
		if (r) void load(r)
	}, [ex.filterKey, ex.rev])

	const enter = (d: Door) => {
		if (busy) return
		const from = rooms.current[rooms.current.length - 1]
		const cx = from.cx + Math.cos(d.a) * STEP
		const cy = from.cy + Math.sin(d.a) * STEP
		// The room you leave folds down to its best title.
		for (const i of from.ids) if (i !== from.lead) store.hide(i)
		const items = d.opt.items
		const ids = store.add(items, performance.now(), (_, j) => roomSpot(j, items.length, cx, cy))
		walk.show(items.slice(1))
		const room: Room = {
			id: rooms.current.length,
			cx,
			cy,
			ids,
			lead: ids[0],
			name: d.opt.label,
			line: d.opt.line,
			from: from.id,
		}
		rooms.current.push(room)
		last.current = d.opt.id
		doors.current = []
		setDoorList([])
		setSel(null)
		setCur(room)
		walk.step(items[0], d.opt.label)
		fit(room, 850)
		void load(room)
	}

	const hooks = useMemo(
		() => ({
			under: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const sx = (x: number) => (x - c.x) * c.scale + c.w / 2
				const sy = (y: number) => (y - c.y) * c.scale + c.h / 2
				ctx.strokeStyle = "rgba(251,191,36,.6)"
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
				const here = rooms.current[rooms.current.length - 1]
				if (here) {
					ctx.fillStyle = "rgba(251,191,36,.06)"
					ctx.strokeStyle = "rgba(251,191,36,.35)"
					ctx.lineWidth = 1.5
					ctx.beginPath()
					ctx.ellipse(sx(here.cx), sy(here.cy + 2), 38 * c.scale, 15 * c.scale, 0, 0, Math.PI * 2)
					ctx.fill()
					ctx.stroke()
				}
			},
			over: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const sx = (x: number) => (x - c.x) * c.scale + c.w / 2
				const sy = (y: number) => (y - c.y) * c.scale + c.h / 2
				const words = Math.max(14, Math.min(26, 3.2 * c.scale))
				const named = c.scale >= 2.6
				for (const d of doors.current) {
					const x = sx(d.x)
					const y = sy(d.y)
					const w = DOOR_W * c.scale
					const h = DOOR_H * c.scale
					const arch = () => {
						ctx.beginPath()
						ctx.moveTo(x - w / 2, y + h / 2)
						ctx.lineTo(x - w / 2, y - h / 2 + w / 2)
						ctx.arc(x, y - h / 2 + w / 2, w / 2, Math.PI, 0)
						ctx.lineTo(x + w / 2, y + h / 2)
						ctx.closePath()
					}
					ctx.save()
					arch()
					ctx.fillStyle = "#0b0a0f"
					ctx.fill()
					ctx.clip()
					if (d.img?.complete && d.img.naturalWidth) {
						ctx.globalAlpha = 0.8
						ctx.drawImage(d.img, x - w / 2, y - h / 2, w, w * 1.5)
						ctx.globalAlpha = 1
					}
					ctx.restore()
					ctx.lineWidth = 2.5
					ctx.strokeStyle = "rgba(253,230,138,.85)"
					arch()
					ctx.stroke()
					if (!wide.current || !named) continue
					// Name above the door; zoomed in, what it changes too (the list on the left always says it).
					ctx.textAlign = "center"
					ctx.textBaseline = "bottom"
					const lines =
						c.scale >= 7
							? (() => {
									ctx.font = "500 12px system-ui, sans-serif"
									return wrap(ctx, d.opt.line, Math.min(230, 30 * c.scale)).slice(0, 2)
								})()
							: []
					let yy = y - h / 2 - 6
					ctx.font = "500 12px system-ui, sans-serif"
					for (let k = lines.length - 1; k >= 0; k--) {
						haloText(ctx, lines[k], x, yy, "#e7e5e4", "rgba(0,0,0,.92)", 4)
						yy -= 15
					}
					ctx.font = `900 ${words}px 'Big Shoulders Display', system-ui, sans-serif`
					haloText(ctx, d.opt.label, x, yy - 2, "#fcd34d", "rgba(0,0,0,.92)", 6)
				}
				// Rooms you passed: their name next to the one poster that stays.
				ctx.textAlign = "left"
				ctx.textBaseline = "middle"
				ctx.font = "800 15px 'Big Shoulders Display', system-ui, sans-serif"
				const n = rooms.current.length
				for (const r of rooms.current.slice(0, n - 1))
					haloText(ctx, r.name, sx(store.x[r.lead]) + 5.5 * c.scale + 8, sy(store.y[r.lead]), "#d6d3d1", "rgba(0,0,0,.9)", 5)
			},
		}),
		[store],
	)

	const onTap = (i: number | null, wx: number, wy: number) => {
		const d = doors.current.find((q) => Math.abs(q.x - wx) < DOOR_W * 0.6 && Math.abs(q.y - wy) < DOOR_H * 0.6)
		if (d) return enter(d)
		setSel(i)
	}

	return (
		<div className="rx2-stage bg-stone-950 text-white">
			<Stage
				ref={stage}
				className="absolute inset-0"
				store={store}
				hooks={hooks}
				bg="ink"
				selected={sel}
				initial={{ x: 0, y: -30, scale: 6 }}
				minScale={0.5}
				maxScale={30}
				onTap={onTap}
				ariaLabel="A room of five titles and three doors out"
			/>
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/90 via-black/60 to-transparent px-4 pb-8 pt-3 md:px-8 md:pt-5 lg:inset-x-auto lg:bottom-0 lg:left-0 lg:w-[33rem] lg:bg-gradient-to-r lg:pb-0">
				<div className="pointer-events-auto">
					<Top
						ex={ex}
						title={cur?.name ?? "Your room"}
						sub={
							<span className="hidden md:inline">
								{cur && cur.from != null
									? cur.line
									: "Five of your closest titles. Three doors lead on, each somewhere different; walk through one."}
							</span>
						}
					/>
					{rooms.current.length > 1 && (
						<p className="mt-3 hidden text-xs text-stone-400 lg:block">
							{rooms.current.map((r) => r.name).join(" → ")}
						</p>
					)}
					<nav aria-label="Doors" className="mt-4 hidden w-full max-w-md flex-col gap-1.5 lg:flex">
						{doorList.map((d) => (
							<button
								key={d.opt.id}
								type="button"
								disabled={busy}
								onClick={() => enter(d)}
								className="flex flex-col rounded-xl bg-white/10 px-3 py-2 text-left hover:bg-amber-400 hover:text-black disabled:opacity-40 [&:hover_span]:text-black"
							>
								<span className="rx2-display text-xl font-black leading-none text-amber-300">{d.opt.label}</span>
								<span className="mt-0.5 text-xs text-stone-300">
									{d.opt.line} Behind it: {d.opt.items[0]?.t}.
								</span>
							</button>
						))}
					</nav>
				</div>
			</div>
			<nav
				aria-label="Doors"
				className={`absolute inset-x-3 rx2-bottom z-10 grid grid-cols-3 gap-1.5 lg:hidden ${sel != null ? "hidden" : ""}`}
			>
				{doorList.map((d) => (
					<button
						key={d.opt.id}
						type="button"
						disabled={busy}
						onClick={() => enter(d)}
						className="flex min-h-14 flex-col justify-center rounded-xl border border-white/10 bg-black/80 px-2 py-1.5 text-left backdrop-blur disabled:opacity-40"
					>
						<span className="rx2-display truncate text-lg font-black leading-none text-amber-300">{d.opt.label}</span>
						<span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-stone-300">
							{d.opt.line || d.opt.items[0]?.t}
						</span>
					</button>
				))}
			</nav>
			<PeekDock ex={ex} it={sel == null ? null : store.items[sel]} onClose={() => setSel(null)} />
			<ZoomControls
				className={`absolute bottom-6 right-4 z-10 hidden lg:flex ${sel != null ? "lg:hidden" : ""}`}
				onIn={() => stage.current?.zoomBy(2)}
				onOut={() => stage.current?.zoomBy(0.5)}
				onYou={() => {
					const r = rooms.current[rooms.current.length - 1]
					if (r) fit(r)
				}}
				youLabel="Back to this room"
			/>
		</div>
	)
}
