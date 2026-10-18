// PROTOTYPE - throwaway. Variant A, "Strip": one dense row per title, the ten score keys always beside it.
// Groups have sticky headings with their count and average; filters sit in one bar above the list.
import { Link } from "@remix-run/react"
import { memo } from "react"
import type { RatedTitle } from "~/server/prototype-my-library-rescore.server"
import { Poster } from "~/ui/my-pages/bits"
import {
	ChangeBar,
	Distribution,
	GROUP_LABEL,
	KindTabs,
	SORT_LABEL,
	ScoreKeys,
	Search,
	Select,
	average,
	gwOnTen,
	kindCounts,
	titleHref,
	useView,
} from "../shared"

const Row = memo(function Row({
	t,
	score,
	changedFrom,
	onPick,
}: {
	t: RatedTitle
	score: number
	changedFrom: number | null
	onPick: (t: RatedTitle, n: number) => void
}) {
	return (
		<li className="flex flex-col gap-1.5 border-b border-white/5 py-2 md:flex-row md:items-center md:gap-4">
			<Link to={titleHref(t)} prefetch="intent" className="group flex min-w-0 flex-1 items-center gap-3">
				<Poster path={t.poster_path} className="h-12 w-8 shrink-0 rounded" />
				<span className="min-w-0 flex-1">
					<b className="block truncate text-sm text-white group-hover:text-amber-200">{t.title}</b>
					<span className="block truncate text-xs text-gray-500">
						{t.mediaType === "show" ? "Show" : "Movie"} · {t.release_year ?? "?"}
						{t.gw != null && <span className="text-sky-300/80"> · GoodWatch {t.gw}%</span>}
						{changedFrom != null && <span className="font-semibold text-amber-300"> · was {changedFrom}</span>}
					</span>
				</span>
			</Link>
			<div className="w-full md:w-[22rem] md:shrink-0">
				<ScoreKeys score={score} gw={gwOnTen(t)} size="sm" label={`Your score for ${t.title}`} onPick={(n) => onPick(t, n)} />
			</div>
		</li>
	)
})

export function Strip({ titles }: { titles: RatedTitle[] }) {
	const v = useView(titles, "score", "title")
	const original = new Map(titles.map((t) => [t.key, t.score]))
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
				<Select label="Sort" value={v.sortBy} options={SORT_LABEL} onPick={v.setSortBy} />
			</div>
			<details className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
				<summary className="cursor-pointer text-xs font-semibold text-gray-400">
					Your scores at a glance{v.filters.scores.length ? ` · showing ${v.filters.scores.join(", ")}` : ""}
				</summary>
				<div className="pt-2">
					<Distribution
						titles={titles}
						scoreOf={v.scoreOf}
						picked={v.filters.scores}
						onToggle={(n) =>
							v.set({
								scores: v.filters.scores.includes(n) ? v.filters.scores.filter((s) => s !== n) : [...v.filters.scores, n],
							})
						}
					/>
				</div>
			</details>
			<p className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
				<span>{v.total.toLocaleString("en-US")} titles</span>
				<label className="flex min-h-8 cursor-pointer items-center gap-1.5">
					<input type="checkbox" checked={v.filters.changedOnly} onChange={(e) => v.set({ changedOnly: e.target.checked })} />
					Only what I changed ({v.changes.length})
				</label>
				<span className="flex items-center gap-1">
					<span aria-hidden className="inline-block h-0.5 w-3 rounded-full bg-sky-400/70" /> GoodWatch's score
				</span>
			</p>
			{v.groups.map((g) => (
				<section key={g.key} className="[content-visibility:auto] [contain-intrinsic-size:auto_800px]">
					{g.label && (
						<h2 className="sticky top-[var(--nav-header-height,0px)] z-10 -mx-1 flex items-baseline gap-2 bg-gray-950/95 px-1 py-2 text-sm font-black text-white">
							{v.groupBy === "score" ? <span className="text-amber-300">{g.label}</span> : g.label}
							<span className="text-xs font-semibold text-gray-500">
								{g.titles.length} · average {average(g.titles, v.scoreOf)}
							</span>
						</h2>
					)}
					<ul>
						{g.titles.map((t) => {
							const score = v.scoreOf(t)
							const from = original.get(t.key) ?? score
							return <Row key={t.key} t={t} score={score} changedFrom={from !== score ? from : null} onPick={v.rescore} />
						})}
					</ul>
				</section>
			))}
			<ChangeBar changes={v.changes} onUndo={v.undo} />
		</div>
	)
}
