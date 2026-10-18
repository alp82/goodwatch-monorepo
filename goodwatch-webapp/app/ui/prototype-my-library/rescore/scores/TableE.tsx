// PROTOTYPE - throwaway. Variant E, the table after the owner's notes on D (2026-10-18):
// - checkboxes are the episode list's tick box, and a press on the title ticks it (the title cell is its label);
// - a chevron opens the row in place: synopsis, facts, and the real score control;
// - the ten keys take the colors of the score control's 1-10 strip;
// - every header sorts, a second press turns the order around;
// - filters in Discover's design: search, a switch, Group and Filters in one row, chips under it, the side sheet.
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, MinusIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RatedTitle } from "~/server/prototype-my-library-rescore.server"
import type { Score } from "~/server/scores.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { Poster, tmdbImage } from "~/ui/my-pages/bits"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { getVibeColorValue, goodwatchVibeIndex, scoreLabels } from "~/utils/ratings"
import { ChangeBar, SCORES, gwOnTen, titleHref, useRescore } from "../shared"
import {
	ChangedSwitch,
	Chips,
	FiltersButton,
	GroupControl,
	NO_FILTERS,
	type RescoreFilters,
	RowSearch,
	Sheet,
	applyFilters,
	chipsOf,
	decadeOf,
	versusOf,
} from "./table-filters"

type SortKey = "title" | "year" | "kind" | "gw" | "gap" | "score" | "rated"
type Dir = "asc" | "desc"
const FIRST_DIR: Record<SortKey, Dir> = { title: "asc", year: "desc", kind: "asc", gw: "desc", gap: "desc", score: "desc", rated: "desc" }
type GroupKey = "none" | "score" | "decade" | "genre" | "kind" | "rated" | "versus"
const GROUPS: { key: GroupKey; label: string; hint: string }[] = [
	{ key: "none", label: "No grouping", hint: "One list" },
	{ key: "score", label: "My score", hint: "Your 10s first" },
	{ key: "versus", label: "Compared with GoodWatch", hint: "Where you and GoodWatch disagree" },
	{ key: "genre", label: "Genre", hint: "The biggest genre first" },
	{ key: "decade", label: "Decade", hint: "Newest first" },
	{ key: "kind", label: "Movies and shows", hint: "Movies, then shows" },
	{ key: "rated", label: "Year rated", hint: "When you gave the score" },
]
const gapOf = (t: RatedTitle, score: number) => (t.gw == null ? null : score - t.gw / 10)
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/^(the|an|a) (?=\S)/, "")
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null)

// ---------------------------------------------------------------------------------------------------------
// Pieces

