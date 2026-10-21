// The active filters outside the cards: grouped by filter (one TMDB TV genre rides with the movie genre it was merged
// into), a small popover, the desktop count line with "N more" and Clear all, and one line of removable chips for the
// sheet's header.
import { ChevronDownIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useLayoutEffect, useRef, useState } from "react"
import type { FilterName, FilterState } from "~/domain/filter-state"
import { HiddenMeter } from "./SubBar"
import { TitleChipPreview } from "./TitleChipPreview"
import { useMenu } from "./controls"
import {
	type ActiveChip,
	FILTER_ACCENTS,
	compactCount,
	recoveryLabel,
} from "./labels"
import { MENU, RollingNumber, TAP } from "./motion"
import type { FilterBarCounts } from "./types"

const GROUP_LABELS: Partial<Record<FilterName, string>> = {
	type: "Type",
	anime: "Anime",
	moods: "Mood",
	themes: "Theme",
	styles: "Style",
	genres: "Genre",
	minScore: "Score",
	minMatch: "Taste match",
	released: "Released",
	runtime: "Length",
	sourceScores: "Scores",
	scoreGap: "Critics",
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

export interface ChipGroup {
	id: FilterName
	label: string
	dot: string
	chips: ActiveChip[]
}

/** TMDB's combined TV genres, and the movie genres the sheet merges each into. */
const TV_GENRE_OF: Record<string, string[]> = {
	"Action & Adventure": ["Action", "Adventure"],
	"Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
	"War & Politics": ["War"],
}

/**
 * Chips with a merged TV genre folded into its movie genre: one chip ("Sci-Fi"), whose removal takes both off. A TV
 * genre chosen on its own stays a chip.
 */
export function mergedChips(all: ActiveChip[]): ActiveChip[] {
	const labels = new Set(all.map((c) => c.label))
	const riders = all.filter(
		(c) =>
			c.group === "genres" && TV_GENRE_OF[c.label]?.some((m) => labels.has(m)),
	)
	return all
		.filter((c) => !riders.includes(c))
		.map((c) => {
			const mine = riders.filter((r) => TV_GENRE_OF[r.label].includes(c.label))
			if (!mine.length) return c
			return {
				...c,
				label: c.label === "Science Fiction" ? "Sci-Fi" : c.label,
				remove: (s: FilterState) =>
					mine.reduce((acc, r) => r.remove(acc), c.remove(s)),
			}
		})
}

/** The chips by filter, in their order; content goes with the age limit, years with Released. */
export function groupChips(all: ActiveChip[]): ChipGroup[] {
	const out: ChipGroup[] = []
	for (const chip of mergedChips(all)) {
		const id: FilterName =
			chip.group === "content"
				? "ageLimit"
				: chip.group === "years"
					? "released"
					: chip.group
		let g = out.find((x) => x.id === id)
		if (!g) {
			g = {
				id,
				label: GROUP_LABELS[id] ?? id,
				dot: FILTER_ACCENTS[chip.group].dot,
				chips: [],
			}
			out.push(g)
		}
		g.chips.push(chip)
	}
	return out
}

/** A small popover menu under its trigger; it closes on Escape, Tab, or a press outside. */
export function Popover({
	open,
	onClose,
	trigger,
	children,
	label,
	align = "left",
	width = "w-72",
}: {
	open: boolean
	onClose: () => void
	trigger: ReactNode
	children: ReactNode
	label: string
	align?: "left" | "right"
	width?: string
}) {
	const root = useRef<HTMLDivElement>(null)
	const trig = useRef<HTMLDivElement>(null)
	useMenu(open, onClose, root, trig)
	return (
		<div ref={root} className="relative">
			<div ref={trig}>{trigger}</div>
			<AnimatePresence>
				{open && (
					<motion.div
						role="menu"
						aria-label={label}
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

/** "36 showing · 62k hidden". */
function ShortCount({
	counts,
	searching,
}: { counts: FilterBarCounts | null; searching?: boolean }) {
	if (!counts) return <span className="text-sm text-gray-500">Counting…</span>
	return (
		<span className="text-sm whitespace-nowrap text-gray-400">
			<RollingNumber value={counts.total} className="font-bold text-white" />{" "}
			{searching ? (counts.total === 1 ? "match" : "matches") : "showing"}
			{counts.hidden > 0 && (
				<span className="text-gray-500">
					{" "}
					· {compactCount(counts.hidden)} hidden
				</span>
			)}
		</span>
	)
}

/**
 * The desktop count line: meter and count, the two biggest one-tap recoveries in amber, "N more" (the other
 * recoveries, then the active filters by type, each value removable), and Clear all. Without filters, `idle` (the
 * popular filters).
 */
export function FilterInsight({
	counts,
	chips,
	state,
	onChange,
	onDrop,
	onClear,
	searching,
	lead,
	idle,
	className = "",
}: {
	counts: FilterBarCounts | null
	chips: ActiveChip[]
	state: FilterState
	onChange: (s: FilterState) => void
	onDrop: (filter: FilterName) => void
	onClear: () => void
	searching?: boolean
	lead?: ReactNode
	idle?: ReactNode
	className?: string
}) {
	const [open, setOpen] = useState(false)
	const recoveries = counts?.recoveries ?? []
	const top = recoveries.slice(0, 2)
	const rest = recoveries.slice(2)
	const groups = groupChips(chips)
	return (
		<div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
			{lead}
			<div className="flex items-center gap-3" aria-live="polite">
				<HiddenMeter counts={counts} className="w-32" />
				<ShortCount counts={counts} searching={searching} />
			</div>
			{top.map((r) => (
				<motion.button
					key={r.filter}
					type="button"
					whileTap={TAP}
					onClick={() => onDrop(r.filter)}
					className="flex items-center gap-1.5 rounded-md text-sm font-bold whitespace-nowrap text-amber-400 cursor-pointer outline-none hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<PlusIcon className="h-3.5 w-3.5" />
					<span className="sr-only">Show </span>
					{recoveryLabel(r.filter, r.titles, state)}
				</motion.button>
			))}
			{(rest.length > 0 || groups.length > 0) && (
				<Popover
					open={open}
					onClose={() => setOpen(false)}
					label="Your filters"
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
							<ChevronDownIcon
								className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
							/>
						</button>
					}
				>
					<div className="max-h-[65vh] overflow-y-auto p-1">
						{rest.length > 0 && (
							<section className="mb-3">
								<h4 className="px-2 pb-1 text-[12px] text-gray-500">
									Also hiding titles
								</h4>
								{rest.map((r) => (
									<button
										key={r.filter}
										type="button"
										role="menuitem"
										onClick={() => {
											onDrop(r.filter)
											setOpen(false)
										}}
										className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold text-amber-400 cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:bg-white/[0.06]"
									>
										<PlusIcon className="h-3.5 w-3.5 shrink-0" />
										{recoveryLabel(r.filter, r.titles, state)}
									</button>
								))}
							</section>
						)}
						{groups.length > 0 && (
							<section>
								<h4 className="px-2 pb-1.5 text-[12px] text-gray-500">
									Your filters
								</h4>
								<div className="space-y-2.5 px-2">
									{groups.map((g) => (
										<div key={g.id} className="flex items-start gap-3">
											<span className="flex w-24 shrink-0 items-center gap-1.5 pt-1.5 text-[13px] font-semibold text-gray-200">
												<span
													className={`h-1.5 w-1.5 shrink-0 rounded-full ${g.dot}`}
												/>
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
														className="group flex h-7 max-w-full items-center gap-1 rounded-full bg-white/[0.07] pr-1.5 pl-2.5 text-[13px] text-gray-100 cursor-pointer outline-none hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-amber-400"
													>
														<span className="truncate">
															{c.label.replace(/^Produced in /, "")}
														</span>
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
				<button
					type="button"
					onClick={onClear}
					className="rounded-md text-sm text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					Clear all
				</button>
			) : (
				idle
			)}
		</div>
	)
}

/**
 * The active filters on one line: each with its ×; what doesn't fit whole hides and counts in "+N", which shows them
 * all. When none fits, "+N" stays away (the Filters count says it already).
 */
export function OneLineChips({
	chips,
	state,
	onChange,
	onGoTo,
	className = "",
}: {
	chips: ActiveChip[]
	state: FilterState
	onChange: (state: FilterState) => void
	/** A tap on a chip's label, for example scrolling to its card. */
	onGoTo?: (chip: ActiveChip) => void
	className?: string
}) {
	const list = useRef<HTMLUListElement>(null)
	const [hidden, setHidden] = useState(0)
	const [all, setAll] = useState(false)
	const shown = mergedChips(chips)
	const sig = shown.map((c) => c.key).join("|")
	// Measures again when the chips change.
	useLayoutEffect(() => {
		const el = list.current
		if (!el) return
		const measure = () => {
			const items = [...el.children] as HTMLElement[]
			const top = items[0]?.offsetTop ?? 0
			let n = 0
			for (const i of items) {
				const out =
					!all &&
					(i.offsetTop > top + 4 ||
						i.offsetLeft + i.offsetWidth > el.clientWidth + 1)
				i.style.visibility = out ? "hidden" : ""
				if (out) n++
			}
			setHidden(n)
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(el)
		return () => observer.disconnect()
	}, [sig, all])
	if (!shown.length) return null
	return (
		<div className={`flex min-w-0 items-start gap-1.5 ${className}`}>
			<ul
				aria-label="Active filters"
				ref={list}
				className={`flex min-w-0 flex-1 flex-wrap gap-1.5 ${all ? "" : "max-h-8 overflow-hidden"}`}
			>
				{shown.map((chip) => (
					<li
						key={chip.key}
						className="flex h-8 items-center rounded-full bg-white/[0.06] text-[13px] text-gray-100"
					>
						<TitleChipPreview chip={chip}>
							<button
								type="button"
								onClick={() => onGoTo?.(chip)}
								aria-label={onGoTo ? `Go to ${chip.label}` : chip.label}
								className="flex h-8 items-center gap-1.5 rounded-l-full pr-1 pl-3 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span
									className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`}
								/>
								{chip.label}
							</button>
						</TitleChipPreview>
						<button
							type="button"
							onClick={() => onChange(chip.remove(state))}
							aria-label={`Remove ${chip.label}`}
							className="grid h-8 w-7 place-items-center rounded-r-full text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<XMarkIcon className="h-3.5 w-3.5" />
						</button>
					</li>
				))}
			</ul>
			{(all || (hidden > 0 && hidden < shown.length)) && (
				<button
					type="button"
					onClick={() => setAll(!all)}
					aria-expanded={all}
					className="h-8 shrink-0 rounded-full bg-white/[0.06] px-3 text-[13px] font-semibold text-gray-200 cursor-pointer outline-none hover:bg-white/[0.11] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					{all ? "Less" : `+${hidden}`}
				</button>
			)}
		</div>
	)
}
