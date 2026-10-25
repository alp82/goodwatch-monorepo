// The For you page: unseen, worthwhile picks steered by the taste print and a recipe.
//
// Phones:
// - the results start with the strip: the top four big with titles, then six small (Results.tsx). A drawer (the
//   recipes, or the big print) slides up from the bottom and covers the page from just under those two rows, so the
//   strip re-orders on every pick and handle snap while you play; closing the drawer uncovers the rest of the list.
// - three surfaces, clearly apart: the page with the strip, the drawer (a lighter sheet with rounded top corners), and
//   the taste bar (TasteBar.tsx). Tap the bar's small print: the print drawer; tap the recipe: the recipe drawer; tap
//   the active one again, the strip, Done or Escape, or drag the drawer's head down to close. Every drawer dims the
//   page behind it like the title drawer does. While a drawer is open, or the bar is still sliding back, the site's
//   bottom nav steps back (useQuietDock).
// - the print drawer has no instructions: a ghost fingertip drags one handle out and back (DragHint.tsx) on its first
//   open and at most once more after a long idle.
// - a tap on a pick opens the title drawer (TitleDrawer.tsx).
//
// Desktop: the print top left, filling a column as tall as the two rows of recipe tiles beside it; the dice top left,
// Reset bottom left; the results full width below. A tap on a pick opens the pop-out card (PopOutCard.tsx).
//
// No totals or counts anywhere; the recipe tiles never move while you steer.
import { Link, useRevalidator, useSearchParams } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion"
import {
	forwardRef,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	type ForYouPage as ForYouPageData,
	type ForYouPool,
	type ForYouTaste,
	decodeFingerprints,
} from "~/domain/for-you-page/contract"
import { type Ranked, poolStats } from "~/domain/for-you-page/rank"
import { MIN_FIT } from "~/domain/for-you-page/recipes"
import type { Recipe } from "~/domain/for-you-page/shape"
import { DISPLAY } from "~/ui/my-pages/bits"
import { useQuietDock } from "~/ui/navigation"
import { useNavigation } from "~/ui/navigation/NavigationContext"
import { DragHint } from "./DragHint"
import { type GuestLoader, GuestLock } from "./GuestLock"
import { HandlePrint } from "./HandlePrint"
import { Heading, PhoneHeadingRow } from "./Heading"
import {
	LazyPopOutCard,
	LazyTitleDrawer,
	usePreloadDetailSurfaces,
} from "./LazyDetail"
import { PickContext } from "./PickTap"
import { Results } from "./Results"
import {
	Dice,
	LivePill,
	ResetIcon,
	SPRING,
	type Sheet,
	TasteBar,
} from "./TasteBar"
import {
	type DetailsLoader,
	ForYouContext,
	type ForYouContextValue,
	detailBatcher,
	detailQuery,
	detailQueryKey,
	fetchDetails,
	posterSrc,
} from "./context"
import { DIM, DIM_IN, DIM_OUT, SHEET_IN, SHEET_OUT } from "./crossfade"
import { inNestedDialog, useFocusScope } from "./focus"
import { DESK_NARROW, type Surface, useSteering } from "./useSteering"

const SWAP = { type: "spring", stiffness: 420, damping: 40 } as const

/** The drawer never gets shorter than this (px, the bar included); on short phones it covers the small row. */
const MIN_DRAWER = 440
/** The recipe drawer opens by itself once per tab, on phones. */
const DRAWER_SEEN = "for-you:drawer-seen"

const isDesk = () => window.matchMedia("(min-width: 1024px)").matches

function useIsDesk() {
	const [desk, setDesk] = useState(false)
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 1024px)")
		const on = () => setDesk(mq.matches)
		on()
		mq.addEventListener("change", on)
		return () => mq.removeEventListener("change", on)
	}, [])
	return desk
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

/** The print fills its box: the box's shorter side, measured. Returns a callback ref (the box may mount later). */
function useSquare(min = 160) {
	const [el, setEl] = useState<HTMLElement | null>(null)
	const [side, setSide] = useState(0)
	useEffect(() => {
		if (!el) return
		const ro = new ResizeObserver(([e]) =>
			setSide(
				Math.max(
					min,
					Math.floor(Math.min(e.contentRect.width, e.contentRect.height)),
				),
			),
		)
		ro.observe(el)
		return () => ro.disconnect()
	}, [el, min])
	return [setEl, side] as const
}

