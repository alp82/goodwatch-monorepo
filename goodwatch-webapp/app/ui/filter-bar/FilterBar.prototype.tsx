// PROTOTYPE - throwaway. The desktop bar for the Filters sheet variants: For you and Sort as one split control, and
// the Filters button merged with the active filters into one row.
import {
	AdjustmentsHorizontalIcon,
	ChevronDownIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import {
	type ComponentProps,
	type ReactNode,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import type { FilterState } from "~/domain/filter-state"
import { OneRowChips } from "./FilterGroups.prototype"
import { FingerprintTip, MovedUp } from "./ForYou"
import { TitleChipPreview } from "./TitleChipPreview"
import { SortControl, useMenu } from "./controls"
import { type ActiveChip, FILTER_ACCENTS } from "./labels"
import { Knob, MENU, TAP } from "./motion"
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
					<MovedUp on={lit} movedUp={movedUp} />
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
	gap: "Critics vs audiences",
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

function grouped(chips: ActiveChip[]): ChipGroup[] {
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
}: {
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
						className={`absolute z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] p-1.5 ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"} ${MENU}`}
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
