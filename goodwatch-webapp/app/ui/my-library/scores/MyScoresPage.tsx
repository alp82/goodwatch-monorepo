// Your scores (My library): every title the member has scored, in one table with the ten scores beside each.
//
// What the owner chose from the prototypes (October 18, 2026): the table, with the site's tick boxes in brand amber
// (a press on the title ticks the row), rows that open in place instead of a popup, the keys in the score control
// strip's colors, a two-way sort on every column, and the filters in Discover's design. Selected rows change
// together: all to one score, or each a step up or down. A change saves at once and Undo takes it back.
//
// The member's whole list comes with the page; rows are drawn in steps while scrolling, so a long list stays light.
import { ArrowUturnLeftIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LIBRARY_HUB } from "~/domain/my-library"
import {
	type Direction,
	NO_FILTERS,
	type ScoreFilters,
	type ScoreGrouping,
	type ScoreSort,
	type ScoredTitle,
	activeFilterCount,
	arrange,
	nextSort,
} from "~/domain/my-scores"
import type { Score } from "~/server/scores.server"
import { Empty, PageHead, WRAP } from "~/ui/my-pages/bits"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { ChangedSwitch, FilterChips, FiltersButton, FiltersSheet, GroupControl, RowSearch } from "./ScoreFilters"
import { ScoreKeys, ScoreRow, TickBox } from "./ScoreRow"
import { type Change, type SaveState, useScores } from "./useScores"

const GROUPINGS: { key: ScoreGrouping; label: string; hint: string }[] = [
	{ key: "none", label: "No grouping", hint: "One list" },
	{ key: "score", label: "My score", hint: "Your 10s first" },
	{ key: "versus", label: "Compared with GoodWatch", hint: "Where you and GoodWatch disagree" },
	{ key: "genre", label: "Genre", hint: "The biggest genre first" },
	{ key: "decade", label: "Decade", hint: "Newest first" },
	{ key: "kind", label: "Movies and shows", hint: "Movies, then shows" },
	{ key: "rated", label: "Year rated", hint: "When you gave the score" },
]
/** Rows drawn at first and added per step while scrolling. */
const ROWS_STEP = 120
const count = (n: number) => n.toLocaleString("en-US")

function SortButton({
	label,
	sort,
	current,
	onSort,
}: {
	label: string
	sort: ScoreSort
	current: { by: ScoreSort; dir: Direction }
	onSort: (s: ScoreSort) => void
}) {
	const on = current.by === sort
	return (
		<button
			type="button"
			onClick={() => onSort(sort)}
			data-sort={sort}
			className={`inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap hover:text-white ${on ? "text-amber-300" : ""}`}
		>
			{label}
			<span aria-hidden className={`text-[10px] ${on ? "" : "opacity-0"}`}>
				{on && current.dir === "asc" ? "▲" : "▼"}
			</span>
		</button>
	)
}

function Th({
	label = "",
	sort,
	current,
	onSort,
	className = "",
}: {
	label?: string
	sort?: ScoreSort
	current: { by: ScoreSort; dir: Direction }
	onSort: (s: ScoreSort) => void
	className?: string
}) {
	const on = sort !== undefined && current.by === sort
	return (
		<th
			aria-sort={on ? (current.dir === "asc" ? "ascending" : "descending") : undefined}
			className={`px-2 py-2 text-left text-xs font-semibold text-gray-400 ${className}`}
		>
			{sort ? <SortButton label={label} sort={sort} current={current} onSort={onSort} /> : label}
		</th>
	)
}

