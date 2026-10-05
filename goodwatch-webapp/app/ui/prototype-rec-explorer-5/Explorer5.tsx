// PROTOTYPE - throwaway. One round-5 variant (#180): the islands map with its identities, its fractal and its
// cinematic close-up (all drawn by engine5.ts), and the controls around it: grouping, filters, history (last two
// steps and a dropdown), minimap, zoom ladder, keyboard, pinch. Round 4's page state (useExplorer4) is reused as is.
import { useSearchParams } from "@remix-run/react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { MapHandle } from "~/ui/prototype-rec-explorer-4/MapCanvas"
import { History, Minimap, Toast4 } from "~/ui/prototype-rec-explorer-4/chrome"
import {
	type Cell,
	type Dir,
	type World,
	doorsOf,
	layout,
} from "~/ui/prototype-rec-explorer-4/geo"
import type { Ex4, Step } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import type { PeekInfo4 } from "~/ui/prototype-rec-explorer-4/wire4"
import { CinemaPanel, type DoorView } from "./CinemaPanel"
import { IdentBadge, Ladder5, Top5 } from "./chrome5"
import type { Config } from "./config"
import { type Look, setFontsReady } from "./emblems"
import {
	type Engine,
	type Hooks,
	type Island,
	type Pad,
	makeEngine,
} from "./engine5"
import { clearEmblems, identOf, loadEraFonts, onLogo } from "./identity"
import { BRANCH, type DoorRes, type TreeRes, type W, firstCount } from "./wire5"

type Door = DoorView & { cell: Cell; idx: number }
type Open = { cell: string; i: number; it: W; n: number }
const DIRS: Record<Dir, number> = { n: -1, w: -1, e: 1, s: 1 }

