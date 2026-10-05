// PROTOTYPE - throwaway. One round-4 variant: the map in a chosen layout, the close-up at its deep end, and the
// controls around both (grouping, filters, history, zoom ladder, minimap, keyboard).
import { useEffect, useMemo, useRef, useState } from "react"
import { CloseUp, type CloseMode } from "./CloseUp"
import { History, Ladder, Minimap, Toast4, Top } from "./chrome"
import { type Cell, type Dir, type LayoutKind, type Rect, type World, layout } from "./geo"
import { type MapHandle, MapCanvas, type Pad } from "./MapCanvas"
import type { Ex4, Step } from "./useExplorer4"
import type { GroupId, W } from "./wire4"

type Open = { it: W; cell: Cell; from: Rect | null; dir: Dir | null; n: number; s: number }

export function Explorer4({ ex, kind, mode, hide = [] }: { ex: Ex4; kind: LayoutKind; mode: CloseMode; hide?: GroupId[] }) {
	const stage = useRef<HTMLDivElement>(null)
	const map = useRef<MapHandle>(null)
	const [aspect, setAspect] = useState<number | null>(null)
	const [open, setOpen] = useState<Open | null>(null)
	const [focus, setFocus] = useState<string | null>(null)
	const trail = useRef<string[]>([])
	const pending = useRef<Step | null>(null)

	// Rings always show taste distance as rings, so the grouping picks the sectors.
	useEffect(() => {
		if (hide.includes(ex.group)) ex.setGroupQuiet("mood")
	}, [])

	// The overview fits the map into the part of the screen the header and controls leave free.
	const [pad, setPad] = useState<Pad>({ t: 150, r: 96, b: 24, l: 24 })
	useEffect(() => {
		const el = stage.current
		if (!el) return
		const measure = () => {
			const w = el.clientWidth
			const top = el.querySelector(".rx4-top-row2") as HTMLElement | null
			const t = top ? top.offsetTop + top.offsetHeight + 14 : 150
			const next = w >= 1024 ? { t, r: 96, b: 20, l: 20 } : { t, r: 12, b: 150, l: 12 }
			setPad((p) => (p.t === next.t && p.r === next.r && p.b === next.b && p.l === next.l ? p : next))
			// The map's shape follows the free area, in coarse steps so resizing doesn't re-lay it every pixel.
			const a = (w - next.l - next.r) / Math.max(1, el.clientHeight - next.t - next.b)
			const b = a >= 1.25 ? Math.min(2.25, Math.round(a * 4) / 4) : a >= 0.85 ? 1 : Math.max(0.5, Math.round(a * 4) / 4)
			setAspect((x) => (x === b ? x : b))
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const world = useMemo<World | null>(
		() => (aspect ? layout(kind, ex.map.regions, aspect) : null),
		[aspect, kind, ex.map],
	)
	const cellById = (w: World, id: string | undefined) => (id ? w.cells.find((c) => c.id === id) ?? null : null)

	// Follow the region in the middle of the screen, for the minimap and the history.
	useEffect(() => {
		const m = map.current
		if (!m) return
		let raf = 0
		const off = m.subscribe(() => {
			if (raf) return
			raf = requestAnimationFrame(() => {
				raf = 0
				const f = m.view().focus?.id ?? null
				setFocus((x) => (x === f ? x : f))
			})
		})
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [world !== null])

	// A history step taken while the grouping changes is applied once the new map is laid out.
	useEffect(() => {
		const s = pending.current
		if (!s || !world || s.group !== ex.map.group) return
		pending.current = null
		apply(s, world)
	}, [world])

	const openTitle = (it: W, cell: Cell, from: Rect | null, dir: Dir | null, how: "browse" | "door" | "near" | "map") => {
		trail.current = [...trail.current.filter((k) => k !== it.k), it.k].slice(-40)
		setOpen((o) => ({ it, cell, from, dir, n: (o?.n ?? 0) + 1, s: o && how !== "map" ? o.s : (o?.n ?? 0) + 1 }))
		ex.push({ kind: "title", label: it.t, group: ex.group, cell: cell.id, title: it }, how === "browse")
		if (how !== "map") {
			// Keep the map under the close-up in step, so zooming out lands in the region you're in now.
			map.current?.flyToCell(cell, 1)
		}
	}
	const goRegion = (cell: Cell) => {
		map.current?.flyToCell(cell)
		ex.push({ kind: "region", label: cellLabel(cell), group: ex.group, cell: cell.id })
	}
	const closeUp = () => {
		if (!open) return
		const c = open.cell
		setOpen(null)
		map.current?.flyToCell(c, 1)
		ex.push({ kind: "region", label: cellLabel(c), group: ex.group, cell: c.id })
	}
	function apply(s: Step, w: World) {
		if (s.kind === "map" || s.kind === "group") {
			setOpen(null)
			map.current?.overview()
			return
		}
		const c = cellById(w, s.cell)
		if (s.kind === "region" && c) {
			setOpen(null)
			map.current?.flyToCell(c)
		}
		if (s.kind === "title" && c && s.title) {
			map.current?.flyToCell(c, 1)
			setOpen((o) => ({ it: s.title as W, cell: c, from: null, dir: null, n: (o?.n ?? 0) + 1, s: o ? o.s : 1 }))
		}
	}
	const jump = (s: Step) => {
		const step = ex.backTo(s.id)
		if (!step) return
		if (step.group !== ex.group) {
			pending.current = step
			setOpen(null)
			ex.setGroupQuiet(step.group)
			return
		}
		if (world) apply(step, world)
	}
	const stop = (k: "all" | "region" | "title") => {
		const m = map.current
		if (!m || !world) return
		if (k === "all") {
			setOpen(null)
			m.overview()
			ex.push({ kind: "map", label: `All by ${ex.groupName(ex.group).toLowerCase()}`, group: ex.group })
			return
		}
		const v = m.view()
		const near = v.focus ?? nearestCell(world, v.cam.x, v.cam.y)
		if (k === "region") {
			if (open) return closeUp()
			if (near) goRegion(near)
			return
		}
		if (open) return
		const c = near ?? world.cells[0]
		const it = c?.items.find(ex.pass)
		if (c && it) openTitle(it, c, m.posterRect(it.k), null, "map")
	}

	// Grouping switch from the bar: the history already recorded it; close any close-up.
	const lastGroup = useRef(ex.group)
	useEffect(() => {
		if (lastGroup.current === ex.group) return
		lastGroup.current = ex.group
		if (!pending.current) setOpen(null)
	}, [ex.group])

	// Keyboard on the map (when it has focus): arrows pan, + and - zoom, 0 shows everything, Enter flies in.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (open) return
			const el = stage.current
			if (!el || !el.contains(document.activeElement)) return
			const t = e.target as HTMLElement
			if (t.closest?.("input, textarea, [contenteditable]")) return
			const m = map.current
			if (!m) return
			const pan: Record<string, [number, number]> = { ArrowLeft: [-160, 0], ArrowRight: [160, 0], ArrowUp: [0, -160], ArrowDown: [0, 160] }
			if (pan[e.key]) {
				e.preventDefault()
				e.stopPropagation()
				m.panBy(...pan[e.key])
			} else if (e.key === "+" || e.key === "=") m.zoomBy(1.6)
			else if (e.key === "-" || e.key === "_") m.zoomBy(1 / 1.6)
			else if (e.key === "0") stop("all")
			else if (e.key === "Enter" && t === el) stop(m.view().cam.s > m.view().region * 1.4 ? "title" : "region")
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	})

	const history = <History steps={ex.steps} onPick={jump} />
	return (
		<div ref={stage} className="rx4-stage" tabIndex={-1} onPointerDown={(e) => e.target === e.currentTarget && stage.current?.focus()}>
			{world && (
				<MapCanvas
					ref={map}
					world={world}
					pad={pad}
					pass={ex.pass}
					rev={ex.rev}
					current={open?.cell.id ?? focus}
					onPoster={(it, cell, rect) => openTitle(it, cell, rect, null, "map")}
					onCell={(cell) => {
						stage.current?.focus({ preventScroll: true })
						goRegion(cell)
					}}
					className="rx4-canvas"
					label={`Map of ${ex.map.total.toLocaleString("en")} films and shows by ${ex.groupName(ex.group).toLowerCase()}`}
				/>
			)}
			{!open && <Top ex={ex} hide={hide} history={history} />}
			{ex.loading && <p className="rx4-loading">Laying the map out by {ex.groupName(ex.group).toLowerCase()}…</p>}
			{world && open && (
				<CloseUp
					key={`s${open.s}`}
					ex={ex}
					mode={mode}
					it={open.it}
					cell={open.cell}
					world={world}
					from={open.from}
					dir={open.dir}
					trail={trail.current}
					history={history}
					onGo={(it, cell, how, dir) => openTitle(it, cell, null, dir, how)}
					onClose={closeUp}
				/>
			)}
			<div className={`rx4-nav ${open ? "rx4-nav-cu" : ""}`}>
				{world && (
					<div className={open ? "hidden md:block" : ""}>
						<Minimap
							map={map}
							world={world}
							current={open?.cell.id ?? focus}
							onGo={(x, y) => {
								const m = map.current
								if (!m) return
								setOpen(null)
								const v = m.view()
								m.flyTo(x, y, Math.max(v.cam.s, v.region))
							}}
						/>
					</div>
				)}
			</div>
			{world && (
				<div className={open ? "hidden lg:block" : ""}>
					<Ladder map={map} closeUp={!!open} onStop={stop} />
				</div>
			)}
			<Toast4 ex={ex} />
		</div>
	)
}

const cellLabel = (c: Cell) => (c.band != null ? `${c.region.name}, ${["near you", "a step out", "unexplored"][c.band]}` : c.region.name)

function nearestCell(w: World, x: number, y: number) {
	let best: Cell | null = null
	let bd = Number.POSITIVE_INFINITY
	for (const c of w.cells) {
		const d = Math.hypot(c.cx - x, c.cy - y)
		if (d < bd) {
			bd = d
			best = c
		}
	}
	return best
}
