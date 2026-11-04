// More like this's expanded view: a shelf's See more turns the section into the page's only one. Every shelf is a
// block, one after the other in the shelves' order (the watch order first), each two rows of bigger cards with a sort
// and a Show all into Discover (ExpandedShelves.tsx). The view starts at the block of the shelf that was opened.
// The frame stays the title page's: the opener, the trailer and the other sections step out (the opener into the
// title bar, which becomes the sub-page header with its way back), the section header stays, the rail stays and lists
// the shelves under More like this (rail/TitleRail.tsx reads them from shelfBridge), marking the block being read.
// Opening pushes ?shelf=<shelf> (history.pushState, so nothing reloads), and Back, Escape and the header fold it back:
// the page's scroll and each row's offset are put back exactly. Motion: transform and opacity only, none with reduced
// motion.
import { useLocation } from "@remix-run/react"
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { shelfBridge } from "~/ui/details/rail/rail-model"
import { useSpy } from "~/ui/details/rail/spy"
import {
	FRAME_STYLE,
	FrameBar,
	type Tab,
	barBottom,
	moreSection,
	scrollSectionUnderBar,
	takePage,
} from "./expanded-frame"
import {
	EASE,
	IN,
	OUT,
	type Rects,
	flipIn,
	rectsOf,
	reducedMotion,
	restoreScroll,
	settle,
} from "./motion"

/** What a shelf tells the provider: its section, its count and its first posters (for the rail's shelf cards). */
export interface Entry {
	el: HTMLElement | null
	count: number
	posters: (string | null)[]
}

interface Opened {
	id: string
	phase: "in" | "open"
	head: DOMRect | null
	cards: Rects
	tabs: Tab[]
}

/** What the fold back needs from just before it. */
interface Leaving {
	id: string
	cards: Rects
	head: DOMRect | null
	header: DOMRect | null
	barPoster: DOMRect | null
	barName: DOMRect | null
}

interface Ctx {
	opened: Opened | null
	/** The block being read (the opened shelf's at first). */
	active: string | null
	/** A block's place among the expanded view's blocks (-1: not one of them). */
	blockAt: (id: string) => number
	slot: HTMLElement | null
	open: (id: string) => void
	close: () => void
	hop: (id: string) => void
	register: (id: string, entry: Entry) => () => void
}

/**
 * A popstate listener added when this module is first evaluated: with the page's route modules, before the app's
 * router adds its own. Listeners on the window run in the order they were added (capture or not), so this one can
 * stop a popstate the router mustn't see. Once per document (a hot update evaluates the module again).
 */
function makePopGate() {
	if (typeof window === "undefined") return null
	const w = window as unknown as {
		__shelvesPopGate?: { handle: (() => boolean) | null }
	}
	if (!w.__shelvesPopGate) {
		const gate = { handle: null as (() => boolean) | null }
		window.addEventListener("popstate", (e) => {
			if (gate.handle?.()) e.stopImmediatePropagation()
		})
		w.__shelvesPopGate = gate
	}
	return w.__shelvesPopGate
}
const popGate = makePopGate()

const ExpandContext = createContext<Ctx | null>(null)
export const useExpand = () => useContext(ExpandContext)

const withShelf = (id: string | null) => {
	const url = new URL(window.location.href)
	if (id) url.searchParams.set("shelf", id.replace(/^shelf-/, ""))
	else url.searchParams.delete("shelf")
	return url.pathname + url.search + url.hash
}

const rectOf = (el: Element | null | undefined) =>
	el?.getBoundingClientRect() ?? null
const visibleOne = (sel: string) =>
	[...document.querySelectorAll(sel)].find(
		(el) => el.getBoundingClientRect().width > 0,
	) ?? null
/** The title page's opener: its poster and title condense into the title bar. */
const opener = () =>
	document.querySelector("#overview h1")?.closest("header") ?? null
const onScreen = (r: DOMRect | null) =>
	!!r && r.bottom > 0 && r.top < window.innerHeight && r.width > 0

/** Block `id` of the expanded view under `root`. */
export const blockIn = (root: ParentNode | null | undefined, id: string) =>
	root?.querySelector<HTMLElement>(`[data-shelf-block="${CSS.escape(id)}"]`) ??
	null

