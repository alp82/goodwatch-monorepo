// PROTOTYPE - throwaway. The rescoring table's filters in Discover's design: the row (search, a switch, Group, Filters),
// the removable chips under it, and the Filters side sheet with a subset of groups that make sense for your own scores.
// The look is copied from ui/filter-bar (FilterGroups, FiltersSheet, SubBar); the controls that are generic are reused.
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, Squares2X2Icon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useId, useMemo, useRef, useState } from "react"
import type { RatedTitle } from "~/server/prototype-my-library-rescore.server"
import { FiltersButton, SortItems, useMenu } from "~/ui/filter-bar/controls"
import { FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import { ShowTitlesButton } from "~/ui/filter-bar/FiltersSheet"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { Knob, MENU, SHELL, SPRING, TAP } from "~/ui/filter-bar/motion"
import { useModalDialog } from "~/ui/filter-bar/useModalDialog"
import type { Score } from "~/server/scores.server"
import { getVibeColorValue, goodwatchVibeIndex, scoreLabels } from "~/utils/ratings"

export type Versus = "more" | "close" | "less"
export interface RescoreFilters {
	q: string
	scores: number[]
	kind: "all" | "movie" | "show"
	genres: string[]
	minGw: 0 | 60 | 70 | 80
	decades: number[]
	versus: Versus[]
	rated: string[]
	changedOnly: boolean
}
export const NO_FILTERS: RescoreFilters = {
	q: "",
	scores: [],
	kind: "all",
	genres: [],
	minGw: 0,
	decades: [],
	versus: [],
	rated: [],
	changedOnly: false,
}

type GroupKey = "scores" | "kind" | "genres" | "minGw" | "decades" | "versus" | "rated"
// Each group borrows the accent of the Discover group it is closest to.
const ACCENT: Record<GroupKey, { dot: string; bar: string }> = {
	scores: FILTER_ACCENTS.minMatch,
	kind: FILTER_ACCENTS.type,
	genres: FILTER_ACCENTS.genres,
	minGw: FILTER_ACCENTS.minScore,
	decades: FILTER_ACCENTS.released,
	versus: FILTER_ACCENTS.moods,
	rated: FILTER_ACCENTS.people,
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
export const decadeOf = (t: RatedTitle) => (t.release_year ? Math.floor(t.release_year / 10) * 10 : 0)
export const versusOf = (t: RatedTitle, score: number): Versus | null => {
	if (t.gw == null) return null
	const gap = score - t.gw / 10
	return gap >= 1.5 ? "more" : gap <= -1.5 ? "less" : "close"
}
const VERSUS_LABEL: Record<Versus, string> = {
	more: "I like it more",
	close: "About the same",
	less: "I like it less",
}
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

/** Whether a title passes every filter, leaving one group out (for that group's option counts). */
function passes(t: RatedTitle, f: RescoreFilters, score: number, changed: boolean, skip?: GroupKey) {
	return (
		(skip === "scores" || !f.scores.length || f.scores.includes(score)) &&
		(skip === "kind" || f.kind === "all" || t.mediaType === f.kind) &&
		(skip === "genres" || !f.genres.length || f.genres.some((g) => t.genres.includes(g))) &&
		(skip === "minGw" || !f.minGw || (t.gw ?? 0) >= f.minGw) &&
		(skip === "decades" || !f.decades.length || f.decades.includes(decadeOf(t))) &&
		(skip === "versus" || !f.versus.length || f.versus.includes(versusOf(t, score) as Versus)) &&
		(skip === "rated" || !f.rated.length || f.rated.includes(t.ratedAt?.slice(0, 4) ?? "")) &&
		(!f.changedOnly || changed) &&
		(!f.q || fold(t.title).includes(fold(f.q)))
	)
}

export function applyFilters(
	titles: RatedTitle[],
	f: RescoreFilters,
	placeOf: (t: RatedTitle) => number,
	changed: (t: RatedTitle) => boolean,
) {
	return titles.filter((t) => passes(t, f, placeOf(t), changed(t)))
}

interface Option {
	id: string
	label: string
	active: boolean
	count: number
	toggle: () => void
	swatch?: ReactNode
}
interface Group {
	key: GroupKey
	title: string
	note?: string
	badge: number
	options: Option[]
}

function buildGroups(
	titles: RatedTitle[],
	f: RescoreFilters,
	set: (next: RescoreFilters) => void,
	placeOf: (t: RatedTitle) => number,
	changed: (t: RatedTitle) => boolean,
): Group[] {
	// What each option would leave: the other groups applied, this option added.
	const pool = (skip: GroupKey) => titles.filter((t) => passes(t, f, placeOf(t), changed(t), skip))
	const tally = (skip: GroupKey, keyOf: (t: RatedTitle) => (string | number | null)[]) => {
		const n = new Map<string, number>()
		for (const t of pool(skip)) for (const k of keyOf(t)) if (k != null) n.set(String(k), (n.get(String(k)) ?? 0) + 1)
		return n
	}
	const scoreN = tally("scores", (t) => [placeOf(t)])
	const kindN = tally("kind", (t) => [t.mediaType])
	const genreN = tally("genres", (t) => t.genres)
	const gwPool = pool("minGw")
	const decadeN = tally("decades", (t) => [decadeOf(t)])
	const versusN = tally("versus", (t) => [versusOf(t, placeOf(t))])
	const ratedN = tally("rated", (t) => [t.ratedAt?.slice(0, 4) ?? null])
	const allGenres = [...new Set(titles.flatMap((t) => t.genres))].sort((a, b) => a.localeCompare(b))
	const decades = [...new Set(titles.map(decadeOf))].filter(Boolean).sort((a, b) => b - a)
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
				count: scoreN.get(String(s)) ?? 0,
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
				count: kindN.get(k) ?? 0,
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
				count: versusN.get(v) ?? 0,
				toggle: () => set({ ...f, versus: toggle(f.versus, v) }),
			})),
		},
		{
			key: "genres",
			title: "Genre",
			badge: f.genres.length,
			options: allGenres.map((g) => ({
				id: g,
				label: g,
				active: f.genres.includes(g),
				count: genreN.get(g) ?? 0,
				toggle: () => set({ ...f, genres: toggle(f.genres, g) }),
			})),
		},
		{
			key: "minGw",
			title: "GoodWatch score",
			badge: f.minGw ? 1 : 0,
			options: ([60, 70, 80] as const).map((s) => ({
				id: String(s),
				label: `${s} and up`,
				active: f.minGw === s,
				count: gwPool.filter((t) => (t.gw ?? 0) >= s).length,
				toggle: () => set({ ...f, minGw: f.minGw === s ? 0 : s }),
				swatch: <span className={`h-2 w-2 rounded-full bg-vibe-${goodwatchVibeIndex(s)}`} />,
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
				count: decadeN.get(String(d)) ?? 0,
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
				count: ratedN.get(y) ?? 0,
				toggle: () => set({ ...f, rated: toggle(f.rated, y) }),
			})),
		},
	]
}

