// PROTOTYPE - throwaway. One round-7 variant (#180): round 6's `near` (the living islands map, a card that comes
// forward when the pointer is close to a poster, captions on the posters around it) with the poster presentation
// and lens of the variant (wire7.ts, Present) and, in two variants, a way to combine two islands (Combine).
// Round 4's page state (useExplorer4) is reused as is: grouping, filters, Want to See and Seen it, the reason, history.
import { useSearchParams } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type Cell, type World, doorsOf, layout } from "~/ui/prototype-rec-explorer-4/geo"
import type { Ex4, Step } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import type { PeekInfo4 } from "~/ui/prototype-rec-explorer-4/wire4"
import { Caption6, Card6, type DoorCard } from "~/ui/prototype-rec-explorer-6/Card6"
import { History6, Minimap6, Rail6, Toast6, Where6 } from "~/ui/prototype-rec-explorer-6/chrome6"
import type { Engine as Engine6 } from "~/ui/prototype-rec-explorer-6/map6"
import { rgbCss } from "~/ui/prototype-rec-explorer-6/surface6"
import { BlendMark, CombineBar, GlBadge, type Side, TopBar7 } from "./chrome7"
import { type Drawn, type Engine, type Hooks, type Isl, type Look, type Pad, makeEngine } from "./map7"
import { BRANCH, type BlendRes, type Config7, type DoorRes, type GlLevel, type TreeRes, type W, firstCount } from "./wire7"

type Act = { k: string; isl: string; it: W; pinned: boolean }
type Bridge = { id: string; a: string; b: string; count: number; kind: BlendRes["kind"] }

const HINT: Record<Config7["present"], string> = {
	lit: "Scroll or pinch to dive in. The light follows your pointer.",
	rise: "Scroll or pinch to dive in. Posters stand up as you come near.",
	tiles: "Scroll or pinch to dive in. Gold dots are your best matches.",
	frames: "Scroll or pinch to dive in. Titles come into focus as you come near.",
}
const HINT_COMBINE = {
	tap: "Tap Combine, then two islands, to see the titles they share.",
	drag: "Hold an island and drop it on another to see the titles they share.",
}

const side = (i: Isl): Side => ({ name: i.name, color: rgbCss(i.tint) })

