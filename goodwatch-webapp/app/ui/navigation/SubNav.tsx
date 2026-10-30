// The third level of the navigation, under an area's tabs: one row for a tab's views (links to their own addresses,
// such as Watch's Next Movie · Want to Watch or Scores' Scored · Not rated) and for the sections of a
// one-page tab (anchor links with scroll-spy, such as the Taste portrait's Type · What pulls you · Groups).
//
// The row sticks right under the tab row (UNDER_TABS in ./AreaTabs.tsx), has one fixed height (SUBNAV_PX) and scrolls
// sideways on phones with the current item kept in view. It sits below the tabs in the visual hierarchy: smaller type,
// a lighter weight, no icons (Settings keeps small ones), muted counts. Its bar is a step lighter than the page
// (./bar-layers.ts), and the current item has an amber dot that moves between items with a layout animation
// (transform only).
//
// Phones (below lg) get QuietRow instead: one line of text in the page that scrolls away with it, never sticky. Views
// are one tap each for the first three, the rest under "More"; sections scroll to their part of the page.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { LayoutGroup, motion } from "framer-motion"
import {
	type MouseEvent,
	type RefObject,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { SnapSheet } from "~/ui/filter-bar"
import { STICKY_SUBBAR } from "~/ui/layers"
import { UNDER_TABS } from "./AreaTabs"
import type { NavIcon } from "./areas"
import {
	SUBNAV_BAR,
	SUBNAV_HERE_ICON,
	SUBNAV_HERE_MUTED,
	SUBNAV_LIST,
	SUBNAV_MARK,
	subnavItem,
} from "./bar-layers"

const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
const count = (n: number) => n.toLocaleString("en-US")

export interface SubNavItem {
	key: string
	label: string
	/** The view's address, or `#id` of a section on the page (with `sections`). */
	href: string
	/** The current view. Sections work it out from the scroll position. */
	here?: boolean
	count?: number
	/** A small icon before the label (Settings' pages); most rows have none. */
	icon?: NavIcon
	/** A thin divider before the item, between groups. */
	sep?: boolean
}

/** The scroll position where the row starts to stick: the content starts there. */
function stuckAt(sentinel: HTMLElement, nav: HTMLElement) {
	const top = Number.parseFloat(getComputedStyle(nav).top) || 0
	return sentinel.getBoundingClientRect().top + window.scrollY - top
}

/** How far down the page the sticky rows reach: a section starts right under them. */
const coveredBy = (nav: HTMLElement) =>
	(Number.parseFloat(getComputedStyle(nav).top) || 0) + nav.offsetHeight

const reducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

const plainClick = (event: MouseEvent) =>
	event.button === 0 &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey

/**
 * Scroll-spy for section items: the last section whose top has passed under the sticky rows is current (the first
 * before any has, the last at the page's end). A click locks it on the clicked section until the scroll ends.
 */
function useSpy(items: SubNavItem[], nav: RefObject<HTMLElement>, on: boolean) {
	const [here, setHere] = useState(items[0]?.key)
	const locked = useRef<string | null>(null)
	useEffect(() => {
		if (!on) return
		let frame = 0
		const measure = () => {
			frame = 0
			if (locked.current || !nav.current) return
			const line = coveredBy(nav.current) + 24
			let current = items[0]?.key
			for (const item of items) {
				const el = document.getElementById(item.href.slice(1))
				if (el && el.getBoundingClientRect().top <= line) current = item.key
			}
			const end =
				window.innerHeight + window.scrollY >=
				document.documentElement.scrollHeight - 4
			if (end && items.length) current = items[items.length - 1].key
			setHere(current)
		}
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(measure)
		}
		measure()
		window.addEventListener("scroll", onScroll, { passive: true })
		window.addEventListener("resize", onScroll, { passive: true })
		return () => {
			window.removeEventListener("scroll", onScroll)
			window.removeEventListener("resize", onScroll)
			if (frame) cancelAnimationFrame(frame)
		}
	}, [items, nav, on])
	const lock = useCallback((key: string) => {
		locked.current = key
		setHere(key)
		const release = () => {
			locked.current = null
			window.removeEventListener("scrollend", release)
		}
		window.addEventListener("scrollend", release)
		// Browsers without scrollend, and a click that needs no scroll.
		window.setTimeout(release, 900)
	}, [])
	return { here, lock }
}

/**
 * Scrolls to a section under the sticky rows. Left to the browser, the hash change reaches Remix as a Back/Forward
 * step and its ScrollRestoration puts back a saved offset. The hash is replaced without a history entry, so Back still
 * leaves the page in one step.
 */
function scrollToSection(id: string, nav: HTMLElement) {
	const el = document.getElementById(id)
	if (!el) return false
	const top =
		el.getBoundingClientRect().top + window.scrollY - coveredBy(nav) - 16
	window.scrollTo({
		top: Math.max(0, top),
		behavior: reducedMotion() ? "auto" : "smooth",
	})
	window.history.replaceState(window.history.state, "", `#${id}`)
	return true
}