/** The last change and Undo, or how saving goes. Above the phone's dock. */
function ChangeBar({ changes, save, onUndo }: { changes: Change[]; save: SaveState; onUndo: () => void }) {
	const last = changes[0]
	if (!last && save.kind === "idle") return null
	return (
		<output
			className="fixed inset-x-2 bottom-[calc(var(--nav-dock-height,0px)+0.5rem)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-gray-950 px-4 py-2.5 text-sm text-gray-100 shadow-2xl ring-1 ring-white/20 lg:bottom-6"
			data-change-bar
		>
			<span className="min-w-0 flex-1 truncate">
				{save.kind === "saving" ? (
					`Saving ${count(save.done)} of ${count(save.of)}…`
				) : save.kind === "failed" ? (
					<span className="text-rose-300">Couldn't save {save.label}. Its score is back as it was.</span>
				) : (
					<>
						<b>{last.label}</b>{" "}
						{last.to === "step"
							? "moved a step"
							: last.items.length === 1
								? `${last.items[0].from} → ${last.to}`
								: `to ${last.to}`}
						<span className="text-gray-400"> · saved</span>
					</>
				)}
			</span>
			{last && save.kind !== "saving" && (
				<button
					type="button"
					onClick={onUndo}
					data-undo
					className="flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2 font-semibold text-gray-300 hover:bg-white/10 hover:text-white"
				>
					<ArrowUturnLeftIcon className="h-4 w-4" aria-hidden />
					Undo
				</button>
			)}
		</output>
	)
}

