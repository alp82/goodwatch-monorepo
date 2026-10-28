// PROTOTYPE - throwaway. Variant X, "Bar, side tabs": M's expanding bar, organized. Closed: a static title, one bar
// (a wide mood search field first, then Mood, Streaming, Not seen yet, Sort, Filters) and one status line (count, the
// search's Read as chips, the active values, Clear all). The mood search is a filter: type and press Enter, and it
// stays in the field as a value chip with ×. Mood or Filters expands the bar into one wide panel under it: vertical
// tabs on the left (the common filters with their values, then under a divider the niche ones in smaller type), the
// tab's control on the right, and a sticky footer with Clear all and Show N titles. Phones: the field stays on top,
// M's slab at the bottom; the same panel rises full width from it, with the tabs as a scrolling row.
import {
	AdjustmentsHorizontalIcon,
	ArrowTurnDownLeftIcon,
	ArrowsUpDownIcon,
	EyeIcon,
	EyeSlashIcon,
	GlobeAltIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useCallback, useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import {
	SLAB_CLEARANCE,
	SLAB_SEGMENT,
	ShowTitlesButton,
	SnapSheet,
	discoverSorts,
} from "~/ui/filter-bar"
import {
	FilterInsight,
	OneLineChips,
	mergedChips,
} from "~/ui/filter-bar/ActiveFilters"
import {
	FiltersButton,
	NotSeenSwitch,
	ServiceStack,
	ServicesControl,
	SortControl,
} from "~/ui/filter-bar/controls"
import { sortShown } from "~/ui/filter-bar/labels"
import { MENU, RollingNumber, SHELL, TAP } from "~/ui/filter-bar/motion"
import { PopularInline } from "~/ui/filter-bar/PopularFilters"
import { SlabShell } from "~/ui/filter-bar/Slab"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { ProtoGrid, type ProtoDiscover, useFilterPieces } from "../kit"
import {
	COMMON,
	type Cat,
	type CatKey,
	CatPane,
	HueDots,
	MoodSearchValue,
	OneCardStyle,
	PAGE_TITLE,
	type Pieces,
	ValueChip,
	catValues,
	moodLabel,
	nicheFor,
	useIsDesktop,
} from "./O-categories"

export const NAME = "Bar, side tabs"

const PRIVATE = "search-private ph-no-capture sentry-mask"
const TASTE = "signUp" as const
/** A tab: a filter category, or Sort (phones only; desktop has Sort in the bar). */
type Tab = CatKey | "sort"

function useSort(d: ProtoDiscover) {
	const searching = d.filters.searching
	return {
		options: discoverSorts(searching, TASTE),
		value: sortShown(d.filters.sort, searching, TASTE),
		onChange: (key: string) => d.filters.setSort(key as typeof d.filters.sort),
		footnote: searching ? undefined : "Relevance joins once you search.",
	}
}

// ---------------------------------------------------------------------------------------------------------------
// The mood search field: a filter like the others, the largest one.

function MoodSearchField({
	d,
	className = "",
}: { d: ProtoDiscover; className?: string }) {
	const [editing, setEditing] = useState(false)
	const [text, setText] = useState("")
	const input = useRef<HTMLInputElement>(null)
	const showValue = d.q !== null && !editing
	const edit = () => {
		setText(d.q ?? "")
		setEditing(true)
		requestAnimationFrame(() => input.current?.focus())
	}
	const typed = text.trim()
	return (
		<div
			className={`flex h-14 min-w-0 items-center gap-3 rounded-2xl bg-white/[0.06] pr-2 pl-4 ring-1 ring-inset transition-colors focus-within:bg-white/[0.08] focus-within:ring-amber-400/70 ${d.q ? "ring-amber-400/50" : "ring-amber-400/30 hover:ring-amber-400/50"} ${PRIVATE} ${className}`}
		>
			<MagnifyingGlassIcon
				className="h-5 w-5 shrink-0 text-amber-300"
				aria-hidden
			/>
			{showValue ? (
				<>
					<button
						type="button"
						onClick={edit}
						aria-label={`Mood search: ${d.q}. Change it`}
						className="flex h-9 min-w-0 items-center rounded-full bg-amber-400/[0.14] px-3.5 ring-1 ring-inset ring-amber-400/40 cursor-text outline-none hover:bg-amber-400/[0.2] focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<span className="brand-header min-w-0 truncate text-[17px] text-white">
							{d.q}
						</span>
					</button>
					<button
						type="button"
						onClick={() => d.setQ(null)}
						aria-label="Remove the mood search"
						className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 cursor-pointer outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
					<button
						type="button"
						aria-hidden
						tabIndex={-1}
						onClick={edit}
						className="h-full min-w-4 flex-1 cursor-text"
					/>
				</>
			) : (
				<>
					<input
						ref={input}
						type="search"
						value={text}
						maxLength={SEARCH_MAX_CHARS}
						autoComplete="off"
						enterKeyHint="search"
						data-ph-no-capture
						aria-label="What's the mood?"
						placeholder="What's the mood?"
						onFocus={() => setEditing(true)}
						onBlur={() => {
							if (!text.trim() || text.trim() === d.q) setEditing(false)
						}}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault()
								d.setQ(typed || null)
								setEditing(false)
								setText("")
								input.current?.blur()
							} else if (e.key === "Escape") {
								setText("")
								setEditing(false)
								input.current?.blur()
							}
						}}
						className="brand-header min-w-0 flex-1 border-0 bg-transparent p-0 text-[19px] text-white outline-none placeholder:text-gray-400 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
					/>
					{typed && (
						<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-amber-400/15 px-2 py-1 font-sans text-xs font-semibold text-amber-200/90 sm:flex">
							<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
							Search
						</kbd>
					)}
				</>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The panel's parts

function SideTabs({
	d,
	pieces,
	tab,
	onPick,
}: { d: ProtoDiscover; pieces: Pieces; tab: Tab; onPick: (t: Tab) => void }) {
	const values = catValues(d, pieces)
	const item = (c: Cat, niche: boolean) => {
		const on = c.key === tab
		const value = values[c.key]
		return (
			<button
				key={c.key}
				type="button"
				role="tab"
				aria-selected={on}
				onClick={() => onPick(c.key)}
				className={`relative flex w-full min-w-0 items-center gap-2 rounded-lg text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
					niche ? "h-8 px-3" : "h-11 px-3"
				} ${on ? "bg-white/[0.09]" : "hover:bg-white/[0.04]"}`}
			>
				{on && (
					<span
						aria-hidden
						className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-amber-400"
					/>
				)}
				<span
					className={`shrink-0 ${niche ? "text-[13px]" : "text-[15px] font-semibold"} ${
						on
							? "text-white"
							: niche
								? (value ? "text-gray-100" : "text-gray-400")
								: "text-gray-100"
					}`}
				>
					{c.label}
				</span>
				{c.key === "moods" && !value && <HueDots tags={d.picked} size={9} />}
				{value && (
					<span
						className={`ml-auto min-w-0 truncate text-right text-amber-200/85 ${niche ? "text-[11px]" : "text-[12px]"}`}
					>
						{value}
					</span>
				)}
			</button>
		)
	}
	return (
		<div
			role="tablist"
			aria-orientation="vertical"
			aria-label="Filters"
			className="flex flex-col gap-0.5"
		>
			{COMMON.map((c) => item(c, false))}
			<div className="my-3 flex items-center gap-2 px-3">
				<span className="text-[11px] font-bold tracking-[0.08em] text-gray-500 uppercase">
					More
				</span>
				<span className="h-px flex-1 bg-white/[0.07]" />
			</div>
			{nicheFor(pieces).map((c) => item(c, true))}
		</div>
	)
}

function RowTabs({
	d,
	pieces,
	tab,
	onPick,
}: { d: ProtoDiscover; pieces: Pieces; tab: Tab; onPick: (t: Tab) => void }) {
	const values = catValues(d, pieces)
	const row = useRef<HTMLDivElement>(null)
	useEffect(() => {
		row.current
			?.querySelector<HTMLElement>(`[data-tab="${tab}"]`)
			?.scrollIntoView({
				block: "nearest",
				inline: "center",
				behavior: "smooth",
			})
	}, [tab])
	const common: Cat[] = [...COMMON, { key: "sort" as CatKey, label: "Sort" }]
	const item = (c: Cat, niche: boolean) => {
		const on = c.key === tab
		const set = c.key !== ("sort" as CatKey) && values[c.key] !== null
		return (
			<button
				key={c.key}
				type="button"
				role="tab"
				aria-selected={on}
				data-tab={c.key}
				onClick={() => onPick(c.key)}
				className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
					niche
						? "h-10 px-2.5 text-[13px]"
						: "h-10 px-3 text-[15px] font-semibold"
				} ${on ? "text-white" : niche ? "text-gray-500" : "text-gray-300"}`}
			>
				{c.label}
				{set && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
				{on && (
					<span
						aria-hidden
						className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-amber-400"
					/>
				)}
			</button>
		)
	}
	return (
		<div
			ref={row}
			role="tablist"
			aria-label="Filters"
			className="flex items-center overflow-x-auto border-b border-white/[0.07] px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			{common.map((c) => item(c, false))}
			<span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-white/15" />
			{nicheFor(pieces).map((c) => item(c, true))}
		</div>
	)
}

function SortPane({ d }: { d: ProtoDiscover }) {
	const sort = useSort(d)
	return (
		<section aria-label="Sort">
			<h2 className="mb-4 flex h-8 items-center text-[19px] font-bold text-white">
				Sort
			</h2>
			<div role="radiogroup" aria-label="Sort" className="flex flex-col gap-1">
				{sort.options.map((s) => {
					const on = s.key === sort.value
					return (
						<button
							key={s.key}
							// biome-ignore lint/a11y/useSemanticElements: rows as a radio group
							type="button"
							role="radio"
							aria-checked={on}
							aria-disabled={s.disabled || undefined}
							onClick={() => !s.disabled && sort.onChange(s.key)}
							className={`flex h-11 items-center rounded-xl px-4 text-left text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
								s.disabled
									? "cursor-default text-gray-600"
									: on
										? "bg-white font-semibold text-gray-950 cursor-pointer"
										: "bg-white/[0.05] text-gray-200 cursor-pointer"
							}`}
						>
							{s.label}
						</button>
					)
				})}
			</div>
			{sort.footnote && (
				<p className="mt-3 text-[12px] text-gray-500">{sort.footnote}</p>
			)}
		</section>
	)
}

function TabPane({
	d,
	pieces,
	tab,
}: { d: ProtoDiscover; pieces: Pieces; tab: Tab }) {
	if (tab === "sort") return <SortPane d={d} />
	return (
		<CatPane
			d={d}
			pieces={pieces}
			cat={tab}
			niche={!COMMON.some((c) => c.key === tab)}
		/>
	)
}

function Footer({
	d,
	pieces,
	onDone,
}: { d: ProtoDiscover; pieces: Pieces; onDone: () => void }) {
	const n = pieces.secondaryCount
	return (
		<div className="flex shrink-0 items-center gap-4 border-t border-white/[0.06] bg-gray-950/85 px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:pb-3">
			<button
				type="button"
				onClick={d.filters.clearSecondary}
				disabled={!n}
				className="rounded-md px-2 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
			>
				{n ? `Clear all ${n}` : "Clear all"}
			</button>
			<span className="hidden items-center gap-2.5 text-sm text-gray-400 lg:flex">
				<HiddenMeter counts={d.counts} className="w-24" />
				{d.counts && d.counts.hidden > 0 && (
					<span>
						<RollingNumber
							value={d.counts.hidden}
							className="font-semibold text-gray-200"
						/>{" "}
						hidden
					</span>
				)}
			</span>
			<ShowTitlesButton
				counts={d.counts}
				onClick={onDone}
				className="ml-auto min-w-48"
			/>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function MoodSegment({
	d,
	open,
	onClick,
}: { d: ProtoDiscover; open: boolean; onClick: () => void }) {
	const label = moodLabel(d)
	return (
		<motion.button
			type="button"
			data-x-trigger
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-expanded={open}
			className={`flex h-12 max-w-[16rem] shrink-0 items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${
				open
					? "bg-white/[0.09] text-white ring-white/25"
					: label
						? "text-white hover:ring-white/25"
						: "text-gray-200 hover:ring-white/25"
			}`}
		>
			<HueDots tags={d.picked} size={13} />
			<span className="truncate">{label ?? "Mood"}</span>
		</motion.button>
	)
}

function DesktopPanel({
	d,
	pieces,
	tab,
	onTab,
	onClose,
}: {
	d: ProtoDiscover
	pieces: Pieces
	tab: Tab
	onTab: (t: Tab) => void
	onClose: () => void
}) {
	const ref = useRef<HTMLDivElement>(null)
	const pane = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		const down = (e: Event) => {
			const t = e.target as HTMLElement
			if (
				ref.current?.contains(t) ||
				t.closest("[data-x-trigger], [data-x-row]")
			)
				return
			if (t.closest("[role=dialog], [role=menu], [role=listbox]")) return
			onClose()
		}
		document.addEventListener("keydown", key)
		document.addEventListener("pointerdown", down)
		return () => {
			document.removeEventListener("keydown", key)
			document.removeEventListener("pointerdown", down)
		}
	}, [onClose])
	return (
		<motion.div
			ref={ref}
			role="dialog"
			aria-label="Mood and filters"
			initial={{ opacity: 0, y: -6 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -4 }}
			transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
			className={`absolute inset-x-0 top-[calc(3.5rem+10px)] z-40 flex h-[min(680px,calc(100vh-220px))] flex-col overflow-hidden ${MENU}`}
		>
			<div className="grid min-h-0 flex-1 grid-cols-[252px_minmax(0,1fr)]">
				<div className="min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-2.5 py-3">
					<SideTabs
						d={d}
						pieces={pieces}
						tab={tab}
						onPick={(t) => {
							onTab(t)
							pane.current?.scrollTo({ top: 0 })
						}}
					/>
				</div>
				<div
					ref={pane}
					className="min-h-0 overflow-y-auto overscroll-contain px-7 pt-5 pb-8"
				>
					<TabPane d={d} pieces={pieces} tab={tab} />
				</div>
			</div>
			<Footer d={d} pieces={pieces} onDone={onClose} />
		</motion.div>
	)
}

function DesktopBar({
	d,
	pieces,
	open,
	setOpen,
	tab,
	setTab,
}: {
	d: ProtoDiscover
	pieces: Pieces
	open: boolean
	setOpen: (open: boolean) => void
	tab: Tab
	setTab: (t: Tab) => void
}) {
	const navigate = useNavigate()
	const [sortOpen, setSortOpen] = useState(false)
	const sort = useSort(d)
	const close = useCallback(() => setOpen(false), [setOpen])
	const openAt = (t: Tab) => {
		if (open && tab === t) return setOpen(false)
		setTab(t)
		setOpen(true)
	}
	const chips = mergedChips(pieces.chips.filter((c) => c.key !== "services"))
	const any = chips.length > 0 || d.q !== null
	return (
		<>
			<div className="relative mt-4 hidden lg:block">
				<div data-x-row className="flex items-center gap-2.5">
					<MoodSearchField
						d={d}
						className="min-w-[280px] flex-1 basis-[440px]"
					/>
					<MoodSegment
						d={d}
						open={open && tab === "moods"}
						onClick={() => openAt("moods")}
					/>
					<ServicesControl
						{...pieces.servicesProps}
						labels={{ ...pieces.servicesProps.labels, mine: "My services" }}
						onAddServices={() => navigate(SERVICES_PATH)}
					/>
					<NotSeenSwitch {...pieces.notSeenProps} compact />
					<SortControl
						{...sort}
						open={sortOpen}
						onOpenChange={setSortOpen}
						align="right"
					/>
					<span data-x-trigger>
						<FiltersButton
							count={pieces.secondaryCount}
							expanded={open}
							onClick={() =>
								open
									? setOpen(false)
									: openAt(tab === "moods" ? "services" : tab)
							}
							compact
						/>
					</span>
				</div>
				<FilterInsight
					counts={d.counts}
					chips={[]}
					state={d.filters.state}
					onChange={pieces.onChange}
					onDrop={d.filters.drop}
					onClear={d.filters.clearSecondary}
					searching={d.filters.searching}
					idle={
						any ? (
							<div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
								<MoodSearchValue d={d} readOnly />
								{chips.map((chip) => (
									<ValueChip
										key={chip.key}
										chip={chip}
										onRemove={() => d.filters.update((s) => chip.remove(s))}
									/>
								))}
								<button
									type="button"
									onClick={() => {
										d.filters.clearSecondary()
										if (d.q !== null) d.setQ(null)
									}}
									className="shrink-0 rounded-md px-1 text-sm text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									Clear all
								</button>
							</div>
						) : (
							<PopularInline data={pieces.groups} />
						)
					}
					className="mt-4 min-h-9"
				/>
				<AnimatePresence>
					{open && (
						<DesktopPanel
							d={d}
							pieces={pieces}
							tab={tab}
							onTab={setTab}
							onClose={close}
						/>
					)}
				</AnimatePresence>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones: the field on top, the slab at the bottom, and the panel rising from it.

function PhoneLayout({
	d,
	pieces,
	desktop,
}: { d: ProtoDiscover; pieces: Pieces; desktop: boolean }) {
	const navigate = useNavigate()
	const [sheet, setSheet] = useState(-1)
	const [tab, setTab] = useState<Tab>("moods")
	const openAt = (t: Tab) => {
		setTab(t)
		setSheet(0)
	}
	const { state } = d.filters
	const mine = state.onMyServices
	const sort = useSort(d)
	const sortLabel = sort.options.find((s) => s.key === sort.value)?.label ?? ""
	const label = moodLabel(d)
	const chips = mergedChips(pieces.chips.filter((c) => c.key !== "services"))
	const total = d.counts?.total
	const line = (
		<div className="flex h-11 items-center gap-2 px-3 pt-2 text-xs">
			<span className="shrink-0 whitespace-nowrap text-gray-400">
				{total != null ? (
					<RollingNumber value={total} className="font-bold text-white" />
				) : (
					"…"
				)}{" "}
				{d.filters.searching ? "matches" : "titles"}
			</span>
			{(chips.length > 0 || d.q) && (
				<div className="-mr-3 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{d.reading.length > 0 && <MoodSearchValue d={d} readOnly />}
					{chips.map((c) => (
						<button
							key={c.key}
							type="button"
							onClick={() => pieces.onChange(c.remove(state))}
							aria-label={`Remove ${c.label}`}
							className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-white/[0.07] pr-2 pl-2.5 text-[12px] text-gray-100 cursor-pointer"
						>
							{c.label}
							<span aria-hidden className="text-gray-500">
								×
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
	return (
		<>
			<MoodSearchField d={d} className="mt-3 w-full lg:hidden" />
			<div className="lg:hidden">
				<SlabShell
					line={line}
					strip={
						<>
							<motion.button
								type="button"
								whileTap={TAP}
								onClick={() => openAt("moods")}
								aria-label={label ? `Mood: ${label}` : "Mood"}
								className={`${SLAB_SEGMENT} ${label ? "bg-white/10 text-white" : "text-gray-200"}`}
							>
								<span className="flex h-4 items-center">
									<HueDots tags={d.picked} size={12} />
								</span>
								<span className="w-full truncate px-1 text-center">
									{label ?? "Mood"}
								</span>
							</motion.button>
							<motion.button
								type="button"
								role="switch"
								aria-checked={mine}
								aria-label="On my services"
								whileTap={TAP}
								onClick={() =>
									pieces.hasServices
										? pieces.servicesProps.onChange(!mine)
										: navigate(SERVICES_PATH)
								}
								className={`${SLAB_SEGMENT} ${mine ? "bg-linear-to-b from-emerald-600 to-emerald-800 text-white" : "text-gray-400"}`}
							>
								{mine ? (
									<ServiceStack
										providers={pieces.services.providers}
										on
										size={16}
									/>
								) : pieces.hasServices ? (
									<GlobeAltIcon className="h-4 w-4" />
								) : (
									<PlusIcon className="h-4 w-4" />
								)}
								<span className="w-full truncate px-0.5 text-center">
									{mine
										? "My services"
										: pieces.hasServices
											? "Everywhere"
											: "Add services"}
								</span>
							</motion.button>
							<motion.button
								type="button"
								role="switch"
								aria-checked={state.notSeenYet}
								aria-label="Not seen yet"
								whileTap={TAP}
								onClick={() => pieces.notSeenProps.onChange(!state.notSeenYet)}
								className={`${SLAB_SEGMENT} ${state.notSeenYet ? "bg-linear-to-b from-blue-600 to-blue-800 text-white" : "text-gray-400"}`}
							>
								{state.notSeenYet ? (
									<EyeSlashIcon className="h-4 w-4" />
								) : (
									<EyeIcon className="h-4 w-4" />
								)}
								<span className="w-full truncate px-0.5 text-center">
									{state.notSeenYet ? "Not seen" : "Seen too"}
								</span>
							</motion.button>
							<motion.button
								type="button"
								whileTap={TAP}
								onClick={() => openAt("sort")}
								aria-label={`Sort: ${sortLabel}`}
								className={`${SLAB_SEGMENT} text-gray-200`}
							>
								<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
								<span className="w-full truncate px-1 text-center">
									{sortLabel}
								</span>
							</motion.button>
						</>
					}
					trailing={
						<motion.button
							type="button"
							whileTap={{ scale: 0.9 }}
							onClick={() => openAt("services")}
							aria-haspopup="dialog"
							aria-expanded={sheet >= 0}
							aria-label={
								pieces.secondaryCount
									? `Filters, ${pieces.secondaryCount} active`
									: "Filters"
							}
							className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[18px] bg-white/[0.08] text-white ring-1 ring-white/10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<AdjustmentsHorizontalIcon className="h-5 w-5" />
							{pieces.secondaryCount > 0 && (
								<span
									aria-hidden
									className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 ring-2 ring-gray-950"
								>
									{pieces.secondaryCount}
								</span>
							)}
						</motion.button>
					}
				/>
			</div>
			{!desktop && (
				<SnapSheet
					index={sheet}
					onIndex={setSheet}
					snaps={[0.94]}
					label="Mood and filters"
					header={<RowTabs d={d} pieces={pieces} tab={tab} onPick={setTab} />}
					footer={<Footer d={d} pieces={pieces} onDone={() => setSheet(-1)} />}
				>
					<div className="px-5 pt-4 pb-6">
						<TabPane d={d} pieces={pieces} tab={tab} />
					</div>
				</SnapSheet>
			)}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantX({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const desktop = useIsDesktop()
	const [open, setOpen] = useState(false)
	const [tab, setTab] = useState<Tab>("moods")
	const panelOpen = open && desktop
	return (
		<MotionConfig reducedMotion="user">
			<OneCardStyle />
			<div
				className={`mx-auto max-w-[1600px] px-4 pt-4 lg:px-8 lg:pt-6 ${SLAB_CLEARANCE}`}
			>
				<h1 className="brand-header text-[26px] leading-tight text-white lg:text-[32px]">
					{PAGE_TITLE}
				</h1>
				<DesktopBar
					d={d}
					pieces={pieces}
					open={panelOpen}
					setOpen={setOpen}
					tab={tab}
					setTab={setTab}
				/>
				<PhoneLayout d={d} pieces={pieces} desktop={desktop} />
				<div className="relative mt-3 lg:mt-4">
					<ProtoGrid d={d} />
					<AnimatePresence>
						{panelOpen && (
							<motion.button
								type="button"
								aria-label="Close the filters"
								tabIndex={-1}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.18 }}
								onClick={() => setOpen(false)}
								className="absolute inset-0 z-30 cursor-default bg-gray-950/45"
							/>
						)}
					</AnimatePresence>
				</div>
			</div>
		</MotionConfig>
	)
}