function Count({ n, here }: { n: number; here: boolean }) {
	return (
		<span
			className={`text-[11px] font-normal tabular-nums ${
				here ? SUBNAV_HERE_MUTED : "text-gray-500"
			}`}
		>
			{count(n)}
		</span>
	)
}

function Sep() {
	return (
		<li aria-hidden className="flex items-center px-1.5">
			<span className="h-4 w-px bg-white/10" />
		</li>
	)
}

/**
 * The third-level row. `sections`: the items are `#id` anchors of sections on this page, with scroll-spy and a smooth
 * scroll; otherwise they are links to the views' own addresses, which replace the history entry and keep the row
 * where it is (a view picked from the stuck row starts at its top, right under the row). `under`: the tab row above
 * (Watch's two-line row or a one-line row). `className` adds to the row (such as `lg:hidden`).
 */
export function SubNav({
	label,
	items: given,
	sections = false,
	under = "one",
	className = "",
	phoneItems,
}: {
	label: string
	items: SubNavItem[]
	sections?: boolean
	under?: keyof typeof UNDER_TABS
	className?: string
	/** Phones' views, when they differ from desktop's (Up next: every status instead of Next episodes | All shows). */
	phoneItems?: SubNavItem[]
}) {
	const nav = useRef<HTMLElement>(null)
	const sentinel = useRef<HTMLDivElement>(null)
	const scroller = useRef<HTMLDivElement>(null)
	const thumb = useId()
	// Sections the page did not draw (a part with no data) leave the row once it is on screen.
	const [drawn, setDrawn] = useState<string | null>(null)
	useLayoutEffect(() => {
		if (!sections) return
		setDrawn(
			given
				.filter((it) => document.getElementById(it.href.slice(1)))
				.map((it) => it.key)
				.join(" "),
		)
	}, [given, sections])
	const items = useMemo(() => {
		if (drawn === null) return given
		const keys = new Set(drawn.split(" "))
		return given.filter((it) => keys.has(it.key))
	}, [given, drawn])
	const { here: spied, lock } = useSpy(items, nav, sections)
	const hereKey = sections
		? spied
		: (items.find((item) => item.here)?.key ?? null)

	// The current item stays in view in a row that scrolls sideways (the row only: never the page).
	useLayoutEffect(() => {
		const row = scroller.current
		const el = row?.querySelector<HTMLElement>(
			`[data-subnav-item="${hereKey}"]`,
		)
		if (!row || !el || row.scrollWidth <= row.clientWidth) return
		const left = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2
		row.scrollTo({
			left: Math.max(0, left),
			behavior: sections && !reducedMotion() ? "smooth" : "auto",
		})
	}, [hereKey, sections])

	const onView = () => {
		// Picked from the stuck row, deep in a page: the new view starts at its top, right under the row.
		const box = nav.current
		const mark = sentinel.current
		if (!box || !mark) return
		const at = stuckAt(mark, box)
		if (window.scrollY > at) window.scrollTo({ top: at })
	}

	const item = (it: SubNavItem) => {
		const on = it.key === hereKey
		const Icon = it.icon
		const inner = (
			<>
				{on && (
					<motion.span
						layoutId={thumb}
						aria-hidden
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						className={SUBNAV_MARK}
					/>
				)}
				{Icon && (
					<Icon
						aria-hidden
						className={`relative size-3.5 shrink-0 ${on ? SUBNAV_HERE_ICON : "text-gray-500"}`}
					/>
				)}
				<span className="relative">{it.label}</span>
				{it.count != null && (
					<span className="relative">
						<Count n={it.count} here={on} />
					</span>
				)}
			</>
		)
		const className = `${subnavItem(on)} shrink-0 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400`
		return sections ? (
			<a
				href={it.href}
				data-subnav-item={it.key}
				aria-current={on ? "true" : undefined}
				onClick={(event) => {
					if (!plainClick(event) || !nav.current) return
					if (!scrollToSection(it.href.slice(1), nav.current)) return
					event.preventDefault()
					lock(it.key)
				}}
				className={className}
			>
				{inner}
			</a>
		) : (
			<Link
				to={it.href}
				replace
				preventScrollReset
				prefetch="intent"
				data-subnav-item={it.key}
				aria-current={on ? "page" : undefined}
				onClick={(event) => plainClick(event) && onView()}
				className={className}
			>
				{inner}
			</Link>
		)
	}

	return (
		<>
			<QuietRow
				label={label}
				items={sections ? items : (phoneItems ?? items)}
				sections={sections}
				className={className}
			/>
			<div ref={sentinel} aria-hidden className={`max-lg:hidden ${className}`} />
			<nav
				ref={nav}
				aria-label={label}
				data-subnav
				className={`sticky ${UNDER_TABS[under]} ${STICKY_SUBBAR} h-11 ${SUBNAV_BAR} max-lg:hidden ${className}`}
			>
				<LayoutGroup id={thumb}>
					<div className={`${WRAP} flex h-full items-center`}>
						<div
							ref={scroller}
							className="-mx-1 flex h-full min-w-0 items-center overflow-x-auto px-1 [scrollbar-width:none]"
						>
							<ul className={`${SUBNAV_LIST} shrink-0`}>
								{items.flatMap((it) => [
									...(it.sep ? [<Sep key={`${it.key}-sep`} />] : []),
									<li
										key={it.key}
										className="flex h-full shrink-0 items-center"
									>
										{item(it)}
									</li>,
								])}
							</ul>
						</div>
					</div>
				</LayoutGroup>
			</nav>
		</>
	)
}