export function MyScoresPage({ titles }: { titles: ScoredTitle[] }) {
	const s = useScores(titles)
	const [f, setF] = useState<ScoreFilters>(NO_FILTERS)
	const [sort, setSort] = useState<{ by: ScoreSort; dir: Direction }>({ by: "score", dir: "desc" })
	const [grouping, setGrouping] = useState<ScoreGrouping>("none")
	const [sheet, setSheet] = useState(false)
	const [checked, setChecked] = useState<Set<string>>(new Set())
	const [open, setOpen] = useState<string | null>(null)
	const [folded, setFolded] = useState<Set<string>>(new Set())
	const [limit, setLimit] = useState(ROWS_STEP)

	// A new search, filter, sort or grouping moves rescored rows to where they now belong, and starts the steps over.
	const { settle } = s
	// Only a change of view settles the rows: `settle` is the same function throughout.
	useEffect(() => {
		settle()
		setLimit(ROWS_STEP)
	}, [f, sort, grouping])

	// A full-width row spans the columns shown at this width: a larger span would add a column of its own.
	const head = useRef<HTMLTableRowElement>(null)
	const [span, setSpan] = useState(10)
	useEffect(() => {
		const measure = () =>
			setSpan([...(head.current?.children ?? [])].filter((c) => getComputedStyle(c).display !== "none").length || 1)
		measure()
		window.addEventListener("resize", measure)
		return () => window.removeEventListener("resize", measure)
	}, [])

	const groups = useMemo(
		() => arrange(titles, f, sort, grouping, s.standingOf, (n) => scoreLabels[n] ?? String(n)),
		[titles, f, sort, grouping, s.standingOf],
	)
	const visible = useMemo(() => groups.flatMap((g) => g.titles), [groups])

	// More rows as the end of the drawn ones comes near.
	const end = useRef<HTMLDivElement>(null)
	const more = visible.length > limit
	useEffect(() => {
		if (!more || !end.current) return
		const observer = new IntersectionObserver(
			(entries) => entries.some((e) => e.isIntersecting) && setLimit((l) => l + ROWS_STEP),
			{ rootMargin: "800px 0px" },
		)
		observer.observe(end.current)
		return () => observer.disconnect()
	}, [more])

	const onSort = useCallback((by: ScoreSort) => setSort((current) => nextSort(current, by)), [])
	const toggleIn = (set: Set<string>, key: string) => {
		const next = new Set(set)
		next.has(key) ? next.delete(key) : next.add(key)
		return next
	}
	const onCheck = useCallback((key: string) => setChecked((c) => toggleIn(c, key)), [])
	const onOpen = useCallback((key: string) => setOpen((o) => (o === key ? null : key)), [])
	// Only rows the filters show count as selected: a change never reaches titles the member can't see.
	const picked = useMemo(() => visible.filter((t) => checked.has(t.key)), [visible, checked])
	const allOn = visible.length > 0 && visible.every((t) => checked.has(t.key))
	const someOn = !allOn && visible.some((t) => checked.has(t.key))

	if (!titles.length)
		return (
			<div className="pb-24" data-my-scores>
				<PageHead name="Your scores" line="Every title you have scored." back={{ label: "My library", to: LIBRARY_HUB }} />
				<div className={WRAP}>
					<Empty title="No scores yet">A score you give a title on its page appears here, to change any time.</Empty>
				</div>
			</div>
		)

	let drawn = 0
	return (
		<div className="overflow-x-clip pb-32" data-my-scores>
			<PageHead
				name="Your scores"
				line={`${count(titles.length)} titles you have scored. Change any score right in the list.`}
				back={{ label: "My library", to: LIBRARY_HUB }}
			/>
			<div className={`${WRAP} flex flex-col gap-3`}>
				<div className="flex flex-wrap items-center gap-2.5" data-controls>
					<RowSearch q={f.q} onChange={(q) => setF((x) => ({ ...x, q }))} />
					<ChangedSwitch
						on={f.changedOnly}
						count={titles.filter(s.changed).length}
						onChange={(changedOnly) => setF((x) => ({ ...x, changedOnly }))}
					/>
					<div className="flex min-w-0 items-center gap-2.5 sm:ml-auto">
						<GroupControl options={GROUPINGS} value={grouping} onChange={setGrouping} />
						<FiltersButton count={activeFilterCount(f)} expanded={sheet} onClick={() => setSheet(true)} />
					</div>
				</div>
				<FilterChips f={f} set={setF} />
				<p className="text-xs text-gray-500" aria-live="polite" data-result>
					{visible.length === titles.length
						? `${count(titles.length)} titles.`
						: `${count(visible.length)} of ${count(titles.length)} titles.`}{" "}
					Press a title to select it; the arrow opens it.
				</p>

				{picked.length > 0 && (
					<div
						className={`sticky top-[var(--nav-header-height,0px)] z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-gray-900/95 px-3 py-2 text-sm ring-1 ring-amber-400/40 ${s.save.kind === "saving" ? "[&_button]:pointer-events-none [&_button]:opacity-50" : ""}`}
						aria-busy={s.save.kind === "saving"}
						data-selection
					>
						<b>{count(picked.length)} selected</b>
						{s.save.kind === "saving" && <span className="text-gray-400">Saving…</span>}
						<span className="text-gray-500">Set to</span>
						<div className="w-full max-w-[19rem]">
							<ScoreKeys score={null} gw={null} label="Set the selected titles to" onPick={(n) => s.rescoreMany(picked, n)} />
						</div>
						<button
							type="button"
							onClick={() => s.rescoreMany(picked, (now) => now + 1)}
							className="h-8 cursor-pointer rounded-md bg-white/[0.08] px-2 text-xs font-bold hover:bg-white/20"
						>
							+1
						</button>
						<button
							type="button"
							onClick={() => s.rescoreMany(picked, (now) => now - 1)}
							className="h-8 cursor-pointer rounded-md bg-white/[0.08] px-2 text-xs font-bold hover:bg-white/20"
						>
							−1
						</button>
						<button
							type="button"
							onClick={() => setChecked(new Set())}
							className="ml-auto h-8 cursor-pointer px-2 text-xs text-gray-400 hover:text-white"
						>
							Clear selection
						</button>
					</div>
				)}

				<table className="w-full table-fixed border-collapse" data-scores-table>
					<thead className="border-b border-white/10">
						<tr ref={head}>
							<th
								aria-sort={sort.by === "title" ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
								className="py-2 text-left text-xs font-semibold text-gray-400"
							>
								<span className="flex items-center gap-1.5">
									<button
										type="button"
										// biome-ignore lint/a11y/useSemanticElements: a tri-state select-all drawn as the site's tick box
										role="checkbox"
										aria-checked={allOn ? true : someOn ? "mixed" : false}
										aria-label="Select all shown"
										onClick={() => setChecked(allOn ? new Set() : new Set(visible.map((t) => t.key)))}
										className="group grid h-9 w-8 cursor-pointer place-items-center pl-1"
									>
										<TickBox on={allOn} mixed={someOn} />
									</button>
									<span className="w-[3.25rem] shrink-0" aria-hidden />
									<SortButton label="Title" sort="title" current={sort} onSort={onSort} />
								</span>
							</th>
							<Th label="Year" sort="year" current={sort} onSort={onSort} className="hidden w-16 md:table-cell" />
							<Th label="Type" sort="kind" current={sort} onSort={onSort} className="hidden w-16 md:table-cell" />
							<Th label="Genres" current={sort} onSort={onSort} className="hidden w-40 xl:table-cell" />
							<Th label="GoodWatch" sort="gw" current={sort} onSort={onSort} className="hidden w-24 text-right md:table-cell" />
							<Th label="Gap" sort="gap" current={sort} onSort={onSort} className="hidden w-16 text-right md:table-cell" />
							<Th label="My score" sort="score" current={sort} onSort={onSort} className="hidden w-[21rem] pl-3 lg:table-cell" />
							<Th label="Mine" sort="score" current={sort} onSort={onSort} className="w-16 text-right lg:hidden" />
							<Th current={sort} onSort={onSort} className="hidden w-16 md:table-cell" />
							<Th current={sort} onSort={onSort} className="w-11" />
						</tr>
					</thead>
					<tbody>
						{groups.map((g) => {
							if (drawn >= limit) return null
							const shut = folded.has(g.key)
							const rows = shut ? [] : g.titles.slice(0, Math.max(0, limit - drawn))
							drawn += rows.length
							return (
								<Fragment key={g.key}>
									{g.label && (
										<tr>
											<td colSpan={span} className="pb-1 pt-5">
												<button
													type="button"
													aria-expanded={!shut}
													onClick={() => setFolded((x) => toggleIn(x, g.key))}
													className="flex cursor-pointer items-center gap-1.5 text-sm font-black text-white"
												>
													{shut ? <ChevronRightIcon className="h-4 w-4" aria-hidden /> : <ChevronDownIcon className="h-4 w-4" aria-hidden />}
													{grouping === "score" && (
														<span className="h-2.5 w-2.5 rounded-full" style={{ background: getVibeColorValue(Number(g.key) as Score) }} />
													)}
													{g.label}
													<span className="ml-1 text-xs font-semibold text-gray-500">{count(g.titles.length)}</span>
												</button>
											</td>
										</tr>
									)}
									{rows.map((t) => {
										const score = s.scoreOf(t)
										const from = s.original.get(t.key) ?? score
										return (
											<ScoreRow
												key={t.key}
												t={t}
												score={score}
												changedFrom={from !== score ? from : null}
												checked={checked.has(t.key)}
												open={open === t.key}
												span={span}
												onCheck={onCheck}
												onOpen={onOpen}
												onPick={s.rescore}
											/>
										)
									})}
								</Fragment>
							)
						})}
					</tbody>
				</table>
				{more && <div ref={end} className="h-px" aria-hidden />}
				{visible.length === 0 && (
					<p className="py-6 text-sm text-gray-400" data-no-match>
						Nothing matches these filters.
					</p>
				)}
			</div>
			<FiltersSheet
				open={sheet}
				onClose={() => setSheet(false)}
				titles={titles}
				f={f}
				set={setF}
				standingOf={s.standingOf}
				shown={visible.length}
			/>
			<ChangeBar changes={s.changes} save={s.save} onUndo={s.undo} />
		</div>
	)
}
