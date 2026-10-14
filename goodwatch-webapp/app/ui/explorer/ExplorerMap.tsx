import useLocale from "~/utils/locale"
// The Explorer's page: one map with every grouping's islands, each grouping in a region of its own around a middle
// kept free. The Viewing menu flies to a region; a tap picks an island, which sails to the middle, and two to five
// picked islands raise their combination there.
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
	type CombinationKind,
	type ExplorerTitle,
	type ExplorerWorld,
	GROUPING_NAMES,
	MAX_PICKS,
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
import { Minimap } from "./Minimap"
import { Caption, ProximityCard } from "./ProximityCard"
import { Selection, type SelectionState } from "./Selection"
import { TopBar } from "./TopBar"
import { Tutorial, type TutorialStep, useTutorial } from "./Tutorial"
import { ZoomRail } from "./ZoomRail"
import {
	type MapQuery,
	type WorldQuery,
	explorerKeys,
	fetchCard,
	fetchCombination,
	fetchIsland,
	fetchParts,
	fetchShares,
	fetchWorld,
} from "./api"
import { rgbCss } from "./color"
import {
	combinationSentence,
	sharedLine,
	sharedNote,
} from "./combination-words"
import { type Drawn, type MapEngine, type Pad, createMapEngine } from "./engine"
import type { IslandInput, MapIsland } from "./island"
import { openingOf } from "./opening"
import { groupingOf, layRegions, localId, worldId } from "./regions"

/** The map's filters as the URL holds them (null is the default). */
type Filters = WorldQuery

/** The title whose card is open: nearest the focus, or pinned by a tap. */
interface Active {
	key: number
	island: string
	title: ExplorerTitle
	pinned: boolean
}

/** The combination that's up: the islands it joins (in the order picked) and what it holds. */
interface Mix {
	id: string
	of: string[]
	kind: CombinationKind
	count: number
}

/** The filters from the URL: `services=mine|all`, `unseen=0|1`, `type=movie|show`, `anime=only|none`. */
function filtersOf(params: URLSearchParams): Filters {
	const services = params.get("services")
	const unseen = params.get("unseen")
	return {
		services: services === "mine" || services === "all" ? services : null,
		unseen: unseen === "0" || unseen === "1" ? unseen : null,
		...titleTypeParams(parseTitleType(params)),
	}
}
const filterKey = (f: Filters) =>
	`${f.services}|${f.unseen}|${f.type}|${f.anime}`

const currentParams = () => new URLSearchParams(window.location.search)

const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

const sideOf = (island: MapIsland) => ({
	id: island.id,
	name: island.name,
	color: rgbCss(island.tint),
	group: GROUPING_NAMES[groupingOf(island.id)],
	total: island.count,
	posters: (island.top.length ? island.top : island.titles)
		.slice(0, 3)
		.map((t) => t.poster),
})

/**
 * The Explorer: every grouping's islands on one map, each grouping in a region of its own around a middle kept free.
 * Tapping an island picks it (up to five, from any regions) and shows what every other island would leave; two to
 * five picked islands raise their combination in the middle. Filters hide titles; the page never scrolls.
 */
