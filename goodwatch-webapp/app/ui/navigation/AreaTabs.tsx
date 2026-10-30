// The rows under the site header: an area's tabs (sticky under the h-16 header, sideways scroll on phones) and the
// Settings gear at the Profile row's end. The third level under the tabs is SubNav.tsx. Props in, links out: the data
// comes from ./areas.ts.
//
// The row is a step lighter than the header above and a step darker than the in-page nav below (./bar-layers.ts).
// Watch's two-line row fits a phone as four equal columns: no icons, and Recommendations reads "For you" there.
//
// Every row has one fixed height, so the rows under it can stick at a known offset. A profile with the sticky visitor
// bar sets `--visitor-bar-h` on its wrapper (0px elsewhere); every sticky offset here adds it.
import { LockClosedIcon, UserGroupIcon } from "@heroicons/react/20/solid"
import { Cog6ToothIcon } from "@heroicons/react/24/outline"
import {
	Cog6ToothIcon as CogSolid,
	UserCircleIcon as UserCircleSolid,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useLayoutEffect, useRef } from "react"
import { STICKY_BAR } from "~/ui/layers"
import type { AreaTab, NavIcon, TasteRow } from "./areas"
import { TAB_ROW } from "./bar-layers"

/** The page width, as ui/my-pages/bits.tsx (kept here so the header chunk does not pull that module). */
const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
const count = (n: number) => n.toLocaleString("en-US")

/**
 * The tab row's height in px, border included, below lg and from lg: one-line rows (Explore, Profile) and Watch's
 * two-line row. The classes below repeat these numbers, since Tailwind reads whole literals.
 */
export const TAB_ROW_PX = { one: [45, 49], two: [57, 61] } as const
/** The third-level row's height in px (SubNav.tsx), the same at every width. */
export const SUBNAV_PX = 44

/** Where the tab row sticks: under the site header and the visitor bar. */
export const TABS_TOP = "top-[calc(4rem_+_var(--visitor-bar-h,0px))]"
/** Where a row right under the tab row sticks (SubNav, the Settings column), by the tab row it sits under. */
export const UNDER_TABS = {
	one: "top-[calc(4rem_+_var(--visitor-bar-h,0px)_+_45px)] lg:top-[calc(4rem_+_var(--visitor-bar-h,0px)_+_49px)]",
	two: "top-[calc(4rem_+_var(--visitor-bar-h,0px)_+_57px)] lg:top-[calc(4rem_+_var(--visitor-bar-h,0px)_+_61px)]",
} as const
/** Where a bar under the tab row and a SubNav sticks (the My scores selection bar). */
export const UNDER_SUBNAV = {
	one: "top-[calc(4rem_+_var(--visitor-bar-h,0px)_+_89px)] lg:top-[calc(4rem_+_var(--visitor-bar-h,0px)_+_93px)]",
	two: "top-[calc(4rem_+_var(--visitor-bar-h,0px)_+_101px)] lg:top-[calc(4rem_+_var(--visitor-bar-h,0px)_+_105px)]",
} as const
/** The tab row's own height, by kind (TAB_ROW_PX). */
const ROW_H = {
	one: "h-[45px] lg:h-[49px]",
	two: "h-[57px] lg:h-[61px]",
} as const

/** Keeps the current tab in view in a row that scrolls sideways. */
export function useCenterCurrent() {
	const box = useRef<HTMLDivElement>(null)
	useLayoutEffect(() => {
		const row = box.current
		const here = row?.querySelector<HTMLElement>("[aria-current='page']")
		if (!row || !here) return
		row.scrollLeft = Math.max(
			0,
			here.offsetLeft - (row.clientWidth - here.offsetWidth) / 2,
		)
	})
	return box
}

function Mark({ mark }: { mark: AreaTab["mark"] }) {
	if (mark === "me")
		return (
			<LockClosedIcon
				className="size-3.5 text-amber-300/80"
				aria-label="Only you see this"
			/>
		)
	if (mark === "members")
		return (
			<UserGroupIcon
				className="size-3.5 text-sky-300/80"
				aria-label="Members only"
			/>
		)
	return null
}

