// The third level of the navigation, under an area's tabs: one row for a tab's views (links to their own addresses,
// such as Watch's Tonight · Whole Wishlist · Recently added or Scores' Scored · Not rated) and for the sections of a
// one-page tab (anchor links with scroll-spy, such as the Taste portrait's Type · What pulls you · Groups).
//
// The row sticks right under the tab row (UNDER_TABS in ./AreaTabs.tsx), has one fixed height (SUBNAV_PX) and scrolls
// sideways on phones with the current item kept in view. It sits below the tabs in the visual hierarchy: smaller type,
// a lighter weight, no icons (Settings keeps small ones), muted counts. Its look is a round 9 option (subnav):
// - line: small text items with a quiet underline under the current one.
// - segment: one rounded track; the current item is a lighter thumb that slides (transform only).
// - quiet: small outline pills; the current one has amber text and border, no fill.
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
import { STICKY_SUBBAR } from "~/ui/layers"
import { UNDER_TABS } from "./AreaTabs"
import type { NavIcon } from "./areas"
import { type NavOptions, useNavOptions } from "./nav-options"

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

type Look = NavOptions["subnav"]

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

function Count({ n, here, look }: { n: number; here: boolean; look: Look }) {
	return (
		<span
			className={`text-[11px] font-normal tabular-nums ${
				here
					? look === "quiet"
						? "text-amber-300/70"
						: "text-gray-400"
					: "text-gray-500"
			}`}
		>
			{count(n)}
		</span>
	)
}

const ITEM: Record<Look, (here: boolean) => string> = {
	line: (here) =>
		`relative flex h-full items-center gap-1.5 px-2.5 text-[13px] font-medium ${
			here ? "text-white" : "text-gray-400 hover:text-gray-200"
		}`,
	segment: (here) =>
		`relative flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${
			here ? "text-white" : "text-gray-400 hover:text-gray-200"
		}`,
	quiet: (here) =>
		`flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 transition-colors ${
			here
				? "text-amber-300 ring-amber-400/60"
				: "text-gray-400 ring-white/10 hover:text-gray-200 hover:ring-white/20"
		}`,
}

const LIST: Record<Look, string> = {
	line: "-ml-2.5 flex h-full items-stretch",
	segment:
		"flex h-8 items-center rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/[0.08]",
	quiet: "flex h-full items-center gap-1.5",
}

function Sep({ look }: { look: Look }) {
	return (
		<li
			aria-hidden
			className={`flex items-center ${look === "segment" ? "px-1" : "px-1.5"}`}
		>
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
}: {
	label: string
	items: SubNavItem[]
	sections?: boolean
	under?: keyof typeof UNDER_TABS
	className?: string
}) {
	const { subnav: look } = useNavOptions()
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
				{look === "segment" && on && (
					<motion.span
						layoutId={thumb}
						aria-hidden
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						className="absolute inset-0 rounded-full bg-white/[0.13] ring-1 ring-white/10"
					/>
				)}
				{Icon && (
					<Icon
						aria-hidden
						className={`relative size-3.5 shrink-0 ${on ? (look === "quiet" ? "text-amber-300" : "text-gray-200") : "text-gray-500"}`}
					/>
				)}
				<span className="relative">{it.label}</span>
				{it.count != null && (
					<span className="relative">
						<Count n={it.count} here={on} look={look} />
					</span>
				)}
				{look === "line" && on && (
					<span
						aria-hidden
						className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-white/50"
					/>
				)}
			</>
		)
		const className = `${ITEM[look](on)} shrink-0 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400`
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
			<div ref={sentinel} aria-hidden className={className} />
			<nav
				ref={nav}
				aria-label={label}
				data-subnav={look}
				className={`sticky ${UNDER_TABS[under]} ${STICKY_SUBBAR} h-11 border-b border-white/[0.06] bg-gray-950/95 ${className}`}
			>
				<LayoutGroup id={thumb}>
					<div className={`${WRAP} flex h-full items-center`}>
						<div
							ref={scroller}
							className="-mx-1 flex h-full min-w-0 items-center overflow-x-auto px-1 [scrollbar-width:none]"
						>
							<ul className={`${LIST[look]} shrink-0`}>
								{items.flatMap((it) => [
									...(it.sep
										? [<Sep key={`${it.key}-sep`} look={look} />]
										: []),
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
