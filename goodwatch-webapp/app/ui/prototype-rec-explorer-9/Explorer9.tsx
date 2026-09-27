// PROTOTYPE - throwaway. One round-9 variant (#180): round 8's page (Explorer8.tsx: round 7's `bridge` with `lit`
// posters, a page that never scrolls, combining built into the map's gestures) on round 9's focus layout (map9.ts):
// a bridge forms between the islands it joins and becomes the main thing on screen, the islands it joins are drawn
// in against it, and the rest shrink, move aside and go grey. While islands are being combined they're already in
// focus, so the map never jumps back to normal in between. Undo (Let go, Separate, Escape, history) springs the
// map back. Round 4's page state (useExplorer4) is reused as is. Data comes from round 8's read-only API.
import { useSearchParams } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	type Cell,
	type World,
	doorsOf,
	layout,
} from "~/ui/prototype-rec-explorer-4/geo"
import type { Ex4, Step } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import type { PeekInfo4 } from "~/ui/prototype-rec-explorer-4/wire4"
import {
	Caption6,
	Card6,
	type DoorCard,
} from "~/ui/prototype-rec-explorer-6/Card6"
import {
	History6,
	Rail6,
	Toast6,
	Where6,
} from "~/ui/prototype-rec-explorer-6/chrome6"
import type { Engine as Engine6 } from "~/ui/prototype-rec-explorer-6/map6"
import { rgbCss } from "~/ui/prototype-rec-explorer-6/surface6"
import {
	Bar8,
	type BarState,
	type Side,
	TopBar8,
	shared,
} from "~/ui/prototype-rec-explorer-8/chrome8"
import {
	BRANCH,
	type BlendRes,
	type Config8,
	type DoorRes,
	type GlLevel,
	type Pair,
	type PairsRes,
	type TreeRes,
	type W,
	firstCount,
	pairKey,
} from "~/ui/prototype-rec-explorer-8/wire8"
import { Minimap9 } from "./chrome9"
import {
	type Drawn,
	type Engine,
	type Ghost,
	type Hooks,
	type Isl,
	type Look,
	type Pad,
	makeEngine,
} from "./map9"

type Act = { k: string; isl: string; it: W; pinned: boolean }
type Bridge = {
	id: string
	of: string[]
	count: number
	kind: BlendRes["kind"]
}

/** The first thing to try, until combining has been used once. Touch and mouse differ where the gesture does. */
const HINT: Record<Config8["gesture"], { mouse: string; touch: string }> = {
	select: {
		mouse:
			"Click an island to light it up, then another to see the titles they share.",
		touch:
			"Tap an island to light it up, then another to see the titles they share.",
	},
	stretch: {
		mouse:
			"Click an island to go in. Drag from one island to another to combine them.",
		touch:
			"Tap an island to go in. Drag from one island to another to combine them.",
	},
	preview: {
		mouse: "Click an island to see how much it shares with every other island.",
		touch: "Tap an island to see how much it shares with every other island.",
	},
	gather: {
		mouse:
			"Click an island to go in. Push one island into another to combine them.",
		touch:
			"Tap an island to go in. Push one island into another, or pinch two together.",
	},
	neighbors: {
		mouse: "Go into an island to see which islands it pairs well with.",
		touch: "Go into an island to see which islands it pairs well with.",
	},
	triple: {
		mouse:
			"Click islands to light them up. Two make a bridge, and a third joins it.",
		touch:
			"Tap islands to light them up. Two make a bridge, and a third joins it.",
	},
}
/** Select-style variants: a tap lights an island instead of flying into it. */
const LIGHTS = new Set<Config8["gesture"]>(["select", "preview", "triple"])

const side = (i: Isl): Side => ({
	id: i.id,
	name: i.name,
	color: rgbCss(i.tint),
})

