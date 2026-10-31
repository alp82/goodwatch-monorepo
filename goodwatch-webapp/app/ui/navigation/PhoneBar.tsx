// The phone's top bar (below lg): a small area label over the big page title with a plain chevron, and search at the
// right end. The title opens the sheet of the area's pages; the dock's area keys open the same sheet for their area. The bar slides away while the page scrolls
// down and comes back on the way up (transform only). Which bar a page gets: ./phone-bar.ts.
import { ChevronDownIcon, ChevronLeftIcon } from "@heroicons/react/24/outline"
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { Link, useLocation, useNavigate } from "@remix-run/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { SnapSheet } from "~/ui/filter-bar"
import { useUser } from "~/utils/auth"
import { useAuthHref } from "~/utils/auth-href"
import { useNavigation, usePathViewer } from "./NavigationContext"
import { holdKeyboardForSearch } from "./Search"
import { type AreaTab, areaKeys } from "./areas"
import { type PhoneBar as Bar, areaSheetOf, phoneBarOf } from "./phone-bar"

/** The bar's height in px (h-16): the page starts under it, and it slides away by this much. */
const BAR_PX = 64

/** True while the bar should be out of the way: scrolling down past the bar. Up by a few px brings it back. */
function useScrollAway(enabled: boolean) {
	const [away, setAway] = useState(false)
	useEffect(() => {
		if (!enabled) {
			setAway(false)
			return
		}
		let last = window.scrollY
		let frame = 0
		const measure = () => {
			frame = 0
			const y = window.scrollY
			const delta = y - last
			if (y <= BAR_PX) setAway(false)
			else if (delta > 6) setAway(true)
			else if (delta < -6) setAway(false)
			if (Math.abs(delta) > 6 || y <= BAR_PX) last = y
		}
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(measure)
		}
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			window.removeEventListener("scroll", onScroll)
			if (frame) cancelAnimationFrame(frame)
		}
	}, [enabled])
	return away
}

/** A detail page's own name, from its first heading, once that heading has scrolled under the bar. */
function useHeadingTitle(enabled: boolean) {
	const { pathname } = useLocation()
	const [title, setTitle] = useState("")
	useEffect(() => {
		setTitle("")
		if (!enabled) return
		let frame = 0
		const measure = () => {
			frame = 0
			const h1 = document.querySelector<HTMLElement>("main h1:not(.sr-only)")
			if (!h1) return setTitle("")
			const gone = h1.getBoundingClientRect().bottom < BAR_PX
			setTitle(gone ? (h1.textContent ?? "").trim() : "")
		}
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(measure)
		}
		measure()
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			window.removeEventListener("scroll", onScroll)
			if (frame) cancelAnimationFrame(frame)
		}
	}, [enabled, pathname])
	return title
}

/** Back: the previous page in this tab when there is one (Remix keeps an index in history.state), else `fallback`. */
function BackKey({ href, label }: { href: string; label: string }) {
	const navigate = useNavigate()
	return (
		<Link
			to={href}
			onClick={(event) => {
				const idx = (window.history.state as { idx?: number } | null)?.idx
				if (!label && idx && idx > 0) {
					event.preventDefault()
					navigate(-1)
				}
			}}
			aria-label={label ? undefined : "Back"}
			className="-ml-2 flex h-10 shrink-0 items-center gap-0.5 rounded-full pr-2 pl-1 text-[15px] font-semibold text-gray-300 active:bg-white/[0.06]"
		>
			<ChevronLeftIcon className="size-6" aria-hidden />
			{label}
		</Link>
	)
}

function SearchKey() {
	const navigation = useNavigation()
	return (
		<button
			type="button"
			onClick={() => {
				holdKeyboardForSearch()
				navigation.setSearchOpen(true)
			}}
			aria-haspopup="dialog"
			aria-label="Search titles, people, moods"
			className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/[0.06] text-amber-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
		>
			<MagnifyingGlassIcon className="h-5 w-5" aria-hidden />
		</button>
	)
}

