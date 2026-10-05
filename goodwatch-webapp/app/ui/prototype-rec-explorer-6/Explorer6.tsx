// PROTOTYPE - throwaway. One round-6 variant (#180): the living islands map (sea6.ts + map6.ts) with a title card
// that comes forward over the map when you're close to a poster, never a separate screen. How the card comes
// forward is the variant (wire6.ts, Activation). Round 4's page state (useExplorer4) is reused as is: grouping,
// filters, in-page Want to See and Seen it, the reason, history.
import { useSearchParams } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type Cell, type World, doorsOf, layout } from "~/ui/prototype-rec-explorer-4/geo"
import type { Ex4, Step } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import type { PeekInfo4 } from "~/ui/prototype-rec-explorer-4/wire4"
import { Caption6, Card6, type DoorCard } from "./Card6"
import { History6, Minimap6, Rail6, Toast6, TopBar, Where6 } from "./chrome6"
import { type Drawn, type Engine, type Hooks, type Isl, type Look, type Pad, makeEngine } from "./map6"
import { BRANCH, type Config6, type DoorRes, type TreeRes, type W, firstCount } from "./wire6"

type Act = { k: string; isl: string; it: W; pinned: boolean }

const HINT: Record<Config6["activation"], string> = {
	near: "Scroll or pinch to dive in. Titles open as you get close to them.",
	focus: "Scroll or pinch to dive in. The title nearest the middle is always in focus.",
	drawer: "Scroll or pinch to dive in. The drawer follows the title nearest the middle.",
	peek: "Scroll or pinch to dive in. Point at a poster to peek, click to keep it open.",
	pin: "Scroll or pinch to dive in. Tap a poster to open its card.",
}