/** `el` moves from `from` to where it is now (translate, and scale when `scale`). */
function flipFrom(
	el: Element | null | undefined,
	from: DOMRect | null,
	opts: { scale?: boolean; duration?: number } = {},
) {
	if (!el || !from || reducedMotion()) return []
	const now = el.getBoundingClientRect()
	if (!now.width) return []
	const dx = from.left - now.left
	const dy = from.top - now.top
	if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return []
	const s = opts.scale ? from.height / now.height : 1
	;(el as HTMLElement).style.transformOrigin = "0 0"
	return [
		el.animate(
			[
				{ transform: `translate(${dx}px, ${dy}px) scale(${s})` },
				{ transform: "none" },
			],
			{ duration: opts.duration ?? IN, easing: EASE },
		),
	]
}

const fadeIn = (
	els: Iterable<Element>,
	delay = IN * 0.25,
	duration = IN * 0.75,
) =>
	reducedMotion()
		? []
		: [...els].map((el) =>
				el.animate([{ opacity: 0 }, { opacity: 1 }], {
					duration,
					delay,
					easing: EASE,
					fill: "backwards",
				}),
			)

export function ExpandProvider({
	pageTitle,
	poster,
	end,
	children,
}: {
	pageTitle: string
	poster: string | null
	/** At the header's right (the score), as on the routed sub-pages. */
	end?: ReactNode
	children: ReactNode
}) {
	const [shelvesVer, setShelvesVer] = useState(0)
	const [opened, setOpened] = useState<Opened | null>(null)
	const [active, setActive] = useState<string | null>(null)
	/** A jump (or the opening) pins the mark on its block until the reader scrolls on their own. */
	const pinned = useRef(false)
	const [slot, setSlot] = useState<HTMLElement | null>(null)
	const slotRef = useRef<HTMLElement | null>(null)
	slotRef.current = slot
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const entries = useRef(new Map<string, Entry>())
	const openRef = useRef<Opened | null>(null)
	openRef.current = opened
	const pushed = useRef(false)
	/** The Back this code asked for itself (close): its popstate is this code's, not the router's. */
	const ownPop = useRef(false)
	const y = useRef(0)
	const untake = useRef<(() => void) | null>(null)
	const rows = useRef(new Map<HTMLElement, number>())
	const leaving = useRef<Leaving | null>(null)
	const before = useRef<{
		header: DOMRect | null
		poster: DOMRect | null
		name: DOMRect | null
		bar: boolean
	} | null>(null)
	const focusBack = useRef<HTMLElement | null>(null)
	const root = useRef<HTMLDivElement>(null)

	const register = useCallback((id: string, entry: Entry) => {
		entries.current.set(id, entry)
		setShelvesVer((v) => v + 1)
		return () => {
			if (entries.current.get(id) === entry) entries.current.delete(id)
			setShelvesVer((v) => v + 1)
		}
	}, [])

	/** `keep`: blocks already in the expanded view stay while it is open, even when a control empties them. */
	const tabsNow = useCallback(
		(keep?: ReadonlySet<string>): Tab[] =>
			[...entries.current.entries()]
				.filter(
					([id, e]) => e.el?.isConnected && (e.count > 0 || keep?.has(id)),
				)
				.sort(([, a], [, b]) =>
					a.el &&
					b.el &&
					a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
						? -1
						: 1,
				)
				.map(([id, e]) => ({
					id,
					kind: e.el?.querySelector("[data-shelf-kind]")?.textContent ?? "",
					title: e.el?.querySelector("h3")?.textContent ?? "",
					count: e.count,
					posters: e.posters.slice(0, 3),
					head: rectOf(e.el?.querySelector("[data-shelf-head]")),
				})),
		[],
	)

	const labelOf = (id: string) =>
		entries.current.get(id)?.el?.querySelector("[data-shelf-kind]")
			?.textContent ?? "More like this"

	const sectionHeader = () =>
		moreSection(root.current)?.querySelector(":scope > header") ?? null

	// --- open, close, hop --------------------------------------------------------------------------------------------

	const open = useCallback(
		(id: string) => {
			if (openRef.current) return
			const entry = entries.current.get(id)
			if (!entry) return
			y.current = window.scrollY
			focusBack.current = document.activeElement as HTMLElement | null
			window.history.pushState(window.history.state, "", withShelf(id))
			pushed.current = true
			rows.current = new Map(
				[
					...(root.current?.querySelectorAll<HTMLElement>("[data-shelf-row]") ??
						[]),
				].map((r) => [r, r.scrollLeft]),
			)
			before.current = {
				header: rectOf(sectionHeader()),
				poster: rectOf(opener()?.querySelector("img")),
				name: rectOf(opener()?.querySelector("h1")),
				bar:
					document
						.querySelector("[data-title-bar]")
						?.getAttribute("aria-hidden") === "false",
			}
			pinned.current = true
			setActive(id)
			setOpened({
				id,
				phase: "in",
				head: rectOf(entry.el?.querySelector("[data-shelf-head]")),
				cards: rectsOf(entry.el?.querySelector("[data-shelf-row]")),
				tabs: tabsNow(),
			})
		},
		[tabsNow],
	)

	const beginClose = useCallback(() => {
		const o = openRef.current
		if (!o) return
		const block = blockIn(slotRef.current, o.id) ?? slotRef.current
		leaving.current = {
			id: o.id,
			cards: rectsOf(block),
			head: rectOf(block?.querySelector("[data-shelf-head]")),
			header: rectOf(sectionHeader()),
			barPoster: rectOf(document.querySelector("[data-sub-bar-poster]")),
			barName: rectOf(visibleOne("[data-sub-bar-name]")),
		}
		setOpened(null)
	}, [])

	const close = useCallback(() => {
		if (!openRef.current) return
		if (pushed.current) {
			pushed.current = false
			ownPop.current = true
			window.history.back()
		}
		beginClose()
	}, [beginClose])

	/** Scrolls the expanded view so block `id`'s top sits under the header (the first block: the section's top). */
	const scrollToBlock = useCallback((id: string, smooth: boolean) => {
		const el = blockIn(slotRef.current, id)
		if (!el) return
		const behavior = (
			smooth && !reducedMotion() ? "smooth" : "instant"
		) as ScrollBehavior
		const section = moreSection(root.current)
		const first = openRef.current?.tabs[0]?.id === id && section
		const top = first
			? window.scrollY +
				section.getBoundingClientRect().top +
				(Number.parseFloat(getComputedStyle(section).paddingTop) || 0)
			: window.scrollY + el.getBoundingClientRect().top
		window.scrollTo({
			top: Math.max(0, top - barBottom() - 20),
			left: window.scrollX,
			behavior,
		})
	}, [])

	// A jump to another block: the view scrolls to it.
	const hop = useCallback(
		(id: string) => {
			if (!openRef.current || !entries.current.has(id)) return
			window.history.replaceState(window.history.state, "", withShelf(id))
			pinned.current = true
			setActive(id)
			scrollToBlock(id, true)
		},
		[scrollToBlock],
	)

	// Back (or Forward past it) folds it. The router never heard of the ?shelf= entry, so it mustn't hear of leaving
	// it either (it would take it for a navigation, run the loaders again and put its saved scroll position over the
	// one put back here): the pop gate, a listener that runs before the router's, answers it and stops it.
	useEffect(() => {
		if (!popGate) return
		const onPop = () => {
			if (ownPop.current) {
				ownPop.current = false
				return true
			}
			if (openRef.current && pushed.current) {
				pushed.current = false
				beginClose()
				return true
			}
			return false
		}
		popGate.handle = onPop
		return () => {
			if (popGate.handle === onPop) popGate.handle = null
		}
	}, [beginClose])

	// Escape, unless the quick view (over it) has it.
	useEffect(() => {
		if (!opened) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || document.querySelector("[data-quick-view]"))
				return
			e.preventDefault()
			close()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [opened, close])

	// Another page (a title opened from the quick view): drop it at once, nothing to put back.
	const { pathname } = useLocation()
	const shownPath = useRef(pathname)
	useEffect(() => {
		if (shownPath.current === pathname) return
		shownPath.current = pathname
		if (!openRef.current) return
		pushed.current = false
		leaving.current = null
		setOpened(null)
		untake.current?.()
		untake.current = null
	}, [pathname])
	useEffect(
		() => () => {
			untake.current?.()
		},
		[],
	)

	// --- the motion: in and out -----------------------------------------------------------------------------------------

	useLayoutEffect(() => {
		const o = opened
		const section = moreSection(root.current)
		if (o && o.phase === "in") {
			const b = before.current
			if (section) {
				untake.current = takePage(section)
				scrollSectionUnderBar(section)
			}
			// The view starts at the opened shelf's block.
			if (o.tabs[0]?.id !== o.id) scrollToBlock(o.id, false)
			const as: Animation[] = []
			// The section header stays the page's: it slides from where it was to under the bar.
			as.push(...flipFrom(sectionHeader(), b?.header ?? null))
			// The opened shelf's heading and cards go to their places in its block; the other blocks' cards stream in.
			const mine = blockIn(slot, o.id) ?? slot
			as.push(...flipFrom(mine?.querySelector("[data-shelf-head]"), o.head))
			for (const el of slot?.querySelectorAll("[data-shelf-block]") ?? [])
				if (el !== mine) as.push(...flipIn(el, new Map()))
			as.push(...flipIn(mine, o.cards))
			as.push(...fadeIn(slot?.querySelectorAll("[data-shelf-fade]") ?? []))
			// When the bar wasn't up, the opener condenses into it.
			const bar = document.querySelector("[data-sub-bar]")
			if (!reducedMotion() && b && !b.bar && bar) {
				bar.animate([{ opacity: 0 }, { opacity: 1 }], {
					duration: 200,
					easing: EASE,
				})
				if (onScreen(b.poster))
					as.push(
						...flipFrom(bar.querySelector("[data-sub-bar-poster]"), b.poster, {
							scale: true,
						}),
					)
				if (onScreen(b.name))
					as.push(
						...flipFrom(visibleOne("[data-sub-bar-name]"), b.name, {
							scale: true,
						}),
					)
			}
			before.current = null
			let cancelled = false
			settle(as).then(() => {
				if (cancelled) return
				setOpened((cur) =>
					cur && cur.phase === "in" ? { ...cur, phase: "open" } : cur,
				)
				document
					.querySelector<HTMLElement>("[data-sub-bar] [data-sub-bar-back]")
					?.focus({ preventScroll: true })
			})
			return () => {
				cancelled = true
			}
		}
		const l = leaving.current
		if (!o && l) {
			leaving.current = null
			untake.current?.()
			untake.current = null
			// Each row's offset, with its snapping off while its cards land (a snap would move it to a card's moving box).
			const offsets = [...rows.current].filter(([row]) => row.isConnected)
			rows.current.clear()
			for (const [row, left] of offsets) {
				row.style.scrollSnapType = "none"
				row.scrollLeft = left
			}
			restoreScroll(y.current)
			// Everything goes back where it was: the cards into their row, the heading into the shelf, the header to its
			// place, and (when it's on the screen again) the opener out of the title bar.
			const el = entries.current.get(l.id)?.el
			const as: Animation[] = []
			if (!reducedMotion()) {
				as.push(...flipIn(el?.querySelector("[data-shelf-row]"), l.cards, OUT))
				as.push(
					...flipFrom(el?.querySelector("[data-shelf-head]"), l.head, {
						duration: OUT,
					}),
				)
				as.push(...flipFrom(sectionHeader(), l.header, { duration: OUT }))
				const poster = opener()?.querySelector("img")
				const name = opener()?.querySelector("h1")
				if (onScreen(rectOf(poster)))
					as.push(
						...flipFrom(poster, l.barPoster, { scale: true, duration: OUT }),
					)
				if (onScreen(rectOf(name)))
					as.push(...flipFrom(name, l.barName, { scale: true, duration: OUT }))
			}
			settle(as).then(() => {
				for (const [row, left] of offsets) {
					row.style.scrollSnapType = ""
					row.scrollLeft = left
				}
			})
			focusBack.current?.focus({ preventScroll: true })
			focusBack.current = null
		}
	}, [opened?.id, opened?.phase, opened === null])

	// The shelves, the block being read and the ways to open, hop and close, for the rail (rail/TitleRail.tsx).
	useEffect(() => {
		const f = requestAnimationFrame(() =>
			shelfBridge.set({
				shelves: (openRef.current?.tabs ?? tabsNow()).map(
					({ head: _h, ...t }) => t,
				),
				opened: opened ? (active ?? opened.id) : null,
				open: (id) => open(id),
				hop,
				close,
			}),
		)
		return () => cancelAnimationFrame(f)
	}, [shelvesVer, opened?.id, active, open, hop, close])
	useEffect(() => () => shelfBridge.set(null), [])

	// Shelves that arrive (or change) while the view is open join it; the ones in it stay.
	useEffect(() => {
		if (!openRef.current) return
		setOpened((cur) => {
			if (!cur) return cur
			const tabs = tabsNow(new Set(cur.tabs.map((t) => t.id)))
			const same =
				tabs.length === cur.tabs.length &&
				tabs.every(
					(t, i) =>
						t.id === cur.tabs[i].id &&
						t.count === cur.tabs[i].count &&
						t.title === cur.tabs[i].title,
				)
			return same ? cur : { ...cur, tabs }
		})
	}, [shelvesVer])

	// The block at the reading line is the active one, once the reader scrolls on their own.
	const reading = opened?.phase === "open"
	useEffect(() => {
		if (!opened) return
		const free = () => {
			pinned.current = false
		}
		const onKey = (e: KeyboardEvent) => {
			if (
				[
					"ArrowDown",
					"ArrowUp",
					"PageDown",
					"PageUp",
					"Home",
					"End",
					" ",
				].includes(e.key)
			)
				free()
		}
		// A drag on the scrollbar: a press outside the page's content.
		const onDown = (e: PointerEvent) => {
			if (e.clientX >= document.documentElement.clientWidth) free()
		}
		window.addEventListener("wheel", free, { passive: true })
		window.addEventListener("touchmove", free, { passive: true })
		window.addEventListener("keydown", onKey)
		window.addEventListener("pointerdown", onDown)
		return () => {
			window.removeEventListener("wheel", free)
			window.removeEventListener("touchmove", free)
			window.removeEventListener("keydown", onKey)
			window.removeEventListener("pointerdown", onDown)
		}
	}, [!!opened])
	const spyKeys = reading ? opened.tabs.map((t) => t.id) : []
	const spied = useSpy(
		spyKeys,
		(k) => blockIn(slot, k),
		reading ? barBottom() : 0,
		reading,
	)
	useEffect(() => {
		if (!spied || pinned.current || !openRef.current) return
		setActive(spied)
		window.history.replaceState(window.history.state, "", withShelf(spied))
	}, [spied])

	const value = useMemo<Ctx>(
		() => ({
			opened,
			active,
			blockAt: (id) => opened?.tabs.findIndex((t) => t.id === id) ?? -1,
			slot,
			open,
			close,
			hop,
			register,
		}),
		[opened, active, slot, open, close, hop, register],
	)

	const on = active ?? opened?.id ?? ""
	return (
		<ExpandContext.Provider value={value}>
			<style>{FRAME_STYLE}</style>
			<div ref={root}>
				<div hidden={!!opened}>{children}</div>
				<div hidden={!opened}>
					<div ref={setSlot} className="flex flex-col gap-14" />
				</div>
			</div>
			{mounted &&
				opened &&
				createPortal(
					<FrameBar
						poster={poster}
						title={pageTitle}
						trail={["More like this", labelOf(on)]}
						onBack={close}
						end={end}
					/>,
					document.body,
				)}
		</ExpandContext.Provider>
	)
}

/**
 * A shelf's block in the expanded view, while it is open: portalled into the view in the shelves' order (CSS order,
 * as the blocks are portalled in whenever their shelf renders).
 */
export function ExpandPortal({ id, block }: { id: string; block: ReactNode }) {
	const x = useExpand()
	if (!x?.opened || !x.slot) return null
	const at = x.blockAt(id)
	if (at < 0) return null
	return createPortal(
		<div data-shelf-block={id} style={{ order: at }} className="min-w-0">
			{block}
		</div>,
		x.slot,
	)
}
