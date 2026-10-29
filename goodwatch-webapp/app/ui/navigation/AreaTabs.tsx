// The rows under the site header: an area's tabs (sticky under the h-16 header, sideways scroll on phones), the Settings
// gear at the Taste row's end, the small two-option switch ("To watch | Seen", "Scored | Not rated", Best's "Movies |
// Shows") and the chip row under Watch's To watch. Props in, links out: the data comes from ./areas.ts.
import { LockClosedIcon, UserGroupIcon } from "@heroicons/react/20/solid"
import { Cog6ToothIcon } from "@heroicons/react/24/outline"
import {
	Cog6ToothIcon as CogSolid,
	FingerPrintIcon as FingerPrintSolid,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useLayoutEffect, useRef } from "react"
import { STICKY_BAR } from "~/ui/layers"
import type { AreaTab, NavChoices, NavIcon, TasteRow } from "./areas"

/** The page width, as ui/my-pages/bits.tsx (kept here so the header chunk does not pull that module). */
const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
const count = (n: number) => n.toLocaleString("en-US")

/** Keeps the current tab or chip in view in a row that scrolls sideways. */
function useCenterCurrent() {
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
				className={`relative flex min-h-14 shrink-0 flex-col items-start justify-center border-b-2 px-3 whitespace-nowrap lg:min-h-[60px] lg:px-4 ${
					tab.here
						? "border-amber-400"
						: "border-transparent hover:[&_b]:text-gray-100"
				}`}
			>
				<span className="flex items-baseline gap-1.5">
					<b
						className={`text-sm leading-5 font-semibold ${tab.here ? "text-white" : "text-gray-300"}`}
					>
						{tab.label}
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
			</Link>
		)
	return (
		<Link
			to={tab.href}
			prefetch="intent"
			aria-current={tab.here ? "page" : undefined}
			className={`relative flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold whitespace-nowrap lg:min-h-12 ${
				tab.here
					? "border-amber-400 text-white"
					: "border-transparent text-gray-400 hover:text-gray-100"
			}`}
		>
			{tab.label}
			{n}
			<Mark mark={tab.mark} />
			<News news={tab.news} />
		</Link>
	)
}

const Divider = () => <span aria-hidden className="mr-1 h-5 w-px bg-white/10" />

/**
 * An area's tab row. `label` names the row at its start on desktop ("Watch", "@handle"); `trailing` tabs sit at the
 * row's end after a thin divider; `end` (the Settings gear) closes the row. Sticky under the header unless `sticky`
 * is false (pages with their own sticky bar or a full-screen layout).
 */
export function AreaTabs({
	label,
	icon: Icon,
	tabs,
	trailing,
	end,
	sticky = true,
}: {
	label: ReactNode
	/** The area's filled icon before the label; leave it out for a guest on a profile. */
	icon?: NavIcon
	tabs: AreaTab[]
	trailing?: AreaTab[]
	end?: ReactNode
	sticky?: boolean
}) {
	const scroller = useCenterCurrent()
	const hasTrailing = trailing != null && trailing.length > 0
	return (
		<nav
			aria-label={typeof label === "string" ? label : "Area"}
			className={`${sticky ? `sticky top-16 ${STICKY_BAR}` : "relative"} border-b border-white/10 bg-gray-950/95`}
		>
			<div
				ref={scroller}
				className={`${WRAP} flex items-center gap-1 overflow-x-auto [scrollbar-width:none]`}
			>
				<span className="hidden shrink-0 items-center gap-1.5 pr-3 text-[11px] font-semibold tracking-wide text-gray-500 uppercase lg:flex">
					{Icon && <Icon className="h-4 w-4 text-amber-400" aria-hidden />}
					{label}
				</span>
				{tabs.map((t) => (
					<TabLink key={t.key} tab={t} />
				))}
				{hasTrailing && (
					<span className="ml-auto flex shrink-0 items-center gap-1 pl-4 lg:pl-8">
						<Divider />
						{trailing.map((t) => (
							<TabLink key={t.key} tab={t} />
						))}
					</span>
				)}
				{end && !hasTrailing && (
					<span className="ml-auto flex shrink-0 items-center gap-1 pl-3 lg:pl-8">
						<Divider />
						{end}
					</span>
				)}
				{end && hasTrailing && (
					<span className="flex shrink-0 items-center pl-1">{end}</span>
				)}
			</div>
		</nav>
	)
}