export function Explorer9({ ex, cfg }: { ex: Ex4; cfg: Config8 }) {
	const [params] = useSearchParams()
	const glAsk = useMemo<GlLevel | null>(() => {
		if (process.env.NODE_ENV === "production") return null
		const v = params.get("gl")
		return v === "0" || v === "1" || v === "2" ? (Number(v) as GlLevel) : null
	}, [])
	const lights = LIGHTS.has(cfg.gesture)
	const stage = useRef<HTMLDivElement>(null)
	const glc = useRef<HTMLCanvasElement>(null)
	const c2 = useRef<HTMLCanvasElement>(null)
	const engRef = useRef<Engine | null>(null)
	const [eng, setEng] = useState<Engine | null>(null)
	const [aspect, setAspect] = useState<number | null>(null)
	const [size, setSize] = useState({ w: 1440, h: 800 })
	const [barTop, setBarTop] = useState(80)
	const [act, setActState] = useState<Act | null>(null)
	const actRef = useRef<Act | null>(null)
	const [caps, setCaps] = useState<Drawn[]>([])
	const [info, setInfo] = useState<PeekInfo4 | null>(null)
	const [doors, setDoors] = useState<DoorCard[] | null>(null)
	const [focusIsl, setFocusIsl] = useState<Isl | null>(null)
	/** Zoomed in past the island to its titles. */
	const [deep, setDeep] = useState(false)
	const [touch, setTouch] = useState(false)
	// Combining.
	const [lit, setLitState] = useState<string[]>([])
	const litRef = useRef<string[]>([])
	const [bridge, setBridgeState] = useState<Bridge | null>(null)
	const bridgeRef = useRef<Bridge | null>(null)
	const [forming, setForming] = useState<string[] | null>(null)
	const [reachSt, setReachSt] = useState<{
		from: Isl
		over: Isl | null
	} | null>(null)
	const [hover, setHover] = useState<Isl | null>(null)
	const [combined, setCombined] = useState(false)
	const [pairs, setPairs] = useState<Record<string, Pair> | null>(null)
	const pairsRef = useRef<Record<string, Pair> | null>(null)
	const [ghostList, setGhostList] = useState<
		(Ghost & { label: string; sub: string; color: string; pv: boolean })[]
	>([])
	const cardEl = useRef<HTMLDivElement>(null)
	const anchorEl = useRef<HTMLDivElement>(null)
	const goEl = useRef<HTMLDivElement>(null)
	const capEls = useRef(new Map<string, HTMLDivElement>())
	const ghostEls = useRef(new Map<string, HTMLDivElement>())
	const trail = useRef<string[]>([])
	const pending = useRef<Step | null>(null)
	const small = size.w < 640
	const form: "float" | "sheet" = small ? "sheet" : "float"

	const setAct = useCallback((a: Act | null) => {
		actRef.current = a
		setActState(a)
	}, [])
	const setLit = (v: string[]) => {
		litRef.current = v
		setLitState(v)
		engRef.current?.setPicks(v)
	}
	const setBridge = (b: Bridge | null) => {
		bridgeRef.current = b
		setBridgeState(b)
	}
	useEffect(() => {
		setTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false)
	}, [])

	// ------------------------------------------------------------ layout of the screen

	const padRef = useRef<Pad>({ t: 150, r: 70, b: 70, l: 16 })
	useEffect(() => {
		const el = stage.current
		if (!el) return
		const measure = () => {
			const w = el.clientWidth
			const h = el.clientHeight
			const top = el.querySelector(".rx8-top") as HTMLElement | null
			const rows = top
				? [...top.querySelectorAll(".rx8-row")].filter(
						(r) => (r as HTMLElement).offsetHeight > 0,
					)
				: []
			const last = rows[rows.length - 1] as HTMLElement | undefined
			const t = last ? last.offsetTop + last.offsetHeight + 12 : 120
			// Phones: the combine bar gets its own row under the controls; wider screens: it sits in the second row.
			const bt =
				w < 768
					? t - 4
					: ((top?.querySelector(".rx8-row2") as HTMLElement | null)
							?.offsetTop ?? 70) - 3
			padRef.current =
				w >= 1024
					? { t: t + 8, r: 80, b: 72, l: 24 }
					: { t: t + (w < 768 ? 54 : 8), r: 12, b: w < 640 ? 150 : 120, l: 12 }
			setBarTop(bt)
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
		const top = el.querySelector(".rx8-top")
		if (top) ro.observe(top)
		return () => ro.disconnect()
	}, [])
	const world = useMemo<World | null>(
		() => (aspect ? layout("blobs", ex.map.regions, aspect) : null),
		[aspect, ex.map],
	)
	const center = () => {
		const p = padRef.current
		const e = engRef.current
		const { w, h } = e?.size() ?? size
		if (w < 640) {
			const a = actRef.current
			if (!a) return { x: w / 2, y: p.t + (h - p.t - p.b) * 0.5 }
			const top = a.pinned ? h - 60 - h * 0.5 : h - 60 - 176
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

	// ------------------------------------------------------------ data (round 7's API through round 8's, read-only)

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
		// Round 8's answers are all this round needs.
		const r = await fetch(`/prototype/rec-explorer-8/api?${q}`)
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
	// What every pair of islands shares, for previews and suggestions (one small answer per grouping and filters).
	useEffect(() => {
		let live = true
		setPairs(null)
		pairsRef.current = null
		api<PairsRes>("pairs", {})
			.then((r) => {
				if (!live) return
				pairsRef.current = r.pairs
				setPairs(r.pairs)
			})
			.catch(() => {})
		return () => {
			live = false
		}
	}, [ex.map.group, ex.filterKey])
	const pairOf = (a: string, b: string) =>
		pairsRef.current?.[pairKey([a, b])] ?? null

	// ------------------------------------------------------------ combining

	const combine = async (list: Isl[], push = true) => {
		const e = engRef.current
		const ids = list.map((i) => i.id)
		if (
			!e ||
			new Set(ids).size !== ids.length ||
			list.length < 2 ||
			list.some((i) => i.bridge)
		)
			return
		setLit([])
		// In focus while their bridge is found, so the map doesn't fall back to normal in between.
		e.setPicks(ids)
		setForming(ids)
		unpin()
		const key = `${ex.map.group}|${ex.filterKey}|${pairKey(ids)}`
		let p = blends.current.get(key)
		if (!p) {
			p = api<BlendRes>("blend", { ids: ids.join(",") })
			p.catch(() => blends.current.delete(key))
			blends.current.set(key, p)
		}
		const res = await p.catch(() => null)
		setForming(null)
		if (engRef.current !== e || list.some((i) => e.island(i.id) !== i)) return
		if (!res || !res.items.length) {
			e.setPicks(litRef.current)
			ex.say(
				`${list.map((i) => i.name).join(" and ")} share no titles with these filters`,
			)
			return
		}
		const name = list.map((i) => i.name).join(" + ")
		const isl = e.addBridge(list, res, name)
		e.setPicks(litRef.current)
		setBridge({ id: isl.id, of: ids, count: res.count, kind: res.kind })
		setCombined(true)
		if (push)
			ex.push({
				kind: "region",
				label: name,
				group: ex.map.group,
				cell: isl.id,
			})
	}
	const separate = (keepLit: string[] = []) => {
		const e = engRef.current
		const b = bridgeRef.current
		if (!e || !b) return
		if (actRef.current?.isl === b.id) unpin()
		e.removeBridge()
		setBridge(null)
		setLit(keepLit)
		// A step of its own, so Back raises the bridge again.
		ex.push({
			kind: "map",
			label: `All by ${ex.groupName(ex.map.group).toLowerCase()}`,
			group: ex.map.group,
		})
		// Back out to the whole map as it springs back.
		e.overview()
	}
	/** Let a bridge go without a step of its own (history, or going into an island out of its focus). */
	const dropBridge = () => {
		const e = engRef.current
		if (!e || !bridgeRef.current) return
		if (actRef.current?.isl === bridgeRef.current.id) unpin()
		e.removeBridge()
		setBridge(null)
	}
	const flyIn = (isl: Isl) => {
		unpin()
		// Going into an island out of the bridge's focus lets the bridge go (Back raises it again).
		const b = bridgeRef.current
		if (b && isl.id !== b.id && !b.of.includes(isl.id)) dropBridge()
		setLit([])
		engRef.current?.flyToIsland(isl)
		ex.push({
			kind: "region",
			label: isl.name,
			group: ex.map.group,
			cell: isl.id,
		})
	}
	/** A tap on an island in the select-style variants. */
	const tapLight = (isl: Isl) => {
		const e = engRef.current
		if (!e) return
		const b = bridgeRef.current
		const cur = litRef.current
		// An island in the bridge: take it out (a triple becomes a pair; a pair lets go, the other stays lit).
		if (b?.of.includes(isl.id)) {
			const rest = b.of.filter((x) => x !== isl.id)
			if (rest.length >= 2) {
				const list = rest.map((id) => e.island(id)).filter((x): x is Isl => !!x)
				e.removeBridge()
				setBridge(null)
				void combine(list)
			} else separate(rest)
			return
		}
		if (cur.includes(isl.id)) {
			setLit(cur.filter((x) => x !== isl.id))
			return
		}
		// A third island joins a standing pair.
		if (cfg.gesture === "triple" && b && b.of.length === 2 && !cur.length) {
			const list = [...b.of.map((id) => e.island(id)), isl].filter(
				(x): x is Isl => !!x,
			)
			void combine(list)
			return
		}
		const next = [...cur, isl.id]
		if (next.length >= 2) {
			const list = next
				.slice(-2)
				.map((id) => e.island(id))
				.filter((x): x is Isl => !!x)
			void combine(list)
			return
		}
		setLit(next)
	}

	// Ghosts: the preview of a bridge before it's made, and the suggested bridges out of an island.
	const neighborsOf = (isl: Isl, n: number) => {
		const e = engRef.current
		const ps = pairsRef.current
		if (!e || !ps) return []
		return e
			.islands()
			.filter((o) => o !== isl && !o.bridge)
			.map((o) => ({ o, p: ps[pairKey([isl.id, o.id])] }))
			.filter((x) => x.p && (x.p.kind === "between" || x.p.c >= 12))
			.sort((a, b) => b.p.s - a.p.s)
			.slice(0, n)
	}
	useEffect(() => {
		const e = engRef.current
		if (!e) return
		const out: (Ghost & {
			label: string
			sub: string
			color: string
			pv: boolean
		})[] = []
		const litIsl = lit.length === 1 ? e.island(lit[0]) : null
		const preview = (A: Isl, B: Isl, hot = 1) => {
			const p = pairOf(A.id, B.id)
			out.push({
				key: `pv|${A.id}|${B.id}`,
				from: A.id,
				to: B.id,
				island: true,
				hot,
				label: `${A.name} + ${B.name}`,
				sub: p ? shared(p.c, p.kind) : "",
				color: rgbCss(B.tint),
				pv: true,
			})
		}
		if (reachSt?.over && !forming && cfg.gesture === "stretch")
			preview(reachSt.from, reachSt.over)
		else if (
			cfg.gesture === "preview" &&
			litIsl &&
			hover &&
			hover !== litIsl &&
			!hover.bridge &&
			!forming
		)
			preview(litIsl, hover)
		else if (
			cfg.gesture === "neighbors" &&
			focusIsl &&
			!deep &&
			!focusIsl.bridge &&
			!bridge &&
			!forming &&
			!act?.pinned
		) {
			for (const { o, p } of neighborsOf(focusIsl, 3))
				out.push({
					key: `nb|${focusIsl.id}|${o.id}`,
					from: focusIsl.id,
					to: o.id,
					island: false,
					hot: 0,
					label: o.name,
					sub:
						p.kind === "both"
							? `${p.c.toLocaleString("en")} in both`
							: "close by",
					color: rgbCss(o.tint),
					pv: false,
				})
		}
		e.setGhosts(out)
		setGhostList(out)
	}, [
		reachSt,
		hover,
		lit,
		focusIsl,
		deep,
		bridge,
		forming,
		pairs,
		eng,
		act?.pinned,
	])
	// preview: a lit island's count on every other island.
	useEffect(() => {
		const e = engRef.current
		if (!e || cfg.gesture !== "preview") return
		const m = new Map<string, string>()
		if (lit.length === 1 && pairs)
			for (const o of e.islands()) {
				if (o.id === lit[0] || o.bridge) continue
				const p = pairOf(lit[0], o.id)
				if (p)
					m.set(
						o.id,
						p.kind === "both"
							? `${p.c.toLocaleString("en")} in both`
							: `${p.c.toLocaleString("en")} in between`,
					)
			}
		e.setNotes(m)
	}, [lit, pairs, eng])

	// ------------------------------------------------------------ activation (round 6's `near`)

	const pin = (d: { isl: Isl; it: W }, push = true) => {
		setAct({ k: d.it.k, isl: d.isl.id, it: d.it, pinned: true })
		trail.current = [
			...trail.current.filter((k) => k !== d.it.k),
			d.it.k,
		].slice(-40)
		if (push)
			ex.push({
				kind: "title",
				label: d.it.t,
				group: ex.map.group,
				cell: d.isl.id,
				title: d.it,
			})
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
		if (!a?.pinned && !e.reaching()) {
			const byPtr = !!ptr && !small
			const pt = byPtr && ptr ? ptr : c
			const reach = byPtr ? 36 : Math.min(w, h) * 0.16
			let cand = e.nearest(pt.x, pt.y, ACT, reach)
			if (a && cand && cand.it.k !== a.k) {
				const cur = e.find(a.k, a.isl)
				if (cur && cur.w >= ACT * 0.9) {
					const dc = Math.hypot(cur.cx - pt.x, cur.cy - pt.y)
					const dn = Math.hypot(cand.cx - pt.x, cand.cy - pt.y)
					if (dc < dn * 1.3 + 12) cand = cur
				}
			}
			if (!small) {
				capList = e
					.drawn()
					// Out at the map, a bridge's posters are smaller than inside an island, and still get their captions.
					.filter(
						(d) =>
							d.w >= Math.min(ACT * 0.6, 52) &&
							d.a > 0.9 &&
							d.it.k !== cand?.it.k &&
							Math.hypot(d.cx - pt.x, d.cy - pt.y) < ACT * 2.6,
					)
					.sort(
						(x, y) =>
							Math.hypot(x.cx - pt.x, x.cy - pt.y) -
							Math.hypot(y.cx - pt.x, y.cy - pt.y),
					)
					.slice(0, 4)
			}
			const k = cand?.it.k ?? null
			const now = performance.now()
			if (k !== (a?.k ?? null)) {
				if (pendingAuto.current.k !== k) pendingAuto.current = { k, t: now }
				const wait = k == null ? 160 : 90
				if (now - pendingAuto.current.t >= wait)
					setAct(
						cand
							? { k: cand.it.k, isl: cand.isl.id, it: cand.it, pinned: false }
							: null,
					)
				else setTimeout(() => engRef.current && compute(), wait + 5)
			} else pendingAuto.current = { k, t: now }
		}
		const ck = capList.map((d) => `${d.isl.id}|${d.it.k}`).join(",")
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
			const d = e.find(a.k, a.isl)
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
				const y = Math.min(
					h - chh - 12,
					Math.max(Math.min(p.t - 4, h - chh - 12), d.cy - chh * 0.36),
				)
				el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
				box = { x, y, w: cw, h: chh }
				el.style.visibility = "visible"
				el.style.setProperty("--ox", sideX)
			} else if (!a.pinned) el.style.visibility = "hidden"
		}
		// Captions, keyed by island and title (a title can be on a bridge and on an island it joins); one that would
		// sit on another caption or the card stays hidden.
		const capBoxes: { x: number; y: number; w: number; h: number }[] = box
			? [box]
			: []
		for (const [key, cel] of capEls.current) {
			const [isl, k] = key.split("\n")
			const d = e.find(k, isl)
			if (!d) {
				cel.style.visibility = "hidden"
				continue
			}
			const cw = cel.offsetWidth || 120
			const ch = cel.offsetHeight || 28
			const x = Math.min(w - cw - 8, Math.max(8, d.cx - cw / 2))
			const y = d.y + d.h + 8
			const hit = capBoxes.some(
				(r) =>
					x < r.x + r.w + 6 &&
					x + cw > r.x - 6 &&
					y < r.y + r.h + 4 &&
					y + ch > r.y - 4,
			)
			cel.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
			cel.style.visibility = hit || y > h - 40 ? "hidden" : "visible"
			if (!hit) capBoxes.push({ x, y, w: cw, h: ch })
		}
		// "Go in" on a lit island: inside it, low, when it fits; otherwise next to it, wherever it covers the least of
		// the other islands (on a phone the lit island is small and its neighbors are close).
		const go = goEl.current
		const gi = litRef.current.length === 1 ? e.island(litRef.current[0]) : null
		if (go && gi) {
			const gw = go.offsetWidth || 110
			const gh = go.offsetHeight || 40
			const p = padRef.current
			const inside = {
				x: gi.sx - gw / 2,
				y: gi.sy + Math.max(34, Math.min(gi.sr * 0.55, 70)),
			}
			const cands =
				gw < gi.sr * 1.3 && gh < gi.sr * 0.6
					? [inside]
					: [
							{ x: gi.sx - gw / 2, y: gi.sy + gi.sr + 10 },
							{ x: gi.sx + gi.sr + 10, y: gi.sy - gh / 2 },
							{ x: gi.sx - gi.sr - 10 - gw, y: gi.sy - gh / 2 },
							{ x: gi.sx - gw / 2, y: gi.sy - gi.sr - 10 - gh },
						]
			const others = e
				.islands()
				.filter((o) => o !== gi && o.on && !(o.bridge && o.bridge.to === 0))
			let best = cands[0]
			let bv = Number.POSITIVE_INFINITY
			for (const c of cands) {
				const x = clampN(c.x, 8, w - gw - 8)
				const y = clampN(c.y, p.t, h - gh - Math.max(12, p.b - 40))
				// How much of other islands it covers, and how far it had to be pushed back on screen.
				let v = Math.abs(x - c.x) + Math.abs(y - c.y)
				for (const o of others) {
					const dx = Math.max(0, Math.abs(o.sx - (x + gw / 2)) - gw / 2)
					const dy = Math.max(0, Math.abs(o.sy - (y + gh / 2)) - gh / 2)
					const into = o.sr - Math.hypot(dx, dy)
					if (into > 0) v += into * 4
				}
				if (v < bv) {
					bv = v
					best = { x, y }
				}
			}
			go.style.transform = `translate3d(${Math.round(best.x)}px,${Math.round(best.y)}px,0)`
			go.style.visibility = gi.on ? "visible" : "hidden"
		}
		// Labels of the bridges that aren't there yet, nudged apart where two would overlap.
		const at = new Map(e.ghostAnchors().map((g) => [g.key, g]))
		const taken: { x: number; y: number; w: number; h: number }[] = []
		for (const [k, gel] of ghostEls.current) {
			const g = at.get(k)
			if (!g) {
				gel.style.visibility = "hidden"
				continue
			}
			const gw = gel.offsetWidth || 160
			const gh = gel.offsetHeight || 42
			const p = padRef.current
			const x = clampN(
				g.x - gw / 2,
				Math.max(8, p.l),
				w - gw - Math.max(8, p.r),
			)
			let y = clampN(g.y - gh / 2, p.t, h - gh - Math.max(8, p.b - 20))
			for (const r of taken)
				if (
					x < r.x + r.w + 6 &&
					x + gw + 6 > r.x &&
					y < r.y + r.h + 6 &&
					y + gh + 6 > r.y
				)
					y = r.y + r.h + 8
			taken.push({ x, y, w: gw, h: gh })
			gel.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
			gel.style.visibility = "visible"
		}
	}
	const placeRef = useRef(place)
	placeRef.current = place
	useEffect(() => {
		placeRef.current()
		engRef.current?.invalidate()
	}, [act, caps, lit, ghostList])

	// ------------------------------------------------------------ the engine

	const hooks = useRef<Hooks>(null as unknown as Hooks)
	hooks.current = {
		pass: ex.pass,
		pad: () => padRef.current,
		center,
		active: () =>
			actRef.current
				? {
						k: actRef.current.k,
						pinned: actRef.current.pinned,
						isl: actRef.current.isl,
					}
				: null,
		card: () =>
			form === "sheet"
				? null
				: (cardEl.current?.getBoundingClientRect() ?? null),
		onTapPoster: (d) => {
			stage.current?.focus({ preventScroll: true })
			const a = actRef.current
			if (a?.pinned && a.k === d.it.k) return
			pin(d)
			const e = engRef.current
			if (!e) return
			const p = padRef.current
			const { w, h } = e.size()
			const out =
				d.x < p.l ||
				d.y < p.t - 20 ||
				d.x + d.w > w - p.r ||
				d.y + d.h > h - Math.min(p.b, 40)
			if (d.w < e.act() || out || w < 640) e.glideToPoster(d.isl, d.i)
		},
		onTapIsland: (isl) => {
			stage.current?.focus({ preventScroll: true })
			if (lights && !isl.bridge) {
				unpin()
				tapLight(isl)
				return
			}
			flyIn(isl)
		},
		onDoubleTapIsland: (isl) => flyIn(isl),
		onTapWater: () => {
			stage.current?.focus({ preventScroll: true })
			if (actRef.current?.pinned) unpin()
			else if (litRef.current.length) setLit([])
		},
		onLongPress: (d) => pin(d),
		needTree: (isl) => {
			if (!isl.bridge) void treeOf(isl).catch(() => {})
		},
		onFrame: () => compute(),
		onPointer: () => compute(),
		onCombine: (list) => {
			if (list.some((i) => i.bridge)) return
			void combine(list)
		},
		onReach: (from, over) => {
			setReachSt(from ? { from, over } : null)
			if (from) unpin()
		},
		onHoverIsland: (isl) => setHover(isl),
		pairOf: (a, b) => pairOf(a, b),
	}
	useEffect(() => {
		const a = glc.current
		const b = c2.current
		if (!a || !b) return
		const e = makeEngine(a, b, cfg, glAsk, hooks)
		engRef.current = e
		setEng(e)
		const w = window as unknown as { __rx9?: unknown }
		w.__rx9 = {
			view: () => e.view(),
			drawn: () =>
				e.drawn().map((d) => ({
					k: d.it.k,
					t: d.it.t,
					x: d.x,
					y: d.y,
					w: d.w,
					h: d.h,
					gen: d.gen,
					isl: d.isl.id,
					near: d.t,
				})),
			active: () =>
				actRef.current && {
					k: actRef.current.k,
					t: actRef.current.it.t,
					pinned: actRef.current.pinned,
					isl: actRef.current.isl,
				},
			frames: () => e.frames(),
			islands: () =>
				e.islands().map((i) => ({
					id: i.id,
					name: i.name,
					x: i.sx,
					y: i.sy,
					r: i.sr,
					on: i.on,
					loaded: i.loaded,
					bridge: i.bridge && { ...i.bridge },
					role: i.role,
					f: i.f,
					tf: i.tf,
					mute: i.mute,
					vivid: i.vivid,
					pick: i.pick,
					wx: i.wx,
					wy: i.wy,
					wr: i.wr,
					tx: i.cell.cx + i.tx,
					ty: i.cell.cy + i.ty,
					dx: i.dx,
					dy: i.dy,
					moving: i.f !== i.tf || i.lx !== i.tx || i.ly !== i.ty,
				})),
			bridge: () => bridgeRef.current,
			lit: () => litRef.current,
			ghosts: () => e.ghostAnchors(),
			pairs: () => pairsRef.current,
			gl: () => e.glKind(),
			busy: () => e.busy(),
		}
		return () => {
			e.destroy()
			engRef.current = null
		}
	}, [])
	const worldGroup = useRef<string | null>(null)
	useEffect(() => {
		if (!eng || !world) return
		// Other filters, same grouping: the same bridge rises again over the new islands.
		const keep =
			worldGroup.current === ex.map.group ? bridgeRef.current?.of : null
		worldGroup.current = ex.map.group
		eng.setWorld(world, lookOf, `${ex.map.group}|${ex.filterKey}`)
		setAct(null)
		setLit([])
		setBridge(null)
		if (keep) {
			const list = keep.map((id) => eng.island(id)).filter((x): x is Isl => !!x)
			if (list.length === keep.length)
				setTimeout(() => void combine(list, false), 60)
		}
		setHover(null)
		setReachSt(null)
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
				const inIsl =
					v.focus && v.cam.s >= (v.stops[1] ?? v.fit * 3) * 0.8 ? v.focus : null
				setFocusIsl((x) => (x === inIsl ? x : inIsl))
				const d =
					!!inIsl && v.cam.s >= (v.stops[2] ?? Number.POSITIVE_INFINITY) * 0.85
				setDeep((x) => (x === d ? x : d))
				if (settleT) clearTimeout(settleT)
				settleT = setTimeout(() => {
					if (eng.busy()) return
					const f = eng.view()
					const isl =
						f.focus && f.cam.s >= (f.stops[1] ?? f.fit * 3) * 0.8
							? f.focus
							: null
					if (isl && isl.id !== lastRegion.current) {
						lastRegion.current = isl.id
						const top = ex.steps[ex.steps.length - 1]
						if (
							!(top?.kind === "title" && top.cell === isl.id) &&
							!(top?.cell === isl.id)
						)
							ex.push({
								kind: "region",
								label: isl.name,
								group: ex.map.group,
								cell: isl.id,
							})
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
	// Going into an island lets its light go (the "Go in" button's job is done).
	useEffect(() => {
		if (focusIsl && litRef.current.length) setLit([])
	}, [focusIsl])

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
				// From a bridge, the doors lead back to the islands it joins.
				const ds = isl.bridge
					? isl.bridge.of
							.map((id) => e?.island(id))
							.filter((x): x is Isl => !!x)
							.map((x) => ({ cell: x.cell }))
					: doorsOf(world, isl.cell).slice(0, 4)
				const key = `${ex.map.group}|${ex.filterKey}|${act.k}|${isl.id}`
				let p = doorCache.current.get(key)
				if (!p) {
					p = api<DoorRes>("door", {
						k: act.k,
						to: ds
							.map((d) => `${d.cell.id}:${firstCount(d.cell.count)}`)
							.join(","),
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
							return {
								id: d.cell.id,
								name: d.cell.region.name,
								color: di ? rgbCss(di.tint) : d.cell.region.color,
								item: r.doors[j]?.item ?? null,
							}
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
			dropBridge()
			setLit([])
			e.overview()
			return
		}
		// A step somewhere out of the bridge's focus: the map springs back first.
		const b = bridgeRef.current
		if (b && s.cell && s.cell !== b.id && !b.of.includes(s.cell)) {
			dropBridge()
			setLit([])
		}
		const isl = s.cell ? e.island(s.cell) : null
		if (!isl && s.cell?.includes("+")) {
			// A bridge that was let go: raise it again.
			const cell = s.cell
			const list = cell
				.split("+")
				.map((id) => e.island(id))
				.filter((x): x is Isl => !!x)
			if (list.length === cell.split("+").length)
				void combine(list, false).then(() => {
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
		void (
			isl.bridge ? Promise.resolve(null) : treeOf(isl).catch(() => null)
		).then(() => {
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

	const keys = useRef({ pin, unpin, apply, separate, flyIn })
	keys.current = { pin, unpin, apply, separate, flyIn }
	useEffect(() => {
		const onKey = (ev: KeyboardEvent) => {
			const t = ev.target as HTMLElement
			if (t.closest?.("input, textarea, select, [contenteditable]")) return
			const e = engRef.current
			const el = stage.current
			if (!e || !el || !el.contains(document.activeElement)) return
			const a = actRef.current
			const dirs: Record<string, [number, number]> = {
				ArrowLeft: [-1, 0],
				ArrowRight: [1, 0],
				ArrowUp: [0, -1],
				ArrowDown: [0, 1],
			}
			if (dirs[ev.key]) {
				ev.preventDefault()
				ev.stopPropagation()
				const cur = a ? e.find(a.k, a.isl) : null
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
				ex.push({
					kind: "map",
					label: `All by ${ex.groupName(ex.map.group).toLowerCase()}`,
					group: ex.map.group,
				})
			} else if (ev.key === "Escape") {
				// Undo, one layer at a time: the card, the lit island, the bridge, then a step out.
				if (a) keys.current.unpin()
				else if (litRef.current.length) setLit([])
				else if (bridgeRef.current) keys.current.separate()
				else e.stepZoom(-1)
			} else if (ev.key === "Enter" && t === el) {
				const li =
					litRef.current.length === 1 ? e.island(litRef.current[0]) : null
				if (li) return keys.current.flyIn(li)
				const c = center()
				const d =
					(a && e.find(a.k, a.isl)) || e.nearest(c.x, c.y, e.act() * 0.5, 1e9)
				if (d) keys.current.pin(d)
				else e.stepZoom(1)
			}
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [ex.map.group])

	// ------------------------------------------------------------ render

	const actIsl = act && eng ? eng.island(act.isl) : null
	const where = actIsl
		? { name: actIsl.name, color: rgbCss(actIsl.tint) }
		: { name: "", color: "#888" }
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
	const sides = (ids: string[]) =>
		ids
			.map(islOf)
			.filter((x): x is Isl => !!x)
			.map(side)
	const litIsl = lit.length === 1 ? islOf(lit[0]) : null
	let bar: BarState | null = null
	if (reachSt) {
		const p = reachSt.over ? pairOf(reachSt.from.id, reachSt.over.id) : null
		bar = {
			k: "reach",
			from: side(reachSt.from),
			over: reachSt.over ? side(reachSt.over) : null,
			count: p?.c ?? null,
			kind: p?.kind ?? null,
			push: cfg.gesture === "gather",
		}
	} else if (forming) bar = { k: "forming", list: sides(forming) }
	else if (litIsl)
		bar = {
			k: "lit",
			lit: side(litIsl),
			next:
				bridge && cfg.gesture !== "triple"
					? "and which other island?"
					: cfg.gesture === "preview"
						? touch
							? "tap another island to combine"
							: "point at another island, click to combine"
						: touch
							? "tap another island to combine"
							: "click another island to combine",
		}
	else if (bridge) {
		const list = sides(bridge.of)
		if (list.length === bridge.of.length)
			bar = {
				k: "bridge",
				list,
				count: bridge.count,
				kind: bridge.kind,
				more:
					cfg.gesture === "triple" && list.length === 2 && !focusIsl
						? `${touch ? "Tap" : "Click"} a third island to add it`
						: null,
			}
	}
	const hint = HINT[cfg.gesture][touch ? "touch" : "mouse"]
	const showHint =
		!combined &&
		!bar &&
		!act &&
		world &&
		!(cfg.gesture === "neighbors" && focusIsl)
	return (
		<div
			ref={stage}
			className="rx6-stage rx8-stage rx9-stage"
			data-bar={bar ? "" : undefined}
			tabIndex={-1}
			onPointerDown={(e) => {
				if (e.target === c2.current)
					stage.current?.focus({ preventScroll: true })
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
						key={`${d.isl.id}\n${d.it.k}`}
						ref={(el) => {
							if (el) capEls.current.set(`${d.isl.id}\n${d.it.k}`, el)
							else capEls.current.delete(`${d.isl.id}\n${d.it.k}`)
						}}
						it={d.it}
						onClick={() => pin(d)}
					/>
				))}
				{ghostList.map((g) => (
					<div
						key={g.key}
						className="rx8-on"
						style={{ visibility: "hidden" }}
						ref={(el) => {
							if (el) ghostEls.current.set(g.key, el)
							else ghostEls.current.delete(g.key)
						}}
					>
						{g.pv ? (
							<div
								className="rx8-ghost rx8-ghost-pv"
								style={{ "--c": g.color } as React.CSSProperties}
							>
								<b>{g.label}</b>
								{g.sub && <span>{g.sub}</span>}
							</div>
						) : (
							<button
								type="button"
								className="rx8-ghost"
								style={{ "--c": g.color } as React.CSSProperties}
								onPointerEnter={() =>
									engRef.current?.setGhosts(
										ghostList.map((x) => ({
											...x,
											hot: x.key === g.key ? 1 : 0,
										})),
									)
								}
								onPointerLeave={() => engRef.current?.setGhosts(ghostList)}
								onClick={() => {
									const e = engRef.current
									const A = e?.island(g.from)
									const B = e?.island(g.to)
									if (A && B) void combine([A, B])
								}}
							>
								<span className="rx8-ghost-plus" aria-hidden>
									+
								</span>
								<b>{g.label}</b>
								<span className="rx8-ghost-n">{g.sub}</span>
							</button>
						)}
					</div>
				))}
				{litIsl && !forming && (
					<div ref={goEl} className="rx8-on" style={{ visibility: "hidden" }}>
						<button
							type="button"
							className="rx8-goin"
							style={{ "--c": rgbCss(litIsl.tint, 0.6) } as React.CSSProperties}
							onClick={() => flyIn(litIsl)}
						>
							Go in
							<svg viewBox="0 0 14 14" aria-hidden="true">
								<path
									d="M3 7h8M7.5 3.5L11 7l-3.5 3.5"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.9"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</button>
					</div>
				)}
				{form === "float" && act && (
					<div
						ref={anchorEl}
						className="rx6-anchor"
						style={{ visibility: "hidden" }}
					>
						{card}
					</div>
				)}
				{form === "sheet" && card}
			</div>
			<TopBar8 ex={ex} history={history} />
			{bar && !(small && act?.pinned) && (
				<div
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						top: barTop,
						zIndex: 31,
						pointerEvents: "none",
					}}
				>
					<div style={{ pointerEvents: "auto" }}>
						<Bar8
							state={bar}
							onUndo={() => {
								if (bar?.k === "bridge") separate()
								else setLit([])
							}}
							onGo={() => {
								const e = engRef.current
								if (bar?.k === "lit" && litIsl) return flyIn(litIsl)
								const b = bridgeRef.current
								const isl = b && e?.island(b.id)
								if (e && isl) e.flyToIsland(isl)
							}}
						/>
					</div>
				</div>
			)}
			{ex.loading && (
				<p className="rx6-loading">
					Laying the islands out by {ex.groupName(ex.group).toLowerCase()}…
				</p>
			)}
			{!(small && act) && world && (
				<Minimap9
					eng={eng}
					world={world}
					onGo={(x, y) => {
						const e = engRef.current
						if (!e) return
						const v = e.view()
						e.flyTo({
							x,
							y,
							s: Math.max(v.cam.s, (v.stops[1] ?? v.fit * 3) * 0.9),
						})
					}}
				/>
			)}
			{!(small && act?.pinned) && (
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
						if (isl && Math.abs(Math.log(s / (v.stops[1] ?? 0))) < 0.01)
							return e.flyToIsland(isl)
						e.flyTo(
							{
								x:
									v.cam.x +
									(c.x - v.cam.w / 2) / v.cam.s -
									(c.x - v.cam.w / 2) / s,
								y:
									v.cam.y +
									(c.y - v.cam.h / 2) / v.cam.s -
									(c.y - v.cam.h / 2) / s,
								s,
							},
							600,
						)
					}}
				/>
			)}
			{!act && !bar && !ghostList.length && <Where6 isl={focusIsl} />}
			{showHint && <p className="rx6-hint">{hint}</p>}
			{glAsk != null && (
				<GlBadge kind={eng ? eng.glKind() : null} asked={glAsk} />
			)}
			<Toast6 text={ex.toast} />
		</div>
	)
}

const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

const GL_NAME: Record<GlLevel, string> = {
	2: "WebGL 2",
	1: "WebGL 1",
	0: "Canvas 2D",
}
/** Development only, with ?gl=: which renderer draws the sea. */
function GlBadge({ kind, asked }: { kind: GlLevel | null; asked: GlLevel }) {
	if (kind == null) return null
	return (
		<p className="rx8-gl">
			Sea drawn with {GL_NAME[kind]}
			{kind !== asked ? ` (${GL_NAME[asked]} unavailable)` : ""}
		</p>
	)
}
