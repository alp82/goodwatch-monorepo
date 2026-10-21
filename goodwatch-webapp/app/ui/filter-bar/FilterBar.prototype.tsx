// PROTOTYPE - throwaway. The desktop bar for the Filters sheet variants: For you and Sort as one split control, and
// the Filters button merged with the active filters into one row.
import {
	AdjustmentsHorizontalIcon,
	ChevronDownIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useQueries } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import {
	type ComponentProps,
	type ReactNode,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { type FilterName, type FilterState, dropFilter } from "~/domain/filter-state"
import { OneRowChips } from "./FilterGroups.prototype"
import { FingerprintTip, MovedUp } from "./ForYou"
import { TitleChipPreview } from "./TitleChipPreview"
import { SortControl, useMenu } from "./controls"
import { CountLine, HiddenMeter } from "./SubBar"
import { type ActiveChip, FILTER_ACCENTS, compactCount, recoveryLabel } from "./labels"
import { Knob, MENU, RollingNumber, TAP } from "./motion"
import type { FilterBarCounts } from "./types"
import type { ForYouControl } from "./types"

/** For you | Sort in one shell: For you lights its half amber, Sort opens its menu from the other half. */
export function ForYouSortSplit({
	forYou,
	sort,
}: {
	forYou?: ForYouControl
	sort: ComponentProps<typeof SortControl>
}) {
	if (!forYou || forYou.replacement)
		return (
			<>
				{forYou?.replacement && <div className="flex h-12 shrink-0 items-center">{forYou.replacement}</div>}
				<SortControl {...sort} />
			</>
		)
	const { on, onChange, movedUp, explanation, disabled } = forYou
	const lit = on && !disabled
	return (
		<div
			className={`flex h-12 shrink-0 items-stretch rounded-2xl ring-1 transition-[background-color,box-shadow] duration-300 ${lit ? "bg-white/[0.04] ring-amber-500/40 shadow-[0_0_30px_-10px_rgba(245,158,11,.55)]" : "bg-white/[0.04] ring-white/10"}`}
		>
			<div className={`flex items-center rounded-l-2xl pl-1.5 transition-colors ${lit ? "bg-amber-500/[0.14]" : ""}`}>
				<FingerprintTip on={lit} explanation={explanation} />
				<motion.button
					type="button"
					role="switch"
					aria-checked={lit}
					aria-disabled={disabled || undefined}
					whileTap={disabled ? undefined : TAP}
					data-for-you-switch
					onClick={() => !disabled && onChange(!on)}
					className={`flex h-full items-center gap-2.5 pr-3.5 pl-1.5 text-sm font-bold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${disabled ? "cursor-not-allowed text-gray-500" : lit ? "cursor-pointer text-amber-100" : "cursor-pointer text-gray-400 hover:text-gray-200"}`}
				>
					For you
					{/* The moved count takes room only when there is one. */}
					{lit && movedUp > 0 && <MovedUp on={lit} movedUp={movedUp} />}
					<Knob on={lit} />
				</motion.button>
			</div>
			<span aria-hidden className="my-2.5 w-px bg-white/10" />
			<SortControl {...sort} bare />
		</div>
	)
}

/**
 * The Filters button and the active filters as one row: the button opens the sheet, each chip comes off with its ×,
 * what doesn't fit folds into "+N" (which opens the sheet), and Clear ends the row. Without filters the row says what
 * the sheet holds.
 */
export function FiltersRow({
	count,
	chips,
	state,
	onChange,
	onOpen,
	onClear,
	expanded,
}: {
	count: number
	chips: ActiveChip[]
	state: FilterState
	onChange: (state: FilterState) => void
	onOpen: () => void
	onClear: () => void
	expanded: boolean
}) {
	return (
		<div className="flex min-h-12 items-center gap-2 rounded-2xl bg-white/[0.04] p-1.5 ring-1 ring-white/10">
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={onOpen}
				aria-haspopup="dialog"
				aria-expanded={expanded}
				aria-label={count ? `Filters, ${count} active` : "Filters"}
				className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-white/[0.07] px-3 text-sm font-bold text-white cursor-pointer outline-none hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<AdjustmentsHorizontalIcon className="h-4 w-4" />
				Filters
				{count > 0 && (
					<span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs tabular-nums text-gray-950">
						{count}
					</span>
				)}
			</motion.button>
			{chips.length ? (
				<OneRowChips
					chips={chips}
					state={state}
					onChange={onChange}
					onMore={onOpen}
					className="flex-1"
					trailing={
						<button type="button" onClick={onClear} className="h-8 shrink-0 px-2 text-[13px] text-gray-500 cursor-pointer hover:text-white">
							Clear
						</button>
					}
				/>
			) : (
				<button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-[13px] text-gray-500 cursor-pointer hover:text-gray-300">
					Genre, mood, score, year, length, streaming, cast…
				</button>
			)}
		</div>
	)
}

// ---------------------------------------------------------------- the active-filters row under the bar (round 5)

/** Which filter a chip belongs to, for grouping: legacy chips go by their parameter. */
function groupOf(chip: ActiveChip): string {
	if (chip.group === "content") return "ageLimit"
	if (chip.group !== "legacy") return chip.group
	const param = chip.key.replace(/^legacy-/, "")
	if (param === "minYear" || param === "maxYear") return "released"
	if (param === "minRuntime" || param === "maxRuntime") return "length"
	if (param === "scoreGap") return "gap"
	if (/^min(Imdb|Tomatometer|RtAudience|Metacritic)$/.test(param)) return "sources"
	return "legacy"
}

const GROUP_LABELS: Record<string, string> = {
	type: "Type",
	anime: "Anime",
	moods: "Mood",
	themes: "Theme",
	styles: "Style",
	genres: "Genre",
	minScore: "Score",
	minMatch: "Taste match",
	released: "Released",
	length: "Length",
	sources: "Scores",
	gap: "Critics",
	similarTo: "Similar to",
	loved: "Loved",
	disliked: "Disliked",
	people: "Cast and crew",
	productionCountries: "Made in",
	ageLimit: "Age & content",
	services: "Streaming",
	notSeenYet: "Not seen",
	legacy: "Other",
}

interface ChipGroup {
	id: string
	label: string
	dot: string
	chips: ActiveChip[]
}

/** TMDB's combined TV genres, shown under the movie genre they were merged into. */
const TV_GENRE_OF: Record<string, string[]> = {
	"Action & Adventure": ["Action", "Adventure"],
	"Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
	"War & Politics": ["War"],
}

function grouped(all: ActiveChip[]): ChipGroup[] {
	// A merged TV genre rides along with its movie genre: one chip, and its × takes both off.
	const labels = new Set(all.map((c) => c.label))
	const riders = all.filter((c) => c.group === "genres" && TV_GENRE_OF[c.label]?.some((m) => labels.has(m)))
	const chips = all
		.filter((c) => !riders.includes(c))
		.map((c) => {
			const mine = riders.filter((r) => TV_GENRE_OF[r.label].includes(c.label))
			if (!mine.length) return c
			const label = c.label === "Science Fiction" ? "Sci-Fi" : c.label
			return { ...c, label, remove: (s: FilterState) => mine.reduce((acc, r) => r.remove(acc), c.remove(s)) }
		})
	const out: ChipGroup[] = []
	for (const chip of chips) {
		const id = groupOf(chip)
		let g = out.find((x) => x.id === id)
		if (!g) {
			g = { id, label: GROUP_LABELS[id] ?? id, dot: FILTER_ACCENTS[chip.group].dot, chips: [] }
			out.push(g)
		}
		g.chips.push(chip)
	}
	return out
}

const removeAll = (chips: ActiveChip[], state: FilterState) => chips.reduce((s, c) => c.remove(s), state)

/** A small popover under its trigger; closes on Escape, Tab, or a press outside. */
function Popover({
	open,
	onClose,
	trigger,
	children,
	align = "left",
	width = "w-72",
}: {
	width?: string
	open: boolean
	onClose: () => void
	trigger: ReactNode
	children: ReactNode
	align?: "left" | "right"
}) {
	const root = useRef<HTMLDivElement>(null)
	const t = useRef<HTMLDivElement>(null)
	useMenu(open, onClose, root, t)
	return (
		<div ref={root} className="relative">
			<div ref={t}>{trigger}</div>
			<AnimatePresence>
				{open && (
					<motion.div
						role="menu"
						initial={{ opacity: 0, y: -6, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -4, scale: 0.98 }}
						transition={{ duration: 0.14 }}
						className={`absolute z-40 mt-2 ${width} max-w-[calc(100vw-2rem)] p-1.5 ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"} ${MENU}`}
					>
						{children}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

/** One removable value in a menu. */
function MenuValue({ chip, onRemove }: { chip: ActiveChip; onRemove: () => void }) {
	return (
		<button
			type="button"
			role="menuitem"
			onClick={onRemove}
			className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-gray-200 cursor-pointer outline-none hover:bg-white/[0.07] focus-visible:bg-white/[0.07]"
		>
			<span className="min-w-0 flex-1 truncate">{chip.label}</span>
			<XMarkIcon className="h-4 w-4 shrink-0 text-gray-500 group-hover:text-white" />
		</button>
	)
}

/** Every active value by filter, each removable, a "Clear <filter>" per group, and Clear all. */
function GroupedMenu({ groups, state, onChange, onClear }: { groups: ChipGroup[]; state: FilterState; onChange: (s: FilterState) => void; onClear: () => void }) {
	return (
		<div className="max-h-[60vh] overflow-y-auto">
			{groups.map((g) => (
				<div key={g.id} className="pb-1">
					<div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
						<span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} />
						<span className="flex-1 text-[12px] font-semibold text-gray-400">{g.label}</span>
						{g.chips.length > 1 && (
							<button type="button" role="menuitem" onClick={() => onChange(removeAll(g.chips, state))} className="rounded px-1.5 text-[12px] text-gray-500 cursor-pointer hover:text-white">
								Clear {g.label.toLowerCase()}
							</button>
						)}
					</div>
					{g.chips.map((c) => (
						<MenuValue key={c.key} chip={c} onRemove={() => onChange(c.remove(state))} />
					))}
				</div>
			))}
			<div className="mt-1 border-t border-white/[0.07] pt-1">
				<button type="button" role="menuitem" onClick={onClear} className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-amber-300 cursor-pointer hover:bg-white/[0.07]">
					Clear all filters
				</button>
			</div>
		</div>
	)
}

/** The live chip look: dot, label, ×. */
function LiveChip({ chip, onRemove }: { chip: ActiveChip; onRemove: () => void }) {
	return (
		<TitleChipPreview chip={chip}>
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={onRemove}
				aria-label={`Remove ${chip.label}`}
				className="group flex h-8 items-center gap-2 rounded-full bg-white/[0.06] pr-2 pl-3 text-sm whitespace-nowrap text-gray-100 cursor-pointer outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<span className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`} />
				{chip.label}
				<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" />
			</motion.button>
		</TitleChipPreview>
	)
}

export type ActiveRowStyle = "wrap" | "menu" | "grouped"

/**
 * The active filters under the bar.
 * - wrap: every chip, wrapping, then Clear all.
 * - menu: one line; what doesn't fit folds into "+N"; "Clear ▾" opens every value by filter, to take off any.
 * - grouped: one chip per filter ("Genre: Comedy, Drama"); a tap opens its values; its × takes the filter off.
 */
export function ActiveFiltersRow({
	style,
	chips,
	state,
	onChange,
	onClear,
}: {
	style: ActiveRowStyle
	chips: ActiveChip[]
	state: FilterState
	onChange: (s: FilterState) => void
	onClear: () => void
}) {
	const [menu, setMenu] = useState<string | null>(null)
	const list = useRef<HTMLUListElement>(null)
	const [hidden, setHidden] = useState(0)
	const sig = chips.map((c) => c.key).join("|")
	// biome-ignore lint/correctness/useExhaustiveDependencies: measure again when the chips change
	useLayoutEffect(() => {
		const el = list.current
		if (style !== "menu" || !el) return
		const measure = () => {
			const items = [...el.children] as HTMLElement[]
			const top = items[0]?.offsetTop ?? 0
			let n = 0
			for (const i of items) {
				const out = i.offsetTop > top + 4 || i.offsetLeft + i.offsetWidth > el.clientWidth + 1
				i.style.visibility = out ? "hidden" : ""
				if (out) n++
			}
			setHidden(n)
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [sig, style])
	if (!chips.length) return null
	const groups = grouped(chips)
	const clearAll = (
		<button type="button" onClick={onClear} className="h-8 shrink-0 px-1.5 text-sm text-gray-500 cursor-pointer hover:text-white">
			Clear all
		</button>
	)

	if (style === "wrap")
		return (
			<ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
				{chips.map((c) => (
					<li key={c.key}>
						<LiveChip chip={c} onRemove={() => onChange(c.remove(state))} />
					</li>
				))}
				<li>{clearAll}</li>
			</ul>
		)

	if (style === "menu")
		return (
			<div className="flex items-center gap-2">
				<ul aria-label="Active filters" ref={list} className="flex h-8 min-w-0 flex-1 flex-wrap gap-2 overflow-hidden">
					{chips.map((c) => (
						<li key={c.key}>
							<LiveChip chip={c} onRemove={() => onChange(c.remove(state))} />
						</li>
					))}
				</ul>
				<Popover
					open={menu === "all"}
					onClose={() => setMenu(null)}
					align="right"
					trigger={
						<span className="flex h-8 shrink-0 items-center rounded-full bg-white/[0.04] ring-1 ring-white/10">
							{hidden > 0 && (
								<button type="button" onClick={() => setMenu(menu ? null : "all")} className="h-8 rounded-l-full pr-2 pl-3 text-sm font-semibold text-gray-200 cursor-pointer hover:bg-white/[0.06]">
									+{hidden}
								</button>
							)}
							<button type="button" onClick={onClear} className={`h-8 px-3 text-sm text-gray-400 cursor-pointer hover:bg-white/[0.06] hover:text-white ${hidden > 0 ? "border-l border-white/10" : "rounded-l-full"}`}>
								Clear all
							</button>
							<button
								type="button"
								aria-label="Choose what to clear"
								aria-haspopup="menu"
								aria-expanded={menu === "all"}
								onClick={() => setMenu(menu ? null : "all")}
								className="grid h-8 w-8 place-items-center rounded-r-full border-l border-white/10 text-gray-400 cursor-pointer hover:bg-white/[0.06] hover:text-white"
							>
								<ChevronDownIcon className={`h-4 w-4 transition-transform ${menu === "all" ? "rotate-180" : ""}`} />
							</button>
						</span>
					}
				>
					<GroupedMenu groups={groups} state={state} onChange={onChange} onClear={() => { setMenu(null); onClear() }} />
				</Popover>
			</div>
		)

	return (
		<ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
			{groups.map((g) => (
				<li key={g.id}>
					<Popover
						open={menu === g.id}
						onClose={() => setMenu(null)}
						trigger={
							<span className="flex h-8 items-center rounded-full bg-white/[0.06] text-sm text-gray-100">
								<button
									type="button"
									aria-haspopup="menu"
									aria-expanded={menu === g.id}
									onClick={() => setMenu(menu === g.id ? null : g.id)}
									className="flex h-8 max-w-[18rem] items-center gap-2 rounded-l-full pr-1.5 pl-3 cursor-pointer hover:bg-white/[0.05]"
								>
									<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${g.dot}`} />
									<span className="shrink-0 text-gray-400">{g.label}</span>
									<span className="truncate">{g.chips.map((c) => c.label.replace(/^Produced in /, "")).join(", ")}</span>
									{g.chips.length > 1 && <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-gray-500" />}
								</button>
								<button
									type="button"
									onClick={() => onChange(removeAll(g.chips, state))}
									aria-label={`Remove ${g.label}`}
									className="grid h-8 w-7 place-items-center rounded-r-full text-gray-500 cursor-pointer hover:text-white"
								>
									<XMarkIcon className="h-3.5 w-3.5" />
								</button>
							</span>
						}
					>
						<div className="px-2.5 pt-1.5 pb-1 text-[12px] font-semibold text-gray-400">{g.label}</div>
						{g.chips.map((c) => (
							<MenuValue key={c.key} chip={c} onRemove={() => onChange(c.remove(state))} />
						))}
					</Popover>
				</li>
			))}
			<li>{clearAll}</li>
		</ul>
	)
}

// ---------------------------------------------------------------- one filter row: status + what hides titles (round 6)

/**
 * The count line and the active filters as one row. It starts with what shows ("22 showing", the meter, what's
 * hidden); then one chip per filter, ordered by how many titles it hides, each with what taking it off brings back
 * (+5.6k) and its ×; a tap on a chip with several values opens them. What doesn't fit goes under More; Clear all ends
 * the row. `lines` is 1 (one line) or 2 (taller: the count above, the chips below).
 */
export function FilterStatusRow({
	lines,
	counts,
	chips,
	state,
	onChange,
	onClear,
	searching,
}: {
	lines: 1 | 2
	counts: FilterBarCounts | null
	chips: ActiveChip[]
	state: FilterState
	onChange: (s: FilterState) => void
	onClear: () => void
	searching?: boolean
}) {
	const [menu, setMenu] = useState<string | null>(null)
	const list = useRef<HTMLUListElement>(null)
	const [hiddenIds, setHiddenIds] = useState<string[]>([])
	const recovered = new Map((counts?.recoveries ?? []).map((r) => [r.filter as string, r.titles]))
	// The top row's filters that hide titles (On my services, picked services, Not seen yet) join the row too.
	const extra: ActiveChip[] = []
	if ((state.onMyServices || state.services?.length) && recovered.get("services"))
		extra.push({
			key: "row-services",
			group: "services",
			label: state.onMyServices ? "My services" : `${state.services?.length} services`,
			remove: (s) => dropFilter(s, "services"),
		})
	if (state.notSeenYet && recovered.get("notSeenYet"))
		extra.push({ key: "row-notSeenYet", group: "notSeenYet", label: "Not seen yet", remove: (s) => ({ ...s, notSeenYet: false }) })
	const groups = grouped([...chips, ...extra])
	const legacyGroups = groups.filter((g) => g.chips.some((c) => c.group === "legacy"))
	// What taking a filter off brings back. The older-style filters (years, length, scores) share one number, so it
	// shows only when one of them is on.
	const back = (g: ChipGroup): number | null => {
		const legacy = g.chips.some((c) => c.group === "legacy")
		if (legacy) return legacyGroups.length === 1 ? (recovered.get("legacy") ?? null) : null
		const key = g.chips[0].group
		return recovered.get(key) ?? recovered.get(g.id) ?? null
	}
	const ordered = [...groups].sort((a, b) => (back(b) ?? -1) - (back(a) ?? -1))
	const sig = ordered.map((g) => `${g.id}:${g.chips.length}`).join("|")
	// biome-ignore lint/correctness/useExhaustiveDependencies: measure again when the chips change
	useLayoutEffect(() => {
		const el = list.current
		if (!el) return
		// Fill the line in order, skipping a chip that doesn't fit so smaller ones after it still can.
		const measure = () => {
			const items = [...el.children] as HTMLElement[]
			for (const i of items) i.style.display = ""
			const widths = items.map((i) => i.offsetWidth)
			const gap = 6
			let used = 0
			const out: string[] = []
			items.forEach((i, n) => {
				const need = widths[n] + (used ? gap : 0)
				if (used + need <= el.clientWidth + 1) used += need
				else {
					i.style.display = "none"
					if (i.dataset.id) out.push(i.dataset.id)
				}
			})
			setHiddenIds((prev) => (prev.join() === out.join() ? prev : out))
		}
		measure()
		let last = el.clientWidth
		const ro = new ResizeObserver(() => {
			if (el.clientWidth === last) return
			last = el.clientWidth
			measure()
		})
		ro.observe(el)
		return () => ro.disconnect()
	}, [sig, lines])
	const more = ordered.filter((g) => hiddenIds.includes(g.id))
	const plus = (n: number | null) =>
		n ? (
			<span className="text-[12px] font-semibold tabular-nums text-amber-400" title={`${n.toLocaleString("en")} more without it`}>
				+{compactCount(n)}
			</span>
		) : null

	const status = (
		<div className="flex shrink-0 items-center gap-2.5" aria-live="polite">
			<HiddenMeter counts={counts} className="w-16" />
			<span className="text-sm whitespace-nowrap text-gray-400">
				{counts ? (
					<>
						<RollingNumber value={counts.total} className="font-bold text-white" />{" "}
						{searching ? (counts.total === 1 ? "match" : "matches") : "showing"}
						{counts.hidden > 0 && (
							<span className="text-gray-500">
								{" · "}
								{compactCount(counts.hidden)} hidden
							</span>
						)}
					</>
				) : (
					"Counting…"
				)}
			</span>
		</div>
	)

	const chipRow = (
		<ul ref={list} aria-label="Active filters" className="flex h-8 min-w-0 flex-1 gap-1.5 overflow-hidden">
			{ordered.map((g) => {
				const n = back(g)
				const values = g.chips.map((c) => c.label.replace(/^Produced in /, "")).join(", ")
				return (
					<li key={g.id} data-id={g.id} className="shrink-0">
						<Popover
							open={menu === g.id}
							onClose={() => setMenu(null)}
							trigger={
								<span className="flex h-8 items-center rounded-full bg-white/[0.06] text-sm text-gray-100 transition-colors hover:bg-white/[0.09]">
									<button
										type="button"
										aria-haspopup={g.chips.length > 1 ? "menu" : undefined}
										aria-expanded={g.chips.length > 1 ? menu === g.id : undefined}
										onClick={() => g.chips.length > 1 && setMenu(menu === g.id ? null : g.id)}
										title={g.label}
										className={`flex h-8 max-w-[16rem] items-center gap-1.5 rounded-l-full pr-1 pl-3 ${g.chips.length > 1 ? "cursor-pointer" : "cursor-default"}`}
									>
										<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${g.dot}`} />
										<span className="truncate">{values}</span>
										{plus(n)}
									</button>
									<button
										type="button"
										onClick={() => onChange(removeAll(g.chips, state))}
										aria-label={`Remove ${g.label}`}
										className="grid h-8 w-7 place-items-center rounded-r-full text-gray-500 cursor-pointer hover:text-white"
									>
										<XMarkIcon className="h-3.5 w-3.5" />
									</button>
								</span>
							}
						>
							<div className="px-2.5 pt-1.5 pb-1 text-[12px] font-semibold text-gray-400">{g.label}</div>
							{g.chips.map((c) => (
								<MenuValue key={c.key} chip={c} onRemove={() => onChange(c.remove(state))} />
							))}
						</Popover>
					</li>
				)
			})}
		</ul>
	)

	const tail = (
		<div className="flex shrink-0 items-center gap-1">
			{more.length > 0 && (
				<Popover
					open={menu === "more"}
					onClose={() => setMenu(null)}
					align="right"
					trigger={
						<button
							type="button"
							aria-haspopup="menu"
							aria-expanded={menu === "more"}
							onClick={() => setMenu(menu === "more" ? null : "more")}
							className="flex h-8 items-center gap-1 rounded-full bg-white/[0.06] pr-2 pl-3 text-sm font-semibold text-gray-200 cursor-pointer hover:bg-white/[0.09]"
						>
							{more.length} more
							<ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${menu === "more" ? "rotate-180" : ""}`} />
						</button>
					}
				>
					<div className="max-h-[60vh] overflow-y-auto">
						{more.map((g) => (
							<div key={g.id} className="pb-1">
								<div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
									<span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} />
									<span className="flex-1 text-[12px] font-semibold text-gray-400">{g.label}</span>
									{plus(back(g))}
								</div>
								{g.chips.map((c) => (
									<MenuValue key={c.key} chip={c} onRemove={() => onChange(c.remove(state))} />
								))}
							</div>
						))}
					</div>
				</Popover>
			)}
			{chips.length > 0 && (
				<button type="button" onClick={onClear} className="h-8 px-2 text-sm whitespace-nowrap text-gray-500 cursor-pointer hover:text-white">
					Clear all
				</button>
			)}
		</div>
	)

	if (lines === 2)
		return (
			<div className="rounded-2xl bg-white/[0.03] px-3.5 pt-2.5 pb-3 ring-1 ring-white/[0.06]">
				{status}
				{chips.length > 0 && (
					<div className="mt-2 flex items-center gap-2">
						{chipRow}
						{tail}
					</div>
				)}
			</div>
		)
	return (
		<div className="flex min-h-12 items-center gap-3 rounded-2xl bg-white/[0.03] px-3.5 py-2 ring-1 ring-white/[0.06]">
			{status}
			{chips.length > 0 && <span aria-hidden className="h-5 w-px shrink-0 bg-white/10" />}
			{chipRow}
			{tail}
		</div>
	)
}

// ---------------------------------------------------------------- round 7: the count line, improved; phone quick row

/** The older-style filters, each with the URL parameters it owns and how its recovery reads. */
const LEGACY_GROUPS = [
	{ id: "released", params: ["minYear", "maxYear"], label: (n: string) => `${n} from other years` },
	{ id: "length", params: ["minRuntime", "maxRuntime"], label: (n: string) => `${n} of other lengths` },
	{ id: "sources", params: ["minImdb", "minTomatometer", "minRtAudience", "minMetacritic"], label: (n: string) => `${n} with lower source scores` },
	{ id: "gap", params: ["scoreGap"], label: (n: string) => `${n} without critics vs audiences` },
] as const

/**
 * The server counts the older-style filters (years, length, source scores, critics vs audiences) as one. With two or
 * more on, the prototype asks for each one's own number: the same results without that filter's parameters.
 */
function useLegacySplit(state: FilterState, total: number | null) {
	const on = LEGACY_GROUPS.filter((g) => g.params.some((p) => state.legacy?.[p as keyof typeof state.legacy]))
	const search = typeof window === "undefined" ? "" : window.location.search
	const results = useQueries({
		queries: on.map((g) => ({
			queryKey: ["proto-legacy-split", g.id, search],
			queryFn: async () => {
				const p = new URLSearchParams(search)
				for (const k of g.params) p.delete(k)
				for (const k of ["variant", "order", "as"]) p.delete(k)
				const r = await (await fetch(`/api/discover/results?${p}`)).json()
				return r.total as number
			},
			enabled: on.length > 1 && total !== null,
			staleTime: 60_000,
		})),
	})
	if (on.length < 2 || total === null) return null
	return on
		.map((g, i) => ({ group: g, titles: results[i].data != null ? (results[i].data as number) - total : null }))
		.filter((x) => x.titles === null || x.titles > 0)
}

/** "22 showing · 62k hidden": the count, short. */
function ShortCount({ counts, searching }: { counts: FilterBarCounts | null; searching?: boolean }) {
	if (!counts) return <span className="text-sm text-gray-500">Counting…</span>
	return (
		<span className="text-sm whitespace-nowrap text-gray-400">
			<RollingNumber value={counts.total} className="font-bold text-white" />{" "}
			{searching ? (counts.total === 1 ? "match" : "matches") : "showing"}
			{counts.hidden > 0 && <span className="text-gray-500"> · {compactCount(counts.hidden)} hidden</span>}
		</span>
	)
}

interface Recovery {
	id: string
	titles: number | null
	label: string
	drop: () => void
}

/**
 * The live count line, kept as it looks (meter, the count, the two biggest one-tap recoveries in amber), with More
 * (what else hides titles, and your filters by type to take off) and Clear all. Without filters it offers popular ones.
 */
export function InsightLine({
	counts,
	chips,
	state,
	onChange,
	onDrop,
	onClear,
	searching,
	lead,
	popular,
}: {
	counts: FilterBarCounts | null
	chips: ActiveChip[]
	state: FilterState
	onChange: (s: FilterState) => void
	onDrop: (filter: FilterName) => void
	onClear: () => void
	searching?: boolean
	lead?: ReactNode
	popular?: ReactNode
}) {
	const [open, setOpen] = useState(false)
	const split = useLegacySplit(state, counts?.total ?? null)
	const recoveries: Recovery[] = (counts?.recoveries ?? []).flatMap((r): Recovery[] => {
		if (r.filter === "legacy" && split)
			return split.map((x) => ({
				id: x.group.id,
				titles: x.titles,
				label: x.group.label(x.titles === null ? "…" : x.titles.toLocaleString("en")),
				drop: () => {
					const legacy = { ...(state.legacy ?? {}) } as Record<string, string>
					for (const k of x.group.params) delete legacy[k]
					onChange({ ...state, legacy: Object.keys(legacy).length ? (legacy as FilterState["legacy"]) : undefined })
				},
			}))
		return [{ id: r.filter, titles: r.titles, label: protoRecoveryLabel(r.filter, r.titles, state), drop: () => onDrop(r.filter) }]
	})
	recoveries.sort((a, b) => (b.titles ?? 0) - (a.titles ?? 0))
	const top = recoveries.slice(0, 2)
	const rest = recoveries.slice(2)
	const groups = grouped(chips)
	const hasMore = rest.length > 0 || groups.length > 0
	return (
		<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
			{lead}
			<div className="flex items-center gap-3" aria-live="polite">
				<HiddenMeter counts={counts} className="w-32" />
				<ShortCount counts={counts} searching={searching} />
			</div>
			{top.map((r) => (
				<motion.button
					key={r.id}
					type="button"
					whileTap={TAP}
					onClick={r.drop}
					className="flex items-center gap-1.5 rounded-md text-sm font-bold whitespace-nowrap text-amber-400 cursor-pointer outline-none hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<PlusIcon className="h-3.5 w-3.5" />
					<span className="sr-only">Show </span>
					{r.label}
				</motion.button>
			))}
			{hasMore && (
				<Popover
					open={open}
					onClose={() => setOpen(false)}
					align="right"
					width="w-[24rem]"
					trigger={
						<button
							type="button"
							aria-haspopup="menu"
							aria-expanded={open}
							onClick={() => setOpen(!open)}
							className="flex items-center gap-1 rounded-md text-sm font-semibold text-gray-300 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{rest.length ? `${rest.length} more` : "Your filters"}
							<ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
						</button>
					}
				>
					<div className="max-h-[65vh] overflow-y-auto p-1">
						{rest.length > 0 && (
							<section className="mb-3">
								<h4 className="px-2 pb-1 text-[12px] text-gray-500">Also hiding titles</h4>
								{rest.map((r) => (
									<button
										key={r.id}
										type="button"
										role="menuitem"
										onClick={() => {
											r.drop()
											setOpen(false)
										}}
										className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold text-amber-400 cursor-pointer hover:bg-white/[0.06]"
									>
										<PlusIcon className="h-3.5 w-3.5 shrink-0" />
										{r.label}
									</button>
								))}
							</section>
						)}
						{groups.length > 0 && (
							<section>
								<h4 className="px-2 pb-1.5 text-[12px] text-gray-500">Your filters</h4>
								<div className="space-y-2.5 px-2">
									{groups.map((g) => (
										<div key={g.id} className="flex items-start gap-3">
											<span className="flex w-24 shrink-0 items-center gap-1.5 pt-1.5 text-[13px] font-semibold text-gray-200">
												<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${g.dot}`} />
												<span className="truncate">{g.label}</span>
											</span>
											<span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
												{g.chips.map((c) => (
													<button
														key={c.key}
														type="button"
														role="menuitem"
														onClick={() => onChange(c.remove(state))}
														aria-label={`Remove ${c.label}`}
														className="group flex h-7 max-w-full items-center gap-1 rounded-full bg-white/[0.07] pr-1.5 pl-2.5 text-[13px] text-gray-100 cursor-pointer hover:bg-white/[0.12]"
													>
														<span className="truncate">{c.label.replace(/^Produced in /, "")}</span>
														<XMarkIcon className="h-3.5 w-3.5 shrink-0 text-gray-500 group-hover:text-white" />
													</button>
												))}
											</span>
										</div>
									))}
								</div>
							</section>
						)}
					</div>
				</Popover>
			)}
			{chips.length > 0 ? (
				<button type="button" onClick={onClear} className="text-sm text-gray-500 cursor-pointer hover:text-white">
					Clear all
				</button>
			) : (
				popular
			)}
		</div>
	)
}