/** The sky badge of something new behind a tab, as the new-episodes mark elsewhere. */
function News({ news }: { news: AreaTab["news"] }) {
	if (!news) return null
	return (
		<span
			data-new-episodes
			className="flex h-[18px] min-w-[18px] items-center justify-center self-center rounded-full bg-sky-400 px-1.5 text-[11px] font-black tabular-nums leading-none text-black"
		>
			<span aria-hidden>{news.badge}</span>
			<span className="sr-only">{news.label}</span>
		</span>
	)
}

/**
 * A tab's icon, left of the label; amber on the current tab. One-line tabs use the gear's 20 px outline. A two-line
 * tab's icon is a little smaller than its two lines (32 px next to 20 px + 16 px), and phones leave it out: the four
 * Watch tabs only fit a 390 px phone as text.
 */
function TabIcon({ tab }: { tab: AreaTab }) {
	const Icon = tab.icon
	if (!Icon) return null
	return (
		<Icon
			aria-hidden
			className={`${tab.sub ? "size-8 max-md:hidden" : "size-5"} shrink-0 ${tab.here ? "text-amber-300" : "text-gray-500"}`}
		/>
	)
}

/** A tab's box: its height and the amber underline on the current tab. */
function tabBox(here: boolean, kind: "one" | "two") {
	const h = kind === "two" ? "h-14 lg:h-[60px]" : "h-11 lg:h-12"
	return `${h} border-b-2 ${here ? "border-amber-400" : "border-transparent"}`
}

/** The label, with the phone's shorter one where the tab has it. */
function Label({ tab }: { tab: AreaTab }) {
	if (!tab.short) return <>{tab.label}</>
	return (
		<>
			<span className="md:hidden">{tab.short}</span>
			<span className="max-md:hidden">{tab.label}</span>
		</>
	)
}

/** One tab: one line, or two (label and a smaller line under it) when it has `sub`. The amber underline marks it current. */
export function TabLink({ tab }: { tab: AreaTab }) {
	const n = tab.count != null && (
		<span className="text-xs tabular-nums text-gray-500">
			{count(tab.count)}
		</span>
	)
	if (tab.sub)
		return (
			<Link
				to={tab.href}
				prefetch="intent"
				aria-current={tab.here ? "page" : undefined}
				className={`relative flex items-center gap-2.5 px-3 whitespace-nowrap max-md:min-w-0 max-md:flex-1 max-md:justify-center max-md:px-1 md:shrink-0 lg:px-4 ${tabBox(tab.here, "two")} ${
					tab.here ? "" : "hover:[&_b]:text-gray-100"
				}`}
			>
				<TabIcon tab={tab} />
				<span className="flex flex-col items-start max-md:items-center">
					<span className="flex items-baseline gap-1.5">
						<b
							className={`text-sm leading-5 font-semibold max-md:text-[13px] ${tab.here ? "text-white" : "text-gray-300"}`}
						>
							<Label tab={tab} />
						</b>
						{n}
						<Mark mark={tab.mark} />
						<News news={tab.news} />
					</span>
					<span
						className={`text-[11px] leading-4 font-medium lg:text-xs ${tab.here ? "text-amber-200/80" : "text-gray-500"}`}
					>
						{tab.sub}
					</span>
				</span>
			</Link>
		)
	return (
		<Link
			to={tab.href}
			prefetch="intent"
			aria-current={tab.here ? "page" : undefined}
			className={`relative flex shrink-0 items-center gap-1.5 px-3 text-sm font-semibold whitespace-nowrap ${tabBox(tab.here, "one")} ${
				tab.here ? "text-white" : "text-gray-400 hover:text-gray-100"
			}`}
		>
			<TabIcon tab={tab} />
			<Label tab={tab} />
			{n}
			<Mark mark={tab.mark} />
			<News news={tab.news} />
		</Link>
	)
}

const Divider = () => (
	<span aria-hidden className="mr-1 h-5 w-px self-center bg-white/10" />
)

/**
 * An area's tab row. `label` names the row at its start on desktop ("Watch", "@handle"); `trailing` tabs sit at the
 * row's end after a thin divider (with `trailingEnd="desktop"`, at the end on desktop only and right after the tabs on
 * phones); `end` (the Settings gear) closes the row. Sticky under the header unless `sticky` is false (pages with their
 * own sticky bar or a full-screen layout).
 */
