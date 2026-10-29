// Your scores' filters in Discover's design: the row (search, Only what I changed, Group, Filters), the removable
// chips under it, and the Filters side sheet with the groups that fit your own scores. The sheet and the chips are
// drawn like ui/filter-bar's (FiltersSheet, FilterGroups, SubBar), which are bound to Discover's filter state; the
// generic controls (Filters button, the sort menu's items, the switch's knob, Show N titles) are reused as they are.
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, Squares2X2Icon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useId, useMemo, useRef, useState } from "react"
import {
	type FilterGroup,
	MIN_GOODWATCH,
	NO_FILTERS,
	type ScoreFilters,
	type ScoredTitle,
	type Standing,
	type Versus,
	optionCounts,
} from "~/domain/my-scores"
import type { Score } from "~/server/scores.server"
import { FiltersButton, SortItems, useMenu } from "~/ui/filter-bar/controls"
import { FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import { ShowTitlesButton } from "~/ui/filter-bar/ShowTitlesButton"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { Knob, MENU, SHELL, SPRING, TAP } from "~/ui/filter-bar/motion"
import { useModalDialog } from "~/ui/filter-bar/useModalDialog"
import { getVibeColorValue, goodwatchVibeIndex, scoreLabels } from "~/utils/ratings"

export { FiltersButton }

// Each group takes the accent of the Discover group it is closest to.
const ACCENT: Record<FilterGroup, { dot: string; bar: string }> = {
	scores: FILTER_ACCENTS.minMatch,
	kind: FILTER_ACCENTS.type,
	versus: FILTER_ACCENTS.moods,
	genres: FILTER_ACCENTS.genres,
	minGw: FILTER_ACCENTS.minScore,
	decades: FILTER_ACCENTS.released,
	rated: FILTER_ACCENTS.people,
}
export const VERSUS_LABEL: Record<Versus, string> = {
	more: "I like it more",
	close: "About the same",
	less: "I like it less",
}
const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
const clearSheet = (f: ScoreFilters): ScoreFilters => ({ ...NO_FILTERS, q: f.q, changedOnly: f.changedOnly })

interface Option {
	id: string
	label: string
	active: boolean
	count: number
	toggle: () => void
	swatch?: ReactNode
}
interface Group {
	key: FilterGroup
	title: string
	note?: string
	badge: number
	options: Option[]
}

function groupsOf(
	titles: readonly ScoredTitle[],
	f: ScoreFilters,
	set: (f: ScoreFilters) => void,
	standingOf: (t: ScoredTitle) => Standing,
): Group[] {
	const counts = optionCounts(titles, f, standingOf)
	const n = (group: FilterGroup, key: string | number) => counts[group].get(String(key)) ?? 0
	const genres = [...new Set(titles.flatMap((t) => t.genres))].sort((a, b) => a.localeCompare(b, "en"))
	const decades = [...new Set(titles.map((t) => (t.release_year ? Math.floor(t.release_year / 10) * 10 : 0)))]
		.filter(Boolean)
		.sort((a, b) => b - a)
	const years = [...new Set(titles.map((t) => t.ratedAt?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse()
	return [
		{
			key: "scores",
			title: "My score",
			badge: f.scores.length,
			options: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => ({
				id: String(s),
				label: `${s} · ${scoreLabels[s]}`,
				active: f.scores.includes(s),
				count: n("scores", s),
				toggle: () => set({ ...f, scores: toggle(f.scores, s) }),
				swatch: <span className="h-2 w-2 rounded-full" style={{ background: getVibeColorValue(s as Score) }} />,
			})),
		},
		{
			key: "kind",
			title: "Movies or shows",
			badge: f.kind === "all" ? 0 : 1,
			options: (["movie", "show"] as const).map((k) => ({
				id: k,
				label: k === "movie" ? "Movies" : "Shows",
				active: f.kind === k,
				count: n("kind", k),
				toggle: () => set({ ...f, kind: f.kind === k ? "all" : k }),
			})),
		},
		{
			key: "versus",
			title: "Compared with GoodWatch",
			note: "Your score against the GoodWatch score",
			badge: f.versus.length,
			options: (["more", "close", "less"] as const).map((v) => ({
				id: v,
				label: VERSUS_LABEL[v],
				active: f.versus.includes(v),
				count: n("versus", v),
				toggle: () => set({ ...f, versus: toggle(f.versus, v) }),
			})),
		},
		{
			key: "genres",
			title: "Genre",
			badge: f.genres.length,
			options: genres.map((g) => ({
				id: g,
				label: g,
				active: f.genres.includes(g),
				count: n("genres", g),
				toggle: () => set({ ...f, genres: toggle(f.genres, g) }),
			})),
		},
		{
			key: "minGw",
			title: "GoodWatch score",
			badge: f.minGw ? 1 : 0,
			options: MIN_GOODWATCH.map((min) => ({
				id: String(min),
				label: `${min} and up`,
				active: f.minGw === min,
				count: n("minGw", min),
				toggle: () => set({ ...f, minGw: f.minGw === min ? 0 : min }),
				swatch: <span className={`h-2 w-2 rounded-full bg-vibe-${goodwatchVibeIndex(min)}`} />,
			})),
		},
		{
			key: "decades",
			title: "Released",
			badge: f.decades.length,
			options: decades.map((d) => ({
				id: String(d),
				label: `${d}s`,
				active: f.decades.includes(d),
				count: n("decades", d),
				toggle: () => set({ ...f, decades: toggle(f.decades, d) }),
			})),
		},
		{
			key: "rated",
			title: "Rated in",
			badge: f.rated.length,
			options: years.map((y) => ({
				id: y,
				label: y,
				active: f.rated.includes(y),
				count: n("rated", y),
				toggle: () => set({ ...f, rated: toggle(f.rated, y) }),
			})),
		},
	]
}

function OptionChip({ option, counted }: { option: Option; counted: boolean }) {
	const dead = counted && !option.active && option.count === 0
	return (
		<motion.button
			type="button"
			aria-pressed={option.active}
			aria-label={counted ? `${option.label}, ${option.count.toLocaleString("en")} titles` : option.label}
			whileTap={TAP}
			onClick={option.toggle}
			className={`flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full pl-3 pr-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				option.active
					? "bg-white font-bold text-gray-950 shadow-[0_6px_20px_-6px_rgba(255,255,255,.35)]"
					: dead
						? "bg-white/[0.03] text-gray-600 ring-1 ring-white/5"
						: "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"
			}`}
		>
			{option.swatch}
			{option.label}
			<span aria-hidden className="text-xs tabular-nums text-gray-500">
				{option.active ? <CheckIcon className="h-3.5 w-3.5" /> : counted ? option.count.toLocaleString("en") : null}
			</span>
		</motion.button>
	)
}

interface Chip {
	key: string
	group: FilterGroup
	label: string
	remove: (f: ScoreFilters) => ScoreFilters
}
function chipsOf(f: ScoreFilters): Chip[] {
	const without = <T,>(list: T[], value: T) => list.filter((v) => v !== value)
	return [
		...f.scores.map((s) => ({ key: `s${s}`, group: "scores" as const, label: `My score ${s}`, remove: (x: ScoreFilters) => ({ ...x, scores: without(x.scores, s) }) })),
		...(f.kind === "all" ? [] : [{ key: "kind", group: "kind" as const, label: f.kind === "movie" ? "Movies" : "Shows", remove: (x: ScoreFilters) => ({ ...x, kind: "all" as const }) }]),
		...f.versus.map((v) => ({ key: `v${v}`, group: "versus" as const, label: VERSUS_LABEL[v], remove: (x: ScoreFilters) => ({ ...x, versus: without(x.versus, v) }) })),
		...f.genres.map((g) => ({ key: `g${g}`, group: "genres" as const, label: g, remove: (x: ScoreFilters) => ({ ...x, genres: without(x.genres, g) }) })),
		...(f.minGw ? [{ key: "gw", group: "minGw" as const, label: `GoodWatch ${f.minGw}+`, remove: (x: ScoreFilters) => ({ ...x, minGw: 0 as const }) }] : []),
		...f.decades.map((d) => ({ key: `d${d}`, group: "decades" as const, label: `${d}s`, remove: (x: ScoreFilters) => ({ ...x, decades: without(x.decades, d) }) })),
		...f.rated.map((y) => ({ key: `r${y}`, group: "rated" as const, label: `Rated in ${y}`, remove: (x: ScoreFilters) => ({ ...x, rated: without(x.rated, y) }) })),
	]
}

/** The active filters under the row, each one removable, as on Discover. */
export function FilterChips({ f, set }: { f: ScoreFilters; set: (f: ScoreFilters) => void }) {
	const chips = chipsOf(f)
	return (
		<AnimatePresence initial={false}>
			{chips.length > 0 && (
				<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
					<ul aria-label="Active filters" className="flex flex-wrap items-center gap-2 pt-1" data-filter-chips>
						<AnimatePresence initial={false} mode="popLayout">
							{chips.map((chip) => (
								<motion.li layout key={chip.key} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={SPRING}>
									<motion.button
										type="button"
										whileTap={TAP}
										onClick={() => set(chip.remove(f))}
										aria-label={`Remove ${chip.label}`}
										className="group flex h-8 cursor-pointer items-center gap-2 rounded-full bg-white/[0.06] pl-3 pr-2 text-sm text-gray-100 outline-none ring-1 ring-white/10 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400"
									>
										<span className={`h-1.5 w-1.5 rounded-full ${ACCENT[chip.group].dot}`} />
										{chip.label}
										<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" />
									</motion.button>
								</motion.li>
							))}
						</AnimatePresence>
						<li>
							<button type="button" onClick={() => set(clearSheet(f))} className="ml-1 cursor-pointer text-sm text-gray-500 hover:text-white">
								Clear filters
							</button>
						</li>
					</ul>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

/** The Filters side sheet, 480 px from the right (the whole width on a phone), as on Discover. */
export function FiltersSheet({
	open,
	onClose,
	titles,
	f,
	set,
	standingOf,
	shown,
	only,
}: {
	open: boolean
	onClose: () => void
	titles: readonly ScoredTitle[]
	f: ScoreFilters
	set: (f: ScoreFilters) => void
	standingOf: (t: ScoredTitle) => Standing
	/**
	 * Titles the filters leave now. Null where `titles` is only the part of a longer list loaded so far (Quick list):
	 * then neither the button nor the options count.
	 */
	shown: number | null
	/** The groups to show, in their usual order; all when left out (Quick list shows those that fit unscored titles). */
	only?: readonly FilterGroup[]
}) {
	const panel = useRef<HTMLElement>(null)
	const search = useRef<HTMLInputElement>(null)
	const titleId = useId()
	const [query, setQuery] = useState("")
	useModalDialog({ open, onClose, container: panel, initialFocus: search })
	const groups = useMemo(
		() => (open ? groupsOf(titles, f, set, standingOf).filter((g) => !only || only.includes(g.key)) : []),
		[open, titles, f, set, standingOf, only],
	)
	const q = query.trim().toLowerCase()
	const visible = groups
		.map((g) => ({
			...g,
			options: !q || g.title.toLowerCase().includes(q) ? g.options : g.options.filter((o) => o.label.toLowerCase().includes(q)),
		}))
		.filter((g) => g.options.length > 0)
	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div aria-hidden className="fixed inset-0 z-[1001] bg-black/60 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
					<motion.aside
						// biome-ignore lint/a11y/useSemanticElements: an animated sheet with its own focus trap, as Discover's; <dialog> can't animate out
						ref={panel}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", stiffness: 380, damping: 40 }}
						className="fixed inset-y-0 right-0 z-[1002] flex w-full max-w-[480px] flex-col bg-gray-950 shadow-[-30px_0_80px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/10"
						data-filters-sheet
					>
						<header className="px-6 pb-4 pt-6">
							<div className="flex items-center justify-between">
								<h2 id={titleId} className="brand-header text-2xl text-white">
									Filters
								</h2>
								<button type="button" onClick={onClose} aria-label="Close filters" className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white/5 text-gray-300 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400">
									<XMarkIcon className="h-5 w-5" />
								</button>
							</div>
							<FilterSearchField value={query} onChange={setQuery} inputRef={search} className="mt-4" />
						</header>
						<div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
							{visible.length === 0 ? (
								<p className="py-10 text-center text-base font-bold text-white">No filter called “{query}”</p>
							) : (
								<div className="flex flex-col gap-7">
									{visible.map((g) => (
										<section key={g.key} aria-labelledby={`score-filter-${g.key}`}>
											<header className="mb-3 flex items-center gap-2.5">
												<span className={`h-3.5 w-1 rounded-full ${ACCENT[g.key].bar}`} />
												<h3 id={`score-filter-${g.key}`} className="text-[15px] font-bold text-white">
													{g.title}
												</h3>
												{g.badge > 0 && <span className="rounded-full bg-white/10 px-2 text-xs font-bold tabular-nums text-white">{g.badge}</span>}
												{g.note && <span className="ml-auto truncate text-xs text-gray-500">{g.note}</span>}
											</header>
											<div className="flex flex-wrap gap-2">
												{g.options.map((o) => (
													<OptionChip key={o.id} option={o} counted={shown != null} />
												))}
											</div>
										</section>
									))}
								</div>
							)}
						</div>
						<footer className="flex items-center gap-4 border-t border-white/5 bg-gray-950/90 px-6 py-4 backdrop-blur">
							<button type="button" onClick={() => set(clearSheet(f))} className="cursor-pointer text-sm text-gray-400 hover:text-white">
								Clear all
							</button>
							<span className="flex-1" />
							<ShowTitlesButton
								counts={shown == null ? null : { total: shown, hidden: 0, recoveries: [], optionCounts: {} as never }}
								onClick={onClose}
							/>
						</footer>
					</motion.aside>
				</>
			)}
		</AnimatePresence>
	)
}

/** The row's search, in the row's shell. */
export function RowSearch({
	q,
	onChange,
	placeholder = "Search your scores",
}: {
	q: string
	onChange: (q: string) => void
	/** The field's words and name (Quick list searches the whole catalog). */
	placeholder?: string
}) {
	return (
		<label className={`flex h-12 min-w-0 flex-1 basis-56 items-center gap-2.5 px-3.5 focus-within:ring-amber-500/70 sm:max-w-sm ${SHELL}`}>
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
			<span className="sr-only">{placeholder}</span>
			<input
				type="search"
				value={q}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				enterKeyHint="search"
				data-search
				className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-white outline-none placeholder:text-gray-500 focus:ring-0 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
			/>
			{q && (
				<button type="button" onClick={() => onChange("")} aria-label="Clear the search" className="cursor-pointer text-gray-500 hover:text-white">
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</label>
	)
}

/** Only what I changed, in the look of Discover's Not seen yet switch. */
export function ChangedSwitch({ on, count, onChange }: { on: boolean; count: number; onChange: (on: boolean) => void }) {
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={on}
			whileTap={TAP}
			onClick={() => onChange(!on)}
			data-changed-only
			className={`relative flex h-12 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap px-3.5 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
		>
			<span>Only what I changed</span>
			<span aria-hidden className={`w-6 text-right text-xs tabular-nums ${count ? "text-amber-300/80" : "text-gray-600"}`}>
				{count}
			</span>
			<Knob on={on} />
		</motion.button>
	)
}

/** Group: drawn as Discover's sort control, with the sort menu's items. */
export function GroupControl<K extends string>({
	options,
	value,
	onChange,
	name = "Group",
	icon: Icon = Squares2X2Icon,
}: {
	options: { key: K; label: string; hint: string }[]
	value: K
	onChange: (key: K) => void
	/** The menu's name, beside the choice: Group or Sort. */
	name?: string
	icon?: typeof Squares2X2Icon
}) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const trigger = useRef<HTMLButtonElement>(null)
	useMenu(open, () => setOpen(false), root, trigger)
	const label = options.find((o) => o.key === value)?.label ?? ""
	return (
		<div ref={root} className="relative shrink-0">
			<button
				ref={trigger}
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={`${name}: ${label}`}
				onClick={() => setOpen(!open)}
				data-group={name === "Group" ? "" : undefined}
				data-menu={name.toLowerCase()}
				className={`flex h-12 cursor-pointer items-center gap-2 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:w-56 sm:px-4 ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"}`}
			>
				<Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
				{/* On a phone the icon and the choice say it; the name stays in the button's label. */}
				<span className="hidden text-gray-400 sm:inline">{name}</span>
				<span className="max-w-24 flex-1 truncate text-left font-bold text-white sm:max-w-none">{label}</span>
				<ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
			</button>
			{open && (
				<div role="menu" aria-label={name} className={`absolute right-0 z-40 mt-2 w-72 max-w-[calc(100vw-1.5rem)] origin-top-right p-1.5 ${MENU}`}>
					<SortItems
						options={options}
						value={value}
						onPick={(key) => {
							onChange(key)
							setOpen(false)
						}}
					/>
				</div>
			)}
		</div>
	)
}

export { chipsOf }