/** Discover's OptionChip, as drawn in the Filters sheet. */
function OptionChip({ option }: { option: Option }) {
	const dead = !option.active && option.count === 0
	return (
		<motion.button
			type="button"
			aria-pressed={option.active}
			aria-label={`${option.label}, ${option.count.toLocaleString("en")} titles`}
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
				{option.active ? <CheckIcon className="h-3.5 w-3.5" /> : option.count.toLocaleString("en")}
			</span>
		</motion.button>
	)
}

export interface Chip {
	key: string
	group: GroupKey | "changed"
	label: string
	remove: (f: RescoreFilters) => RescoreFilters
}
export function chipsOf(f: RescoreFilters): Chip[] {
	return [
		...f.scores.map((s) => ({ key: `s${s}`, group: "scores" as const, label: `My score ${s}`, remove: (x: RescoreFilters) => ({ ...x, scores: x.scores.filter((v) => v !== s) }) })),
		...(f.kind !== "all" ? [{ key: "kind", group: "kind" as const, label: f.kind === "movie" ? "Movies" : "Shows", remove: (x: RescoreFilters) => ({ ...x, kind: "all" as const }) }] : []),
		...f.versus.map((v) => ({ key: `v${v}`, group: "versus" as const, label: VERSUS_LABEL[v], remove: (x: RescoreFilters) => ({ ...x, versus: x.versus.filter((y) => y !== v) }) })),
		...f.genres.map((g) => ({ key: `g${g}`, group: "genres" as const, label: g, remove: (x: RescoreFilters) => ({ ...x, genres: x.genres.filter((y) => y !== g) }) })),
		...(f.minGw ? [{ key: "gw", group: "minGw" as const, label: `GoodWatch ${f.minGw}+`, remove: (x: RescoreFilters) => ({ ...x, minGw: 0 as const }) }] : []),
		...f.decades.map((d) => ({ key: `d${d}`, group: "decades" as const, label: `${d}s`, remove: (x: RescoreFilters) => ({ ...x, decades: x.decades.filter((y) => y !== d) }) })),
		...f.rated.map((y) => ({ key: `r${y}`, group: "rated" as const, label: `Rated in ${y}`, remove: (x: RescoreFilters) => ({ ...x, rated: x.rated.filter((v) => v !== y) }) })),
	]
}
const dotOf = (chip: Chip) => (chip.group === "changed" ? "bg-amber-400" : ACCENT[chip.group].dot)

