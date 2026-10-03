import { useLocation, useSearchParams } from "@remix-run/react"
import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query"
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	type BridgeKind,
	DEFAULT_GROUPING,
	type ExplorerPair,
	type ExplorerTitle,
	GROUPING_NAMES,
	type ExplorerMap as MapData,
	isGrouping,
} from "~/domain/explorer"
import {
	isAllTitleTypes,
	parseTitleType,
	passesTitleType,
	titleTypeOf,
	titleTypeParams,
} from "~/domain/title-type"
import { NoTitlesOfType } from "~/ui/type-filter"
import { useUser } from "~/utils/auth"
import {
	type BarState,
	CombineBar,
	type Side,
	sharedLine,
	sharedNote,
} from "./CombineBar"
import { HistoryBar, type StepView } from "./HistoryBar"
import { Minimap } from "./Minimap"
import { Caption, ProximityCard } from "./ProximityCard"
import { TopBar } from "./TopBar"
import { ZoomRail } from "./ZoomRail"
import {
	type MapQuery,
	explorerKeys,
	fetchBridge,
	fetchCard,
	fetchIsland,
	fetchMap,
	fetchPairs,
	pairKey,
} from "./api"
import { rgbCss } from "./color"
import { type Drawn, type MapEngine, type Pad, createMapEngine } from "./engine"
import {
	type MapFocus,
	focusOf,
	sameFocus,
	useSteps,
	withFocus,
} from "./history"
import type { IslandInput, MapIsland } from "./island"
import { layWorld } from "./world"

/** The title whose card is open: nearest the focus, or pinned by a tap. */
interface Active {
	key: number
	island: string
	title: ExplorerTitle
	pinned: boolean
}

/** The bridge that's up: the islands it joins (in the order picked), what it holds, and its titles. */
interface Bridge {
	id: string
	a: string
	b: string
	kind: BridgeKind
	count: number
	titles: ExplorerTitle[]
}

/**
 * The map's query from the URL: `grouping`, `services=mine|all`, `unseen=0|1`, `type=movie|show`, `anime=only|none`;
 * defaults are left out.
 */
export function mapQueryOf(params: URLSearchParams): MapQuery {
	const grouping = params.get("grouping")
	const services = params.get("services")
	const unseen = params.get("unseen")
	return {
		grouping: isGrouping(grouping) ? grouping : DEFAULT_GROUPING,
		services: services === "mine" || services === "all" ? services : null,
		unseen: unseen === "0" || unseen === "1" ? unseen : null,
		...titleTypeParams(parseTitleType(params)),
	}
}

const sameQuery = (a: MapQuery, b: MapQuery) =>
	a.grouping === b.grouping &&
	a.services === b.services &&
	a.unseen === b.unseen &&
	a.type === b.type &&
	a.anime === b.anime

const currentParams = () => new URLSearchParams(window.location.search)

const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

const side = (island: MapIsland): Side => ({
	id: island.id,
	name: island.name,
	color: rgbCss(island.tint),
})

/**
 * The Explorer's islands map: the grouping's islands on the sea, their titles as lit posters that grow as you zoom in,
 * and the card of the title nearest the focus over the live map. Tapping an island lights it and shows what every other
 * island shares with it; tapping another raises the bridge between them. Every grouping, island entered, and bridge is
 * a step in the browser's history. Filters hide titles; the page never scrolls.
 */
