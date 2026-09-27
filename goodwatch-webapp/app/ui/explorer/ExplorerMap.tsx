import { useSearchParams } from "@remix-run/react"
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
	type ExplorerMap as MapData,
	type ExplorerTitle,
	GROUPING_NAMES,
	isGrouping,
} from "~/domain/explorer"
import { useUser } from "~/utils/auth"
import {
	type MapQuery,
	explorerKeys,
	fetchCard,
	fetchIsland,
	fetchMap,
} from "./api"
import { rgbCss } from "./color"
import { type Drawn, type MapEngine, type Pad, createMapEngine } from "./engine"
import type { IslandInput, MapIsland } from "./island"
import { Caption, ProximityCard } from "./ProximityCard"
import { TopBar } from "./TopBar"
import { layWorld } from "./world"
import { ZoomRail } from "./ZoomRail"

/** The title whose card is open: nearest the focus, or pinned by a tap. */
interface Active {
	key: number
	island: string
	title: ExplorerTitle
	pinned: boolean
}

/** The map's query from the URL: `grouping`, `services=mine|all`, `unseen=0|1`; defaults are left out. */
export function mapQueryOf(params: URLSearchParams): MapQuery {
	const grouping = params.get("grouping")
	const services = params.get("services")
	const unseen = params.get("unseen")
	return {
		grouping: isGrouping(grouping) ? grouping : "genre",
		services: services === "mine" || services === "all" ? services : null,
		unseen: unseen === "0" || unseen === "1" ? unseen : null,
	}
}

