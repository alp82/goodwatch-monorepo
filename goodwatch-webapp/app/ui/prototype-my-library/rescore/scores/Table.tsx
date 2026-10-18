// PROTOTYPE - throwaway. Variant D, "Table": a spreadsheet of your scores. Columns sort on a press, groups fold,
// and a checkbox per row lets you change many at once: set them all to one score, or move them up or down by one.
// The ten keys sit in the My score column on wide screens; on a phone the score opens them under the row.
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { Fragment, memo, useState } from "react"
import type { RatedTitle } from "~/server/prototype-my-library-rescore.server"
import { Poster } from "~/ui/my-pages/bits"
import {
	ChangeBar,
	GROUP_LABEL,
	KindTabs,
	SCORES,
	ScoreKeys,
	Search,
	Select,
	type SortBy,
	average,
	gapOf,
	gwOnTen,
	kindCounts,
	titleHref,
	useView,
} from "../shared"

const Tr = memo(function Tr({
	t,
	score,
	changedFrom,
	checked,
	open,
	onCheck,
	onOpen,
	onPick,
}: {
	t: RatedTitle
	score: number
	changedFrom: number | null
	checked: boolean
	open: boolean
	onCheck: (key: string) => void
	onOpen: (key: string) => void
	onPick: (t: RatedTitle, n: number) => void
}) {
	const gap = t.gw == null ? null : gapOf(t, score)
	return (
		<>
			<tr className={`border-b border-white/5 ${checked ? "bg-amber-400/[0.07]" : "hover:bg-white/[0.02]"}`}>
				<td className="w-8 py-1.5 pl-1">
					<input type="checkbox" checked={checked} onChange={() => onCheck(t.key)} aria-label={`Select ${t.title}`} className="h-4 w-4 cursor-pointer accent-amber-400" />
				</td>
				<td className="py-1.5">
					<Link to={titleHref(t)} className="group flex min-w-0 items-center gap-2">
						<Poster path={t.poster_path} className="h-9 w-6 shrink-0 rounded-sm" />
						<span className="truncate text-sm text-white group-hover:text-amber-200">{t.title}</span>
					</Link>
				</td>
				<td className="hidden px-2 text-xs tabular-nums text-gray-400 sm:table-cell">{t.release_year}</td>
				<td className="hidden px-2 text-xs text-gray-400 md:table-cell">{t.mediaType === "show" ? "Show" : "Movie"}</td>
				<td className="hidden max-w-40 truncate px-2 text-xs text-gray-400 xl:table-cell">{t.genres.slice(0, 2).join(", ")}</td>
				<td className="hidden px-2 text-right text-xs tabular-nums text-sky-300/80 md:table-cell">{t.gw != null ? `${t.gw}%` : "-"}</td>
				<td
					className={`hidden px-2 text-right text-xs font-bold tabular-nums md:table-cell ${gap == null ? "text-gray-600" : gap >= 1.5 ? "text-emerald-300" : gap <= -1.5 ? "text-rose-300" : "text-gray-500"}`}
				>
					{gap == null ? "" : `${gap > 0 ? "+" : ""}${gap.toFixed(1)}`}
				</td>
				<td className="hidden w-[20rem] py-1 pl-2 lg:table-cell">
					<ScoreKeys score={score} gw={gwOnTen(t)} size="sm" label={`Your score for ${t.title}`} onPick={(n) => onPick(t, n)} />
				</td>
				<td className="w-14 py-1 text-right lg:hidden">
					<button
						type="button"
						onClick={() => onOpen(t.key)}
						aria-expanded={open}
						aria-label={`Your score for ${t.title}: ${score}. Change it`}
						className="h-9 w-11 cursor-pointer rounded-lg text-base font-black tabular-nums text-amber-300 ring-1 ring-amber-400/40 hover:bg-amber-400 hover:text-black"
					>
						{score}
					</button>
				</td>
				<td className="hidden w-14 pr-1 text-right text-xs font-semibold text-amber-300 sm:table-cell">{changedFrom != null ? `was ${changedFrom}` : ""}</td>
			</tr>
			{open && (
				<tr className="lg:hidden">
					<td colSpan={10} className="pb-2">
						<ScoreKeys score={score} gw={gwOnTen(t)} label={`Your score for ${t.title}`} onPick={(n) => onPick(t, n)} />
					</td>
				</tr>
			)}
		</>
	)
})

function Th({ label, sort, current, onSort, className = "" }: { label: string; sort?: SortBy; current: SortBy; onSort: (s: SortBy) => void; className?: string }) {
	return (
		<th className={`px-2 py-2 text-left text-xs font-semibold text-gray-400 ${className}`}>
			{sort ? (
				<button type="button" onClick={() => onSort(sort)} className={`cursor-pointer hover:text-white ${current === sort ? "text-amber-300" : ""}`}>
					{label}
					{current === sort ? " ↓" : ""}
				</button>
			) : (
				label
			)}
		</th>
	)
}