export function ExplorerMap({
	initialMap,
	fallback,
}: {
	/** The map the server rendered (a member's own; a guest's first map comes from their browser's progress). */
	initialMap: MapData | null
	/** What shows until the page runs: the islands as a list, for no JavaScript and search engines. */
	fallback?: ReactNode
}) {
	const [params, setParams] = useSearchParams()
	const query = useMemo(() => mapQueryOf(params), [params])
	const { user, loading: userLoading } = useUser()
	const member = !!user
	const viewer = user?.id ?? "guest"
	const queryClient = useQueryClient()
	const location = useLocation()
	const history = useSteps()

	// ------------------------------------------------------------ data

	const initialQuery = useRef(query)
	const mapQuery = useQuery({
		queryKey: explorerKeys.map(viewer, query),
		// Each answer carries the query it answers: while the next one loads, the previous map stays up.
		queryFn: async () => ({ query, map: await fetchMap(query, member) }),
		enabled: !userLoading,
		placeholderData: keepPreviousData,
		// The server rendered the member's own map; a guest's depends on the progress their browser holds.
		initialData:
			member && initialMap && query === initialQuery.current
				? { query, map: initialMap }
				: undefined,
	})
	const map = mapQuery.data?.map ?? null
	/** The query the shown map answers (the previous one while the next loads). */
	const shownQuery = mapQuery.data?.query ?? null
	const shownRef = useRef(shownQuery)
	shownRef.current = shownQuery

	/** What every pair of islands shares, for the counts on the islands. */
	const pairsQuery = useQuery({
		queryKey: explorerKeys.pairs(viewer, shownQuery ?? query),
		queryFn: () => fetchPairs(shownQuery ?? query, member),
		enabled: !!shownQuery && !userLoading,
	})
	const pairs = useMemo(() => {
		const data = pairsQuery.data
		if (!data || data.grouping !== map?.grouping) return null
		return new Map<string, ExplorerPair>(
			data.pairs.map((p) => [pairKey(p.a, p.b), p]),
		)
	}, [pairsQuery.data, map?.grouping])
	const pairsRef = useRef(pairs)
	pairsRef.current = pairs

	const hasServices = (map?.services.length ?? 0) > 0
	const onMyServices = hasServices && query.services !== "all"
	const notSeenYet = query.unseen !== "0"
	const titleType = useMemo(
		() => titleTypeOf(query.type, query.anime),
		[query.type, query.anime],
	)
	const [seenNow, setSeenNow] = useState<ReadonlySet<number>>(new Set())
	/** The filters hide titles, never dim them, as soon as they're switched. */
	const visible = useCallback(
		(t: ExplorerTitle) =>
			(!onMyServices || !!map?.approximate || t.services.length > 0) &&
			(!notSeenYet || !(t.seen || seenNow.has(t.key))) &&
			passesTitleType(titleType, t),
		[onMyServices, notSeenYet, titleType, seenNow, map?.approximate],
	)

	/** Island names and colors of every grouping seen this visit, for the history's labels. */
	const names = useRef(new Map<string, { name: string; color: string }>())
	useEffect(() => {
		if (!map) return
		for (const island of map.islands)
			names.current.set(`${map.grouping}|${island.id}`, {
				name: island.name,
				color: island.color,
			})
	}, [map])

	/** A new grouping is a step; the filters change the step shown, keeping what it's focused on. */
	const setQuery = (next: Partial<MapQuery>) => {
		const q = { ...query, ...next }
		const out = currentParams()
		const put = (key: string, value: string | null) => {
			if (value == null) out.delete(key)
			else out.set(key, value)
		}
		const regroup = q.grouping !== query.grouping
		put("grouping", q.grouping === DEFAULT_GROUPING ? null : q.grouping)
		put("services", q.services)
		put("unseen", q.unseen)
		put("type", q.type)
		put("anime", q.anime)
		if (regroup) {
			out.delete("island")
			out.delete("bridge")
		}
		setParams(out, { replace: !regroup, preventScrollReset: true })
	}
	/** Moves the URL's focus: a new step, unless it's already there. */
	const navigateFocus = (focus: MapFocus) => {
		const now = currentParams()
		if (sameFocus(focusOf(now), focus)) return
		setParams(withFocus(now, focus), { preventScrollReset: true })
	}

	// ------------------------------------------------------------ the stage

	const stage = useRef<HTMLDivElement>(null)
	const seaCanvas = useRef<HTMLCanvasElement>(null)
	const posterCanvas = useRef<HTMLCanvasElement>(null)
	const engineRef = useRef<MapEngine | null>(null)
	const [engine, setEngine] = useState<MapEngine | null>(null)
	const [aspect, setAspect] = useState<number | null>(null)
	const [width, setWidth] = useState(1440)
	const [barTop, setBarTop] = useState(80)
	const padRef = useRef<Pad>({ t: 150, r: 70, b: 70, l: 16 })
	const phone = width < 640
	const form: "float" | "sheet" = phone ? "sheet" : "float"

	useEffect(() => {
		const el = stage.current
		if (!el) return
		const measure = () => {
			const w = el.clientWidth
			const h = el.clientHeight
			const rows = [
				...el.querySelectorAll<HTMLElement>(".ex-top .ex-row"),
			].filter((r) => r.offsetHeight > 0)
			const last = rows[rows.length - 1]
			const t = last ? last.offsetTop + last.offsetHeight + 12 : 120
			// The combine bar gets its own row under the controls, and the map leaves room for it.
			setBarTop(t - 4)
			padRef.current =
				w >= 1024
					? { t: t + 54, r: 80, b: 72, l: 24 }
					: { t: t + 54, r: 12, b: w < 640 ? 150 : 120, l: 12 }
			el.style.setProperty("--ex-pad-t", `${padRef.current.t}px`)
			setWidth(w)
			const p = padRef.current
			const a = (w - p.l - p.r) / Math.max(1, h - p.t - p.b)
			// Aspect ratios in steps, so small resizes don't lay the islands out again.
			const stepped =
				a >= 1.25
					? Math.min(2.25, Math.round(a * 4) / 4)
					: a >= 0.85
						? 1
						: Math.max(0.5, Math.round(a * 4) / 4)
			setAspect((x) => (x === stepped ? x : stepped))
			engineRef.current?.repad()
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		const top = el.querySelector(".ex-top")
		if (top) ro.observe(top)
		return () => ro.disconnect()
	}, [])

	const world = useMemo(
		() => (map && aspect ? layWorld(map.islands, aspect) : null),
		[map, aspect],
	)
	const inputs = useMemo<IslandInput[]>(
		() =>
			map?.islands.map((island) => ({
				id: island.id,
				name: island.name,
				color: island.color,
				count: island.count,
				medianMatch: island.medianMatch,
				logo: null,
				titles: island.titles,
			})) ?? [],
		[map],
	)

	// ------------------------------------------------------------ the active title and its card

	const [active, setActiveState] = useState<Active | null>(null)
	const activeRef = useRef<Active | null>(null)
	const setActive = useCallback((a: Active | null) => {
		activeRef.current = a
		setActiveState(a)
	}, [])
	const [captions, setCaptions] = useState<Drawn[]>([])
	const [focusIsland, setFocusIsland] = useState<MapIsland | null>(null)
	const [atOverview, setAtOverview] = useState(true)
	const [toast, setToast] = useState<string | null>(null)
	const [touch, setTouch] = useState(false)
	useEffect(() => {
		setTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false)
	}, [])
	const cardEl = useRef<HTMLDivElement>(null)
	const anchorEl = useRef<HTMLDivElement>(null)
	const goEl = useRef<HTMLDivElement>(null)
	const previewEl = useRef<HTMLDivElement>(null)
	const captionEls = useRef(new Map<string, HTMLDivElement>())

	/** The card's data loads once the title has stayed nearest for a moment (at once when pinned). */
	const [cardKey, setCardKey] = useState<number | null>(null)
	useEffect(() => {
		if (!active) {
			setCardKey(null)
			return
		}
		const t = setTimeout(() => setCardKey(active.key), active.pinned ? 0 : 260)
		return () => clearTimeout(t)
	}, [active?.key, active?.pinned])
	const cardQuery = useQuery({
		queryKey: explorerKeys.card(viewer, cardKey ?? 0),
		queryFn: () => fetchCard(cardKey as number, member),
		enabled: cardKey != null && !userLoading,
	})
	const card =
		cardQuery.data && cardQuery.data.title.key === active?.key
			? cardQuery.data
			: null

	const say = (text: string) => {
		setToast(text)
		setTimeout(() => setToast((t) => (t === text ? null : t)), 2200)
	}

	/** The focus without a mouse: the middle of the free part of the view (above the card sheet on phones). */
	const center = () => {
		const p = padRef.current
		const size = engineRef.current?.size() ?? { w: width, h: 800 }
		const { w, h } = size
		if (w < 640) {
			const a = activeRef.current
			if (!a) return { x: w / 2, y: p.t + (h - p.t - p.b) * 0.5 }
			const top = a.pinned ? h - 60 - h * 0.5 : h - 60 - 176
			return { x: w / 2, y: p.t + Math.max(60, top - p.t) * 0.5 }
		}
		return { x: (p.l + w - p.r) / 2, y: (p.t + h - p.b) / 2 }
	}

	const pin = (d: { island: MapIsland; title: ExplorerTitle }) =>
		setActive({
			key: d.title.key,
			island: d.island.id,
			title: d.title,
			pinned: true,
		})
	const unpin = () => {
		if (activeRef.current) setActive(null)
	}

	// ------------------------------------------------------------ combining islands

	const [lit, setLitState] = useState<string[]>([])
	const litRef = useRef<string[]>([])
	const setLit = (ids: string[]) => {
		litRef.current = ids
		setLitState(ids)
		engineRef.current?.setLit(ids)
	}
	const [bridge, setBridgeState] = useState<Bridge | null>(null)
	const bridgeRef = useRef<Bridge | null>(null)
	const setBridge = (b: Bridge | null) => {
		bridgeRef.current = b
		setBridgeState(b)
	}
	/** Islands being combined while their bridge loads. */
	const [forming, setForming] = useState<[string, string] | null>(null)
	const [hover, setHover] = useState<MapIsland | null>(null)
	/** Combining has been used once: the hint steps aside. */
	const [combined, setCombined] = useState(false)
	/** Changes with every grouping, filter, and layout, so answers for an earlier map are dropped. */
	const worldToken = useRef(0)

	/**
	 * Raises the bridge between two islands: it rises between them at once and pulses while its titles load. A new step
	 * unless it comes from the history. False when there's nothing to raise.
	 */
	const combine = async (a: string, b: string, step = true) => {
		const e = engineRef.current
		const q = shownRef.current
		if (!e || !q || a === b || !e.island(a) || !e.island(b)) return false
		const token = worldToken.current
		setLit([])
		const known = pairsRef.current?.get(pairKey(a, b))
		if (known && !known.count) {
			say(
				`${e.island(a)?.name ?? "They"} and ${e.island(b)?.name ?? "the other"} share no titles with these filters`,
			)
			return false
		}
		if (bridgeRef.current) setBridge(null)
		// Up at once, pulsing until its titles arrive.
		if (!e.raiseBridge(a, b, null, known ?? null)) return false
		setForming([a, b])
		unpin()
		const tree = await queryClient
			.fetchQuery({
				queryKey: explorerKeys.bridge(viewer, q, a, b),
				queryFn: () => fetchBridge(q, a, b, member),
			})
			.catch(() => null)
		if (engineRef.current !== e || worldToken.current !== token) return false
		setForming(null)
		const A = e.island(a)
		const B = e.island(b)
		// Still the bridge that's waiting: not let go, and not replaced by another, since.
		const waiting = e.bridge()
		if (
			!waiting?.bridge?.pending ||
			pairKey(...waiting.bridge.of) !== pairKey(a, b)
		)
			return false
		if (!tree || !tree.titles.length || !A || !B) {
			e.lowerBridge()
			say(
				tree
					? `${A?.name ?? "They"} and ${B?.name ?? "the other"} share no titles with these filters`
					: "That bridge couldn't be raised. Try again in a moment.",
			)
			return false
		}
		const island = e.fillBridge(tree)
		if (!island) return false
		setBridge({
			id: island.id,
			a,
			b,
			kind: tree.kind,
			count: tree.count,
			titles: tree.titles,
		})
		setCombined(true)
		if (step) navigateFocus({ island: null, bridge: [a, b] })
		return true
	}
	/** Lets the bridge go without a step of its own (the history, or going into an island out of its focus). */
	const dropBridge = () => {
		const e = engineRef.current
		const b = bridgeRef.current
		if (!e || !(b || waitingBridge())) return
		if (b && activeRef.current?.island === b.id) unpin()
		e.lowerBridge()
		setBridge(null)
		setForming(null)
	}
	/** A bridge is up without its titles yet. */
	const waitingBridge = () => !!engineRef.current?.bridge()?.bridge?.pending
	/** Separate: the map springs back, a step of its own so Back raises the bridge again. */
	const separate = (keepLit: string[] = []) => {
		if (!bridgeRef.current && !waitingBridge()) return
		dropBridge()
		setLit(keepLit)
		navigateFocus({ island: null, bridge: null })
		engineRef.current?.overview()
	}
	/** Goes into an island. One out of the bridge's focus lets the bridge go (Back raises it again). */
	const flyIn = (island: MapIsland) => {
		const e = engineRef.current
		if (!e) return
		unpin()
		const b = bridgeRef.current
		const inFocus =
			!!b && (island.id === b.id || b.a === island.id || b.b === island.id)
		if (b && !inFocus) dropBridge()
		setLit([])
		e.flyToIsland(island)
		navigateFocus({
			island: island.bridge ? null : island.id,
			bridge: b && inFocus ? [b.a, b.b] : null,
		})
	}
	/** A tap on an island out at the map: light it, let it go, raise a bridge to the lit one, or undo a bridge. */
	const tapIsland = (island: MapIsland) => {
		if (island.bridge) return flyIn(island)
		const b = bridgeRef.current
		if (b && (b.a === island.id || b.b === island.id)) {
			// Tapping an island the bridge joins takes it out: the bridge goes, the other island stays lit.
			separate([b.a === island.id ? b.b : b.a])
			return
		}
		// A bridge joins two islands only: tapping a third lets it go and lights the tapped one on its own.
		if (b) return separate([island.id])
		const cur = litRef.current
		if (cur.includes(island.id)) return setLit([])
		if (cur.length === 1) {
			void combine(cur[0], island.id)
			return
		}
		setLit([island.id])
	}

	/**
	 * Shows what the URL's step is focused on: raises or lets go the bridge, then goes into the island or out to the
	 * whole map. `how` is "history" for Back and Forward, "world" once a map is laid out.
	 */
	const applyFocus = (focus: MapFocus, how: "history" | "world") => {
		const e = engineRef.current
		if (!e) return
		unpin()
		setLit([])
		setHover(null)
		const enter = () => {
			const island = focus.island ? e.island(focus.island) : null
			if (island) e.flyToIsland(island)
			else if (how === "history" && !focus.bridge) e.overview()
		}
		const b = bridgeRef.current
		const want = focus.bridge ? pairKey(...focus.bridge) : null
		const have = b ? pairKey(b.a, b.b) : null
		// Already rising and waiting for its titles.
		const rising = e.bridge()?.bridge
		if (want && rising?.pending && pairKey(...rising.of) === want) return
		if (want !== have) {
			dropBridge()
			if (focus.bridge) {
				void combine(focus.bridge[0], focus.bridge[1], false).then((ok) => {
					if (ok && focus.island) enter()
				})
				return
			}
		} else if (b && !focus.island && how === "history") {
			e.overview()
			return
		}
		enter()
	}
	const applyRef = useRef(applyFocus)
	applyRef.current = applyFocus
	/** When the history last moved: the camera settling right after doesn't make a step of its own. */
	const appliedAt = useRef(0)

	// ------------------------------------------------------------ the title nearest the focus

	const pending = useRef<{ key: number | null; t: number }>({ key: null, t: 0 })
	const lastCaptions = useRef("")
	/** Each frame: the title nearest the focus becomes active after a short wait, and the captions near it. */
	const compute = () => {
		const e = engineRef.current
		if (!e) return
		const a = activeRef.current
		const ACT = e.activationWidth()
		const { w, h } = e.size()
		const ptr = e.pointer()
		const c = center()
		let list: Drawn[] = []
		if (!a?.pinned) {
			const byPointer = !!ptr && !phone
			const pt = byPointer && ptr ? ptr : c
			const reach = byPointer ? 36 : Math.min(w, h) * 0.16
			let near = e.nearest(pt.x, pt.y, ACT, reach)
			// The open card holds on a little, so it doesn't flicker between two titles.
			if (a && near && near.title.key !== a.key) {
				const cur = e.find(a.key, a.island)
				if (cur && cur.w >= ACT * 0.9) {
					const dc = Math.hypot(cur.cx - pt.x, cur.cy - pt.y)
					const dn = Math.hypot(near.cx - pt.x, near.cy - pt.y)
					if (dc < dn * 1.3 + 12) near = cur
				}
			}
			if (!phone)
				list = e
					.drawn()
					.filter(
						(d) =>
							d.w >= Math.min(ACT * 0.6, 52) &&
							d.a > 0.9 &&
							d.title.key !== near?.title.key &&
							Math.hypot(d.cx - pt.x, d.cy - pt.y) < ACT * 2.6,
					)
					.sort(
						(x, y) =>
							Math.hypot(x.cx - pt.x, x.cy - pt.y) -
							Math.hypot(y.cx - pt.x, y.cy - pt.y),
					)
					.slice(0, 4)
			const key = near?.title.key ?? null
			const now = performance.now()
			if (key !== (a?.key ?? null)) {
				if (pending.current.key !== key) pending.current = { key, t: now }
				const wait = key == null ? 160 : 90
				if (now - pending.current.t >= wait)
					setActive(
						near
							? {
									key: near.title.key,
									island: near.island.id,
									title: near.title,
									pinned: false,
								}
							: null,
					)
				else setTimeout(() => engineRef.current && compute(), wait + 5)
			} else pending.current = { key, t: now }
		}
		const listKey = list.map((d) => `${d.island.id}|${d.title.key}`).join(",")
		if (listKey !== lastCaptions.current) {
			lastCaptions.current = listKey
			setCaptions(list)
		}
		place()
	}

	/**
	 * Positions the card beside its poster, the captions under theirs (clear of each other), "Go in" on a lit island,
	 * and the label of a previewed bridge at its seed of light.
	 */
	const place = () => {
		const e = engineRef.current
		if (!e) return
		const { w, h } = e.size()
		const p = padRef.current
		const a = activeRef.current
		const el = anchorEl.current
		let box: { x: number; y: number; w: number; h: number } | null = null
		if (el && a && form === "float") {
			const d = e.find(a.key, a.island)
			const cw = el.offsetWidth || 340
			const ch = el.offsetHeight || 420
			if (d) {
				let x = d.cx + d.w * 0.56 + 22
				let sideX = "0%"
				if (x + cw > w - p.r + 40) {
					x = d.cx - d.w * 0.56 - 22 - cw
					sideX = "100%"
				}
				if (x < 8) x = Math.min(w - cw - 8, Math.max(8, d.cx - cw / 2))
				const y = Math.min(
					h - ch - 12,
					Math.max(Math.min(p.t - 4, h - ch - 12), d.cy - ch * 0.36),
				)
				el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
				el.style.visibility = "visible"
				el.style.setProperty("--ox", sideX)
				box = { x, y, w: cw, h: ch }
			} else if (!a.pinned) el.style.visibility = "hidden"
		}
		// On phones the card docks at the bottom; the zoom buttons move up above its peek.
		const sheet =
			form === "sheet" && a ? (cardEl.current?.offsetHeight ?? 0) : 0
		stage.current?.style.setProperty(
			"--ex-sheet",
			`${sheet ? sheet + 12 : 0}px`,
		)
		const taken = box ? [box] : []
		// Captions never cover the active poster either.
		const shown = a ? e.find(a.key, a.island) : null
		if (shown) taken.push({ x: shown.x, y: shown.y, w: shown.w, h: shown.h })
		for (const [id, cel] of captionEls.current) {
			const [island, key] = id.split("\n")
			const d = e.find(Number(key), island)
			if (!d) {
				cel.style.visibility = "hidden"
				continue
			}
			const cw = cel.offsetWidth || 120
			const ch = cel.offsetHeight || 28
			const x = Math.min(w - cw - 8, Math.max(8, d.cx - cw / 2))
			const y = d.y + d.h + 8
			const hit = taken.some(
				(r) =>
					x < r.x + r.w + 6 &&
					x + cw > r.x - 6 &&
					y < r.y + r.h + 4 &&
					y + ch > r.y - 4,
			)
			cel.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
			cel.style.visibility = hit || y > h - 40 ? "hidden" : "visible"
			if (!hit) taken.push({ x, y, w: cw, h: ch })
		}
		// "Go in" on a lit island: inside it, low, when it fits; otherwise next to it, wherever it covers the least of
		// the other islands.
		const go = goEl.current
		const gi = litRef.current.length === 1 ? e.island(litRef.current[0]) : null
		if (go && gi) {
			const gw = go.offsetWidth || 110
			const gh = go.offsetHeight || 40
			const inside = {
				x: gi.sx - gw / 2,
				y: gi.sy + Math.max(34, Math.min(gi.sr * 0.55, 70)),
			}
			const spots =
				gw < gi.sr * 1.3 && gh < gi.sr * 0.6
					? [inside]
					: [
							{ x: gi.sx - gw / 2, y: gi.sy + gi.sr + 10 },
							{ x: gi.sx + gi.sr + 10, y: gi.sy - gh / 2 },
							{ x: gi.sx - gi.sr - 10 - gw, y: gi.sy - gh / 2 },
							{ x: gi.sx - gw / 2, y: gi.sy - gi.sr - 10 - gh },
						]
			const others = e.islands().filter((o) => o !== gi && o.on)
			let best = spots[0]
			let bestCost = Number.POSITIVE_INFINITY
			for (const s of spots) {
				const x = clampN(s.x, 8, w - gw - 8)
				const y = clampN(s.y, p.t, h - gh - Math.max(12, p.b - 40))
				let cost = Math.abs(x - s.x) + Math.abs(y - s.y)
				// Pushed back on screen, a spot beside the island may end up on it.
				for (const o of s === inside ? others : [gi, ...others]) {
					const dx = Math.max(0, Math.abs(o.sx - (x + gw / 2)) - gw / 2)
					const dy = Math.max(0, Math.abs(o.sy - (y + gh / 2)) - gh / 2)
					const into = o.sr - Math.hypot(dx, dy)
					if (into > 0) cost += into * 4
				}
				if (cost < bestCost) {
					bestCost = cost
					best = { x, y }
				}
			}
			go.style.transform = `translate3d(${Math.round(best.x)}px,${Math.round(best.y)}px,0)`
			go.style.visibility = gi.on ? "visible" : "hidden"
		}
		// The previewed bridge's label, at its seed of light.
		const pv = previewEl.current
		const at = e.previewAnchor()
		if (pv) {
			if (at) {
				const gw = pv.offsetWidth || 160
				const gh = pv.offsetHeight || 42
				const x = clampN(
					at.x - gw / 2,
					Math.max(8, p.l),
					w - gw - Math.max(8, p.r),
				)
				const y = clampN(at.y - gh / 2, p.t, h - gh - Math.max(8, p.b - 20))
				pv.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
				pv.style.visibility = "visible"
			} else pv.style.visibility = "hidden"
		}
	}
	const placeRef = useRef(place)
	placeRef.current = place
	useEffect(() => {
		placeRef.current()
		engineRef.current?.invalidate()
	}, [active, captions, card, lit, hover, forming])

	// ------------------------------------------------------------ the engine

	const hooks = useRef(
		null as unknown as Parameters<typeof createMapEngine>[2]["current"],
	)
	hooks.current = {
		visible,
		pad: () => padRef.current,
		center,
		active: () => {
			const a = activeRef.current
			return a ? { key: a.key, pinned: a.pinned, island: a.island } : null
		},
		card: () =>
			form === "sheet"
				? null
				: (cardEl.current?.getBoundingClientRect() ?? null),
		onTapPoster: (d) => {
			const a = activeRef.current
			if (a?.pinned && a.key === d.title.key) return
			pin(d)
			const e = engineRef.current
			if (!e) return
			const p = padRef.current
			const { w, h } = e.size()
			const out =
				d.x < p.l ||
				d.y < p.t - 20 ||
				d.x + d.w > w - p.r ||
				d.y + d.h > h - Math.min(p.b, 40)
			if (d.w < e.activationWidth() || out || w < 640)
				e.glideToPoster(d.island, d.i)
		},
		onTapIsland: (island) => {
			unpin()
			tapIsland(island)
		},
		onDoubleTapIsland: (island) => flyIn(island),
		onTapWater: () => {
			if (activeRef.current?.pinned) unpin()
			else if (litRef.current.length) setLit([])
		},
		onLongPress: (d) => pin(d),
		needTree: (island) => needTree.current(island),
		onFrame: () => compute(),
		onPointer: () => compute(),
		onHoverIsland: (island) => setHover(island),
	}

	/** Loads an island's tree once, for the query of the map it belongs to. */
	const needTree = useRef<(island: MapIsland) => void>(() => {})
	const asked = useRef(new Set<string>())
	needTree.current = (island) => {
		const q = shownQuery
		if (!q || island.bridge) return
		const keyOf = explorerKeys.island(viewer, q, island.id)
		const id = keyOf.join("|")
		if (asked.current.has(id)) return
		asked.current.add(id)
		queryClient
			.fetchQuery({
				queryKey: keyOf,
				queryFn: () => fetchIsland(q, island.id, member),
			})
			.then((tree) => {
				const e = engineRef.current
				if (e?.island(island.id) === island) e.setTree(island.id, tree)
			})
			.catch(() => asked.current.delete(id))
	}

	useEffect(() => {
		const sea = seaCanvas.current
		const posters = posterCanvas.current
		if (!sea || !posters) return
		const reducedMotion =
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
		const e = createMapEngine(sea, posters, hooks, { reducedMotion })
		engineRef.current = e
		setEngine(e)
		if (import.meta.env.DEV)
			(window as unknown as { __explorer?: unknown }).__explorer = {
				view: () => e.view(),
				drawn: () =>
					e.drawn().map((d) => ({
						key: d.title.key,
						title: d.title.title,
						x: d.x,
						y: d.y,
						w: d.w,
						h: d.h,
						island: d.island.id,
						t: d.t,
					})),
				islands: () =>
					e.islands().map((i) => ({
						id: i.id,
						name: i.name,
						x: i.sx,
						y: i.sy,
						r: i.sr,
						on: i.on,
						loaded: i.loaded,
						role: i.role,
						bridge: i.bridge && { ...i.bridge },
						look: { ...i.look },
						target: { ...i.target },
					})),
				active: () =>
					activeRef.current && {
						key: activeRef.current.key,
						title: activeRef.current.title.title,
						pinned: activeRef.current.pinned,
					},
				lit: () => litRef.current,
				bridge: () =>
					bridgeRef.current && {
						...bridgeRef.current,
						titles: bridgeRef.current.titles.length,
					},
				preview: () => e.previewAnchor(),
				layoutBox: () => e.layoutBox(),
				stats: () => e.stats(),
				sea: () => e.seaKind(),
				busy: () => e.busy(),
			}
		return () => {
			e.destroy()
			engineRef.current = null
		}
	}, [])

	useEffect(() => {
		if (!engine || !world || !map || !shownQuery) return
		worldToken.current++
		engine.setWorld(
			world,
			inputs,
			`${map.grouping}|${shownQuery.services}|${shownQuery.unseen}`,
		)
		setActive(null)
		litRef.current = []
		setLitState([])
		bridgeRef.current = null
		setBridgeState(null)
		setForming(null)
		setHover(null)
		// The step's island or bridge, on the new map (after a reload, a new grouping, or other filters).
		applyRef.current(focusOf(currentParams()), "world")
	}, [engine, world])
	useEffect(() => {
		engine?.refilter()
		const a = activeRef.current
		if (a && !visible(a.title) && !a.pinned) setActive(null)
	}, [visible])

	// Back and Forward: the map shows the step's island or bridge (a step with another grouping or other filters waits
	// for its map, and is shown once that's laid out).
	const firstKey = useRef(location.key)
	useEffect(() => {
		if (location.key === firstKey.current || !history.popped) return
		const shown = shownRef.current
		if (
			!engineRef.current ||
			!shown ||
			!sameQuery(shown, mapQueryOf(currentParams()))
		)
			return
		appliedAt.current = performance.now()
		applyRef.current(focusOf(currentParams()), "history")
	}, [location.key])

	useEffect(() => {
		if (!engine) return
		let raf = 0
		let settle: ReturnType<typeof setTimeout> | null = null
		const off = engine.subscribe(() => {
			if (raf) return
			raf = requestAnimationFrame(() => {
				raf = 0
				const v = engine.view()
				const inside =
					v.focus && v.cam.s >= (v.stops[1] ?? v.fit * 3) * 0.8 ? v.focus : null
				setFocusIsland((x) => (x === inside ? x : inside))
				const overview = v.cam.s <= v.fit * 1.05
				setAtOverview((x) => (x === overview ? x : overview))
				// Once the camera settles: going into an island, or back out to the whole map, is a step.
				if (settle) clearTimeout(settle)
				settle = setTimeout(() => {
					if (engine.busy() || performance.now() - appliedAt.current < 900)
						return
					const f = engine.view()
					const into =
						f.focus && f.cam.s >= (f.stops[1] ?? f.fit * 3) * 0.8
							? f.focus
							: null
					const now = focusOf(currentParams())
					const want = into
						? into.bridge
							? null
							: into.id
						: f.cam.s <= f.fit * 1.05
							? null
							: now.island
					if (want !== now.island) navigateRef.current({ ...now, island: want })
				}, 650)
			})
		})
		return () => {
			off()
			cancelAnimationFrame(raf)
			if (settle) clearTimeout(settle)
		}
	}, [engine])
	const navigateRef = useRef(navigateFocus)
	navigateRef.current = navigateFocus

	// Going into an island lets its light go ("Go in" has done its job).
	useEffect(() => {
		if (focusIsland && litRef.current.length) setLit([])
	}, [focusIsland])

	// A lit island: every other island's name says what it shares with it.
	useEffect(() => {
		const e = engineRef.current
		if (!e) return
		const notes = new Map<string, string>()
		if (lit.length === 1 && pairs)
			for (const o of e.islands()) {
				if (o.id === lit[0] || o.bridge) continue
				const p = pairs.get(pairKey(lit[0], o.id))
				if (p) notes.set(o.id, sharedNote(p.count, p.kind))
			}
		e.setNotes(notes)
	}, [lit, pairs, engine, bridge])
	// Pointing at another island previews the bridge.
	const previewPair =
		lit.length === 1 &&
		hover &&
		hover.id !== lit[0] &&
		!hover.bridge &&
		!forming
			? { from: lit[0], to: hover.id }
			: null
	useEffect(() => {
		engineRef.current?.setPreview(previewPair)
	}, [previewPair?.from, previewPair?.to])

	// ------------------------------------------------------------ keyboard

	const keys = useRef({ pin, unpin, separate, flyIn, setLit })
	keys.current = { pin, unpin, separate, flyIn, setLit }
	useEffect(() => {
		const onKey = (ev: KeyboardEvent) => {
			const e = engineRef.current
			const el = stage.current
			const target = ev.target as HTMLElement | null
			if (!e || !el || !target || !el.contains(target)) return
			if (target.closest("input, textarea, select, .ex-hist-menu")) return
			const onMap = target === posterCanvas.current
			const a = activeRef.current
			const k = keys.current
			if (ev.key === "Escape") {
				// Undo, one layer at a time: the card, the lit island, the bridge, then a zoom step out.
				ev.preventDefault()
				if (a) k.unpin()
				else if (litRef.current.length) k.setLit([])
				else if (bridgeRef.current || e.bridge()?.bridge?.pending) k.separate()
				else e.stepZoom(-1)
				return
			}
			if (!onMap || ev.altKey || ev.ctrlKey || ev.metaKey) return
			const dirs: Record<string, [number, number]> = {
				ArrowLeft: [-1, 0],
				ArrowRight: [1, 0],
				ArrowUp: [0, -1],
				ArrowDown: [0, 1],
			}
			const dir = dirs[ev.key]
			if (dir) {
				ev.preventDefault()
				const cur = a ? e.find(a.key, a.island) : null
				const next = cur ? e.neighbor(cur, dir[0], dir[1]) : null
				if (next) {
					e.glideToPoster(next.island, next.i)
					k.pin(next)
					return
				}
				e.panBy(dir[0] * 200, dir[1] * 200)
				return
			}
			if (ev.key === "+" || ev.key === "=") {
				ev.preventDefault()
				e.stepZoom(1)
			} else if (ev.key === "-" || ev.key === "_") {
				ev.preventDefault()
				e.stepZoom(-1)
			} else if (ev.key === "0") {
				ev.preventDefault()
				k.unpin()
				e.overview()
			} else if (ev.key === "Enter") {
				ev.preventDefault()
				const lone =
					litRef.current.length === 1 ? e.island(litRef.current[0]) : null
				if (lone) return k.flyIn(lone)
				const c = center()
				const d =
					(a && e.find(a.key, a.island)) ||
					e.nearest(c.x, c.y, e.activationWidth() * 0.5, 1e9)
				if (d) k.pin(d)
				else e.stepZoom(1)
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])

	// ------------------------------------------------------------ render

	const activeIsland = active && engine ? engine.island(active.island) : null
	const where = activeIsland
		? { name: activeIsland.name, color: rgbCss(activeIsland.tint) }
		: { name: "", color: "#888" }
	const cardNode = active && activeIsland && (
		<ProximityCard
			key={active.key}
			ref={cardEl}
			title={active.title}
			where={where}
			card={card}
			pinned={active.pinned}
			form={form}
			peek={form === "sheet" && !active.pinned}
			onPin={() => pin({ island: activeIsland, title: active.title })}
			onClose={unpin}
			onAction={(message, seen) => {
				say(message)
				if (seen !== undefined)
					setSeenNow((s) => {
						const next = new Set(s)
						if (seen) next.add(active.key)
						else next.delete(active.key)
						return next
					})
			}}
		/>
	)
	const loadingGrouping =
		mapQuery.isPlaceholderData && shownQuery?.grouping !== query.grouping
	const groupingName =
		GROUPING_NAMES[map?.grouping ?? query.grouping].toLowerCase()

	const islandOf = (id: string) => (engine ? engine.island(id) : null)
	const sides = (ids: string[]) =>
		ids
			.map(islandOf)
			.filter((x): x is MapIsland => !!x)
			.map(side)
	const litIsland = lit.length === 1 ? islandOf(lit[0]) : null
	let bar: BarState | null = null
	if (forming) bar = { k: "forming", list: sides(forming) }
	else if (litIsland)
		bar = {
			k: "lit",
			lit: side(litIsland),
			next: touch
				? "tap another island to combine"
				: "point at another island, click to combine",
		}
	else if (bridge) {
		const list = sides([bridge.a, bridge.b])
		if (list.length === 2)
			bar = { k: "bridge", list, count: bridge.count, kind: bridge.kind }
	}
	const spoken = !bar
		? ""
		: bar.k === "lit"
			? `${bar.lit.name} lit. Its count of shared titles is on every other island.`
			: bar.k === "forming"
				? `Finding what ${bar.list.map((s) => s.name).join(" and ")} share.`
				: `${bar.list.map((s) => s.name).join(" + ")}: ${sharedLine(bar.count, bar.kind)}.`

	const preview =
		previewPair && engine
			? (() => {
					const A = engine.island(previewPair.from)
					const B = engine.island(previewPair.to)
					const p = pairs?.get(pairKey(previewPair.from, previewPair.to))
					return A && B
						? {
								label: `${A.name} + ${B.name}`,
								sub: p ? sharedLine(p.count, p.kind) : "",
								color: rgbCss(B.tint),
							}
						: null
				})()
			: null

	/** Labels of the history's steps, from their URLs and the island names seen this visit. */
	const stepViews: StepView[] = history.steps.map((s) => {
		const sp = new URLSearchParams(s.search)
		const g = mapQueryOf(sp).grouping
		const f = focusOf(sp)
		const named = (id: string) => names.current.get(`${g}|${id}`)
		if (f.island) {
			const n = named(f.island)
			return {
				key: s.key,
				label: n?.name ?? f.island,
				kind: "island",
				color: n?.color ?? null,
			}
		}
		if (f.bridge) {
			const [a, b] = f.bridge.map(named)
			return {
				key: s.key,
				label: `${a?.name ?? f.bridge[0]} + ${b?.name ?? f.bridge[1]}`,
				kind: "bridge",
				color: a?.color ?? null,
			}
		}
		return {
			key: s.key,
			label: `All by ${GROUPING_NAMES[g].toLowerCase()}`,
			kind: "map",
			color: null,
		}
	})

	const hint = touch
		? "Tap an island to see how much it shares with every other island."
		: "Click an island to see how much it shares with every other island."
	return (
		<div ref={stage} className="ex-stage" data-bar={bar ? "" : undefined}>
			{/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas isn't focusable; the sea is decoration. */}
			<canvas ref={seaCanvas} className="ex-sea" aria-hidden="true" />
			{/* biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: the map is one application-like control (spec). */}
			<canvas
				ref={posterCanvas}
				className="ex-posters"
				role="application"
				tabIndex={0}
				// The keys work after a click too; the focus ring is for keyboard focus only.
				onPointerDown={(e) =>
					e.currentTarget.focus({
						preventScroll: true,
						focusVisible: false,
					} as FocusOptions)
				}
				aria-label={
					map
						? `Islands map of ${map.total.toLocaleString("en")} films and shows by ${groupingName}, ${map.islands.length} islands. Arrow keys move between titles, plus and minus zoom, Enter opens a title, Escape steps back.`
						: "Islands map"
				}
			/>
			{fallback}
			<div className="ex-layer">
				{captions.map((d) => {
					const id = `${d.island.id}\n${d.title.key}`
					return (
						<Caption
							key={id}
							ref={(el) => {
								if (el) captionEls.current.set(id, el)
								else captionEls.current.delete(id)
							}}
							title={d.title}
							onClick={() => pin(d)}
						/>
					)
				})}
				{preview && (
					<div
						ref={previewEl}
						className="ex-on"
						style={{ visibility: "hidden" }}
					>
						<div
							className="ex-ghost"
							style={{ "--c": preview.color } as React.CSSProperties}
						>
							<b>{preview.label}</b>
							{preview.sub && <span>{preview.sub}</span>}
						</div>
					</div>
				)}
				{litIsland && !forming && (
					<div ref={goEl} className="ex-on" style={{ visibility: "hidden" }}>
						<button
							type="button"
							className="ex-goin"
							style={
								{ "--c": rgbCss(litIsland.tint, 0.6) } as React.CSSProperties
							}
							onClick={() => {
								flyIn(litIsland)
								// The button goes with the light; the keys carry on on the map.
								posterCanvas.current?.focus({ preventScroll: true })
							}}
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
				{form === "float" && active && (
					<div
						ref={anchorEl}
						className="ex-anchor"
						style={{ visibility: "hidden" }}
					>
						{cardNode}
					</div>
				)}
				{form === "sheet" && cardNode}
			</div>
			<TopBar
				groupings={map?.groupings ?? [query.grouping]}
				grouping={map?.grouping ?? query.grouping}
				onGrouping={(grouping) => setQuery({ grouping })}
				onMyServices={onMyServices}
				notSeenYet={notSeenYet}
				services={map?.services ?? []}
				onToggleServices={() =>
					setQuery({ services: onMyServices ? "all" : null })
				}
				onToggleUnseen={() => setQuery({ unseen: notSeenYet ? "0" : null })}
				titleType={titleType}
				onTitleType={(next) => setQuery(titleTypeParams(next))}
				history={
					<HistoryBar steps={stepViews} at={history.at} onGo={history.go} />
				}
			/>
			{bar && !(phone && active?.pinned) && (
				<div className="ex-bar-wrap" style={{ top: barTop }}>
					<CombineBar
						state={bar}
						onUndo={() => {
							if (bar?.k === "bridge" || bar?.k === "forming") separate()
							else setLit([])
						}}
						onGo={() => {
							const e = engineRef.current
							const b = bridgeRef.current
							const island = b && e?.island(b.id)
							if (e && island) e.flyToIsland(island)
						}}
					/>
				</div>
			)}
			<p className="sr-only" aria-live="polite">
				{spoken}
			</p>
			{(loadingGrouping || (!map && !mapQuery.isError)) && (
				<p className="ex-loading">
					Laying the islands out by{" "}
					{GROUPING_NAMES[query.grouping].toLowerCase()}…
				</p>
			)}
			{map && !map.islands.length && !loadingGrouping && (
				<p className="ex-loading" role="status">
					{isAllTitleTypes(titleType) ? (
						"No titles pass these filters. Turn a filter off."
					) : (
						<NoTitlesOfType
							value={titleType}
							where="with these filters"
							onReset={(all) => setQuery(titleTypeParams(all))}
						/>
					)}
				</p>
			)}
			{mapQuery.isError && !map && (
				<p className="ex-loading" role="alert">
					The islands aren't ready yet. They'll appear in a moment.
				</p>
			)}
			{world && !(phone && active) && (
				<Minimap
					engine={engine}
					world={world}
					phone={phone}
					onGo={(x, y) => {
						const e = engineRef.current
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
			{!(phone && active?.pinned) && (
				<ZoomRail
					engine={engine}
					onStop={(s) => {
						const e = engineRef.current
						if (!e) return
						const v = e.view()
						if (s <= v.fit * 1.01) {
							unpin()
							e.overview()
							return
						}
						const island = v.focus
						if (island && Math.abs(Math.log(s / (v.stops[1] ?? 0))) < 0.01)
							return e.flyToIsland(island)
						e.zoomTo(s)
					}}
				/>
			)}
			{!active && !bar && !preview && focusIsland && (
				<div className="ex-where" aria-live="polite">
					<span
						className="ex-dot"
						style={{
							background: rgbCss(focusIsland.tint),
							boxShadow: `0 0 12px ${rgbCss(focusIsland.tint, 0.9)}`,
						}}
					/>
					<span className="ex-where-n">{focusIsland.name}</span>
					<span className="ex-where-c">
						{focusIsland.count.toLocaleString("en")} titles
					</span>
				</div>
			)}
			{map && !active && !bar && !combined && atOverview && (
				<p className="ex-hint">{hint}</p>
			)}
			{toast && <output className="ex-toast">{toast}</output>}
		</div>
	)
}