export function Explorer5({ ex, cfg }: { ex: Ex4; cfg: Config }) {
	const [params] = useSearchParams()
	const stage = useRef<HTMLDivElement>(null)
	const canvas = useRef<HTMLCanvasElement>(null)
	const [eng, setEng] = useState<Engine | null>(null)
	const engRef = useRef<Engine | null>(null)
	const [aspect, setAspect] = useState<number | null>(null)
	const [size, setSize] = useState({ w: 1440, h: 800 })
	const [open, setOpen] = useState<Open | null>(null)
	const [doors, setDoors] = useState<Door[] | null>(null)
	const [info, setInfo] = useState<PeekInfo4 | null>(null)
	const [focus, setFocus] = useState<string | null>(null)
	const trail = useRef<string[]>([])
	const pending = useRef<Step | null>(null)
	const small = size.w < 640
	const panel: "side" | "marquee" | "sheet" = small
		? "sheet"
		: cfg.cinema === "marquee"
			? "marquee"
			: "side"

	// ------------------------------------------------------------ layout of the screen

	const padRef = useRef<Pad>({ t: 150, r: 96, b: 24, l: 24 })
	const cinePadRef = useRef<Pad>({ t: 80, r: 440, b: 20, l: 20 })
	useEffect(() => {
		const el = stage.current
		if (!el) return
		const measure = () => {
			const w = el.clientWidth
			const h = el.clientHeight
			const top = el.querySelector(".rx4-top-row2") as HTMLElement | null
			const t = top ? top.offsetTop + top.offsetHeight + 14 : 150
			padRef.current =
				w >= 1024 ? { t, r: 96, b: 20, l: 20 } : { t, r: 12, b: 150, l: 12 }
			cinePadRef.current =
				w < 640
					? { t: 70, r: 10, b: Math.round(h * 0.42) + 6, l: 10 }
					: cfg.cinema === "marquee"
						? { t: 84, r: 24, b: 250, l: 24 }
						: { t: 84, r: 25 * 16 + 40, b: 24, l: 24 }
			setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
			const p = padRef.current
			const a = (w - p.l - p.r) / Math.max(1, h - p.t - p.b)
			const b =
				a >= 1.25
					? Math.min(2.25, Math.round(a * 4) / 4)
					: a >= 0.85
						? 1
						: Math.max(0.5, Math.round(a * 4) / 4)
			setAspect((x) => (x === b ? x : b))
			engRef.current?.repad()
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const world = useMemo<World | null>(
		() => (aspect ? layout("blobs", ex.map.regions, aspect) : null),
		[aspect, ex.map],
	)
	const lookOf = (c: Cell): Look => ({
		id: c.region.id,
		name: c.region.name,
		count: c.count,
		fit: c.fit,
		color: c.region.color,
		fill: c.fill,
		ident: identOf(ex.map.group, c.region.id, ex.services),
		key: `${ex.map.group}|${c.region.id}`,
	})

	// ------------------------------------------------------------ data

	const base = useMemo(() => {
		const q = new URLSearchParams()
		for (const k of ["as", "country"]) {
			const v = params.get(k)
			if (v) q.set(k, v)
		}
		return q.toString()
	}, [params])
	const api = async <T,>(op: string, args: Record<string, string | number>) => {
		const q = new URLSearchParams(base)
		q.set("op", op)
		q.set("group", ex.map.group)
		q.set("mine", ex.filterKey[0])
		q.set("ns", ex.filterKey[1])
		q.set("br", BRANCH[cfg.arr].join(","))
		for (const [k, v] of Object.entries(args)) q.set(k, String(v))
		const r = await fetch(`/prototype/rec-explorer-5/api?${q}`)
		if (!r.ok) throw new Error(`API ${op} ${r.status}`)
		return (await r.json()) as T
	}
	const trees = useRef(new Map<string, Promise<TreeRes>>())
	const treeOf = (isl: Island) => {
		const key = `${ex.map.group}|${ex.filterKey}|${isl.cell.id}|${isl.n1}`
		let p = trees.current.get(key)
		if (!p) {
			p = api<TreeRes>("tree", { id: isl.cell.id, n1: isl.n1 })
			p.catch(() => trees.current.delete(key))
			trees.current.set(key, p)
		}
		return p.then((t) => {
			if (engRef.current?.island(isl.cell.id) === isl && !isl.loaded)
				engRef.current.setTree(isl.cell.id, t)
			return t
		})
	}

	// ------------------------------------------------------------ the close-up

	const openTitle = (isl: Island, i: number, dir = 0) => {
		const e = engRef.current
		if (!e) return
		const it = isl.items[i]
		if (!it) return
		trail.current = [...trail.current.filter((k) => k !== it.k), it.k].slice(
			-40,
		)
		if (!isl.loaded) void treeOf(isl).catch(() => {})
		if (e.cine()) e.moveCine(isl, i, dir)
		else e.openCine(isl, i)
		setOpen((o) => ({ cell: isl.cell.id, i, it, n: (o?.n ?? 0) + 1 }))
		ex.push(
			{
				kind: "title",
				label: it.t,
				group: ex.map.group,
				cell: isl.cell.id,
				title: it,
			},
			dir !== 0,
		)
	}
	const closeUp = () => {
		const e = engRef.current
		const c = e?.cine()
		if (!e || !c) return
		e.closeCine()
		setOpen(null)
		ex.push({
			kind: "region",
			label: c.isl.look.name,
			group: ex.map.group,
			cell: c.isl.cell.id,
		})
	}
	const goIsland = (isl: Island) => {
		engRef.current?.flyToIsland(isl)
		ex.push({
			kind: "region",
			label: isl.look.name,
			group: ex.map.group,
			cell: isl.cell.id,
		})
	}
	/** Step toward another island: land on the title of its fractal closest to this one. */
	const stepToward = async (
		cell: Cell,
		dir: number,
		known?: { idx: number },
	) => {
		const e = engRef.current
		const c = e?.cine()
		if (!e || !c) return
		const isl = e.island(cell.id)
		if (!isl) return
		let idx = known?.idx ?? -1
		if (!known) {
			const r = await api<DoorRes>("door", {
				k: c.isl.items[c.i].k,
				to: `${cell.id}:${isl.n1}`,
				shown: trail.current.join(","),
			})
			idx = r.doors[0]?.idx ?? -1
		}
		await treeOf(isl)
		if (idx < 0 || !isl.items[idx]) idx = 0
		openTitle(isl, idx, dir)
	}

	// Doors and the reason, whenever the title in the close-up changes.
	useEffect(() => {
		if (!open || !world) return
		const e = engRef.current
		const isl = e?.island(open.cell)
		if (!isl) return
		let live = true
		setDoors(null)
		setInfo(null)
		const ds = doorsOf(world, isl.cell)
		api<DoorRes>("door", {
			k: open.it.k,
			to: ds.map((d) => `${d.cell.id}:${firstCount(d.cell.count)}`).join(","),
			shown: trail.current.join(","),
		})
			.then((r) => {
				if (!live) return
				setDoors(
					ds.map((d, j) => ({
						dir: d.dir,
						look: lookOf(d.cell),
						item: r.doors[j]?.item ?? null,
						cell: d.cell,
						idx: r.doors[j]?.idx ?? -1,
					})),
				)
			})
			.catch(() => live && setDoors([]))
		ex.peekInfo(open.it.k).then((x) => live && setInfo(x))
		return () => {
			live = false
		}
	}, [open?.cell, open?.it.k, world])

	const order = () => {
		const e = engRef.current
		const c = e?.cine()
		if (!c) return null
		const idx = c.isl.items
			.map((_, j) => j)
			.filter((j) => j === c.i || ex.pass(c.isl.items[j]))
		return { c, idx, at: idx.indexOf(c.i) }
	}
	const browse = (d: 1 | -1) => {
		const o = order()
		if (!o) return
		const j = o.idx[o.at + d]
		if (j != null) openTitle(o.c.isl, j, d)
	}
	const takeDoor = (d: Door) => {
		if (d.item) void stepToward(d.cell, DIRS[d.dir], { idx: d.idx })
	}

	// ------------------------------------------------------------ the engine

	const hooks = useRef<Hooks>(null as unknown as Hooks)
	hooks.current = {
		pass: ex.pass,
		current: () => open?.cell ?? focus,
		pad: () => padRef.current,
		cinePad: () => cinePadRef.current,
		onPoster: (isl, i, rect) => {
			const c = engRef.current?.cine()
			if (c && c.isl === isl && c.i === i) return
			const dir = c ? (rect.x + rect.w / 2 < size.w / 2 ? -1 : 1) : 0
			openTitle(isl, i, dir)
		},
		onIsland: (isl) => {
			stage.current?.focus({ preventScroll: true })
			const c = engRef.current?.cine()
			if (c) {
				if (c.isl !== isl) void stepToward(isl.cell, isl.sx < c.isl.sx ? -1 : 1)
				return
			}
			goIsland(isl)
		},
		needTree: (isl) => void treeOf(isl).catch(() => {}),
		onCineOut: closeUp,
		onSwipe: (d) => browse(d),
	}
	useEffect(() => {
		const cv = canvas.current
		if (!cv) return
		const e = makeEngine(cv, cfg, hooks)
		engRef.current = e
		setEng(e)
		onLogo(() => {
			e.invalidate()
		})
		loadEraFonts().then(() => {
			setFontsReady()
			clearEmblems()
			e.invalidate()
		})
		return () => {
			e.destroy()
			engRef.current = null
		}
	}, [])
	useEffect(() => {
		if (!eng || !world) return
		eng.setWorld(world, lookOf)
		setOpen(null)
		// A history step taken while the grouping changed is applied once the new map is in.
		const s = pending.current
		if (s && s.group === ex.map.group) {
			pending.current = null
			apply(s)
		}
	}, [eng, world])
	useEffect(() => {
		eng?.refilter()
	}, [ex.rev, ex.pass])

	// Follow the island in the middle of the screen, for the ladder, the minimap and the "where" chip.
	useEffect(() => {
		if (!eng) return
		let raf = 0
		const off = eng.subscribe(() => {
			if (raf) return
			raf = requestAnimationFrame(() => {
				raf = 0
				const f = eng.view().focus?.id ?? null
				setFocus((x) => (x === f ? x : f))
			})
		})
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [eng])

	// ------------------------------------------------------------ history

	function apply(s: Step) {
		const e = engRef.current
		if (!e) return
		if (s.kind === "map" || s.kind === "group") {
			if (e.cine()) e.closeCine()
			setOpen(null)
			e.overview()
			return
		}
		const isl = s.cell ? e.island(s.cell) : null
		if (!isl) return
		if (s.kind === "region") {
			if (e.cine()) e.closeCine()
			setOpen(null)
			e.flyToIsland(isl)
			return
		}
		const k = s.title?.k
		void treeOf(isl)
			.catch(() => null)
			.then(() => {
				const i = isl.items.findIndex((x) => x.k === k)
				if (i < 0) return
				if (e.cine()) e.moveCine(isl, i, -1)
				else e.openCine(isl, i)
				setOpen((o) => ({
					cell: isl.cell.id,
					i,
					it: isl.items[i],
					n: (o?.n ?? 0) + 1,
				}))
			})
	}
	const jump = (s: Step) => {
		const step = ex.backTo(s.id)
		if (!step) return
		if (step.group !== ex.map.group) {
			pending.current = step
			setOpen(null)
			ex.setGroupQuiet(step.group)
			return
		}
		apply(step)
	}
	const history = <History steps={ex.steps} onPick={jump} />

	// ------------------------------------------------------------ zoom ladder and keyboard

	const step = (j: number) => {
		const e = engRef.current
		if (!e || !world) return
		const v = e.view()
		if (j === 4) {
			if (e.cine()) return
			const d = e.centerPoster()
			if (d) openTitle(d.isl, d.i)
			else {
				const isl = (v.focus && e.island(v.focus.id)) || e.islands()[0]
				if (isl) openTitle(isl, 0)
			}
			return
		}
		if (e.cine()) closeUp()
		if (j === 0) {
			e.overview()
			ex.push({
				kind: "map",
				label: `All by ${ex.groupName(ex.map.group).toLowerCase()}`,
				group: ex.map.group,
			})
			return
		}
		const isl =
			(v.focus && e.island(v.focus.id)) || nearestIsland(e, v.cam.x, v.cam.y)
		if (!isl) return
		if (j === 1) return goIsland(isl)
		e.stepTo(j - 1)
	}
	const keys = useRef({ step, browse, closeUp, doors, takeDoor })
	keys.current = { step, browse, closeUp, doors, takeDoor }
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement
			if (t.closest?.("input, textarea, [contenteditable]")) return
			const en = engRef.current
			if (!en) return
			const k = keys.current
			if (en.cine()) {
				if (e.key === "Escape") return k.closeUp()
				let d: Dir | null = null
				if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
					e.preventDefault()
					e.stopPropagation()
					if (!e.shiftKey) return k.browse(e.key === "ArrowLeft" ? -1 : 1)
					d = e.key === "ArrowLeft" ? "w" : "e"
				}
				if (e.key === "ArrowUp") d = "n"
				if (e.key === "ArrowDown") d = "s"
				if (!d) return
				e.preventDefault()
				e.stopPropagation()
				const door = k.doors?.find((x) => x.dir === d && x.item)
				if (door) k.takeDoor(door)
				return
			}
			const el = stage.current
			if (!el || !el.contains(document.activeElement)) return
			const pan: Record<string, [number, number]> = {
				ArrowLeft: [-160, 0],
				ArrowRight: [160, 0],
				ArrowUp: [0, -160],
				ArrowDown: [0, 160],
			}
			if (pan[e.key]) {
				e.preventDefault()
				e.stopPropagation()
				en.panBy(...pan[e.key])
			} else if (e.key === "+" || e.key === "=") en.zoomBy(1.6)
			else if (e.key === "-" || e.key === "_") en.zoomBy(1 / 1.6)
			else if (e.key === "0") k.step(0)
			else if (e.key === "Enter" && t === el) {
				const d = en.centerPoster()
				if (d && en.view().cam.s >= en.view().stops[0] * 0.9)
					openTitle(d.isl, d.i)
				else k.step(1)
			}
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])

	// Round 4's minimap reads the camera through a handle; hand it this map's.
	const mini = useRef<MapHandle | null>(null)
	if (eng && !mini.current)
		mini.current = {
			view: () => eng.view(),
			subscribe: (fn: () => void) => eng.subscribe(fn),
		} as unknown as MapHandle

	// ------------------------------------------------------------ render

	const cur = eng && open ? eng.cine() : null
	const ord = open ? order() : null
	const prevI = ord && ord.at > 0 ? ord.idx[ord.at - 1] : null
	const nextI =
		ord && ord.at >= 0 && ord.at < ord.idx.length - 1
			? ord.idx[ord.at + 1]
			: null
	const focusIsl = focus && eng ? eng.island(focus) : null
	return (
		<div
			ref={stage}
			className="rx4-stage"
			tabIndex={-1}
			onPointerDown={(e) =>
				e.target === e.currentTarget && stage.current?.focus()
			}
		>
			<canvas
				ref={canvas}
				className="rx4-canvas"
				style={{ touchAction: "none", display: "block" }}
				role="img"
				aria-label={`Map of ${ex.map.total.toLocaleString("en")} films and shows by ${ex.groupName(ex.map.group).toLowerCase()}`}
			/>
			{!open && <Top5 ex={ex} history={history} />}
			{ex.loading && (
				<p className="rx4-loading">
					Laying the islands out by {ex.groupName(ex.group).toLowerCase()}…
				</p>
			)}
			{!open && focusIsl && (
				<div className="rx5-where" aria-live="polite">
					<IdentBadge
						ident={focusIsl.look.ident}
						color={focusIsl.look.color}
						icons={cfg.icons}
						size={20}
					/>
					<span>{focusIsl.look.name}</span>
					<span className="rx5-where-n">
						{focusIsl.look.count.toLocaleString("en")} titles
					</span>
				</div>
			)}
			{open && cur && (
				<>
					<div className="rx5-cbar">
						<button type="button" className="rx5-back" onClick={closeUp}>
							<span aria-hidden>←</span> Map
						</button>
						{history}
					</div>
					<CinemaPanel
						ex={ex}
						cfg={cfg}
						layout={panel}
						it={cur.isl.items[cur.i] ?? open.it}
						look={cur.isl.look}
						at={(ord?.at ?? 0) + 1}
						total={ord?.idx.length ?? 1}
						onPrev={prevI != null ? () => browse(-1) : null}
						onNext={nextI != null ? () => browse(1) : null}
						prevT={prevI != null ? cur.isl.items[prevI].t : ""}
						nextT={nextI != null ? cur.isl.items[nextI].t : ""}
						doors={doors}
						info={info}
						onDoor={(d) => takeDoor(d as Door)}
					/>
				</>
			)}
			<div className={`rx4-nav ${open ? "rx4-nav-cu" : ""}`}>
				{world && mini.current && (
					<div className={open && panel !== "side" ? "hidden" : ""}>
						<Minimap
							map={mini}
							world={world}
							current={open?.cell ?? focus}
							onGo={(x, y) => {
								const e = engRef.current
								if (!e) return
								const v = e.view()
								e.flyTo(x, y, Math.max(v.cam.s, v.stops[0] * 0.8))
							}}
						/>
					</div>
				)}
			</div>
			{world && (
				<div className={open ? "hidden" : ""}>
					<Ladder5
						eng={eng}
						cine={!!open}
						islandName={focusIsl?.look.name ?? ""}
						onStep={step}
					/>
				</div>
			)}
			<Toast4 ex={ex} />
		</div>
	)
}

function nearestIsland(e: Engine, x: number, y: number) {
	let best: Island | null = null
	let bd = Number.POSITIVE_INFINITY
	for (const isl of e.islands()) {
		const d = Math.hypot(isl.cell.cx - x, isl.cell.cy - y)
		if (d < bd) {
			bd = d
			best = isl
		}
	}
	return best
}