export function ExplorerMap({
	initialWorld,
	fallback,
}: {
	/** The world the server rendered (a member's own; a guest's comes from their browser's progress). */
	initialWorld: ExplorerWorld | null
	/** What shows until the page runs: the islands as a list, for no JavaScript and search engines. */
	fallback?: ReactNode
}) {
	const [params, setParams] = useSearchParams()
	const filters = useMemo(() => filtersOf(params), [params])
	const { user, loading: userLoading } = useUser()
	const member = !!user
	const { locale } = useLocale()
	const viewer = user?.id ?? "guest"
	const queryClient = useQueryClient()

	// ------------------------------------------------------------ data

	const initialFilters = useRef(filters)
	const worldQuery = useQuery({
		queryKey: [...explorerKeys.world(viewer, filters), locale.language],
		// Each answer carries the filters it answers: while the next one loads, the previous world stays up.
		queryFn: async () => ({
			filters,
			maps: (await fetchWorld(filters, member, locale.language)).maps,
		}),
		enabled: !userLoading,
		placeholderData: keepPreviousData,
		// The server rendered the member's own world; a guest's depends on the progress their browser holds.
		initialData:
			member && initialWorld && filters === initialFilters.current
				? { filters, maps: initialWorld.maps }
				: undefined,
	})
	const maps = worldQuery.data?.maps ?? null
	const map = maps?.[0] ?? null
	/** The filters the shown world answers (the previous ones while the next loads). */
	const shown = worldQuery.data?.filters ?? null
	const shownRef = useRef(shown)
	shownRef.current = shown

	const hasServices = (map?.services.length ?? 0) > 0
	const onMyServices = hasServices && filters.services !== "all"
	const notSeenYet = filters.unseen !== "0"
	const titleType = useMemo(
		() => titleTypeOf(filters.type, filters.anime),
		[filters.type, filters.anime],
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

	const setFilters = (next: Partial<Filters>) => {
		const q = { ...filters, ...next }
		const out = currentParams()
		for (const key of ["services", "unseen", "type", "anime"] as const) {
			const value = q[key]
			if (value == null) out.delete(key)
			else out.set(key, value)
		}
		setParams(out, { replace: true, preventScrollReset: true })
	}
	/** The picked islands are in the URL (`mix=mood:dark,decade:1980s`), so a link or a reload keeps them. */
	const writePicks = (ids: readonly string[], step: boolean) => {
		const out = currentParams()
		const was = out.get("mix") ?? ""
		if (was === ids.join(",")) return
		if (ids.length) out.set("mix", ids.join(","))
		else out.delete("mix")
		// A pick the viewer made is a step of the browser's history, so Back lets the island go again.
		setParams(out, { replace: !step, preventScrollReset: true })
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
		() => (maps && aspect ? layRegions(maps, aspect) : null),
		[maps, aspect],
	)
	const inputs = useMemo<IslandInput[]>(
		() =>
			maps?.flatMap((m) =>
				m.islands.map((island) => ({
					id: worldId(m.grouping, island.id),
					name: island.name,
					color: island.color,
					count: island.count,
					medianMatch: island.medianMatch,
					logo: null,
					titles: island.titles,
				})),
			) ?? [],
		[maps],
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
	/** The region in the middle of the view, "hub" for the middle, "all" out at the world. */
	const [at, setAt] = useState<string>("all")
	const [toast, setToast] = useState<string | null>(null)
	const [touch, setTouch] = useState(false)
	useEffect(() => {
		setTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false)
	}, [])
	const cardEl = useRef<HTMLDivElement>(null)
	const anchorEl = useRef<HTMLDivElement>(null)
	const goEl = useRef<HTMLDivElement>(null)
	const captionEls = useRef(new Map<string, HTMLDivElement>())
	const layerEl = useRef<HTMLDivElement>(null)

	// Fingers on the card (or a caption) pinch the map too: one of two there, or both.
	useEffect(() => {
		const el = layerEl.current
		if (!el) return
		let pinchedAt = 0
		const on = (ev: PointerEvent) => {
			if (!engineRef.current?.forward(ev)) return
			pinchedAt = performance.now()
			ev.stopPropagation()
		}
		// The finger lifting off the card after a pinch doesn't press what's under it.
		const click = (ev: MouseEvent) => {
			if (performance.now() - pinchedAt < 400) {
				ev.preventDefault()
				ev.stopPropagation()
			}
		}
		// Off the card to anywhere but the map: the map lets the mouse go.
		const out = (ev: PointerEvent) => {
			const to = ev.relatedTarget
			if (
				ev.pointerType === "mouse" &&
				!(
					to instanceof Node &&
					(el.contains(to) || to === posterCanvas.current)
				)
			)
				engineRef.current?.leave()
		}
		el.addEventListener("pointerout", out)
		const kinds = [
			"pointerdown",
			"pointermove",
			"pointerup",
			"pointercancel",
		] as const
		for (const k of kinds) el.addEventListener(k, on, true)
		el.addEventListener("click", click, true)
		return () => {
			for (const k of kinds) el.removeEventListener(k, on, true)
			el.removeEventListener("click", click, true)
			el.removeEventListener("pointerout", out)
		}
	}, [])

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
		queryKey: [...explorerKeys.card(viewer, cardKey ?? 0), locale.language],
		queryFn: () => fetchCard(cardKey as number, member, locale.language),
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

	/** The picked islands, in the order picked: one to three, from any regions. */
	const [picks, setPicksState] = useState<string[]>([])
	const picksRef = useRef<string[]>([])
	const [mix, setMixState] = useState<Mix | null>(null)
	const mixRef = useRef<Mix | null>(null)
	const setMix = (m: Mix | null) => {
		mixRef.current = m
		setMixState(m)
	}
	/** The combination is up, waiting for its titles. */
	const [forming, setForming] = useState(false)

	/** What every other island would hold with the picked ones, for the counts on the islands. */
	const sharesQuery = useQuery({
		queryKey: [...explorerKeys.picked("shares", viewer, shown ?? filters, picks), locale.language],
		queryFn: () => fetchShares(shown as Filters, picks, member, locale.language),
		enabled:
			!!shown && !userLoading && picks.length > 0 && picks.length < MAX_PICKS,
	})
	const shares = useMemo(() => {
		const data = sharesQuery.data
		if (!data || [...data.of].sort().join(",") !== [...picks].sort().join(","))
			return null
		return new Map(data.shares.map((s) => [s.id, s]))
	}, [sharesQuery.data, picks])
	/** What each picked island does to the combination, for its row in the selection. */
	const partsQuery = useQuery({
		queryKey: [...explorerKeys.picked("parts", viewer, shown ?? filters, picks), locale.language],
		queryFn: () => fetchParts(shown as Filters, picks, member, locale.language),
		enabled: !!shown && !userLoading && picks.length > 1,
	})
	const parts =
		partsQuery.data && partsQuery.data.of.join(",") === picks.join(",")
			? partsQuery.data.without
			: null
	const sharesRef = useRef(shares)
	sharesRef.current = shares

	const namesOf = (ids: readonly string[]) => {
		const list = ids.map((id) => engineRef.current?.island(id)?.name ?? id)
		return list.length > 2
			? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`
			: list.join(" and ")
	}

	/**
	 * Sets the picked islands. Two to five raise their combination in the middle at once; it pulses while its titles
	 * load. A combination that holds nothing lets the last island go again.
	 */
	const applyPicks = async (next: string[], move = true): Promise<void> => {
		const e = engineRef.current
		const q = shownRef.current
		if (!e || !q) return
		const was = picksRef.current
		picksRef.current = next
		setPicksState(next)
		writePicks(next, move)
		e.setLit(next)
		unpin()
		if (next.length < 2) {
			e.lowerMix()
			setMix(null)
			setForming(false)
			// Back out to the whole map, so the next island can come from any group.
			if (move && next.length > was.length) e.overview()
			// Everything let go: the middle is empty again, so back out to the whole world.
			if (!next.length && was.length) e.overview()
			return
		}
		const known =
			was.length < next.length
				? sharesRef.current?.get(next[next.length - 1])
				: null
		setMix(null)
		if (!e.raiseMix(next, null, known ?? null)) return
		setForming(true)
		// Back out to the world while more can join; with every place taken, to the combination.
		if (move && was.length < next.length) {
			if (next.length < MAX_PICKS) e.overview()
			else e.flyToHub()
		}
		const tree = await queryClient
			.fetchQuery({
				queryKey: [...explorerKeys.picked("combination", viewer, q, next), locale.language],
				queryFn: () => fetchCombination(q, next, member, locale.language),
			})
			.catch(() => null)
		// Still the combination that's waiting: not changed since.
		if (
			engineRef.current !== e ||
			picksRef.current.join(",") !== next.join(",")
		)
			return
		setForming(false)
		if (!tree || !tree.titles.length) {
			say(
				tree
					? `${namesOf(next)} share no titles with these filters`
					: "That combination couldn't be raised. Try again in a moment.",
			)
			return applyPicks(next.slice(0, -1), false)
		}
		const island = e.fillMix(tree)
		if (!island) return
		setMix({ id: island.id, of: next, kind: tree.kind, count: tree.count })
	}
	const goRegion = (id: string) => {
		const e = engineRef.current
		if (!e) return
		unpin()
		if (id === "all") e.overview()
		else if (id === "hub") e.flyToHub()
		else e.flyToRegion(id)
	}
	/** Goes into an island. */
	const flyIn = (island: MapIsland) => {
		unpin()
		engineRef.current?.flyToIsland(island)
	}
	/** A tap on an island in among a region: pick it, let it go, or go into the combination. */
	const tapIsland = (island: MapIsland) => {
		if (island.bridge) return flyIn(island)
		const cur = picksRef.current
		if (cur.includes(island.id))
			return void applyPicks(cur.filter((id) => id !== island.id))
		if (cur.length >= MAX_PICKS)
			return say(`${MAX_PICKS} islands at most. Let one go to pick another.`)
		if (cur.length && sharesRef.current?.get(island.id)?.count === 0)
			return say(
				`${namesOf([...cur, island.id])} share no titles with these filters`,
			)
		void applyPicks([...cur, island.id])
	}
	const applyRef = useRef(applyPicks)
	applyRef.current = applyPicks
	// Back and Forward: the URL's picked islands changed without a pick here.
	const mixParam = params.get("mix") ?? ""
	useEffect(() => {
		const e = engineRef.current
		if (!e || !shownRef.current || mixParam === picksRef.current.join(","))
			return
		const want = mixParam
			.split(",")
			.filter((id) => e.island(id))
			.slice(0, MAX_PICKS)
		void applyRef.current(want, false)
		if (!want.length) e.overview()
	}, [mixParam])

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

	/** Positions the card beside its poster, the captions under theirs (clear of each other), and "Go in" on a lone picked island. */
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
		const gi =
			picksRef.current.length === 1 ? e.island(picksRef.current[0]) : null
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
	}
	const placeRef = useRef(place)
	placeRef.current = place
	useEffect(() => {
		placeRef.current()
		engineRef.current?.invalidate()
	}, [active, captions, card, picks, forming])

	// ------------------------------------------------------------ the engine

	const hooks = useRef(
		null as unknown as Parameters<typeof createMapEngine>[2]["current"],
	)
	hooks.current = {
		onTapRegion: (id) => goRegion(id),
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
		},
		onLongPress: (d) => pin(d),
		needTree: (island) => needTree.current(island),
		onFrame: () => compute(),
		onPointer: () => compute(),
		onHoverIsland: () => {},
		holdsPointer: (to) =>
			to instanceof Node && !!anchorEl.current?.contains(to),
	}

	/** Loads an island's tree once, for the query of the map it belongs to. */
	const needTree = useRef<(island: MapIsland) => void>(() => {})
	const asked = useRef(new Set<string>())
	needTree.current = (island) => {
		if (!shown || island.bridge) return
		const q: MapQuery = { ...shown, grouping: groupingOf(island.id) }
		const local = localId(island.id)
		const keyOf = [...explorerKeys.island(viewer, q, local), locale.language]
		const id = keyOf.join("|")
		if (asked.current.has(id)) return
		asked.current.add(id)
		queryClient
			.fetchQuery({
				queryKey: keyOf,
				queryFn: () => fetchIsland(q, local, member, locale.language),
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
				engine: e,
				view: () => e.view(),
				islands: () =>
					e.islands().map((i) => ({
						id: i.id,
						name: i.name,
						x: i.sx,
						y: i.sy,
						r: i.sr,
						on: i.on,
						role: i.role,
						count: i.count,
						loaded: i.loaded,
						bridge: i.bridge && { ...i.bridge },
					})),
				drawn: () => e.drawn().length,
				picks: () => picksRef.current,
				mix: () => mixRef.current,
				sea: () => e.seaKind(),
				busy: () => e.busy(),
				stats: () => e.stats(),
				pick: (ids: string[]) => applyRef.current(ids),
				go: (id: string) => goRef.current(id),
			}
		return () => {
			e.destroy()
			engineRef.current = null
		}
	}, [])

	const opened = useRef(false)
	const goRef = useRef(goRegion)
	goRef.current = goRegion
	useEffect(() => {
		if (!engine || !world || !shown) return
		engine.setWorld(world, inputs, `${filterKey(shown)}:${locale.language}`)
		setActive(null)
		picksRef.current = []
		setPicksState([])
		setMix(null)
		setForming(false)
		// The URL's picked islands, on the new world (after a reload, or other filters).
		const want = (currentParams().get("mix") ?? "")
			.split(",")
			.filter((id) => engine.island(id))
			.slice(0, MAX_PICKS)
		if (want.length) void applyRef.current(want)
		// A link to a grouping (`grouping=decade`, as older links have it) opens on its region, once; with an island
		// of it (`&island=funny`, as the TV's Expand key has it), inside that island.
		const to = openingOf(currentParams())
		if (!opened.current && !want.length && to) {
			const island = to.island && engine.island(worldId(to.grouping, to.island))
			if (island) engine.flyToIsland(island)
			else engine.flyToRegion(to.grouping)
		}
		opened.current = true
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
					v.focus && v.cam.s >= (v.stops[1] ?? v.base * 3) * 0.8
						? v.focus
						: null
				setFocusIsland((x) => (x === inside ? x : inside))
				const overview = v.cam.s <= v.fit * 1.05
				setAtOverview((x) => (x === overview ? x : overview))
				const near = engine.regionNear() ?? "all"
				setAt((x) => (x === near ? x : near))
			})
		})
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [engine])

	// Picked islands: every other island's name says what the combination would hold with it, and the islands that
	// would leave it empty go grey. With three picked nothing more can join.
	useEffect(() => {
		const e = engineRef.current
		if (!e) return
		const notes = new Map<string, string>()
		const dim = new Map<string, number>()
		if (picks.length && picks.length < MAX_PICKS && shares)
			for (const [id, s] of shares) {
				// An island that would leave the combination empty goes grey and loses its name.
				if (!s.count) dim.set(id, 1)
				else
					notes.set(
						id,
						sharedNote(
							s.count,
							s.kind,
							picks.length === 1 && groupingOf(picks[0]) === groupingOf(id),
						),
					)
			}
		e.setNotes(notes)
		e.setDim(dim)
		const first = picks.length === 1 ? e.island(picks[0]) : null
		e.setHubNote(
			first
				? {
						title: `${first.name} +`,
						sub: "Pick another island, from any group",
					}
				: {
						title: "Combine",
						sub: `Pick up to ${MAX_PICKS} islands, from any group`,
					},
		)
	}, [picks, shares, engine, world])

	/**
	 * The tutorial's step: it follows what the viewer has done (a group, an island, another group, an island there,
	 * Combined, a zoom into the combination), and ends once they've separated a combination.
	 */
	const [tutorial, endTutorial] = useTutorial(member, userLoading)
	const [toldSeparate, setToldSeparate] = useState(false)
	/** The viewer has zoomed into a combination of two: next come Show all, a third island, and Combined. */
	const [zoomed, setZoomed] = useState(false)
	let tutStep: TutorialStep | null = null
	// After Separate, one line on what else there is: more islands narrow a combination. It goes with the next pick.
	if (tutorial && maps && toldSeparate && picks.length < 2)
		tutStep = picks.length ? null : "more"
	else if (tutorial && maps && !active?.pinned) {
		const far = at === "all"
		const inside = !!focusIsland?.bridge
		if (picks.length >= 3 && (mix || forming))
			tutStep = at === "hub" || inside ? "separate" : "combined"
		else if (picks.length === 2 && (mix || forming))
			tutStep = !zoomed
				? at === "hub"
					? "zoom"
					: "combined"
				: at === "hub" || inside
					? "all"
					: far
						? "group3"
						: "three"
		else if (picks.length === 1 && at !== "hub")
			tutStep = far ? "group2" : "two"
		else if (!picks.length && at !== "hub") tutStep = far ? "group" : "one"
	}
	const inMix = picks.length === 2 && !!focusIsland?.bridge
	useEffect(() => {
		if (tutorial && inMix) setZoomed(true)
	}, [tutorial, inMix])
	useEffect(() => {
		if (tutStep === "separate") setToldSeparate(true)
	}, [tutStep])
	useEffect(() => {
		if (!toldSeparate || picks.length > 1) return
		if (picks.length) return endTutorial()
		const t = setTimeout(endTutorial, 9000)
		return () => clearTimeout(t)
	}, [toldSeparate, picks.length])

	// ------------------------------------------------------------ keyboard

	const keys = useRef({ pin, unpin, flyIn })
	keys.current = { pin, unpin, flyIn }
	useEffect(() => {
		const onKey = (ev: KeyboardEvent) => {
			const e = engineRef.current
			const el = stage.current
			const target = ev.target as HTMLElement | null
			if (!e || !el || !target || !el.contains(target)) return
			if (target.closest("input, textarea, select")) return
			const onMap = target === posterCanvas.current
			const a = activeRef.current
			const k = keys.current
			if (ev.key === "Escape") {
				// Undo, one layer at a time: the card, the island picked last, then a zoom step out.
				ev.preventDefault()
				if (a) k.unpin()
				else if (picksRef.current.length)
					void applyRef.current(picksRef.current.slice(0, -1), false)
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
			} else if (ev.key === "c" || ev.key === "C") {
				// One key between the two views: the combination, and the whole world.
				ev.preventDefault()
				goRef.current(e.regionNear() === "hub" ? "all" : "hub")
			} else if (ev.key === "0") {
				ev.preventDefault()
				k.unpin()
				e.overview()
			} else if (ev.key === "Enter") {
				ev.preventDefault()
				const lone =
					picksRef.current.length === 1 ? e.island(picksRef.current[0]) : null
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
	const loading = worldQuery.isPlaceholderData || (!maps && !worldQuery.isError)

	const islandOf = (id: string) => (engine ? engine.island(id) : null)
	const picked = picks.map(islandOf).filter((x): x is MapIsland => !!x)
	const litIsland = picks.length === 1 ? islandOf(picks[0]) : null
	const bar: SelectionState | null = picked.length
		? {
				list: picked.map((island, k) => ({
					...sideOf(island),
					without: parts?.[k] ?? null,
				})),
				status: forming
					? "finding what they share…"
					: mix
						? mix.of.length === 2 &&
							groupingOf(mix.of[0]) === groupingOf(mix.of[1])
							? sharedLine(mix.count, mix.kind)
							: combinationSentence(mix.count, picked.map(sideOf))
						: touch
							? "tap another island, in any group"
							: "click another island, in any group",
				count: mix && !forming ? mix.count : null,
				up: !!mix || forming,
				full: picked.length >= MAX_PICKS,
				max: MAX_PICKS,
				at: at === "hub" ? "hub" : atOverview ? "all" : "",
			}
		: null
	const selection = bar && (
		<Selection
			state={bar}
			phone={width < 768}
			onDrop={(id) => void applyPicks(picks.filter((x) => x !== id))}
			onClear={() => void applyPicks([])}
			onGo={() => goRegion("hub")}
			onAll={() => goRegion("all")}
			nudge={
				tutStep === "combined" || tutStep === "all" || tutStep === "separate"
					? { at: tutStep, touch }
					: null
			}
		/>
	)
	const spoken = !bar
		? ""
		: `${bar.list.map((s) => s.name).join(" + ")}: ${bar.status}.`

	const hint = atOverview
		? touch
			? "Tap a group to go to its islands."
			: "Click a group to go to its islands."
		: touch
			? "Tap an island to pick it. Up to five, from any groups, combine in the middle."
			: "Click an island to pick it. Up to five, from any groups, combine in the middle."
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
					maps
						? `Islands map of films and shows in ${maps.length} groups. Arrow keys move between titles, plus and minus zoom, Enter opens a title, Escape steps back.`
						: "Islands map"
				}
			/>
			{fallback}
			<div ref={layerEl} className="ex-layer">
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
				selection={bar && !(phone && active?.pinned) ? selection : null}
				phone={width < 768}
				groupings={
					maps?.map((m) => ({ id: m.grouping, islands: m.islands.length })) ??
					[]
				}
				at={at}
				onGo={goRegion}
				picked={picks.length}
				onMyServices={onMyServices}
				notSeenYet={notSeenYet}
				services={map?.services ?? []}
				onServices={(on) => setFilters({ services: on ? null : "all" })}
				onUnseen={(on) => setFilters({ unseen: on ? null : "0" })}
				titleType={titleType}
				onTitleType={(next) => setFilters(titleTypeParams(next))}
			/>
			<p className="sr-only" aria-live="polite">
				{spoken}
			</p>
			{loading && <p className="ex-loading">Laying the world out…</p>}
			{maps && !inputs.length && !loading && (
				<p className="ex-loading" role="status">
					{isAllTitleTypes(titleType) ? (
						"No titles pass these filters. Turn a filter off."
					) : (
						<NoTitlesOfType
							value={titleType}
							where="with these filters"
							onReset={(all) => setFilters(titleTypeParams(all))}
						/>
					)}
				</p>
			)}
			{worldQuery.isError && !maps && (
				<p className="ex-loading" role="alert">
					The islands aren't ready yet. They'll appear in a moment.
				</p>
			)}
			{world && !(phone && active) && (
				<Minimap
					engine={engine as unknown as MapEngine}
					world={world}
					phone={phone}
					onGo={(x, y) => {
						const e = engineRef.current
						if (!e) return
						const v = e.view()
						e.flyTo({
							x,
							y,
							s: Math.max(v.cam.s, v.base),
						})
					}}
				/>
			)}
			{!(phone && active?.pinned) && (
				<ZoomRail
					engine={engine as unknown as MapEngine}
					onStop={(s) => {
						const e = engineRef.current
						if (!e) return
						const v = e.view()
						const island = v.focus
						if (island && Math.abs(Math.log(s / (v.stops[1] ?? 0))) < 0.01)
							return e.flyToIsland(island)
						e.zoomTo(s)
					}}
				/>
			)}
			{!active && !bar && focusIsland && (
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
			{tutStep ? (
				<Tutorial
					engine={engine}
					touch={touch}
					step={tutStep}
					picks={picks}
					empty={(id) => shares?.get(id)?.count === 0}
					onSkip={endTutorial}
				/>
			) : (
				maps &&
				!tutorial &&
				!active &&
				!bar &&
				!focusIsland && <p className="ex-hint">{hint}</p>
			)}
			{toast && <output className="ex-toast">{toast}</output>}
		</div>
	)
}