/** The episode list's tick box, drawn inside a larger press target. */
function TickBox({ on, mixed = false }: { on: boolean; mixed?: boolean }) {
	return (
		<span
			aria-hidden
			className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] ${on || mixed ? "bg-green-500 text-black" : "border-2 border-white/40 text-transparent group-hover:border-green-400 group-hover:text-green-400/60"}`}
		>
			{mixed && !on ? <MinusIcon className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

/** The ten keys in the score control strip's colors: the score lit in its full color with a white ring. */
function VibeKeys({ score, gw, onPick, label, tall = false }: { score: number; gw: number | null; onPick: (n: number) => void; label: string; tall?: boolean }) {
	return (
		<div role="group" aria-label={label} className="grid grid-cols-10 gap-1">
			{SCORES.map((n) => {
				const picked = score === n
				return (
					<button
						key={n}
						type="button"
						aria-pressed={picked}
						aria-label={`${n}, ${scoreLabels[n]}`}
						title={`${n} · ${scoreLabels[n]}`}
						onClick={() => onPick(n)}
						className={`relative flex ${tall ? "h-9 text-sm" : "h-7 text-xs"} cursor-pointer items-center justify-center rounded-md font-black tabular-nums transition hover:scale-110 hover:text-gray-950 focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-amber-400 ${picked ? "scale-110 text-gray-950 ring-2 ring-white" : "text-white/75"}`}
						style={{ background: `${getVibeColorValue(n as Score)}${picked ? "" : "44"}` }}
					>
						{n}
						{gw === n && !picked && <span aria-hidden className="absolute -bottom-1 h-1 w-1 rounded-full bg-white/80" />}
					</button>
				)
			})}
		</div>
	)
}

const GwNumber = ({ gw }: { gw: number | null }) =>
	gw == null ? (
		<span className="text-gray-600">–</span>
	) : (
		<span className="font-bold" style={{ color: `var(--color-vibe-${goodwatchVibeIndex(gw)})` }}>
			{gw}
		</span>
	)

function Details({ t, score, onRate }: { t: RatedTitle; score: number; onRate: (n: number) => void }) {
	const { data } = useQuery({
		queryKey: ["prototype-rescore-title", t.key],
		queryFn: async () =>
			(await (await fetch(`/prototype/my-library-rescore/title?key=${t.key}`)).json()) as {
				synopsis: string | null
				tagline: string | null
				backdrop_path: string | null
			} | null,
		staleTime: Number.POSITIVE_INFINITY,
	})
	const versus = versusOf(t, score)
	return (
		<div className="grid gap-4 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5 md:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,26rem)] lg:p-4">
			<Link to={titleHref(t)} className="hidden w-28 shrink-0 md:block">
				<Poster path={t.poster_path} className="aspect-[2/3] w-full rounded-lg" />
			</Link>
			<div className="flex min-w-0 flex-col gap-2">
				{data?.tagline && <p className="text-sm italic text-gray-300">{data.tagline}</p>}
				<p className="line-clamp-4 text-sm text-gray-400">{data ? (data.synopsis ?? "No synopsis yet.") : "Loading…"}</p>
				<div className="flex flex-wrap gap-1.5">
					{t.genres.map((g) => (
						<span key={g} className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-gray-300 ring-1 ring-white/10">
							{g}
						</span>
					))}
				</div>
				<dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
					<dt className="text-gray-500">Rated</dt>
					<dd className="text-gray-300">{day(t.ratedAt) ?? "–"}</dd>
					<dt className="text-gray-500">Last watched</dt>
					<dd className="text-gray-300">{day(t.watchedAt) ?? "No date"}</dd>
					{versus && (
						<>
							<dt className="text-gray-500">Against GoodWatch</dt>
							<dd className="text-gray-300">{versus === "more" ? "You like it more" : versus === "less" ? "You like it less" : "About the same"}</dd>
						</>
					)}
				</dl>
				<Link to={titleHref(t)} prefetch="intent" className="mt-1 self-start text-sm font-bold text-amber-300 underline decoration-amber-300/30 underline-offset-4 hover:text-amber-200">
					Open the title page
				</Link>
			</div>
			<div className="flex flex-col gap-3 md:col-span-2 lg:col-span-1">
				<div className="flex items-center gap-3">
					<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: t.gw } } as never} size={48} />
				</div>
				<ScoreControl value={score as Score} onRate={(n) => onRate(n)} fit="box" />
			</div>
		</div>
	)
}

const Tr = memo(function Tr({
	t,
	score,
	changedFrom,
	checked,
	open,
	onCheck,
	onOpen,
	onPick,
	span,
}: {
	t: RatedTitle
	score: number
	changedFrom: number | null
	checked: boolean
	open: boolean
	span: number
	onCheck: (key: string) => void
	onOpen: (key: string) => void
	onPick: (t: RatedTitle, n: number) => void
}) {
	const gap = gapOf(t, score)
	const id = `tick-${t.key}`
	return (
		<>
			<tr className={`border-b border-white/5 ${checked ? "bg-green-500/[0.06]" : open ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}>
				<td className="py-1" colSpan={1}>
					{/* The title is the tick box's label: a press anywhere on it selects the row. */}
					<label htmlFor={id} className="group flex min-w-0 cursor-pointer items-center gap-2.5 py-0.5 pl-1">
						<input id={id} type="checkbox" checked={checked} onChange={() => onCheck(t.key)} className="peer sr-only" />
						<span className="rounded-md peer-focus-visible:ring-2 peer-focus-visible:ring-white">
							<TickBox on={checked} />
						</span>
						<Poster path={t.poster_path} className="h-9 w-6 shrink-0 rounded-sm" />
						<span className="min-w-0">
							<span className="block truncate text-sm text-white">{t.title}</span>
							<span className="block truncate text-xs text-gray-500 md:hidden">
								{t.release_year} · {t.mediaType === "show" ? "Show" : "Movie"}
							</span>
						</span>
					</label>
				</td>
				<td className="hidden px-2 text-xs tabular-nums text-gray-400 md:table-cell">{t.release_year}</td>
				<td className="hidden px-2 text-xs text-gray-400 md:table-cell">{t.mediaType === "show" ? "Show" : "Movie"}</td>
				<td className="hidden truncate px-2 text-xs text-gray-400 xl:table-cell">{t.genres.slice(0, 2).join(", ")}</td>
				<td className="hidden px-2 text-right text-xs tabular-nums md:table-cell">
					<GwNumber gw={t.gw} />
				</td>
				<td className={`hidden px-2 text-right text-xs font-bold tabular-nums md:table-cell ${gap == null ? "text-gray-600" : gap >= 1.5 ? "text-emerald-300" : gap <= -1.5 ? "text-rose-300" : "text-gray-500"}`}>
					{gap == null ? "" : `${gap > 0 ? "+" : ""}${gap.toFixed(1)}`}
				</td>
				<td className="hidden py-1 pl-3 pr-1 lg:table-cell">
					<VibeKeys score={score} gw={gwOnTen(t)} label={`Your score for ${t.title}`} onPick={(n) => onPick(t, n)} />
				</td>
				<td className="py-1 pr-1 text-right lg:hidden">
					<button
						type="button"
						onClick={() => onOpen(t.key)}
						aria-label={`Your score for ${t.title}: ${score}. Change it`}
						className="h-9 w-10 cursor-pointer rounded-lg text-sm font-black tabular-nums text-gray-950 ring-2 ring-white/80"
						style={{ background: getVibeColorValue(score as Score) }}
					>
						{score}
					</button>
				</td>
				<td className="hidden px-1 text-right text-xs font-semibold text-amber-300 sm:table-cell">{changedFrom != null ? `was ${changedFrom}` : ""}</td>
				<td className="py-1 pr-1 text-right">
					<button
						type="button"
						onClick={() => onOpen(t.key)}
						aria-expanded={open}
						aria-label={`${open ? "Close" : "Open"} ${t.title}`}
						className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
					>
						<ChevronDownIcon className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
					</button>
				</td>
			</tr>
			{open && (
				<tr>
					<td colSpan={span} className="pb-3 pt-1">
						<Details t={t} score={score} onRate={(n) => onPick(t, n)} />
					</td>
				</tr>
			)}
		</>
	)
})

