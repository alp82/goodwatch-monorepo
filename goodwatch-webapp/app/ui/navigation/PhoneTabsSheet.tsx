import { Link } from "@remix-run/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Caption } from "~/ui/eyebrow"
import { SnapSheet } from "~/ui/filter-bar/SnapSheet"
import { NAV_ROW } from "~/ui/selection/selected"
import { useNavigation, usePathViewer } from "./NavigationContext"
import { type AreaTab, areaKeys } from "./areas"
import { type PhoneBar as Bar, areaSheetOf } from "./phone-bar"
import { useWatchNews } from "./useWhatsNew"
import { withWatchNews } from "./watch-news"

/** A sheet as tall as its content: one snap, the content's height (plus the handle and header) over the window's. */
function useFitSnap(chrome: number) {
	const ref = useRef<HTMLDivElement>(null)
	const [snap, setSnap] = useState(0.5)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const measure = () =>
			setSnap(Math.min(0.9, Math.max(0.15, (el.scrollHeight + chrome) / window.innerHeight)))
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(el)
		return () => observer.disconnect()
	})
	return { ref, snaps: useMemo(() => [snap], [snap]) }
}

/** One sibling page in the sheet: its icon, label, the smaller line under it, and its count or news. */
function SheetRow({ tab }: { tab: AreaTab }) {
	const Icon = tab.icon
	return (
		<Link
			to={tab.href}
			prefetch="intent"
			aria-current={tab.here ? "page" : undefined}
			className={`flex items-center gap-3 rounded-xl px-3 py-3 ${tab.here ? NAV_ROW : "active:bg-white/[0.05]"}`}
		>
			{Icon && (
				<Icon
					className={`size-6 shrink-0 ${tab.here ? "text-amber-300" : "text-gray-400"}`}
					aria-hidden
				/>
			)}
			<span className="min-w-0 flex-1">
				<span className="block font-semibold text-white">{tab.label}</span>
				{tab.sub && <span className="block text-sm text-gray-500">{tab.sub}</span>}
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
export default function PhoneTabsSheet({ bar }: { bar: Bar }) {
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
	const news = useWatchNews()
	const rawTabs = other?.tabs ?? navigation.phoneRow?.tabs ?? bar.siblings
	const tabs = (asked ?? bar.area) === "watch" ? withWatchNews(rawTabs, news) : rawTabs
	const label = other?.label ?? (navigation.phoneRow?.label || bar.eyebrow)
	const fit = useFitSnap(72)
	return (
		<SnapSheet
			index={navigation.tabsOpen ? 0 : -1}
			onIndex={(index) => navigation.setTabsOpen(index >= 0)}
			label={label}
			snaps={fit.snaps}
			header={<Caption className="px-5 pb-2">{label}</Caption>}
		>
			<nav ref={fit.ref} aria-label={label} className="space-y-1 px-2 pb-6">
				{tabs.map((t) => (
					<SheetRow key={t.key} tab={t} />
				))}
			</nav>
		</SnapSheet>
	)
}