/** Guests: a small Sign up text before the search key (the dock's menu holds Sign in). */
function SignUpText() {
	const authHref = useAuthHref()
	return (
		<Link
			rel="nofollow"
			to={authHref("sign-up")}
			className="flex h-10 shrink-0 items-center px-1 text-sm font-semibold whitespace-nowrap text-amber-300"
		>
			Sign up
		</Link>
	)
}

/** The bar's right end: the search key, after Sign up for guests (nothing extra while the sign-in check runs). */
function EndKey() {
	const { user, loading } = useUser()
	return (
		<span className="flex shrink-0 items-center gap-2">
			{!loading && !user && <SignUpText />}
			<SearchKey />
		</span>
	)
}

/** A sheet as tall as its content: one snap, the content's height (plus the handle and header) over the window's. */
function useFitSnap(chrome: number) {
	const ref = useRef<HTMLDivElement>(null)
	const [snap, setSnap] = useState(0.5)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const measure = () =>
			setSnap(
				Math.min(
					0.9,
					Math.max(0.15, (el.scrollHeight + chrome) / window.innerHeight),
				),
			)
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(el)
		return () => observer.disconnect()
	})
	return { ref, snaps: useMemo(() => [snap], [snap]) }
}

/** Search mode: the bar is the search field, showing the query; it opens the search dialog to change it. */
function SearchField() {
	const navigation = useNavigation()
	const { search } = useLocation()
	const q = new URLSearchParams(search).get("q") ?? ""
	return (
		<button
			type="button"
			onClick={() => {
				holdKeyboardForSearch()
				navigation.setSearchOpen(true)
			}}
			aria-haspopup="dialog"
			aria-label={`Search: ${q}`}
			className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-left"
		>
			<MagnifyingGlassIcon
				className="size-5 shrink-0 text-amber-300"
				aria-hidden
			/>
			<span className="truncate text-[16px] text-gray-100">{q}</span>
		</button>
	)
}

/** The label over the title and the title, with the chevron when it opens the sheet. */
function TitleBlock({ bar, title }: { bar: Bar; title: string }) {
	const navigation = useNavigation()
	const Icon = bar.icon
	const menu = bar.siblings.length > 0
	const inner = (
		<>
			{Icon && <Icon className="size-6 shrink-0 text-amber-300" aria-hidden />}
			<span className="flex min-w-0 flex-col leading-tight">
				{bar.eyebrow && bar.kind !== "settings" && (
					<span className="truncate text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
						{bar.eyebrow}
					</span>
				)}
				<span className="flex min-w-0 items-center gap-1 text-xl font-black text-white">
					<span className="truncate">{title}</span>
					{menu && (
						<ChevronDownIcon
							className="size-5 shrink-0 text-gray-400"
							aria-hidden
						/>
					)}
				</span>
			</span>
		</>
	)
	const box = "flex min-w-0 flex-1 items-center gap-2 self-stretch text-left"
	if (!menu) return <div className={box}>{inner}</div>
	return (
		<button
			type="button"
			aria-haspopup="dialog"
			aria-expanded={navigation.tabsOpen}
			onClick={() => navigation.setTabsOpen(true)}
			className={`${box} -mx-2 cursor-pointer rounded-xl px-2 active:bg-white/[0.04]`}
		>
			{inner}
		</button>
	)
}