/** The site's bottom nav height (MobileDock publishes it), 72 px when it isn't there yet. */
const dockHeight = () =>
	Number.parseFloat(
		getComputedStyle(document.documentElement).getPropertyValue(
			"--nav-dock-height",
		),
	) || 72

/** Where the drawer starts: just under the strip's second row, or its first row on short phones. */
function measureCut(): number {
	const vh = window.innerHeight
	const rows = document.querySelectorAll<HTMLElement>("[data-strip-row]")
	let b1 = 0
	let b2 = 0
	for (const el of rows) {
		const b = el.getBoundingClientRect()
		if (el.dataset.stripRow === "1") b1 = Math.max(b1, b.bottom)
		else b2 = Math.max(b2, b.bottom)
	}
	const room = vh - MIN_DRAWER
	if (b2 && b2 + 10 <= room) return Math.round(b2 + 10)
	if (b1 && b1 + 10 <= room) return Math.round(b1 + 10)
	return Math.max(56, Math.round(room))
}

export function ForYouPage({
	data,
	loadDetails,
	loadGuest,
}: {
	data: ForYouPageData
	/** Where title details come from; the details endpoint by default. */
	loadDetails?: DetailsLoader
	/** Where a guest's preview comes from; the pool endpoint by default. */
	loadGuest?: GuestLoader
}) {
	if (data.kind === "guest") return <GuestLock load={loadGuest} />
	if (data.status === "ready")
		return (
			<Steering
				pool={data.pool}
				taste={data.taste}
				loadDetails={loadDetails ?? fetchDetails}
			/>
		)
	return <Unready status={data.status} />
}

function Unready({ status }: { status: "empty" | "unavailable" }) {
	const revalidator = useRevalidator()
	return (
		<div className="mx-auto max-w-[1600px] px-4 pt-5 pb-16 md:px-8">
			<Heading className="mb-6 flex" />
			<div
				className="max-w-lg rounded-2xl bg-white/[0.035] p-6 ring-1 ring-white/10"
				data-for-you-state={status}
			>
				{status === "empty" ? (
					<>
						<p className="text-[15px] leading-6 text-gray-300">
							Rate a few titles you love to get picks.
						</p>
						<Link
							to="/taste/quiz"
							className="mt-4 inline-flex min-h-11 items-center rounded-full bg-amber-400 px-5 text-[14px] font-black text-gray-950 hover:bg-amber-300"
						>
							Take the quiz
						</Link>
					</>
				) : (
					<>
						<p className="text-[15px] leading-6 text-gray-300">
							For you is warming up. Try again in a minute.
						</p>
						<button
							type="button"
							onClick={() => revalidator.revalidate()}
							disabled={revalidator.state !== "idle"}
							className="mt-4 inline-flex min-h-11 items-center rounded-full px-5 text-[14px] font-semibold text-gray-200 ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-50"
						>
							Try again
						</button>
					</>
				)}
			</div>
		</div>
	)
}