export function Explorer7({ ex, cfg }: { ex: Ex4; cfg: Config7 }) {
	const [params] = useSearchParams()
	const glAsk = useMemo<GlLevel | null>(() => {
		if (process.env.NODE_ENV === "production") return null
		const v = params.get("gl")
		return v === "0" || v === "1" || v === "2" ? (Number(v) as GlLevel) : null
	}, [])
	const stage = useRef<HTMLDivElement>(null)
	const glc = useRef<HTMLCanvasElement>(null)
	const c2 = useRef<HTMLCanvasElement>(null)
	const engRef = useRef<Engine | null>(null)
	const [eng, setEng] = useState<Engine | null>(null)
	const [aspect, setAspect] = useState<number | null>(null)
	const [size, setSize] = useState({ w: 1440, h: 800 })
	const [padT, setPadT] = useState(150)
	const [act, setActState] = useState<Act | null>(null)
	const actRef = useRef<Act | null>(null)
	const [caps, setCaps] = useState<Drawn[]>([])
	const [info, setInfo] = useState<PeekInfo4 | null>(null)
	const [doors, setDoors] = useState<DoorCard[] | null>(null)
	const [focusIsl, setFocusIsl] = useState<Isl | null>(null)
	const [touched, setTouched] = useState(false)
	// Combining.
	const [combineOn, setCombineOnState] = useState(false)
	const combineRef = useRef(false)
	const [picks, setPicksState] = useState<string[]>([])
	const picksRef = useRef<string[]>([])
	const [bridge, setBridgeState] = useState<Bridge | null>(null)
	const bridgeRef = useRef<Bridge | null>(null)
	const [forming, setForming] = useState<{ a: string; b: string } | null>(null)
	const [lifted, setLifted] = useState<{ from: Isl; over: Isl | null } | null>(null)
	const [combined, setCombined] = useState(false)
	const cardEl = useRef<HTMLDivElement>(null)
	const anchorEl = useRef<HTMLDivElement>(null)
	const capEls = useRef(new Map<string, HTMLDivElement>())
	const trail = useRef<string[]>([])
	const pending = useRef<Step | null>(null)
	const small = size.w < 640
	const form: "float" | "sheet" = small ? "sheet" : "float"

	const setAct = useCallback((a: Act | null) => {
		actRef.current = a
		setActState(a)
	}, [])
	const setCombineOn = (v: boolean) => {
		combineRef.current = v
		setCombineOnState(v)
	}
	const setPicks = (v: string[]) => {
		picksRef.current = v
		setPicksState(v)
		engRef.current?.setPicks(v)
	}
	const setBridge = (b: Bridge | null) => {
		bridgeRef.current = b
		setBridgeState(b)
	}

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
			padRef.current = w >= 1024 ? { t: t + (cfg.combine ? 44 : 0), r: 72, b: 64, l: 24 } : { t: t + (cfg.combine ? 44 : 0), r: 12, b: w < 640 ? 150 : 90, l: 12 }
			setPadT(t)
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

	// ------------------------------------------------------------ data (round 5's API through round 7's, read-only)

	const base = useMemo(() => {
		const q = new URLSearchParams()
		for (const k of ["as", "country"]) {
			const v = params.get(k)
			if (v) q.set(k, v)
		}
		return q.toString()
	}, [params])
	const exRef = useRef(ex)
	exRef.current = ex
	const api = async <T,>(op: string, args: Record<string, string | number>) => {
		const x = exRef.current
		const q = new URLSearchParams(base)
		q.set("op", op)
		q.set("group", x.map.group)
		q.set("mine", x.filterKey[0])
		q.set("ns", x.filterKey[1])
		q.set("br", BRANCH.orbit.join(","))
		for (const [k, v] of Object.entries(args)) q.set(k, String(v))
		const r = await fetch(`/prototype/rec-explorer-7/api?${q}`)
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
	const blends = useRef(new Map<string, Promise<BlendRes>>())

	// ------------------------------------------------------------ combining

	const combine = async (A: Isl, B: Isl, push = true) => {
		const e = engRef.current
		if (!e || A.id === B.id) return
		setPicks([A.id, B.id])
		setForming({ a: A.id, b: B.id })
		unpin()
		const key = `${ex.map.group}|${ex.filterKey}|${[A.id, B.id].sort().join("+")}`
		let p = blends.current.get(key)
		if (!p) {
			p = api<BlendRes>("blend", { a: A.id, b: B.id })
			p.catch(() => blends.current.delete(key))
			blends.current.set(key, p)
		}
		const res = await p.catch(() => null)
		setForming(null)
		setPicks([])
		setCombineOn(false)
		if (engRef.current !== e || e.island(A.id) !== A || e.island(B.id) !== B) return
		if (!res || !res.items.length) {
			ex.say(`${A.name} and ${B.name} share no titles with these filters`)
			return
		}
		const name = `${A.name} + ${B.name}`
		const isl = e.addBridge(A, B, res, name)
		setBridge({ id: isl.id, a: A.id, b: B.id, count: res.count, kind: res.kind })
		setCombined(true)
		setTouched(true)
		if (push) ex.push({ kind: "region", label: name, group: ex.map.group, cell: isl.id })
	}
	const separate = () => {
		const e = engRef.current
		const b = bridgeRef.current
		if (!e || !b) return
		if (actRef.current?.isl === b.id) unpin()
		e.removeBridge()
		setBridge(null)
		const A = e.island(b.a)
		const B = e.island(b.b)
		if (A && B) e.frameBoth(A, B)
	}
	const pickIsland = (isl: Isl) => {
		setTouched(true)
		if (isl.bridge) return
		const cur = picksRef.current
		if (cur.includes(isl.id)) {
			setPicks(cur.filter((x) => x !== isl.id))
			return
		}
		const next = [...cur, isl.id].slice(-2)
		if (next.length === 2) {
			const e = engRef.current
			const A = e?.island(next[0])
			const B = e?.island(next[1])
			if (A && B) void combine(A, B)
			return
		}
		setPicks(next)
		if (cfg.combine === "tap" && !combineRef.current) setCombineOn(true)
	}
	// Other filters: the same two islands, recombined.
	useEffect(() => {
		const b = bridgeRef.current
		const e = engRef.current
		if (!b || !e) return
		const A = e.island(b.a)
		const B = e.island(b.b)
		if (A && B) void combine(A, B, false)
	}, [ex.filterKey])

	// ------------------------------------------------------------ activation (round 6's `near`)

	const pin = (d: { isl: Isl; it: W }, push = true) => {
		setAct({ k: d.it.k, isl: d.isl.id, it: d.it, pinned: true })
		trail.current = [...trail.current.filter((k) => k !== d.it.k), d.it.k].slice(-40)
		if (push) ex.push({ kind: "title", label: d.it.t, group: ex.map.group, cell: d.isl.id, title: d.it })
	}
	function unpin() {
		if (actRef.current) setAct(null)
	}
	const pendingAuto = useRef<{ k: string | null; t: number }>({ k: null, t: 0 })
	const lastCaps = useRef("")

	const compute = () => {
		const e = engRef.current
		if (!e) return
		const a = actRef.current
		const ACT = e.act()
		const { w, h } = e.size()
		const ptr = e.pointer()
		const c = center()
		let capList: Drawn[] = []
		if (!a?.pinned) {
			const byPtr = !!ptr && !small
			const pt = byPtr && ptr ? ptr : c
			const reach = byPtr ? 36 : Math.min(w, h) * 0.16
			let cand = e.nearest(pt.x, pt.y, ACT, reach)
			if (a && cand && cand.it.k !== a.k) {
				const cur = e.find(a.k)
				if (cur && cur.w >= ACT * 0.9) {
					const dc = Math.hypot(cur.cx - pt.x, cur.cy - pt.y)
					const dn = Math.hypot(cand.cx - pt.x, cand.cy - pt.y)
					if (dc < dn * 1.3 + 12) cand = cur
				}
			}
			if (!small) {
				capList = e
					.drawn()
					.filter((d) => d.w >= ACT * 0.6 && d.a > 0.9 && d.it.k !== cand?.it.k && Math.hypot(d.cx - pt.x, d.cy - pt.y) < ACT * 2.6)
					.sort((x, y) => Math.hypot(x.cx - pt.x, x.cy - pt.y) - Math.hypot(y.cx - pt.x, y.cy - pt.y))
					.slice(0, 4)
			}
			const k = cand?.it.k ?? null
			const now = performance.now()
			if (k !== (a?.k ?? null)) {
				if (pendingAuto.current.k !== k) pendingAuto.current = { k, t: now }
				const wait = k == null ? 160 : 90
				if (now - pendingAuto.current.t >= wait) setAct(cand ? { k: cand.it.k, isl: cand.isl.id, it: cand.it, pinned: false } : null)
				else setTimeout(() => engRef.current && compute(), wait + 5)
			} else pendingAuto.current = { k, t: now }
		}
		const ck = capList.map((d) => d.it.k).join(",")
		if (ck !== lastCaps.current) {
			lastCaps.current = ck
			setCaps(capList)
		}
		place()
	}

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
				let sideX = "0%"
				if (x + cw > w - p.r + 40) {
					x = d.cx - d.w * 0.56 - 22 - cw
					sideX = "100%"
				}
				if (x < 8) x = Math.min(w - cw - 8, Math.max(8, d.cx - cw / 2))
				const y = Math.min(h - chh - 12, Math.max(Math.min(p.t - 4, h - chh - 12), d.cy - chh * 0.36))
				el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
				box = { x, y, w: cw, h: chh }
				el.style.visibility = "visible"
				el.style.setProperty("--ox", sideX)
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
			const hit = box && x < box.x + box.w + 6 && x + cw > box.x - 6 && y < box.y + box.h + 6 && y + 28 > box.y - 6
			cel.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
			cel.style.visibility = hit || y > h - 40 ? "hidden" : "visible"
		}
	}
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
			const e = engRef.current
			if (!e) return
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
		onLongPress: (d) => pin(d),
		needTree: (isl) => {
			if (!isl.bridge) void treeOf(isl).catch(() => {})
		},
		onFrame: () => compute(),
		onPointer: () => compute(),
		combining: () => combineRef.current,
		onPickIsland: (isl) => pickIsland(isl),
		onCombine: (a, b) => {
			if (a.bridge || b.bridge) return
			void combine(a, b)
		},
		onLift: (isl, over) => {
			setTouched(true)
			setLifted(isl ? { from: isl, over: over && !over.bridge ? over : null } : null)
		},
	}
	useEffect(() => {
		const a = glc.current
		const b = c2.current
		if (!a || !b) return
		const e = makeEngine(a, b, cfg, glAsk, hooks)
		engRef.current = e
		setEng(e)
		const w = window as unknown as { __rx7?: unknown }
		w.__rx7 = {
			view: () => e.view(),
			drawn: () => e.drawn().map((d) => ({ k: d.it.k, t: d.it.t, x: d.x, y: d.y, w: d.w, h: d.h, gen: d.gen, isl: d.isl.id, near: d.t })),
			active: () => actRef.current && { k: actRef.current.k, t: actRef.current.it.t, pinned: actRef.current.pinned, isl: actRef.current.isl },
			frames: () => e.frames(),
			islands: () => e.islands().map((i) => ({ id: i.id, name: i.name, x: i.sx, y: i.sy, r: i.sr, on: i.on, loaded: i.loaded, bridge: i.bridge && { ...i.bridge }, dim: i.dim, pick: i.pick })),
			bridge: () => bridgeRef.current,
			picks: () => picksRef.current,
			lens: () => e.lens(),
			gl: () => e.glKind(),
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
		setPicks([])
		setBridge(null)
		setCombineOn(false)
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
				if (v.cam.s > v.fit * 1.25) setTouched(true)
				if (settleT) clearTimeout(settleT)
				settleT = setTimeout(() => {
					if (eng.busy()) return
					const f = eng.view()
					const isl = f.focus && f.cam.s >= (f.stops[1] ?? f.fit * 3) * 0.8 ? f.focus : null
					if (isl && isl.id !== lastRegion.current) {
						lastRegion.current = isl.id
						const top = ex.steps[ex.steps.length - 1]
						if (!(top?.kind === "title" && top.cell === isl.id) && !(top?.cell === isl.id)) ex.push({ kind: "region", label: isl.name, group: ex.map.group, cell: isl.id })
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
				// From a bridge, the doors lead back to the two islands it joins.
				const ds = isl.bridge
					? [isl.bridge.a, isl.bridge.b].map((id) => e?.island(id)).filter((x): x is Isl => !!x).map((x) => ({ cell: x.cell }))
					: doorsOf(world, isl.cell).slice(0, 4)
				const key = `${ex.map.group}|${ex.filterKey}|${act.k}|${isl.id}`
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
							return { id: d.cell.id, name: d.cell.region.name, color: di ? rgbCss(di.tint) : d.cell.region.color, item: r.doors[j]?.item ?? null }
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
		if (!isl && s.cell?.includes("+")) {
			// A bridge that was let go: raise it again.
			const cell = s.cell
			const [a, b] = cell.split("+")
			const A = e.island(a)
			const B = e.island(b)
			if (A && B)
				void combine(A, B, false).then(() => {
					if (s.kind === "title" && engRef.current?.island(cell)) apply(s)
				})
			return
		}
		if (!isl) return
		if (s.kind === "region") {
			unpin()
			lastRegion.current = isl.id
			e.flyToIsland(isl)
			return
		}
		const k = s.title?.k
		void (isl.bridge ? Promise.resolve(null) : treeOf(isl).catch(() => null)).then(() => {
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
				else if (picksRef.current.length || combineRef.current) {
					setPicks([])
					setCombineOn(false)
				} else e.stepZoom(-1)
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
	const where = actIsl ? { name: actIsl.name, color: rgbCss(actIsl.tint) } : { name: "", color: "#888" }
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
			peek={form === "sheet" && !act.pinned}
			onPin={() => pin({ isl: actIsl, it: act.it })}
			onClose={unpin}
			onDoor={stepToward}
			form={form}
		/>
	)
	const history = <History6 steps={ex.steps} onPick={jump} />
	const islOf = (id: string) => (eng ? eng.island(id) : null)
	let bar: Parameters<typeof CombineBar>[0]["state"] | null = null
	if (lifted) bar = { k: "lifting", from: side(lifted.from), over: lifted.over ? side(lifted.over) : null }
	else if (forming) {
		const A = islOf(forming.a)
		const B = islOf(forming.b)
		if (A && B) bar = { k: "forming", a: side(A), b: side(B) }
	} else if (combineOn || picks.length) bar = { k: "picking", picked: picks.map(islOf).filter((x): x is Isl => !!x).map(side) }
	else if (bridge) {
		const A = islOf(bridge.a)
		const B = islOf(bridge.b)
		if (A && B) bar = { k: "bridge", a: side(A), b: side(B), count: bridge.count, kind: bridge.kind }
	}
	const combineBtn =
		cfg.combine === "tap" ? (
			<button
				type="button"
				aria-pressed={combineOn}
				className={`rx7-comb ${combineOn ? "rx7-comb-on" : ""}`}
				onClick={() => {
					if (combineOn) {
						setCombineOn(false)
						setPicks([])
					} else {
						setCombineOn(true)
						unpin()
					}
				}}
			>
				<BlendMark />
				Combine
			</button>
		) : null
	const hint = cfg.combine && !combined ? HINT_COMBINE[cfg.combine] : HINT[cfg.present]
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
			<TopBar7 ex={ex} history={history} extra={combineBtn} />
			{bar && !(small && act) && (
				<CombineBar
					state={bar}
					top={padT}
					onCancel={() => {
						if (bar?.k === "bridge") separate()
						else {
							setPicks([])
							setCombineOn(false)
						}
					}}
					onGo={() => {
						const e = engRef.current
						const b = bridgeRef.current
						const isl = b && e?.island(b.id)
						if (e && isl) e.flyToIsland(isl)
					}}
				/>
			)}
			{ex.loading && <p className="rx6-loading">Laying the islands out by {ex.groupName(ex.group).toLowerCase()}…</p>}
			{!(small && act) && world && (
				<Minimap6
					eng={eng as unknown as Engine6}
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
					eng={eng as unknown as Engine6}
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
			{!act && !bar && <Where6 isl={focusIsl} />}
			{(!touched || (cfg.combine && !combined && !bar && !act)) && world && <p className="rx6-hint">{hint}</p>}
			{glAsk != null && <GlBadge kind={eng ? eng.glKind() : null} asked={glAsk} />}
			<Toast6 text={ex.toast} />
		</div>
	)
}