/** The live recovery label, with the older-style filters named for what they are now. */
function protoRecoveryLabel(filter: FilterName, titles: number, state: FilterState) {
	if (filter !== "legacy") return recoveryLabel(filter, titles, state)
	const l = state.legacy ?? {}
	const names = [
		(l.minYear || l.maxYear) && "year",
		(l.minRuntime || l.maxRuntime) && "length",
		(l.minImdb || l.minTomatometer || l.minRtAudience || l.minMetacritic) && "source scores",
		l.scoreGap && "critics vs audiences",
	].filter(Boolean)
	return names.length === 1
		? `${titles.toLocaleString("en")} hidden by ${names[0]}`
		: `${titles.toLocaleString("en")} hidden by ${names.length || "other"} filters`
}

/** A quick button on the phone row: the filter's name, or what's set, and a chevron; it opens the sheet there. */
export interface QuickButton {
	key: string
	label: string
	value?: string
}

/**
 * Phones: in place of the chip strip, Filters (with its count) and the most important filters as buttons in one
 * scrolling row. Each opens the filter sheet at that filter; a set filter shows its value, lit.
 */
export function PhoneQuickRow({
	count,
	buttons,
	onOpen,
}: {
	count: number
	buttons: QuickButton[]
	onOpen: (key: string | null) => void
}) {
	return (
		<div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={() => onOpen(null)}
				aria-label={count ? `Filters, ${count} active` : "Filters"}
				className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] pr-2.5 pl-3 text-sm font-bold text-white ring-1 ring-white/15 cursor-pointer"
			>
				<AdjustmentsHorizontalIcon className="h-4 w-4" />
				Filters
				{count > 0 && (
					<span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs tabular-nums text-gray-950">{count}</span>
				)}
			</motion.button>
			{buttons.map((b) => (
				<motion.button
					key={b.key}
					type="button"
					whileTap={TAP}
					onClick={() => onOpen(b.key)}
					className={`flex h-9 max-w-[13rem] shrink-0 items-center gap-1 rounded-full pr-2 pl-3.5 text-sm cursor-pointer ${b.value ? "bg-white font-semibold text-gray-950" : "bg-white/[0.06] text-gray-200 ring-1 ring-white/10"}`}
				>
					<span className="truncate">{b.value ?? b.label}</span>
					<ChevronDownIcon className={`h-4 w-4 shrink-0 ${b.value ? "text-gray-500" : "text-gray-500"}`} />
				</motion.button>
			))}
		</div>
	)
}