/** How many views the phone's row shows one tap away; the rest wait under "More". */
const FREQUENT = 3

/** Where a section lands under the phone's top bar. */
const PHONE_BAR_PX = 64

/**
 * The phone's third level: a quiet text row in the page, scrolling away with it. Views: the first three as words
 * ("Next episodes · Watching · Start"), the rest under "More", which opens a sheet. Sections: every part of the page,
 * each scrolling to its part.
 */
function QuietRow({
	label,
	items,
	sections,
	className,
}: {
	label: string
	items: SubNavItem[]
	sections: boolean
	className: string
}) {
	const [more, setMore] = useState(false)
	const word = (on: boolean) =>
		`shrink-0 py-2.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
			on ? "font-bold text-white" : "text-gray-400 active:text-gray-200"
		}`
	const dot = <span aria-hidden className="shrink-0 text-gray-600">·</span>
	if (sections)
		return (
			<nav
				aria-label={label}
				data-quiet-row="sections"
				className={`mx-auto flex w-full max-w-7xl gap-4 overflow-x-auto px-4 pt-2 text-sm [scrollbar-width:none] sm:px-6 lg:hidden ${className}`}
			>
				{items.map((it) => (
					<a
						key={it.key}
						href={it.href}
						onClick={(event) => {
							const el = document.getElementById(it.href.slice(1))
							if (!plainClick(event) || !el) return
							event.preventDefault()
							const top =
								el.getBoundingClientRect().top + window.scrollY - PHONE_BAR_PX - 12
							window.scrollTo({
								top: Math.max(0, top),
								behavior: reducedMotion() ? "auto" : "smooth",
							})
							window.history.replaceState(window.history.state, "", it.href)
						}}
						className={word(false)}
					>
						{it.label}
					</a>
				))}
			</nav>
		)
	const head = items.slice(0, items.length > FREQUENT + 1 ? FREQUENT : items.length)
	const rest = items.slice(head.length)
	const restHere = rest.find((it) => it.here)
	const link = (it: SubNavItem, extra = "") => (
		<Link
			key={it.key}
			to={it.href}
			replace
			preventScrollReset
			prefetch="intent"
			aria-current={it.here ? "page" : undefined}
			className={`${word(!!it.here)} ${extra}`}
		>
			{it.label}
		</Link>
	)
	return (
		<nav
			aria-label={label}
			data-quiet-row="views"
			className={`mx-auto flex w-full max-w-7xl items-center gap-2 overflow-x-auto px-4 pt-2 text-sm [scrollbar-width:none] sm:px-6 lg:hidden ${className}`}
		>
			{head.map((it, i) => (
				<span key={it.key} className="flex shrink-0 items-center gap-2">
					{i > 0 && dot}
					{link(it)}
				</span>
			))}
			{rest.length > 0 && (
				<>
					{dot}
					<button
						type="button"
						aria-haspopup="dialog"
						onClick={() => setMore(true)}
						className={`flex cursor-pointer items-center gap-0.5 ${word(!!restHere)}`}
					>
						{restHere?.label ?? "More"}
						<ChevronDownIcon className="size-4" aria-hidden />
					</button>
					<SnapSheet
						index={more ? 0 : -1}
						onIndex={(index) => setMore(index >= 0)}
						label={label}
						snaps={[Math.min(0.9, (96 + rest.length * 56) / 800)]}
					>
						<div className="space-y-1 px-2 pb-6">
							{rest.map((it) => (
								<Link
									key={it.key}
									to={it.href}
									replace
									prefetch="intent"
									onClick={() => setMore(false)}
									aria-current={it.here ? "page" : undefined}
									className={`flex items-center rounded-xl px-3 py-3 font-semibold ${
										it.here ? "bg-amber-500/15 text-amber-100" : "text-white active:bg-white/[0.05]"
									}`}
								>
									<span className="flex-1">{it.label}</span>
									{it.count != null && (
										<span className="text-sm font-normal tabular-nums text-gray-500">
											{count(it.count)}
										</span>
									)}
								</Link>
							))}
						</div>
					</SnapSheet>
				</>
			)}
		</nav>
	)
}