function Steering({
	pool: rawPool,
	taste,
	loadDetails,
}: {
	pool: ForYouPool
	taste: ForYouTaste
	loadDetails: DetailsLoader
}) {
	const pool = useMemo(
		() => ({
			...rawPool,
			fingerprints: decodeFingerprints(
				rawPool.fingerprints,
				rawPool.keys.length,
			),
		}),
		[rawPool],
	)
	const stats = useMemo(
		() => poolStats(pool.fingerprints, pool.keys.length),
		[pool],
	)
	const desk = useIsDesk()
	const navigation = useNavigation()
	const [params, setParams] = useSearchParams()

	// ---------- the drawers ----------
	const [sheet, setSheetState] = useState<Sheet>(null)
	const sheetRef = useRef(sheet)
	const surface = useCallback(
		(): Surface =>
			isDesk() ? "desk" : sheetRef.current === "recipes" ? "drawer" : "bar",
		[],
	)
	// ?recipe= follows the recipe a pick, drag, dice or Reset lands on (replace, no scroll); handle levels stay out of
	// the URL. A ?recipe= that changes from outside (a link, back / forward) sets the recipe.
	const urlWrites = useRef(new Set<string | null>())
	const writeRecipe = useCallback(
		(id: string | null) => {
			urlWrites.current.add(id)
			setParams(
				(p) => {
					const next = new URLSearchParams(p)
					if (id) next.set("recipe", id)
					else next.delete("recipe")
					return next
				},
				{ replace: true, preventScrollReset: true },
			)
		},
		[setParams],
	)
	const steering = useSteering({
		pool,
		stats,
		taste,
		initialRecipe: params.get("recipe"),
		surface,
		onRecipe: writeRecipe,
	})
	const {
		attr,
		recipe,
		tile,
		levels,
		ranked,
		previews,
		byId,
		onSet,
		roll,
		rolls,
		reset,
		touched,
		letGo,
		tweak,
		answer,
	} = steering

	const urlRecipe = params.get("recipe")
	const { follow, current } = steering
	useEffect(() => {
		// Our own writes arrive here too: the URL caught up (or is on its way to the recipe already picked).
		if (urlRecipe === current()) return urlWrites.current.clear()
		if (urlWrites.current.has(urlRecipe)) return
		follow(urlRecipe)
	}, [urlRecipe, follow, current])

	// ---------- title details: TanStack Query, batched ----------
	const queryClient = useQueryClient()
	const loadDetail = useMemo(() => detailBatcher(loadDetails), [loadDetails])
	const prefetch = useCallback(
		(keys: string[]) => {
			for (const key of keys)
				if (queryClient.getQueryData(detailQueryKey(key)) === undefined)
					queryClient.prefetchQuery(detailQuery(key, loadDetail))
		},
		[queryClient, loadDetail],
	)
	const detail = useCallback(
		(key: string) =>
			queryClient.getQueryData<ReturnType<ForYouContextValue["detail"]>>(
				detailQueryKey(key),
			),
		[queryClient],
	)
	const ctx = useMemo<ForYouContextValue>(
		() => ({
			pool,
			taste,
			stats,
			ranked,
			attr,
			prefetch,
			detail,
			loadDetail,
		}),
		[pool, taste, stats, ranked, attr, prefetch, detail, loadDetail],
	)
	// The top picks' details, once the page is idle.
	const topRef = useRef(ranked)
	topRef.current = ranked
	useEffect(() => {
		const go = () =>
			prefetch(topRef.current.slice(0, 12).map((r) => pool.keys[r.index]))
		if (typeof window.requestIdleCallback === "function") {
			const id = window.requestIdleCallback(go, { timeout: 3000 })
			return () => window.cancelIdleCallback(id)
		}
		const t = setTimeout(go, 1500)
		return () => clearTimeout(t)
	}, [prefetch, pool])

	// ---------- the open pick ----------
	const [openKey, setOpenKey] = useState<string | null>(null)
	const closePick = useCallback(() => setOpenKey(null), [])
	const openPick = useCallback(
		(r: Ranked) => setOpenKey(pool.keys[r.index]),
		[pool],
	)
	const togglePick = useCallback(
		(r: Ranked) => {
			const key = pool.keys[r.index]
			setOpenKey((cur) => (cur === key ? null : key))
		},
		[pool],
	)
	const pickApi = useMemo(
		() => ({ openId: openKey, toggle: togglePick }),
		[openKey, togglePick],
	)
	// Crossing the desktop breakpoint closes the pick and the drawers: each screen size has its own surfaces.
	const [deskSeen, setDeskSeen] = useState(desk)
	if (deskSeen !== desk) {
		setDeskSeen(desk)
		setOpenKey(null)
		sheetRef.current = null
		setSheetState(null)
	}
	usePreloadDetailSurfaces()

	// The opened pick with the next five and the previous two, in one request.
	useEffect(() => {
		if (!openKey) return
		const at = ranked.findIndex((r) => pool.keys[r.index] === openKey)
		if (at < 0) return
		prefetch(
			[at, at + 1, at + 2, at + 3, at + 4, at + 5, at - 1, at - 2]
				.filter((i) => i >= 0 && i < ranked.length)
				.map((i) => pool.keys[ranked[i].index]),
		)
	}, [openKey, ranked, pool, prefetch])

	// ---------- opening and closing drawers ----------
	const closeSheet = useCallback(() => {
		sheetRef.current = null
		setSheetState(null)
	}, [])
	const setSheet = useCallback((s: Exclude<Sheet, null>) => {
		sheetRef.current = s
		setSheetState(s)
	}, [])

	const [sheetHint, setSheetHint] = useState(0)
	const [deskHint, setDeskHint] = useState(0)
	const printHinted = useRef(false)
	const sheetHost = useRef<HTMLDivElement>(null)
	const deskHost = useRef<HTMLDivElement>(null)
	const sheetTouched = useRef(false)
	const deskTouched = useRef(false)

	/** Opens a drawer, or swaps the open one in place; the active one's own button closes it. */
	const openSheet = (s: Exclude<Sheet, null>) => {
		if (sheetRef.current === s) return closeSheet()
		const from = document.activeElement
		if (from instanceof HTMLElement && bar.current?.contains(from))
			sheetFrom.current = from
		setOpenKey(null)
		// The tiles re-sort only on the way in, never under a finger.
		if (s === "recipes") steering.sortDrawer()
		if (s === "print" && !printHinted.current) {
			printHinted.current = true
			setSheetHint((n) => n + 1)
		}
		setSheet(s)
	}

	// The recipe drawer opens by itself on the first phone visit in this tab.
	useEffect(() => {
		if (isDesk()) return
		try {
			if (window.sessionStorage.getItem(DRAWER_SEEN)) return
			window.sessionStorage.setItem(DRAWER_SEEN, "1")
		} catch {}
		steering.sortDrawer()
		setSheet("recipes")
	}, [])

	// The hub and search dialogs sit under the raised bar: close everything of ours when one opens.
	useEffect(() => {
		if (!navigation.hubOpen && !navigation.searchOpen) return
		closeSheet()
		setOpenKey(null)
	}, [navigation.hubOpen, navigation.searchOpen, closeSheet])

	const open = sheet !== null
	// Focus moves into the drawer and stays in it and the taste bar (which switches between drawers); on closing it
	// returns to the bar's button that opened it.
	const sheetEl = useRef<HTMLDivElement>(null)
	const sheetFrom = useRef<HTMLElement | null>(null)
	useFocusScope({
		active: open,
		scope: () => [sheetEl.current, bar.current],
		initial: () => sheetEl.current,
		returnTo: () => sheetFrom.current,
	})
	// Escape closes; while a drawer is open on a phone the page sits at its top and doesn't scroll.
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !inNestedDialog(e.target)) closeSheet()
		}
		window.addEventListener("keydown", onKey)
		const html = document.documentElement
		const was = html.style.overflow
		if (!isDesk()) html.style.overflow = "hidden"
		return () => {
			window.removeEventListener("keydown", onKey)
			html.style.overflow = was
		}
	}, [open, closeSheet])

	// Desktop hint: once shortly after load, once more after a long idle if the print wasn't touched.
	useEffect(() => {
		if (!desk) return
		const a = window.setTimeout(() => setDeskHint((n) => n || 1), 1200)
		const b = window.setTimeout(() => {
			if (!deskTouched.current) setDeskHint(2)
		}, 30000)
		return () => {
			window.clearTimeout(a)
			window.clearTimeout(b)
		}
	}, [desk])
	// Print drawer: once more after a long idle there (only if the print wasn't touched).
	const replayed = useRef(false)
	useEffect(() => {
		if (sheet !== "print" || replayed.current) return
		const t = window.setTimeout(() => {
			if (sheetTouched.current || replayed.current) return
			replayed.current = true
			setSheetHint((n) => n + 1)
		}, 15000)
		return () => window.clearTimeout(t)
	}, [sheet])

	// ---------- where the drawer starts, and the taste bar's place ----------
	const [cut, setCut] = useState(320)
	useIso(() => {
		if (!open || isDesk()) return
		window.scrollTo(0, 0)
		setCut(measureCut())
		const t = window.setTimeout(() => setCut(measureCut()), 350)
		const onResize = () => setCut(measureCut())
		window.addEventListener("resize", onResize)
		return () => {
			window.clearTimeout(t)
			window.removeEventListener("resize", onResize)
		}
	}, [open])

	const bar = useRef<HTMLDivElement>(null)
	const safe = useRef<HTMLDivElement>(null)
	const [lift, setLift] = useState(72)
	const [barH, setBarH] = useState(84)
	// The bar stays above the nav's layer until it has slid back down (else the nav would cover it on the way).
	const [barOnTop, setBarOnTop] = useState(open)
	useEffect(() => {
		const measure = () => {
			setLift(dockHeight() - (safe.current?.offsetHeight ?? 0))
			if (bar.current) setBarH(bar.current.offsetHeight)
		}
		measure()
		const ro = new ResizeObserver(measure)
		if (bar.current) ro.observe(bar.current)
		window.addEventListener("resize", measure)
		return () => {
			ro.disconnect()
			window.removeEventListener("resize", measure)
		}
	}, [])
	useEffect(() => {
		setLift(dockHeight() - (safe.current?.offsetHeight ?? 0))
		if (open) setBarOnTop(true)
	}, [open])
	useQuietDock(open || barOnTop)

	// ---------- the drawer's drag down ----------
	// The head drags the drawer down with the finger; past 90 px (or a quick flick) it closes, else springs back.
	const sheetY = useMotionValue(0)
	const grabRef = useRef<{ id: number; y0: number; t0: number } | null>(null)
	useEffect(() => {
		if (open) sheetY.set(0)
	}, [open, sheetY])
	const grab: GrabProps = {
		onPointerDown: (e) => {
			if (e.button !== 0 || (e.target as Element).closest("button,a")) return
			grabRef.current = {
				id: e.pointerId,
				y0: e.clientY,
				t0: performance.now(),
			}
			try {
				e.currentTarget.setPointerCapture(e.pointerId)
			} catch {}
		},
		onPointerMove: (e) => {
			const g = grabRef.current
			if (!g || g.id !== e.pointerId) return
			const d = e.clientY - g.y0
			sheetY.set(d > 0 ? d : d * 0.15)
		},
		onPointerUp: (e) => {
			const g = grabRef.current
			if (!g || g.id !== e.pointerId) return
			grabRef.current = null
			const d = e.clientY - g.y0
			const fast = performance.now() - g.t0 < 260
			if (d > 90 || (fast && d > 36)) closeSheet()
			else animate(sheetY, 0, SHEET_IN)
		},
		onPointerCancel: () => {
			grabRef.current = null
			animate(sheetY, 0, SHEET_IN)
		},
	}

	// ---------- words ----------
	const subline = letGo
		? `Drifted from ${letGo}`
		: tweak
			? `with ${tweak}`
			: sheet === "recipes"
				? "Pick a mood"
				: "Change mood"
	// The header row already says For you: the results carry a title only for a picked tile or a tweak.
	const heading = !tile && !tweak ? null : (
		<>
			{tile?.name ?? "For you"}
			{tweak && (
				<span className="font-sans text-[0.8em] font-normal text-gray-400">
					{" "}
					· {tweak}
				</span>
			)}
		</>
	)
	const liveDesk = useRef<HTMLSpanElement>(null)
	const liveSheet = useRef<HTMLSpanElement>(null)
	const [sheetBox, sheetSide] = useSquare()
	const [deskBox, deskSide] = useSquare()
	const few = ranked.length < MIN_FIT

	return (
		<ForYouContext.Provider value={ctx}>
			<div className="mx-auto max-w-[1600px] overflow-x-clip px-4 pt-3 pb-28 sm:pt-5 md:px-8 lg:pb-10">
				<Heading className="mb-4 hidden lg:flex" />
				<PhoneHeadingRow />

				{/* Desktop: the print fills a column as tall as the two tile rows; the dice top left, Reset bottom left. */}
				<div className="hidden lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[20.25rem_minmax(0,1fr)] xl:gap-10">
					<div
						ref={deskBox}
						className="relative grid h-[20.25rem] min-w-0 place-items-center"
					>
						<div
							ref={deskHost}
							className="relative"
							style={{ width: Math.round((deskSide || 280) * 1.1) }}
							onPointerDownCapture={() => {
								deskTouched.current = true
							}}
						>
							<HandlePrint
								levels={levels}
								shape={tile ? tile.shape : null}
								onSet={onSet}
								liveRef={liveDesk}
								className="w-full"
								label="Your taste print. Drag a family's handle out for more of it, in for less."
							/>
							<LivePill r={liveDesk} className="top-0" />
							<DragHint host={deskHost} play={deskHint} />
						</div>
						<div className="absolute top-0 left-0">
							<Dice rolls={rolls} onRoll={roll} small />
						</div>
						<ResetIcon
							on={touched}
							onClick={reset}
							className="absolute bottom-0 left-0"
						/>
					</div>
					<div className="grid min-w-0 grid-cols-4 grid-rows-2 gap-3 xl:grid-cols-5">
						{steering.deskIds.map((id, i) => {
							const m = byId.get(id)
							if (!m) return null
							return (
								<RecipeTile
									key={id}
									m={m}
									on={recipe === id}
									top={previews[id]}
									posters={pool.posters}
									onPick={() => steering.pickOnDesk(id)}
									className={`lg:h-[9.75rem] ${i >= DESK_NARROW ? "lg:hidden xl:flex" : ""}`}
								/>
							)
						})}
					</div>
				</div>

				{/* The results, full width below. On phones their first two rows are the strip. */}
				<section className="min-w-0 lg:mt-10" aria-label="Recommendations">
					<PickContext.Provider value={pickApi}>
						{ranked.length > 0 && <Results title={heading} />}
					</PickContext.Provider>
					{few && (
						<div className="mt-6 flex items-center gap-3 text-[14px] text-gray-400">
							<p>Only a few picks fit right now.</p>
							{touched && (
								<button
									type="button"
									onClick={reset}
									className="min-h-11 rounded-full px-4 font-semibold text-gray-200 ring-1 ring-white/15 hover:bg-white/5"
								>
									Reset
								</button>
							)}
						</div>
					)}
				</section>

				{/* Phones get the title drawer, desktop the pop-out card. */}
				{!desk && (
					<LazyTitleDrawer
						list={ranked}
						openId={openKey}
						onOpen={openPick}
						onClose={closePick}
						answer={answer}
						bottom={lift + barH}
						bar={bar}
					/>
				)}
				<LazyPopOutCard
					list={ranked}
					openId={openKey}
					onOpen={openPick}
					onClose={closePick}
					answer={answer}
					enabled={desk}
				/>

				{/* ---------- phones: the drawer, under the strip; the bar is its footer ---------- */}
				{/* The page dims behind the drawer in two pieces with one fade: over the strip and the site header, and under
				    the drawer (so its slide never shows an undimmed edge). */}
				<AnimatePresence initial={false}>
					{open && (
						<motion.button
							key="dim-top"
							type="button"
							aria-label="Close"
							onClick={closeSheet}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1, transition: DIM_IN }}
							exit={{ opacity: 0, transition: DIM_OUT }}
							className={`fixed inset-x-0 top-0 z-[1099] cursor-default lg:hidden ${DIM}`}
							style={{ height: cut }}
							data-strip-close=""
						/>
					)}
					{open && (
						<motion.div
							key="dim-under"
							aria-hidden="true"
							onClick={closeSheet}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1, transition: DIM_IN }}
							exit={{ opacity: 0, transition: DIM_OUT }}
							className={`fixed inset-x-0 bottom-0 z-[38] lg:hidden ${DIM}`}
							style={{ top: cut }}
						/>
					)}
				</AnimatePresence>
				{/* The drawer sits below the site's bottom nav (z-50) and the taste bar, so on its way out it slides behind both. */}
				<AnimatePresence initial={false}>
					{open && (
						<motion.div
							key="sheet"
							// biome-ignore lint/a11y/useSemanticElements: a sliding drawer, not a modal <dialog>
							role="dialog"
							aria-label={
								sheet === "print" ? "Your taste print" : "Pick a mood"
							}
							ref={sheetEl}
							tabIndex={-1}
							initial={{ y: "100%" }}
							animate={{ y: 0, transition: SHEET_IN }}
							exit={{ y: "100%", transition: SHEET_OUT }}
							style={{ top: cut }}
							className="fixed inset-x-0 bottom-0 z-[39] outline-none lg:hidden"
							data-sheet={sheet}
						>
							<motion.div
								style={{ y: sheetY, paddingBottom: barH }}
								className="absolute inset-0 flex flex-col overflow-hidden rounded-t-3xl bg-gray-900 shadow-[0_-18px_40px_-10px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.14)]"
							>
								<div
									{...grab}
									className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
									data-sheet-grab=""
								>
									<span
										aria-hidden="true"
										className="h-1 w-10 rounded-full bg-white/25"
									/>
								</div>
								<div className="relative min-h-0 flex-1 overflow-hidden">
									<AnimatePresence initial={false}>
										{sheet === "recipes" ? (
											<Panel key="recipes" side={-1}>
												<PanelHead
													title="Pick a mood"
													onDone={closeSheet}
													grab={grab}
												>
													<button
														type="button"
														onClick={reset}
														disabled={!touched}
														aria-hidden={!touched}
														className={`min-h-11 shrink-0 px-2 text-[13px] font-semibold text-gray-400 hover:text-gray-200 ${touched ? "" : "invisible"}`}
													>
														Reset
													</button>
												</PanelHead>
												<RecipeGrid
													ids={steering.drawerIds}
													byId={byId}
													picked={recipe}
													previews={previews}
													posters={pool.posters}
													onPick={steering.pick}
												/>
											</Panel>
										) : (
											<Panel key="print" side={1}>
												{/* No title row: the print takes all the room there is. Done and Reset wait in its corners. */}
												<div
													ref={sheetBox}
													className="relative grid min-h-0 flex-1 place-items-center px-1 pb-1"
												>
													<div
														ref={sheetHost}
														className="relative"
														style={{ width: Math.max(160, sheetSide - 4) }}
														onPointerDownCapture={() => {
															sheetTouched.current = true
														}}
													>
														<HandlePrint
															sheet
															levels={levels}
															shape={tile ? tile.shape : null}
															onSet={onSet}
															liveRef={liveSheet}
															className="w-full"
															label="Your taste print, big. Drag a family's handle out for more of it, in for less."
														/>
														<LivePill r={liveSheet} className="top-1" />
														<DragHint host={sheetHost} play={sheetHint} />
													</div>
													<button
														type="button"
														onClick={closeSheet}
														className="absolute top-0 right-3 min-h-10 rounded-full bg-amber-400 px-3.5 text-[13px] font-black text-gray-950 hover:bg-amber-300"
														data-done=""
													>
														Done
													</button>
													<ResetIcon
														on={touched}
														onClick={reset}
														className="absolute bottom-2 left-3"
													/>
												</div>
											</Panel>
										)}
									</AnimatePresence>
								</div>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>

				<TasteBar
					ref={bar}
					pool={pool}
					sheet={sheet}
					onOpen={openSheet}
					levels={levels}
					tile={tile}
					onSet={onSet}
					posters={tile ? (previews[tile.id] ?? []) : ranked.slice(0, 2)}
					subline={subline}
					rolls={rolls}
					onRoll={roll}
					lift={lift}
					onTop={barOnTop}
					onSettled={() => {
						if (!sheetRef.current) setBarOnTop(false)
					}}
					safeRef={safe}
					transition={open ? SHEET_IN : SPRING}
				/>
			</div>
		</ForYouContext.Provider>
	)
}

