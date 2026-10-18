// PROTOTYPE - throwaway. Shared state of the rescoring list prototype: the scores live in memory (nothing is
// stored), and search, filters and grouping are the same logic in every variant so only the layout differs.
import { ArrowUturnLeftIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RatedTitle } from "~/server/prototype-my-library-rescore.server"
import { titleToDashed } from "~/utils/helpers"

export const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export type GroupBy = "none" | "score" | "decade" | "genre" | "kind" | "rated" | "gap"
export const GROUP_LABEL: Record<GroupBy, string> = {
	none: "No grouping",
	score: "My score",
	decade: "Decade",
	genre: "Genre",
	kind: "Movies and shows",
	rated: "Year rated",
	gap: "Versus GoodWatch",
}
export type SortBy = "score" | "title" | "year" | "rated" | "gap"
export const SORT_LABEL: Record<SortBy, string> = {
	score: "My score",
	title: "Title",
	year: "Release year",
	rated: "Last rated",
	gap: "Most different from GoodWatch",
}
export type Kind = "all" | "movie" | "show"

export interface Change {
	key: string
	title: string
	from: number
	to: number
}

export interface Filters {
	q: string
	kind: Kind
	genre: string
	/** Scores shown; empty = all. */
	scores: number[]
	changedOnly: boolean
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
const sortKey = (title: string) => fold(title).replace(/^(the|an|a) (?=\S)/, "")

/** GoodWatch's score on the member's 1-10 scale, and how far the member's score is from it. */
export const gwOnTen = (t: RatedTitle) => (t.gw == null ? null : Math.round(t.gw / 10))
export const gapOf = (t: RatedTitle, score: number) => (t.gw == null ? 0 : score - t.gw / 10)

export const titleHref = (t: RatedTitle) => `/${t.mediaType}/${t.tmdbId}-${titleToDashed(t.title)}`

export function useRescore(titles: RatedTitle[]) {
	const [scores, setScores] = useState<Record<string, number>>({})
	const [changes, setChanges] = useState<Change[]>([])
	// Where rows sit: the scores as they were at the last settle, so a rescored row stays put until the view changes.
	const [placed, setPlaced] = useState<Record<string, number>>({})
	const placeOf = useCallback((t: RatedTitle) => placed[t.key] ?? t.score, [placed])
	const settle = useCallback(() => setPlaced(scores), [scores])
	const scoreOf = useCallback((t: RatedTitle) => scores[t.key] ?? t.score, [scores])
	// Rows are memoized: rescore stays the same function, and reads the scores from a ref.
	const live = useRef(scores)
	live.current = scores
	const rescore = useCallback((t: RatedTitle, to: number) => {
		const from = live.current[t.key] ?? t.score
		if (from === to) return
		live.current = { ...live.current, [t.key]: to }
		setScores(live.current)
		setChanges((c) => [{ key: t.key, title: t.title, from, to }, ...c])
	}, [])
	const undo = useCallback(() => {
		setChanges((c) => {
			const [last, ...rest] = c
			if (last) setScores((s) => ({ ...s, [last.key]: last.from }))
			return rest
		})
	}, [])
	const original = useMemo(() => new Map(titles.map((t) => [t.key, t.score])), [titles])
	const changed = useCallback(
		(t: RatedTitle) => t.key in scores && scores[t.key] !== original.get(t.key),
		[scores, original],
	)
	const genres = useMemo(() => {
		const n = new Map<string, number>()
		for (const t of titles) for (const g of t.genres) n.set(g, (n.get(g) ?? 0) + 1)
		return [...n].sort((a, b) => b[1] - a[1]).map(([g]) => g)
	}, [titles])
	return { scoreOf, placeOf, settle, rescore, undo, changes, changed, genres }
}

export function useFilters(initialGroup: GroupBy = "score", initialSort: SortBy = "title") {
	const [filters, setFilters] = useState<Filters>({ q: "", kind: "all", genre: "", scores: [], changedOnly: false })
	const [groupBy, setGroupBy] = useState<GroupBy>(initialGroup)
	const [sortBy, setSortBy] = useState<SortBy>(initialSort)
	const set = useCallback((next: Partial<Filters>) => setFilters((f) => ({ ...f, ...next })), [])
	return { filters, set, groupBy, setGroupBy, sortBy, setSortBy }
}

export interface Group {
	key: string
	label: string
	titles: RatedTitle[]
}

/** The filtered titles, sorted, then split into groups. Groups take the titles' scores as they are now. */
export function arrange(
	titles: RatedTitle[],
	f: Filters,
	groupBy: GroupBy,
	sortBy: SortBy,
	scoreOf: (t: RatedTitle) => number,
	changed: (t: RatedTitle) => boolean,
): { groups: Group[]; total: number } {
	const q = fold(f.q)
	const list = titles.filter(
		(t) =>
			(f.kind === "all" || t.mediaType === f.kind) &&
			(!f.genre || t.genres.includes(f.genre)) &&
			(!f.scores.length || f.scores.includes(scoreOf(t))) &&
			(!f.changedOnly || changed(t)) &&
			(!q || fold(t.title).includes(q)),
	)
	const by: Record<SortBy, (a: RatedTitle, b: RatedTitle) => number> = {
		score: (a, b) => scoreOf(b) - scoreOf(a) || sortKey(a.title).localeCompare(sortKey(b.title)),
		title: (a, b) => sortKey(a.title).localeCompare(sortKey(b.title)),
		year: (a, b) => (b.release_year ?? 0) - (a.release_year ?? 0),
		rated: (a, b) => (b.ratedAt ?? "").localeCompare(a.ratedAt ?? ""),
		gap: (a, b) => Math.abs(gapOf(b, scoreOf(b))) - Math.abs(gapOf(a, scoreOf(a))),
	}
	list.sort(by[sortBy])
	if (groupBy === "none") return { groups: [{ key: "all", label: "", titles: list }], total: list.length }
	const groups = new Map<string, Group>()
	const add = (key: string, label: string, t: RatedTitle) => {
		if (!groups.has(key)) groups.set(key, { key, label, titles: [] })
		groups.get(key)?.titles.push(t)
	}
	for (const t of list) {
		if (groupBy === "score") add(String(100 - scoreOf(t)).padStart(3, "0"), `${scoreOf(t)}`, t)
		else if (groupBy === "decade") {
			const d = t.release_year ? Math.floor(t.release_year / 10) * 10 : 0
			add(String(9999 - d), d ? `${d}s` : "Unknown year", t)
		} else if (groupBy === "genre") {
			const g = (f.genre && t.genres.includes(f.genre) ? f.genre : t.genres[0]) ?? "No genre"
			add(g, g, t)
		} else if (groupBy === "kind") add(t.mediaType, t.mediaType === "movie" ? "Movies" : "Shows", t)
		else if (groupBy === "rated") {
			const y = t.ratedAt?.slice(0, 4) ?? "0"
			add(String(9999 - Number(y)), y === "0" ? "Unknown" : `Rated in ${y}`, t)
		} else if (groupBy === "gap") {
			const gap = gapOf(t, scoreOf(t))
			if (t.gw == null) add("4", "No GoodWatch score", t)
			else if (gap >= 1.5) add("0", "You like it more than GoodWatch", t)
			else if (gap <= -1.5) add("2", "You like it less than GoodWatch", t)
			else add("1", "Close to GoodWatch", t)
		}
	}
	const sorted = [...groups.values()].sort((a, b) =>
		groupBy === "genre" ? b.titles.length - a.titles.length : a.key.localeCompare(b.key),
	)
	return { groups: sorted, total: list.length }
}

export const average = (list: RatedTitle[], scoreOf: (t: RatedTitle) => number) =>
	list.length ? (list.reduce((s, t) => s + scoreOf(t), 0) / list.length).toFixed(1) : "-"

// ---------------------------------------------------------------------------------------------------------
// Small pieces every variant may use. They copy the look of My library's controls and the rate bar's keys.

/** The ten score keys in a row, the member's score lit, as on the rate bar. */
export function ScoreKeys({
	score,
	gw,
	onPick,
	size = "md",
	label,
}: {
	score: number
	/** GoodWatch on the 1-10 scale: a faint mark under that key. */
	gw?: number | null
	onPick: (n: number) => void
	size?: "sm" | "md"
	label: string
}) {
	const h = size === "sm" ? "h-8 text-xs" : "h-10 text-sm"
	return (
		<div role="group" aria-label={label} className="grid grid-cols-10 gap-1">
			{SCORES.map((n) => (
				<button
					key={n}
					type="button"
					aria-pressed={score === n}
					aria-label={`${n} out of 10`}
					onClick={() => onPick(n)}
					className={`relative ${h} min-w-0 cursor-pointer rounded-md font-black tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${score === n ? "bg-amber-400 text-black" : "bg-white/[0.08] text-gray-300 hover:bg-white/20 hover:text-white"}`}
				>
					{n}
					{gw === n && score !== n && (
						<span aria-hidden className="absolute inset-x-2 bottom-0.5 h-0.5 rounded-full bg-sky-400/70" />
					)}
				</button>
			))}
		</div>
	)
}

export function Search({ q, onChange, className = "" }: { q: string; onChange: (q: string) => void; className?: string }) {
	return (
		<label
			className={`relative flex h-11 min-w-0 items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10 focus-within:ring-amber-300 ${className}`}
		>
			<MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 h-4 w-4 text-gray-400" aria-hidden />
			<span className="sr-only">Search your scores</span>
			<input
				value={q}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Search your scores"
				className="h-full w-full min-w-0 bg-transparent pl-8 pr-9 text-base text-white placeholder:text-gray-500 focus:outline-none sm:text-sm"
			/>
			{q && (
				<button
					type="button"
					aria-label="Clear the search"
					onClick={() => onChange("")}
					className="absolute right-0 flex h-11 w-9 cursor-pointer items-center justify-center text-gray-400 hover:text-white"
				>
					<XMarkIcon className="h-4 w-4" aria-hidden />
				</button>
			)}
		</label>
	)
}

export function Select<T extends string>({
	value,
	options,
	onPick,
	label,
}: {
	value: T
	options: Record<T, string> | [T, string][]
	onPick: (v: T) => void
	label: string
}) {
	const entries = Array.isArray(options) ? options : (Object.entries(options) as [T, string][])
	return (
		<label className="relative flex h-11 shrink-0 items-center gap-1 rounded-xl bg-white/[0.06] pl-3 text-sm font-bold text-gray-200 ring-1 ring-white/10 focus-within:ring-amber-300">
			<span className="text-xs font-semibold text-gray-500">{label}</span>
			<select
				value={value}
				onChange={(e) => onPick(e.target.value as T)}
				className="h-full max-w-44 cursor-pointer appearance-none bg-transparent pr-3 font-bold text-gray-100 outline-none"
			>
				{entries.map(([k, v]) => (
					<option key={k} value={k} className="bg-gray-900">
						{v}
					</option>
				))}
			</select>
		</label>
	)
}

export function KindTabs({ kind, onPick, counts }: { kind: Kind; onPick: (k: Kind) => void; counts: Record<Kind, number> }) {
	return (
		<div role="tablist" aria-label="Movies and shows" className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
			{(
				[
					["all", "All"],
					["movie", "Movies"],
					["show", "Shows"],
				] as const
			).map(([k, label]) => (
				<button
					key={k}
					type="button"
					role="tab"
					aria-selected={kind === k}
					onClick={() => onPick(k)}
					className={`flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold ${kind === k ? "bg-white text-black" : "text-gray-300 hover:bg-white/10"}`}
				>
					{label}
					<span className={`text-xs tabular-nums ${kind === k ? "text-black/60" : "text-gray-400"}`}>{counts[k].toLocaleString("en-US")}</span>
				</button>
			))}
		</div>
	)
}

export const kindCounts = (titles: RatedTitle[]): Record<Kind, number> => ({
	all: titles.length,
	movie: titles.filter((t) => t.mediaType === "movie").length,
	show: titles.filter((t) => t.mediaType === "show").length,
})

/** "3 changed · Undo": the last change can be taken back. Nothing is stored in the prototype. */
export function ChangeBar({ changes, onUndo }: { changes: Change[]; onUndo: () => void }) {
	if (!changes.length) return null
	const last = changes[0]
	return (
		<div className="fixed inset-x-2 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-gray-950 px-4 py-2.5 text-sm text-gray-100 shadow-2xl ring-1 ring-white/20 lg:bottom-20">
			<span className="min-w-0 flex-1 truncate">
				<b>{last.title}</b> {last.from} → {last.to}
				<span className="text-gray-400"> · {changes.length} changed (not stored)</span>
			</span>
			<button type="button" onClick={onUndo} className="flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2 font-semibold text-gray-300 hover:bg-white/10 hover:text-white">
				<ArrowUturnLeftIcon className="h-4 w-4" aria-hidden />
				Undo
			</button>
		</div>
	)
}

/** Ten bars: how many titles have each score. A press filters to that score. */
export function Distribution({
	titles,
	scoreOf,
	picked,
	onToggle,
}: {
	titles: RatedTitle[]
	scoreOf: (t: RatedTitle) => number
	picked: number[]
	onToggle: (n: number) => void
}) {
	const n = SCORES.map((s) => titles.filter((t) => scoreOf(t) === s).length)
	const max = Math.max(1, ...n)
	return (
		<div className="flex h-20 items-end gap-1" role="group" aria-label="Filter by score">
			{SCORES.map((s, i) => {
				const on = picked.includes(s)
				return (
					<button
						key={s}
						type="button"
						aria-pressed={on}
						onClick={() => onToggle(s)}
						title={`${n[i]} titles scored ${s}`}
						className="group flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-1"
					>
						<span className="text-[10px] tabular-nums text-gray-500">{n[i]}</span>
						<span
							className={`w-full rounded-t ${on ? "bg-amber-400" : picked.length ? "bg-white/10" : "bg-amber-400/50"} group-hover:bg-amber-300`}
							style={{ height: `${Math.max(3, (n[i] / max) * 48)}px` }}
						/>
						<span className={`text-xs font-black tabular-nums ${on ? "text-amber-300" : "text-gray-400"}`}>{s}</span>
					</button>
				)
			})}
		</div>
	)
}

/** Everything a variant needs: the member's scores, the view's choices, and the groups for them. */
export function useView(titles: RatedTitle[], initialGroup: GroupBy = "score", initialSort: SortBy = "title") {
	const r = useRescore(titles)
	const v = useFilters(initialGroup, initialSort)
	const { settle } = r
	// A new search, filter, grouping or sort puts rescored rows where they now belong.
	// biome-ignore lint/correctness/useExhaustiveDependencies: settle only when the view changes
	useEffect(() => settle(), [v.filters, v.groupBy, v.sortBy])
	const arranged = useMemo(
		() => arrange(titles, v.filters, v.groupBy, v.sortBy, r.placeOf, r.changed),
		[titles, v.filters, v.groupBy, v.sortBy, r.placeOf, r.changed],
	)
	return { ...r, ...v, ...arranged }
}