export function Explorer6({ ex, cfg }: { ex: Ex4; cfg: Config6 }) {
	const [params] = useSearchParams()
	const stage = useRef<HTMLDivElement>(null)
	const glc = useRef<HTMLCanvasElement>(null)
	const c2 = useRef<HTMLCanvasElement>(null)
	const engRef = useRef<Engine | null>(null)
	const [eng, setEng] = useState<Engine | null>(null)
	const [aspect, setAspect] = useState<number | null>(null)
	const [size, setSize] = useState({ w: 1440, h: 800 })
	const [act, setActState] = useState<Act | null>(null)
	const actRef = useRef<Act | null>(null)
	const [caps, setCaps] = useState<Drawn[]>([])
	const [info, setInfo] = useState<PeekInfo4 | null>(null)
	const [doors, setDoors] = useState<DoorCard[] | null>(null)
	const [focusIsl, setFocusIsl] = useState<Isl | null>(null)
	const [deep, setDeep] = useState(false)
	const [touched, setTouched] = useState(false)
	const cardEl = useRef<HTMLDivElement>(null)
	const anchorEl = useRef<HTMLDivElement>(null)
	const capEls = useRef(new Map<string, HTMLDivElement>())
	const hoverRef = useRef<Drawn | null>(null)
	const trail = useRef<string[]>([])
	const pending = useRef<Step | null>(null)
	const small = size.w < 640
	const form: "float" | "sheet" | "drawer" = small ? "sheet" : cfg.activation === "drawer" ? "drawer" : "float"

	const setAct = useCallback((a: Act | null) => {
		actRef.current = a
		setActState(a)
	}, [])

	// ------------------------------------------------------------ layout of the screen

	const padRef = useRef<Pad>({ t: 150, r: 70, b: 70, l: 16 })
	useEffect(() => {
		const el = stage.current
		if (!el) return
		const measure = () => {
			const w = el.clientWidth
			const h = el.clientHeight
			const top = el.querySelector(".rx6-top-row2") as HTMLElement | null
			const t = top ? top.offsetTop + top.offsetHeight + 12 : 130
			padRef.current =
				w >= 1024
					? { t, r: cfg.activation === "drawer" ? 440 : 72, b: 64, l: 24 }
					: { t, r: 12, b: w < 640 ? 150 : 90, l: 12 }
			setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
			const p = padRef.current
			const a = (w - p.l - p.r) / Math.max(1, h - p.t - p.b)
			const b = a >= 1.25 ? Math.min(2.25, Math.round(a * 4) / 4) : a >= 0.85 ? 1 : Math.max(0.5, Math.round(a * 4) / 4)
			setAspect((x) => (x === b ? x : b))
			engRef.current?.repad()
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const world = useMemo<World | null>(() => (aspect ? layout("blobs", ex.map.regions, aspect) : null), [aspect, ex.map])
	const center = () => {
		const p = padRef.current
		const e = engRef.current
		const { w, h } = e?.size() ?? size
		if (w < 640) {
			// On a phone the card is a sheet at the bottom: the middle is the map left above it.
			const a = actRef.current
			if (!a) return { x: w / 2, y: p.t + (h - p.t) * 0.34 }
			const top = a.pinned ? h - 86 - h * 0.5 : h - 86 - 176
			return { x: w / 2, y: p.t + Math.max(60, top - p.t) * 0.5 }
		}
		return { x: (p.l + w - p.r) / 2, y: (p.t + h - p.b) / 2 }
	}
	const lookOf = (c: Cell): Look => {
		let logo: string | null = null
		if (ex.map.group === "service") {
			const s = ex.services.find((x) => String(x.id) === c.region.id)
			logo = s?.logo.split("/original")[1] ?? null
		}
		return { id: c.region.id, name: c.region.name, color: c.region.color, logo }
	}

	// ------------------------------------------------------------ data (round 5's API, read-only)

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
	const treeOf = (isl: Isl) => {
		const key = `${ex.map.group}|${ex.filterKey}|${isl.id}|${isl.n1}`
		let p = trees.current.get(key)
		if (!p) {
			p = api<TreeRes>("tree", { id: isl.id, n1: isl.n1 })
			p.catch(() => trees.current.delete(key))
			trees.current.set(key, p)
		}
		return p.then((t) => {
			const e = engRef.current
			if (e?.island(isl.id) === isl && !isl.loaded) e.setTree(isl.id, t)
			return t
		})
	}
	const doorCache = useRef(new Map<string, Promise<DoorRes>>())

	// ------------------------------------------------------------ activation

	const pinned = act?.pinned ?? false
	const pin = (d: { isl: Isl; it: W }, push = true) => {
		setAct({ k: d.it.k, isl: d.isl.id, it: d.it, pinned: true })
		trail.current = [...trail.current.filter((k) => k !== d.it.k), d.it.k].slice(-40)
		if (push) ex.push({ kind: "title", label: d.it.t, group: ex.map.group, cell: d.isl.id, title: d.it })
	}
	const unpin = () => {
		if (actRef.current) setAct(null)
		hoverRef.current = null
	}
	const pendingAuto = useRef<{ k: string | null; t: number }>({ k: null, t: 0 })
	const lastCaps = useRef("")

	/** Who should be in front right now, by the variant's rule. */
	const compute = () => {
		const e = engRef.current
		if (!e) return
		const a = actRef.current
		const ACT = e.act()
		const { w, h } = e.size()
		const ptr = e.pointer()
		const c = center()
		let cand: Drawn | null = null
		let capList: Drawn[] = []
		if (!a?.pinned) {
			if (cfg.activation === "peek") cand = hoverRef.current && e.find(hoverRef.current.it.k)
			else if (cfg.activation === "pin") cand = null
			else {
				const byPtr = cfg.activation === "near" && ptr && !small
				const pt = byPtr && ptr ? ptr : c
				const minW = cfg.activation === "near" ? ACT : cfg.activation === "focus" ? ACT * 0.8 : ACT * 0.72
				const reach = byPtr ? 36 : Math.min(w, h) * (cfg.activation === "near" ? 0.16 : 0.3)
				cand = e.nearest(pt.x, pt.y, minW, reach)
				// Keep the current one while it's still a fair choice, so cards don't flicker between neighbors.
				if (a && cand && cand.it.k !== a.k) {
					const cur = e.find(a.k)
					if (cur && cur.w >= minW * 0.9) {
						const dc = Math.hypot(cur.cx - pt.x, cur.cy - pt.y)
						const dn = Math.hypot(cand.cx - pt.x, cand.cy - pt.y)
						if (dc < dn * 1.3 + 12) cand = cur
					}
				}
				if (cfg.activation === "near" && !small) {
					capList = e
						.drawn()
						.filter((d) => d.w >= ACT * 0.6 && d.a > 0.9 && d.it.k !== cand?.it.k && Math.hypot(d.cx - pt.x, d.cy - pt.y) < ACT * 2.6)
						.sort((x, y) => Math.hypot(x.cx - pt.x, x.cy - pt.y) - Math.hypot(y.cx - pt.x, y.cy - pt.y))
						.slice(0, 4)
				}
			}
			const k = cand?.it.k ?? null
			const now = performance.now()
			if (k !== (a?.k ?? null)) {
				if (pendingAuto.current.k !== k) pendingAuto.current = { k, t: now }
				const wait = k == null ? 160 : cfg.activation === "peek" ? 0 : 90
				if (now - pendingAuto.current.t >= wait) {
					setAct(cand ? { k: cand.it.k, isl: cand.isl.id, it: cand.it, pinned: false } : null)
				} else setTimeout(() => engRef.current && compute(), wait + 5)
			} else pendingAuto.current = { k, t: now }
		}
		const ck = capList.map((d) => d.it.k).join(",")
		if (ck !== lastCaps.current) {
			lastCaps.current = ck
			setCaps(capList)
		}
		place()
	}

	/** Move the card and captions to their posters (every drawn frame). */
	const place = () => {
		const e = engRef.current
		if (!e) return
		const { w, h } = e.size()
		const a = actRef.current
		const el = anchorEl.current
		let box: { x: number; y: number; w: number; h: number } | null = null
		if (el && a && form === "float") {
			const d = e.find(a.k)
			const cw = el.offsetWidth || 340
			const chh = el.offsetHeight || 420
			if (d) {
				const p = padRef.current
				let x = d.cx + d.w * 0.56 + 22
				let side = "0%"
				if (x + cw > w - p.r + 40) {
					x = d.cx - d.w * 0.56 - 22 - cw
					side = "100%"
				}
				if (x < 8) x = Math.min(w - cw - 8, Math.max(8, d.cx - cw / 2))
				const y = Math.min(h - chh - 12, Math.max(Math.min(p.t - 4, h - chh - 12), d.cy - chh * 0.36))
				el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
				box = { x, y, w: cw, h: chh }
				el.style.visibility = "visible"
				el.style.setProperty("--ox", side)
			} else if (!a.pinned) el.style.visibility = "hidden"
		}
		for (const [k, cel] of capEls.current) {
			const d = e.find(k)
			if (!d) {
				cel.style.visibility = "hidden"
				continue
			}
			const cw = cel.offsetWidth || 120
			const x = Math.min(w - cw - 8, Math.max(8, d.cx - cw / 2))
			const y = d.y + d.h + 8
			// A caption never sits on the card.
			const hit = box && x < box.x + box.w + 6 && x + cw > box.x - 6 && y < box.y + box.h + 6 && y + 28 > box.y - 6
			cel.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
			cel.style.visibility = hit || y > h - 40 ? "hidden" : "visible"
		}
	}

	// A card that just mounted sits by its poster at once, even when the map is still (no frame to move it).
	const placeRef = useRef(place)
	placeRef.current = place
	useEffect(() => {
		placeRef.current()
		engRef.current?.invalidate()
	}, [act, caps])

	// ------------------------------------------------------------ the engine

	const hooks = useRef<Hooks>(null as unknown as Hooks)
	hooks.current = {
		pass: ex.pass,
		pad: () => padRef.current,
		center,
		active: () => (actRef.current ? { k: actRef.current.k, pinned: actRef.current.pinned } : null),
		card: () => (form === "sheet" ? null : (cardEl.current?.getBoundingClientRect() ?? null)),
		onTapPoster: (d) => {
			stage.current?.focus({ preventScroll: true })
			setTouched(true)
			const a = actRef.current
			if (a?.pinned && a.k === d.it.k) return
			pin(d)
			// Bring a small poster up to a size where it reads next to its card.
			const e = engRef.current
			if (!e) return
			// Bring a poster that's small, or partly under the chrome or off screen, to the middle.
			const p = padRef.current
			const { w, h } = e.size()
			const out = d.x < p.l || d.y < p.t - 20 || d.x + d.w > w - p.r || d.y + d.h > h - Math.min(p.b, 40)
			if (d.w < e.act() || out || w < 640) e.glideToPoster(d.isl, d.i)
		},
		onTapIsland: (isl) => {
			stage.current?.focus({ preventScroll: true })
			setTouched(true)
			unpin()
			engRef.current?.flyToIsland(isl)
			ex.push({ kind: "region", label: isl.name, group: ex.map.group, cell: isl.id })
		},
		onTapWater: () => {
			stage.current?.focus({ preventScroll: true })
			if (actRef.current?.pinned) unpin()
		},
		onHover: (d) => {
			if (cfg.activation !== "peek") return
			hoverRef.current = d && d.w >= 28 ? d : null
			compute()
		},
		onLongPress: (d) => {
			if (cfg.activation === "peek") {
				hoverRef.current = d
				setAct({ k: d.it.k, isl: d.isl.id, it: d.it, pinned: false })
			} else pin(d)
		},
		needTree: (isl) => void treeOf(isl).catch(() => {}),
		onFrame: () => compute(),
		onPointer: () => {
			if (cfg.activation === "near") compute()
		},
	}
	useEffect(() => {
		const a = glc.current
		const b = c2.current
		if (!a || !b) return
		const e = makeEngine(a, b, cfg, hooks)
		engRef.current = e
		setEng(e)
		const w = window as unknown as { __rx6?: unknown }
		w.__rx6 = {
			view: () => e.view(),
			drawn: () => e.drawn().map((d) => ({ k: d.it.k, t: d.it.t, x: d.x, y: d.y, w: d.w, h: d.h, gen: d.gen, isl: d.isl.id })),
			active: () => actRef.current && { k: actRef.current.k, t: actRef.current.it.t, pinned: actRef.current.pinned, isl: actRef.current.isl },
			frames: () => e.frames(),
			islands: () => e.islands().map((i) => ({ id: i.id, name: i.name, x: i.sx, y: i.sy, r: i.sr, on: i.on, loaded: i.loaded })),
			gl: () => e.hasGL(),
			busy: () => e.busy(),
		}
		return () => {
			e.destroy()
			engRef.current = null
		}
	}, [])
	useEffect(() => {
		if (!eng || !world) return
		eng.setWorld(world, lookOf, `${ex.map.group}|${ex.filterKey}`)
		setAct(null)
		const s = pending.current
		if (s && s.group === ex.map.group) {
			pending.current = null
			setTimeout(() => apply(s), 50)
		}
	}, [eng, world])
	useEffect(() => {
		eng?.refilter()
		const a = actRef.current
		if (a && !ex.pass(a.it) && !a.pinned) setAct(null)
	}, [ex.rev, ex.pass])

	// Follow the island in the middle (the chip, the rail) and record arriving at one in the history.
	const lastRegion = useRef<string | null>(null)
	useEffect(() => {
		if (!eng) return
		let raf = 0
		let settleT: ReturnType<typeof setTimeout> | null = null
		const off = eng.subscribe(() => {
			if (raf) return
			raf = requestAnimationFrame(() => {
				raf = 0
				const v = eng.view()
				const inIsl = v.focus && v.cam.s >= (v.stops[1] ?? v.fit * 3) * 0.8 ? v.focus : null
				setFocusIsl((x) => (x === inIsl ? x : inIsl))
				setDeep(v.cam.s > v.fit * 1.25)
				if (v.cam.s > v.fit * 1.25) setTouched(true)
				if (settleT) clearTimeout(settleT)
				settleT = setTimeout(() => {
					if (eng.busy()) return
					const f = eng.view()
					const isl = f.focus && f.cam.s >= (f.stops[1] ?? f.fit * 3) * 0.8 ? f.focus : null
					if (isl && isl.id !== lastRegion.current) {
						lastRegion.current = isl.id
						const top = ex.steps[ex.steps.length - 1]
						if (!(top?.kind === "title" && top.cell === isl.id)) ex.push({ kind: "region", label: isl.name, group: ex.map.group, cell: isl.id })
					}
					if (!isl && f.cam.s <= f.fit * 1.05) lastRegion.current = null
				}, 650)
			})
		})
		return () => {
			off()
			cancelAnimationFrame(raf)
			if (settleT) clearTimeout(settleT)
		}
	}, [eng, ex.steps, ex.map.group])

	// ------------------------------------------------------------ the card's reason and doors

	useEffect(() => {
		if (!act || !world) {
			setInfo(null)
			setDoors(null)
			return
		}
		let live = true
		setInfo(null)
		setDoors(null)
		const t = setTimeout(
			() => {
				const e = engRef.current
				const isl = e?.island(act.isl)
				if (!isl || !live) return
				ex.peekInfo(act.k).then((x) => live && setInfo(x))
				const ds = doorsOf(world, isl.cell).slice(0, 4)
				const key = `${ex.map.group}|${ex.filterKey}|${act.k}`
				let p = doorCache.current.get(key)
				if (!p) {
					p = api<DoorRes>("door", {
						k: act.k,
						to: ds.map((d) => `${d.cell.id}:${firstCount(d.cell.count)}`).join(","),
						shown: trail.current.join(","),
					})
					p.catch(() => doorCache.current.delete(key))
					doorCache.current.set(key, p)
				}
				p.then((r) => {
					if (!live) return
					setDoors(
						ds.map((d, j) => {
							const di = e?.island(d.cell.id)
							return { id: d.cell.id, name: d.cell.region.name, color: di ? `rgb(${di.tint.map((v) => Math.round(v * 255)).join(",")})` : d.cell.region.color, item: r.doors[j]?.item ?? null }
						}),
					)
				}).catch(() => live && setDoors([]))
			},
			act.pinned ? 0 : 260,
		)
		return () => {
			live = false
			clearTimeout(t)
		}
	}, [act?.k, act?.pinned, world])

	const stepToward = async (d: DoorCard) => {
		const e = engRef.current
		if (!e || !d.item) return
		const isl = e.island(d.id)
		if (!isl) return
		await treeOf(isl).catch(() => null)
		let i = isl.items.findIndex((x) => x.k === d.item?.k)
		if (i < 0) i = 0
		const it = isl.items[i]
		if (!it) return
		pin({ isl, it })
		e.flyToPoster(isl, i)
	}

	// ------------------------------------------------------------ history

	function apply(s: Step) {
		const e = engRef.current
		if (!e) return
		if (s.kind === "map" || s.kind === "group") {
			unpin()
			e.overview()
			return
		}
		const isl = s.cell ? e.island(s.cell) : null
		if (!isl) return
		if (s.kind === "region") {
			unpin()
			lastRegion.current = isl.id
			e.flyToIsland(isl)
			return
		}
		const k = s.title?.k
		void treeOf(isl)
			.catch(() => null)
			.then(() => {
				const i = isl.items.findIndex((x) => x.k === k)
				if (i < 0) return
				pin({ isl, it: isl.items[i] }, false)
				e.flyToPoster(isl, i)
			})
	}
	const jump = (s: Step) => {
		const step = ex.backTo(s.id)
		if (!step) return
		if (step.group !== ex.map.group) {
			pending.current = step
			unpin()
			ex.setGroupQuiet(step.group)
			return
		}
		apply(step)
	}

	// ------------------------------------------------------------ keyboard

	const keys = useRef({ pin, unpin, apply })
	keys.current = { pin, unpin, apply }
	useEffect(() => {
		const onKey = (ev: KeyboardEvent) => {
			const t = ev.target as HTMLElement
			if (t.closest?.("input, textarea, [contenteditable]")) return
			const e = engRef.current
			const el = stage.current
			if (!e || !el || !el.contains(document.activeElement)) return
			const a = actRef.current
			const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
			if (dirs[ev.key]) {
				ev.preventDefault()
				ev.stopPropagation()
				const cur = a ? e.find(a.k) : null
				if (cur) {
					const n = e.neighbor(cur, ...dirs[ev.key])
					if (n) {
						e.glideToPoster(n.isl, n.i)
						keys.current.pin(n)
						return
					}
				}
				const [dx, dy] = dirs[ev.key]
				e.panBy(dx * 200, dy * 200)
				return
			}
			if (ev.key === "+" || ev.key === "=") e.stepZoom(1)
			else if (ev.key === "-" || ev.key === "_") e.stepZoom(-1)
			else if (ev.key === "0") {
				keys.current.unpin()
				e.overview()
				ex.push({ kind: "map", label: `All by ${ex.groupName(ex.map.group).toLowerCase()}`, group: ex.map.group })
			} else if (ev.key === "Escape") {
				if (a) keys.current.unpin()
				else e.stepZoom(-1)
			} else if (ev.key === "Enter" && t === el) {
				const c = center()
				const d = (a && e.find(a.k)) || e.nearest(c.x, c.y, e.act() * 0.5, 1e9)
				if (d) keys.current.pin(d)
				else e.stepZoom(1)
			}
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [ex.map.group])

	// ------------------------------------------------------------ render

	const actIsl = act && eng ? eng.island(act.isl) : null
	const where = actIsl ? { name: actIsl.name, color: `rgb(${actIsl.tint.map((v) => Math.round(v * 255)).join(",")})` } : { name: "", color: "#888" }
	const card = act && actIsl && (
		<Card6
			key={act.k}
			ref={cardEl}
			ex={ex}
			it={act.it}
			where={where}
			info={info}
			doors={doors}
			pinned={act.pinned}
			peek={(cfg.activation === "peek" || form === "sheet") && !act.pinned}
			onPin={() => pin({ isl: actIsl, it: act.it })}
			onClose={unpin}
			onDoor={stepToward}
			form={form}
		/>
	)
	const history = <History6 steps={ex.steps} onPick={jump} />
	return (
		<div
			ref={stage}
			className="rx6-stage"
			tabIndex={-1}
			onPointerDown={(e) => {
				if (e.target === c2.current) stage.current?.focus({ preventScroll: true })
			}}
		>
			<canvas ref={glc} className="rx6-gl" aria-hidden />
			<canvas
				ref={c2}
				className="rx6-2d"
				role="img"
				aria-label={`Islands of ${ex.map.total.toLocaleString("en")} films and shows by ${ex.groupName(ex.map.group).toLowerCase()}`}
			/>
			<div className="rx6-layer">
				{caps.map((d) => (
					<Caption6
						key={d.it.k}
						ref={(el) => {
							if (el) capEls.current.set(d.it.k, el)
							else capEls.current.delete(d.it.k)
						}}
						it={d.it}
						onClick={() => pin(d)}
					/>
				))}
				{form === "float" && act && (
					<div ref={anchorEl} className="rx6-anchor" style={{ visibility: "hidden" }}>
						{card}
					</div>
				)}
				{form === "sheet" && card}
			</div>
			{form === "drawer" && (deep || act) && (
				<aside className="rx6-drawer" aria-label="Title nearest the middle">
					{card || <div className="rx6-drawer-empty">Move closer to an island's posters. The title nearest the middle shows up here.</div>}
				</aside>
			)}
			<TopBar ex={ex} history={history} />
			{ex.loading && <p className="rx6-loading">Laying the islands out by {ex.groupName(ex.group).toLowerCase()}…</p>}
			{!(small && act) && world && (
				<Minimap6
					eng={eng}
					world={world}
					onGo={(x, y) => {
						const e = engRef.current
						if (!e) return
						const v = e.view()
						e.flyTo({ x, y, s: Math.max(v.cam.s, (v.stops[1] ?? v.fit * 3) * 0.9) })
					}}
				/>
			)}
			{!(small && act) && (
				<Rail6
					eng={eng}
					onStop={(s) => {
						const e = engRef.current
						if (!e) return
						const v = e.view()
						if (s <= v.fit * 1.01) {
							unpin()
							e.overview()
							return
						}
						const c = center()
						const isl = v.focus
						if (isl && Math.abs(Math.log(s / (v.stops[1] ?? 0))) < 0.01) return e.flyToIsland(isl)
						e.flyTo({ x: v.cam.x + (c.x - v.cam.w / 2) / v.cam.s - (c.x - v.cam.w / 2) / s, y: v.cam.y + (c.y - v.cam.h / 2) / v.cam.s - (c.y - v.cam.h / 2) / s, s }, 600)
					}}
				/>
			)}
			{!act && <Where6 isl={focusIsl} />}
			{!touched && world && <p className="rx6-hint">{HINT[cfg.activation]}</p>}
			<Toast6 text={ex.toast} />
		</div>
	)
}