export function Table({ titles }: { titles: RatedTitle[] }) {
	const v = useView(titles, "none", "score")
	const original = new Map(titles.map((t) => [t.key, t.score]))
	const [checked, setChecked] = useState<Set<string>>(new Set())
	const [open, setOpen] = useState<string | null>(null)
	const [folded, setFolded] = useState<Set<string>>(new Set())
	const toggle = (set: Set<string>, key: string) => {
		const next = new Set(set)
		next.has(key) ? next.delete(key) : next.add(key)
		return next
	}
	const onCheck = (key: string) => setChecked((c) => toggle(c, key))
	const onOpen = (key: string) => setOpen((o) => (o === key ? null : key))
	const picked = titles.filter((t) => checked.has(t.key))
	const bulk = (to: (t: RatedTitle) => number) => {
		for (const t of picked) v.rescore(t, Math.min(10, Math.max(1, to(t))))
	}
	const visible = v.groups.flatMap((g) => g.titles)
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<KindTabs kind={v.filters.kind} onPick={(kind) => v.set({ kind })} counts={kindCounts(titles)} />
				<Search q={v.filters.q} onChange={(q) => v.set({ q })} className="flex-1 basis-44 sm:max-w-xs" />
				<Select
					label="Genre"
					value={v.filters.genre}
					options={[["", "All"], ...v.genres.map((g) => [g, g] as [string, string])]}
					onPick={(genre) => v.set({ genre })}
				/>
				<span className="hidden grow lg:block" />
				<Select label="Group" value={v.groupBy} options={GROUP_LABEL} onPick={v.setGroupBy} />
			</div>
			<div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
				<span className="mr-1">Show scores</span>
				{SCORES.map((n) => {
					const on = v.filters.scores.includes(n)
					return (
						<button
							key={n}
							type="button"
							aria-pressed={on}
							onClick={() => v.set({ scores: on ? v.filters.scores.filter((s) => s !== n) : [...v.filters.scores, n] })}
							className={`h-8 w-8 cursor-pointer rounded-md font-black tabular-nums ${on ? "bg-amber-400 text-black" : "bg-white/[0.06] text-gray-300 hover:bg-white/15"}`}
						>
							{n}
						</button>
					)
				})}
				<span className="ml-2">{v.total.toLocaleString("en-US")} titles</span>
			</div>
			{picked.length > 0 && (
				<div className="sticky top-[var(--nav-header-height,0px)] z-20 flex flex-wrap items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm ring-1 ring-amber-400/40">
					<b>{picked.length} selected</b>
					<span className="text-gray-500">Set to</span>
					<div className="flex gap-1">
						{SCORES.map((n) => (
							<button key={n} type="button" onClick={() => bulk(() => n)} className="h-8 w-7 cursor-pointer rounded-md bg-white/[0.08] text-xs font-black tabular-nums hover:bg-amber-400 hover:text-black">
								{n}
							</button>
						))}
					</div>
					<button type="button" onClick={() => bulk((t) => v.scoreOf(t) + 1)} className="h-8 cursor-pointer rounded-md bg-white/[0.08] px-2 text-xs font-bold hover:bg-white/20">
						+1
					</button>
					<button type="button" onClick={() => bulk((t) => v.scoreOf(t) - 1)} className="h-8 cursor-pointer rounded-md bg-white/[0.08] px-2 text-xs font-bold hover:bg-white/20">
						−1
					</button>
					<button type="button" onClick={() => setChecked(new Set())} className="ml-auto h-8 cursor-pointer px-2 text-xs text-gray-400 hover:text-white">
						Clear selection
					</button>
				</div>
			)}
			<table className="w-full table-fixed border-collapse">
				<thead className="border-b border-white/10">
					<tr>
						<th className="w-8 pl-1 text-left">
							<input
								type="checkbox"
								aria-label="Select all shown"
								checked={visible.length > 0 && visible.every((t) => checked.has(t.key))}
								onChange={(e) => setChecked(e.target.checked ? new Set(visible.map((t) => t.key)) : new Set())}
								className="h-4 w-4 cursor-pointer accent-amber-400"
							/>
						</th>
						<Th label="Title" sort="title" current={v.sortBy} onSort={v.setSortBy} />
						<Th label="Year" sort="year" current={v.sortBy} onSort={v.setSortBy} className="hidden w-14 sm:table-cell" />
						<Th label="Type" current={v.sortBy} onSort={v.setSortBy} className="hidden w-16 md:table-cell" />
						<Th label="Genres" current={v.sortBy} onSort={v.setSortBy} className="hidden w-40 xl:table-cell" />
						<Th label="GoodWatch" current={v.sortBy} onSort={v.setSortBy} className="hidden w-24 text-right md:table-cell" />
						<Th label="Gap" sort="gap" current={v.sortBy} onSort={v.setSortBy} className="hidden w-14 text-right md:table-cell" />
						<Th label="My score" sort="score" current={v.sortBy} onSort={v.setSortBy} className="hidden w-[21rem] lg:table-cell" />
						<Th label="Mine" sort="score" current={v.sortBy} onSort={v.setSortBy} className="w-14 text-right lg:hidden" />
						<Th label="" current={v.sortBy} onSort={v.setSortBy} className="hidden w-16 sm:table-cell" />
					</tr>
				</thead>
				<tbody>
					{v.groups.map((g) => (
						<Fragment key={g.key}>
							{g.label && (
								<tr>
									<td colSpan={10} className="pt-4">
										<button
											type="button"
											onClick={() => setFolded((f) => toggle(f, g.key))}
											className="flex cursor-pointer items-center gap-1 text-sm font-black text-white"
										>
											{folded.has(g.key) ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
											{g.label}
											<span className="ml-1 text-xs font-semibold text-gray-500">
												{g.titles.length} · average {average(g.titles, v.scoreOf)}
											</span>
										</button>
									</td>
								</tr>
							)}
							{!folded.has(g.key) &&
								g.titles.map((t) => {
									const score = v.scoreOf(t)
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
											onPick={v.rescore}
										/>
									)
								})}
						</Fragment>
					))}
				</tbody>
			</table>
			<ChangeBar changes={v.changes} onUndo={v.undo} />
		</div>
	)
}