/** Discover's sub-bar chips. */
export function Chips({ f, set }: { f: RescoreFilters; set: (f: RescoreFilters) => void }) {
	const chips = chipsOf(f)
	return (
		<AnimatePresence initial={false}>
			{chips.length > 0 && (
				<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
					<ul aria-label="Active filters" className="flex flex-wrap items-center gap-2 pt-1">
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
										<span className={`h-1.5 w-1.5 rounded-full ${dotOf(chip)}`} />
										{chip.label}
										<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" />
									</motion.button>
								</motion.li>
							))}
						</AnimatePresence>
						<li>
							<button type="button" onClick={() => set({ ...NO_FILTERS, q: f.q, changedOnly: f.changedOnly })} className="ml-1 cursor-pointer text-sm text-gray-500 hover:text-white">
								Clear filters
							</button>
						</li>
					</ul>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

/** The Filters side sheet, Discover's shell with this page's groups. */
export function Sheet({
	open,
	onClose,
	titles,
	f,
	set,
	placeOf,
	changed,
	total,
}: {
	open: boolean
	onClose: () => void
	titles: RatedTitle[]
	f: RescoreFilters
	set: (f: RescoreFilters) => void
	placeOf: (t: RatedTitle) => number
	changed: (t: RatedTitle) => boolean
	total: number
}) {
	const panel = useRef<HTMLElement>(null)
	const search = useRef<HTMLInputElement>(null)
	const titleId = useId()
	const [query, setQuery] = useState("")
	useModalDialog({ open, onClose, container: panel, initialFocus: search })
	const groups = useMemo(() => (open ? buildGroups(titles, f, set, placeOf, changed) : []), [open, titles, f, set, placeOf, changed])
	const q = query.trim().toLowerCase()
	const shown = groups
		.map((g) => ({ ...g, options: !q || g.title.toLowerCase().includes(q) ? g.options : g.options.filter((o) => o.label.toLowerCase().includes(q)) }))
		.filter((g) => g.options.length > 0)
	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div aria-hidden className="fixed inset-0 z-[1001] bg-black/60 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
					<motion.aside
						// biome-ignore lint/a11y/useSemanticElements: prototype copy of the Filters sheet
						ref={panel}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", stiffness: 380, damping: 40 }}
						className="fixed inset-y-0 right-0 z-[1002] flex w-full max-w-[480px] flex-col bg-gray-950 shadow-[-30px_0_80px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/10"
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
							<div className="flex flex-col gap-7">
								{shown.map((g) => (
									<section key={g.key} aria-labelledby={`rescore-group-${g.key}`}>
										<header className="mb-3 flex items-center gap-2.5">
											<span className={`h-3.5 w-1 rounded-full ${ACCENT[g.key].bar}`} />
											<h3 id={`rescore-group-${g.key}`} className="text-[15px] font-bold text-white">
												{g.title}
											</h3>
											{g.badge > 0 && <span className="rounded-full bg-white/10 px-2 text-xs font-bold tabular-nums text-white">{g.badge}</span>}
											{g.note && <span className="ml-auto truncate text-xs text-gray-500">{g.note}</span>}
										</header>
										<div className="flex flex-wrap gap-2">
											{g.options.map((o) => (
												<OptionChip key={o.id} option={o} />
											))}
										</div>
									</section>
								))}
							</div>
						</div>
						<footer className="flex items-center gap-4 border-t border-white/5 bg-gray-950/90 px-6 py-4 backdrop-blur">
							<button type="button" onClick={() => set({ ...NO_FILTERS, q: f.q, changedOnly: f.changedOnly })} className="cursor-pointer text-sm text-gray-400 hover:text-white">
								Clear all
							</button>
							<span className="flex-1" />
							<ShowTitlesButton counts={{ total, hidden: 0, recoveries: [], optionCounts: {} as never }} onClick={onClose} />
						</footer>
					</motion.aside>
				</>
			)}
		</AnimatePresence>
	)
}