// ---------- the drawer's middle: one panel per drawer, the recipes on the left, the print on the right ----------

function Panel({
	side,
	children,
}: { side: -1 | 1; children: React.ReactNode }) {
	return (
		<motion.div
			initial={{ opacity: 0, x: side * 56 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: side * 56 }}
			transition={SWAP}
			className="absolute inset-0 flex flex-col"
		>
			{children}
		</motion.div>
	)
}

type GrabProps = {
	onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
	onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
	onPointerUp: (e: React.PointerEvent<HTMLElement>) => void
	onPointerCancel: () => void
}

/** The drawer's title row; everything in it but its buttons drags the drawer down. */
function PanelHead({
	title,
	onDone,
	grab,
	children,
}: {
	title: React.ReactNode
	onDone: () => void
	grab: GrabProps
	children?: React.ReactNode
}) {
	return (
		<div
			{...grab}
			className="flex shrink-0 touch-none items-center gap-1.5 px-4 pb-2"
		>
			<h2
				className={`${DISPLAY} min-w-0 flex-1 truncate text-[1.2rem] leading-tight text-white`}
			>
				{title}
			</h2>
			{children}
			<button
				type="button"
				onClick={onDone}
				className="min-h-11 shrink-0 rounded-full bg-amber-400 px-4 text-[14px] font-black text-gray-950 hover:bg-amber-300"
				data-done=""
			>
				Done
			</button>
		</div>
	)
}