/** One sibling page in the sheet: its icon, label, the smaller line under it, and its count or news. */
function SheetRow({ tab }: { tab: AreaTab }) {
	const Icon = tab.icon
	return (
		<Link
			to={tab.href}
			prefetch="intent"
			aria-current={tab.here ? "page" : undefined}
			className={`flex items-center gap-3 rounded-xl px-3 py-3 ${tab.here ? "bg-amber-500/15" : "active:bg-white/[0.05]"}`}
		>
			{Icon && (
				<Icon
					className={`size-6 shrink-0 ${tab.here ? "text-amber-300" : "text-gray-400"}`}
					aria-hidden
				/>
			)}
			<span className="min-w-0 flex-1">
				<span
					className={`block font-semibold ${tab.here ? "text-amber-100" : "text-white"}`}
				>
					{tab.label}
				</span>
				{tab.sub && (
					<span className="block text-sm text-gray-500">{tab.sub}</span>
				)}
			</span>
			{tab.news && (
				<span className="rounded-full bg-sky-400 px-1.5 text-[11px] font-black text-black">
					<span aria-hidden>{tab.news.badge}</span>
					<span className="sr-only">{tab.news.label}</span>
				</span>
			)}
			{tab.count != null && (
				<span className="text-sm tabular-nums text-gray-500">
					{tab.count.toLocaleString("en-US")}
				</span>
			)}
		</Link>
	)
}

/**
 * The sheet of an area's pages. This page's area: the tab row the page drew (with its counts), else the path's own
 * tabs. Another area (a dock key asked for it): that area's pages from its first page. As tall as its rows.
 */
function TabsSheet({ bar }: { bar: Bar }) {
	const navigation = useNavigation()
	const viewer = usePathViewer()
	const asked = navigation.sheetArea
	const other =
		asked && asked !== bar.area
			? (() => {
					const def = areaKeys(viewer).find((a) => a.key === asked)
					const sheet = def && areaSheetOf(def.key, def.href, viewer)
					return sheet && { label: def.label, tabs: sheet.tabs }
				})()
			: null
	const tabs = other?.tabs ?? navigation.phoneRow?.tabs ?? bar.siblings
	const label = other?.label ?? (navigation.phoneRow?.label || bar.eyebrow)
	const fit = useFitSnap(72)
	return (
		<SnapSheet
			index={navigation.tabsOpen ? 0 : -1}
			onIndex={(index) => navigation.setTabsOpen(index >= 0)}
			label={label}
			snaps={fit.snaps}
			header={
				<p className="px-5 pb-2 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
					{label}
				</p>
			}
		>
			<nav ref={fit.ref} aria-label={label} className="space-y-1 px-2 pb-6">
				{tabs.map((t) => (
					<SheetRow key={t.key} tab={t} />
				))}
			</nav>
		</SnapSheet>
	)
}

/** The phone's top bar, below lg. */
export function PhoneBar({ surface }: { surface: string }) {
	const { pathname, search } = useLocation()
	const viewer = usePathViewer()
	const bar = phoneBarOf({ pathname, search, viewer })
	const navigation = useNavigation()
	const away = useScrollAway(!bar.pinned && !navigation.tabsOpen)
	// Bars that stick under this one (FOLLOW_PHONE_BAR in ~/ui/layers) move up with it: one attribute, CSS does the rest.
	useEffect(() => {
		document.documentElement.toggleAttribute("data-phone-bar-away", away)
	}, [away])
	useEffect(
		() => () => document.documentElement.removeAttribute("data-phone-bar-away"),
		[],
	)
	const heading = useHeadingTitle(bar.kind === "detail")
	const title = bar.kind === "detail" ? heading : bar.title

	return (
		<>
			<div
				data-phone-bar={bar.kind}
				className={`flex h-16 items-center gap-3 px-4 transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none lg:hidden ${surface} ${
					away ? "-translate-y-full" : ""
				}`}
			>
				{bar.kind === "home" ? (
					<>
						<Link
							to="/"
							prefetch="intent"
							aria-label="GoodWatch home"
							className="flex shrink-0"
						>
							<GoodWatchWordmark fontSize={20} />
						</Link>
						<span className="flex-1" />
						<EndKey />
					</>
				) : bar.kind === "search" ? (
					<SearchField />
				) : (
					<>
						{bar.back && (
							<BackKey href={bar.back.href} label={bar.back.label} />
						)}
						<TitleBlock bar={bar} title={title} />
						{bar.kind !== "settings" && <EndKey />}
					</>
				)}
			</div>
			<TabsSheet bar={bar} />
		</>
	)
}