export function AreaTabs({
	label,
	icon: Icon,
	tabs,
	trailing,
	trailingEnd = "always",
	end,
	sticky = true,
}: {
	label: ReactNode
	/** The area's filled icon before the label; leave it out for a guest on a profile. */
	icon?: NavIcon
	tabs: AreaTab[]
	trailing?: AreaTab[]
	trailingEnd?: "always" | "desktop"
	end?: ReactNode
	sticky?: boolean
}) {
	const scroller = useCenterCurrent()
	const hasTrailing = trailing != null && trailing.length > 0
	const kind = [...tabs, ...(trailing ?? [])].some((t) => t.sub) ? "two" : "one"
	return (
		<nav
			aria-label={typeof label === "string" ? label : "Area"}
			data-tab-row={kind}
			className={`${sticky ? `sticky ${TABS_TOP} ${STICKY_BAR}` : "relative"} ${ROW_H[kind]} ${TAB_ROW}`}
		>
			<div
				ref={scroller}
				className={`${WRAP} relative flex h-full items-center gap-1 overflow-x-auto [scrollbar-width:none]`}
			>
				<span className="hidden shrink-0 items-center gap-1.5 self-center pr-3 text-[11px] font-semibold tracking-wide text-gray-500 uppercase lg:flex">
					{Icon && <Icon className="h-4 w-4 text-amber-400" aria-hidden />}
					{label}
				</span>
				{tabs.map((t) => (
					<TabLink key={t.key} tab={t} />
				))}
				{hasTrailing && (
					<span
						className={`${trailingEnd === "always" ? "ml-auto" : "lg:ml-auto"} flex h-full items-center gap-1 pl-2 lg:pl-8 ${
							kind === "two"
								? "max-md:min-w-0 max-md:flex-1 max-md:pl-0 md:shrink-0"
								: "shrink-0"
						}`}
					>
						<span
							className={kind === "two" ? "contents max-md:hidden" : "contents"}
						>
							<Divider />
						</span>
						{trailing.map((t) => (
							<TabLink key={t.key} tab={t} />
						))}
					</span>
				)}
				{end && !hasTrailing && (
					<span className="ml-auto flex h-full shrink-0 items-center gap-1 pl-3 lg:pl-8">
						<Divider />
						{end}
					</span>
				)}
				{end && hasTrailing && (
					<span className="flex h-full shrink-0 items-center pl-1">{end}</span>
				)}
			</div>
		</nav>
	)
}

/** The Settings gear at the Profile row's end: an icon on phones, "Settings" beside it on desktop. */
export function SettingsGear({ href, here }: { href: string; here: boolean }) {
	const Icon = here ? CogSolid : Cog6ToothIcon
	return (
		<Link
			to={href}
			prefetch="intent"
			aria-current={here ? "page" : undefined}
			aria-label="Settings"
			className={`flex items-center gap-1.5 px-2.5 text-[13px] font-medium whitespace-nowrap ${tabBox(here, "one")} ${
				here ? "text-white" : "text-gray-500 hover:text-gray-200"
			}`}
		>
			<Icon className="h-5 w-5" aria-hidden />
			<span className="hidden lg:inline">Settings</span>
		</Link>
	)
}

/** The Profile row from `tasteRow()` in ./areas: tabs, visitors-only tabs and the gear. */
export function TasteTabs({
	row,
	sticky,
	before,
}: {
	row: TasteRow
	sticky?: boolean
	/** An item at the row's end before the gear (the profile's Preview key). */
	before?: ReactNode
}) {
	const gear = row.gear && (
		<SettingsGear href={row.gear.href} here={row.gear.here} />
	)
	return (
		<AreaTabs
			label={row.label}
			icon={row.areaIcon ? UserCircleSolid : undefined}
			tabs={row.tabs}
			trailing={row.trailing}
			end={
				before ? (
					<>
						{before}
						{gear}
					</>
				) : (
					gear
				)
			}
			sticky={sticky}
		/>
	)
}