function RecipeGrid({
	ids,
	byId,
	picked,
	previews,
	posters,
	onPick,
}: {
	ids: string[]
	byId: Map<string, Recipe>
	picked: string | null
	previews: Record<string, Ranked[]>
	posters: string[]
	onPick: (id: string) => void
}) {
	const box = useRef<HTMLDivElement>(null)
	// Coming back from the print: the picked tile in view.
	useEffect(() => {
		box.current
			?.querySelector('[aria-pressed="true"]')
			?.scrollIntoView({ block: "nearest" })
	}, [])
	return (
		<div
			ref={box}
			className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-3"
		>
			<div className="grid grid-cols-2 gap-2.5" data-recipe-tiles="">
				{ids.map((id) => {
					const m = byId.get(id)
					if (!m) return null
					return (
						<RecipeTile
							key={id}
							m={m}
							on={picked === id}
							top={previews[id]}
							posters={posters}
							onPick={() => onPick(id)}
						/>
					)
				})}
			</div>
		</div>
	)
}

// ---------- a recipe tile: name, three fixed posters, a tiny mark for your own taste groups. Nothing in it moves. ----------

type TileProps = {
	m: Recipe
	on: boolean
	top?: Ranked[]
	posters: string[]
	onPick: () => void
	className?: string
}