/** The Settings gear at the Taste row's end: an icon on phones, "Settings" beside it on desktop. */
export function SettingsGear({ href, here }: { href: string; here: boolean }) {
	const Icon = here ? CogSolid : Cog6ToothIcon
	return (
		<Link
			to={href}
			prefetch="intent"
			aria-current={here ? "page" : undefined}
			aria-label="Settings"
			className={`flex min-h-11 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium whitespace-nowrap lg:min-h-12 ${
				here
					? "border-amber-400 text-white"
					: "border-transparent text-gray-500 hover:text-gray-200"
			}`}
		>
			<Icon className="h-5 w-5" aria-hidden />
			<span className="hidden lg:inline">Settings</span>
		</Link>
	)
}

/** The Taste row from `tasteRow()` in ./areas: tabs, visitors-only tabs and the gear. */
export function TasteTabs({
	row,
	sticky,
}: { row: TasteRow; sticky?: boolean }) {
	return (
		<AreaTabs
			label={row.label}
			icon={row.areaIcon ? FingerPrintSolid : undefined}
			tabs={row.tabs}
			trailing={row.trailing}
			end={
				row.gear && <SettingsGear href={row.gear.href} here={row.gear.here} />
			}
			sticky={sticky}
		/>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The two-option switch and the chips. Both replace the history entry and keep the scroll position.

const SEG_TRACK =
	"inline-flex max-w-full shrink-0 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10"
const seg = (on: boolean) =>
	`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors ${
		on ? "bg-white font-bold text-gray-950" : "text-gray-300 hover:text-white"
	}`

/** "To watch | Seen" and its kin: one track, the current side white. `className` sets the spacing around it. */
export function ChoiceSwitch({
	choices,
	className = "mb-3",
}: { choices: NavChoices; className?: string }) {
	return (
		<div className={`${WRAP} ${className}`}>
			<nav aria-label={choices.label} className={SEG_TRACK}>
				{choices.choices.map((c) => (
					<Link
						key={c.key}
						to={c.href}
						replace
						preventScrollReset
						prefetch="intent"
						aria-current={c.here ? "page" : undefined}
						className={seg(c.here)}
					>
						{c.label}
						{c.count != null && (
							<span
								className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${c.here ? "bg-black/10" : "bg-white/10"}`}
							>
								{count(c.count)}
							</span>
						)}
					</Link>
				))}
			</nav>
		</div>
	)
}

/** The chips under To watch, in Discover's chip look: they wrap on a phone and never scroll sideways. */
export function ChipRow({
	choices,
	className = "mb-4",
}: { choices: NavChoices; className?: string }) {
	return (
		<nav
			aria-label={choices.label}
			className={`${WRAP} ${className} flex flex-wrap gap-1.5`}
		>
			{choices.choices.map((c) => (
				<Link
					key={c.key}
					to={c.href}
					replace
					preventScrollReset
					prefetch="intent"
					aria-current={c.here ? "page" : undefined}
					className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ring-1 ${
						c.here
							? "bg-amber-400/15 text-amber-100 ring-amber-400/50"
							: "bg-white/[0.04] text-gray-300 ring-white/10 hover:bg-white/[0.08]"
					}`}
				>
					{c.label}
					{c.count != null && (
						<span
							className={`text-xs tabular-nums ${c.here ? "text-amber-200/80" : "text-gray-500"}`}
						>
							{count(c.count)}
						</span>
					)}
				</Link>
			))}
		</nav>
	)
}