function SortButton({ label, sort, by, dir, onSort }: { label: string; sort: SortKey; by: SortKey; dir: Dir; onSort: (s: SortKey) => void }) {
	const on = sort === by
	return (
		<button type="button" onClick={() => onSort(sort)} className={`inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap hover:text-white ${on ? "text-amber-300" : ""}`}>
			{label}
			<span aria-hidden className={`text-[10px] ${on ? "" : "opacity-0"}`}>
				{on && dir === "asc" ? "▲" : "▼"}
			</span>
		</button>
	)
}

function Th({ label, sort, by, dir, onSort, className = "" }: { label: string; sort?: SortKey; by: SortKey; dir: Dir; onSort: (s: SortKey) => void; className?: string }) {
	const on = sort === by
	return (
		<th aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : undefined} className={`px-2 py-2 text-left text-xs font-semibold text-gray-400 ${className}`}>
			{sort ? <SortButton label={label} sort={sort} by={by} dir={dir} onSort={onSort} /> : label}
		</th>
	)
}

// ---------------------------------------------------------------------------------------------------------

export function TableE({ titles }: { titles: RatedTitle[] }) {
	const r = useRescore(titles)
	const [f, setF] = useState<RescoreFilters>(NO_FILTERS)
	const [sort, setSort] = useState<{ by: SortKey; dir: Dir }>({ by: "score", dir: "desc" })
	const [groupBy, setGroupBy] = useState<GroupKey>("none")
	const [sheet, setSheet] = useState(false)
	const [checked, setChecked] = useState<Set<string>>(new Set())
	const [open, setOpen] = useState<string | null>(null)
	const [folded, setFolded] = useState<Set<string>>(new Set())
	const original = useMemo(() => new Map(titles.map((t) => [t.key, t.score])), [titles])
	// A full-width row spans the columns shown at this width; a larger span would add a column of its own.
	const head = useRef<HTMLTableRowElement>(null)
	const [span, setSpan] = useState(10)
	useEffect(() => {
		const count = () =>
			setSpan([...(head.current?.children ?? [])].filter((c) => getComputedStyle(c).display !== "none").length || 1)
		count()
		window.addEventListener("resize", count)
		return () => window.removeEventListener("resize", count)
	}, [])

	// A new filter, sort or grouping puts rescored rows where they now belong.
	// biome-ignore lint/correctness/useExhaustiveDependencies: settle only when the view changes
	useEffect(() => r.settle(), [f, sort, groupBy])

	const onSort = (by: SortKey) => setSort((s) => (s.by === by ? { by, dir: s.dir === "asc" ? "desc" : "asc" } : { by, dir: FIRST_DIR[by] }))
	const groups = useMemo(() => {
		const list = applyFilters(titles, f, r.placeOf, r.changed)
		const value: Record<SortKey, (t: RatedTitle) => number | string> = {
			title: (t) => fold(t.title),
			year: (t) => t.release_year ?? 0,
			kind: (t) => t.mediaType,
			gw: (t) => t.gw ?? -1,
			gap: (t) => gapOf(t, r.placeOf(t)) ?? -99,
			score: (t) => r.placeOf(t),
			rated: (t) => t.ratedAt ?? "",
		}
		const v = value[sort.by]
		const sign = sort.dir === "asc" ? 1 : -1
		list.sort((a, b) => {
			const x = v(a)
			const y = v(b)
			const c = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)
			return c * sign || fold(a.title).localeCompare(fold(b.title))
		})
		if (groupBy === "none") return [{ key: "all", label: "", titles: list }]
		const map = new Map<string, { key: string; label: string; order: number; titles: RatedTitle[] }>()
		const add = (key: string, label: string, order: number, t: RatedTitle) => {
			if (!map.has(key)) map.set(key, { key, label, order, titles: [] })
			map.get(key)?.titles.push(t)
		}
		for (const t of list) {
			const s = r.placeOf(t)
			if (groupBy === "score") add(String(s), `${s} · ${scoreLabels[s]}`, -s, t)
			else if (groupBy === "decade") add(String(decadeOf(t)), decadeOf(t) ? `${decadeOf(t)}s` : "Unknown year", -decadeOf(t), t)
			else if (groupBy === "kind") add(t.mediaType, t.mediaType === "movie" ? "Movies" : "Shows", t.mediaType === "movie" ? 0 : 1, t)
			else if (groupBy === "rated") {
				const y = Number(t.ratedAt?.slice(0, 4) ?? 0)
				add(String(y), y ? `Rated in ${y}` : "Unknown", -y, t)
			} else if (groupBy === "genre") {
				const g = f.genres.find((x) => t.genres.includes(x)) ?? t.genres[0] ?? "No genre"
				add(g, g, 0, t)
			} else if (groupBy === "versus") {
				const vs = versusOf(t, s)
				const at = { more: [0, "You like it more than GoodWatch"], close: [1, "About the same as GoodWatch"], less: [2, "You like it less than GoodWatch"] } as const
				vs ? add(vs, at[vs][1], at[vs][0], t) : add("none", "No GoodWatch score", 3, t)
			}
		}
		const out = [...map.values()]
		out.sort((a, b) => (groupBy === "genre" ? b.titles.length - a.titles.length : a.order - b.order))
		return out
	}, [titles, f, sort, groupBy, r.placeOf, r.changed])

	const visible = groups.flatMap((g) => g.titles)
	const total = visible.length
	const toggleSet = (set: Set<string>, key: string) => {
		const next = new Set(set)
		next.has(key) ? next.delete(key) : next.add(key)
		return next
	}
	const onCheck = useCallback((key: string) => setChecked((c) => toggleSet(c, key)), [])
	const onOpen = useCallback((key: string) => setOpen((o) => (o === key ? null : key)), [])
	const picked = titles.filter((t) => checked.has(t.key))
	const bulk = (to: (t: RatedTitle) => number) => {
		for (const t of picked) r.rescore(t, Math.min(10, Math.max(1, to(t))))
	}
	const allOn = visible.length > 0 && visible.every((t) => checked.has(t.key))
	const someOn = !allOn && visible.some((t) => checked.has(t.key))
	const filterCount = chipsOf(f).length

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2.5">
				<RowSearch q={f.q} onChange={(q) => setF((x) => ({ ...x, q }))} />
				<ChangedSwitch on={f.changedOnly} count={r.changes.length} onChange={(changedOnly) => setF((x) => ({ ...x, changedOnly }))} />
				<div className="flex min-w-0 items-center gap-2.5 sm:ml-auto">
					<GroupControl options={GROUPS} value={groupBy} onChange={setGroupBy} />
					<FiltersButton count={filterCount} expanded={sheet} onClick={() => setSheet(true)} />
				</div>
			</div>
			<Chips f={f} set={setF} />
			<p className="text-xs text-gray-500">
				{total.toLocaleString("en-US")} of {titles.length.toLocaleString("en-US")} titles. Press a title to select it; the arrow opens it.
			</p>

			{picked.length > 0 && (
				<div className="sticky top-[var(--nav-header-height,0px)] z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-gray-900/95 px-3 py-2 text-sm ring-1 ring-green-500/40 backdrop-blur">
					<b>{picked.length} selected</b>
					<span className="text-gray-500">Set to</span>
					<div className="w-full max-w-[19rem]">
						<VibeKeys score={0} gw={null} label="Set the selected titles to" onPick={(n) => bulk(() => n)} />
					</div>
					<button type="button" onClick={() => bulk((t) => r.scoreOf(t) + 1)} className="h-8 cursor-pointer rounded-md bg-white/[0.08] px-2 text-xs font-bold hover:bg-white/20">
						+1
					</button>
					<button type="button" onClick={() => bulk((t) => r.scoreOf(t) - 1)} className="h-8 cursor-pointer rounded-md bg-white/[0.08] px-2 text-xs font-bold hover:bg-white/20">
						−1
					</button>
					<button type="button" onClick={() => setChecked(new Set())} className="ml-auto h-8 cursor-pointer px-2 text-xs text-gray-400 hover:text-white">
						Clear selection
					</button>
				</div>
			)}

			<table className="w-full table-fixed border-collapse">
				<thead className="border-b border-white/10">
					<tr ref={head}>
						<th aria-sort={sort.by === "title" ? (sort.dir === "asc" ? "ascending" : "descending") : undefined} className="py-2 text-left text-xs font-semibold text-gray-400">
							<span className="flex items-center gap-1.5">
								<button
									type="button"
									// biome-ignore lint/a11y/useSemanticElements: tri-state select-all drawn as the tick box
									role="checkbox"
									aria-checked={allOn ? true : someOn ? "mixed" : false}
									aria-label="Select all shown"
									onClick={() => setChecked(allOn ? new Set() : new Set(visible.map((t) => t.key)))}
									className="group grid h-9 w-8 cursor-pointer place-items-center pl-1"
								>
									<TickBox on={allOn} mixed={someOn} />
								</button>
								<span className="w-[3.25rem] shrink-0" aria-hidden />
								<SortButton label="Title" sort="title" by={sort.by} dir={sort.dir} onSort={onSort} />
							</span>
						</th>
						<Th label="Year" sort="year" by={sort.by} dir={sort.dir} onSort={onSort} className="hidden w-16 md:table-cell" />
						<Th label="Type" sort="kind" by={sort.by} dir={sort.dir} onSort={onSort} className="hidden w-16 md:table-cell" />
						<Th label="Genres" by={sort.by} dir={sort.dir} onSort={onSort} className="hidden w-40 xl:table-cell" />
						<Th label="GoodWatch" sort="gw" by={sort.by} dir={sort.dir} onSort={onSort} className="hidden w-24 text-right md:table-cell" />
						<Th label="Gap" sort="gap" by={sort.by} dir={sort.dir} onSort={onSort} className="hidden w-16 text-right md:table-cell" />
						<Th label="My score" sort="score" by={sort.by} dir={sort.dir} onSort={onSort} className="hidden w-[21rem] pl-3 lg:table-cell" />
						<Th label="Mine" sort="score" by={sort.by} dir={sort.dir} onSort={onSort} className="w-16 text-right lg:hidden" />
						<Th label="" by={sort.by} dir={sort.dir} onSort={onSort} className="hidden w-14 sm:table-cell" />
						<Th label="" by={sort.by} dir={sort.dir} onSort={onSort} className="w-11" />
					</tr>
				</thead>
				<tbody>
					{groups.map((g) => (
						<Fragment key={g.key}>
							{g.label && (
								<tr>
									<td colSpan={span} className="pb-1 pt-5">
										<button type="button" onClick={() => setFolded((x) => toggleSet(x, g.key))} className="flex cursor-pointer items-center gap-1.5 text-sm font-black text-white">
											{folded.has(g.key) ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
											{groupBy === "score" && <span className="h-2.5 w-2.5 rounded-full" style={{ background: getVibeColorValue(Number(g.key) as Score) }} />}
											{g.label}
											<span className="ml-1 text-xs font-semibold text-gray-500">{g.titles.length}</span>
										</button>
									</td>
								</tr>
							)}
							{!folded.has(g.key) &&
								g.titles.map((t) => {
									const score = r.scoreOf(t)
									const from = original.get(t.key) ?? score
									return (
										<Tr
											key={t.key}
											t={t}
											score={score}
											changedFrom={from !== score ? from : null}
											checked={checked.has(t.key)}
											open={open === t.key}
											onCheck={onCheck}
											onOpen={onOpen}
											onPick={r.rescore}
											span={span}
										/>
									)
								})}
						</Fragment>
					))}
				</tbody>
			</table>
			{total === 0 && <p className="py-6 text-sm text-gray-400">Nothing matches these filters.</p>}
			<Sheet open={sheet} onClose={() => setSheet(false)} titles={titles} f={f} set={setF} placeOf={r.placeOf} changed={r.changed} total={total} />
			<ChangeBar changes={r.changes} onUndo={r.undo} />
		</div>
	)
}