const RecipeTile = forwardRef<HTMLButtonElement, TileProps>(function RecipeTile(
	{ m, on, top, posters, onPick, className = "" },
	ref,
) {
	return (
		<motion.button
			ref={ref}
			type="button"
			aria-pressed={on}
			data-recipe={m.id}
			whileTap={{ scale: 0.96 }}
			transition={SPRING}
			onClick={onPick}
			className={`relative flex h-[8.4rem] min-w-0 flex-col overflow-hidden rounded-2xl bg-white/[0.035] p-3 text-left ring-1 ring-white/10 select-none [-webkit-touch-callout:none] hover:ring-white/30 ${className}`}
		>
			<span
				aria-hidden="true"
				className="pointer-events-none absolute inset-0"
				style={{
					background: `linear-gradient(140deg, ${m.hue}33, transparent 58%)`,
				}}
			/>
			<span
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 rounded-2xl bg-amber-400/[0.08] ring-2 ring-amber-400 ring-inset transition-opacity duration-300"
				style={{ opacity: on ? 1 : 0 }}
			/>
			<span
				className={`${DISPLAY} relative line-clamp-2 text-[1.02rem] leading-[1.12] text-white`}
			>
				{m.name}
			</span>
			<span className="relative mt-auto flex items-end gap-2">
				<span className="flex">
					{[0, 1, 2].map((k) => {
						const r = top?.[k]
						const path = r ? posters[r.index] : ""
						return (
							<span
								key={k}
								className="relative -ml-2.5 h-[3.4rem] w-[2.3rem] overflow-hidden rounded-md bg-gray-800 ring-2 ring-gray-950 first:ml-0"
								style={{
									transform: `rotate(${(k - 1) * 5}deg)`,
									zIndex: 3 - k,
								}}
							>
								{path && (
									<img
										src={posterSrc(path, "w92")}
										alt=""
										draggable={false}
										loading="lazy"
										className="pointer-events-none absolute inset-0 size-full object-cover"
									/>
								)}
							</span>
						)
					})}
				</span>
				{m.yours && (
					<span
						className="ml-auto flex items-center gap-1 pb-0.5 text-[10px] font-bold tracking-wide uppercase"
						style={{ color: m.hue }}
						title="From your taste"
					>
						<span
							className="size-1.5 rounded-full"
							style={{ background: m.hue }}
						/>
						Yours
					</span>
				)}
			</span>
		</motion.button>
	)
})