/**
 * The Explorer's islands map: the grouping's islands on the sea, their titles as lit posters that grow as you zoom in,
 * and the card of the title nearest the focus over the live map. Filters hide titles; the page never scrolls.
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

	const hasServices = (map?.services.length ?? 0) > 0
	const onMyServices = hasServices && query.services !== "all"
	const notSeenYet = query.unseen !== "0"
	const [seenNow, setSeenNow] = useState<ReadonlySet<number>>(new Set())
	/** On my services and Not seen yet hide titles, never dim them, as soon as they're switched. */
	const visible = useCallback(
		(t: ExplorerTitle) =>
			(!onMyServices || !!map?.approximate || t.services.length > 0) &&
			(!notSeenYet || !(t.seen || seenNow.has(t.key))),
		[onMyServices, notSeenYet, seenNow, map?.approximate],
	)

	const setQuery = (next: Partial<MapQuery>) => {
		const q = { ...query, ...next }
		const out = new URLSearchParams(params)
		const put = (key: string, value: string | null) => {
			if (value == null) out.delete(key)
			else out.set(key, value)
		}
		put("grouping", q.grouping === "genre" ? null : q.grouping)
		put("services", q.services)
		put("unseen", q.unseen)
		setParams(out, { replace: true, preventScrollReset: true })
	}

	// ------------------------------------------------------------ the stage

	const stage = useRef<HTMLDivElement>(null)
	const seaCanvas = useRef<HTMLCanvasElement>(null)
	const posterCanvas = useRef<HTMLCanvasElement>(null)
	const engineRef = useRef<MapEngine | null>(null)
	const [engine, setEngine] = useState<MapEngine | null>(null)
	const [aspect, setAspect] = useState<number | null>(null)
	const [width, setWidth] = useState(1440)
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
			padRef.current =
				w >= 1024
					? { t: t + 8, r: 80, b: 72, l: 24 }
					: { t: t + 8, r: 12, b: w < 640 ? 150 : 120, l: 12 }
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
				logo:
					map.grouping === "streaming"
						? (map.services.find((s) => String(s.id) === island.id)?.logo ??
							null)
						: null,
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
	const flyIn = (island: MapIsland) => {
		unpin()
		engineRef.current?.flyToIsland(island)
	}

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

	/** Positions the card beside its poster and the captions under theirs, keeping them clear of each other. */
	const place = () => {
		const e = engineRef.current
		if (!e) return
		const { w, h } = e.size()
		const a = activeRef.current
		const el = anchorEl.current
		let box: { x: number; y: number; w: number; h: number } | null = null
		if (el && a && form === "float") {
			const d = e.find(a.key, a.island)
			const cw = el.offsetWidth || 340
			const ch = el.offsetHeight || 420
			if (d) {
				const p = padRef.current
				let x = d.cx + d.w * 0.56 + 22
				let side = "0%"
				if (x + cw > w - p.r + 40) {
					x = d.cx - d.w * 0.56 - 22 - cw
					side = "100%"
				}
				if (x < 8) x = Math.min(w - cw - 8, Math.max(8, d.cx - cw / 2))
				const y = Math.min(
					h - ch - 12,
					Math.max(Math.min(p.t - 4, h - ch - 12), d.cy - ch * 0.36),
				)
				el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`
				el.style.visibility = "visible"
				el.style.setProperty("--ox", side)
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
	}
	const placeRef = useRef(place)
	placeRef.current = place
	useEffect(() => {
		placeRef.current()
		engineRef.current?.invalidate()
	}, [active, captions, card])

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
			flyIn(island)
		},
		onTapWater: () => {
			unpin()
		},
		onLongPress: (d) => pin(d),
		needTree: (island) => needTree.current(island),
		onFrame: () => compute(),
		onPointer: () => compute(),
		onHoverIsland: () => {},
	}

	/** Loads an island's tree once, for the query of the map it belongs to. */
	const needTree = useRef<(island: MapIsland) => void>(() => {})
	const asked = useRef(new Set<string>())
	needTree.current = (island) => {
		const q = shownQuery
		if (!q) return
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
					})),
				active: () =>
					activeRef.current && {
						key: activeRef.current.key,
						title: activeRef.current.title.title,
						pinned: activeRef.current.pinned,
					},
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
		engine.setWorld(
			world,
			inputs,
			`${map.grouping}|${shownQuery.services}|${shownQuery.unseen}`,
		)
		setActive(null)
	}, [engine, world])
	useEffect(() => {
		engine?.refilter()
		const a = activeRef.current
		if (a && !visible(a.title) && !a.pinned) setActive(null)
	}, [visible])

	useEffect(() => {
		if (!engine) return
		let raf = 0
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
			})
		})
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [engine])

	// Escape closes a card that was kept open.
	useEffect(() => {
		const onKey = (ev: KeyboardEvent) => {
			if (ev.key !== "Escape" || !activeRef.current?.pinned) return
			const at = document.activeElement
			// Not while a menu, a field, or a dialog elsewhere on the page has the keys.
			if (at && at !== document.body && !stage.current?.contains(at)) return
			setActive(null)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [setActive])

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
	return (
		<div ref={stage} className="ex-stage">
			{/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas isn't focusable; the sea is decoration. */}
			<canvas ref={seaCanvas} className="ex-sea" aria-hidden="true" />
			{/* biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: the map is one application-like control (spec). */}
			<canvas
				ref={posterCanvas}
				className="ex-posters"
				role="application"
				tabIndex={0}
				aria-label={
					map
						? `Islands map of ${map.total.toLocaleString("en")} films and shows by ${groupingName}, ${map.islands.length} islands`
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
			/>
			{(loadingGrouping || (!map && !mapQuery.isError)) && (
				<p className="ex-loading">
					Laying the islands out by{" "}
					{GROUPING_NAMES[query.grouping].toLowerCase()}…
				</p>
			)}
			{mapQuery.isError && !map && (
				<p className="ex-loading" role="alert">
					The islands aren't ready yet. They'll appear in a moment.
				</p>
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
			{!active && focusIsland && (
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
			{map && !active && atOverview && (
				<p className="ex-hint">
					{touch
						? "Tap an island to go in, or pinch to zoom."
						: "Click an island to go in, or scroll to zoom in on its titles."}
				</p>
			)}
			{toast && <output className="ex-toast">{toast}</output>}
		</div>
	)
}