/** The row's search, in the row's shell. */
export function RowSearch({ q, onChange }: { q: string; onChange: (q: string) => void }) {
	return (
		<label className={`flex h-12 min-w-0 flex-1 basis-56 items-center gap-2.5 px-3.5 focus-within:ring-amber-500/70 sm:max-w-sm ${SHELL}`}>
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
			<span className="sr-only">Search your scores</span>
			<input
				type="search"
				value={q}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Search your scores"
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

/** "Only what I changed", in the look of Discover's Not seen yet switch. */
export function ChangedSwitch({ on, count, onChange }: { on: boolean; count: number; onChange: (on: boolean) => void }) {
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={on}
			whileTap={TAP}
			onClick={() => onChange(!on)}
			className={`relative flex h-12 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap px-3.5 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
		>
			<span className="text-left">Only what I changed</span>
			<span aria-hidden className={`w-6 text-right text-xs tabular-nums ${count ? "text-amber-300/80" : "text-gray-600"}`}>
				{count}
			</span>
			<Knob on={on} />
		</motion.button>
	)
}

/** Group: Discover's sort control, with its own word. */
export function GroupControl<K extends string>({ options, value, onChange }: { options: { key: K; label: string; hint: string }[]; value: K; onChange: (k: K) => void }) {
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
				aria-label={`Group: ${label}`}
				onClick={() => setOpen(!open)}
				className={`flex h-12 cursor-pointer items-center gap-2 px-4 text-sm outline-none sm:w-56 focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"}`}
			>
				<Squares2X2Icon className="h-4 w-4 shrink-0 text-gray-400" />
				<span className="text-gray-400">Group</span>
				<span className="max-w-24 flex-1 truncate text-left font-bold text-white sm:max-w-none">{label}</span>
				<ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>
			{open && (
				<div role="menu" aria-label="Group" className={`absolute right-0 z-40 mt-2 w-72 origin-top-right p-1.5 ${MENU}`}>
					<SortItems
						options={options}
						value={value}
						onPick={(k) => {
							onChange(k)
							setOpen(false)
						}}
					/>
				</div>
			)}
		</div>
	)
}

export { FiltersButton }
