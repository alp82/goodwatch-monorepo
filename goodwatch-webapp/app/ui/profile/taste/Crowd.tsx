// "You vs the crowd": the hot takes, extended (the You vs everyone view of /taste). A summary, the titles rated far
// above and below the GoodWatch score after the member's usual generosity, and where whole attributes and genres part
// with the crowd.
import { Link } from "@remix-run/react"
import { useState } from "react"
import type { EveryoneGap as Gap } from "~/server/taste-portrait/view"
import { PosterImg, count } from "../parts"
import {
	type CrowdRow,
	type Kind,
	type ProfileTaste,
	signed,
	useTaste,
} from "./model"
import { PANEL, Pills, SectionHead } from "./parts"

/** The summary's lines, written to "you". */
function summaryOf(c: ProfileTaste["crowd"]) {
	const lines: string[] = []
	const genres = [...c.genres].sort((a, b) => b.delta - a.delta)
	const attributes = [...c.attributes].sort((a, b) => b.delta - a.delta)
	if (genres[0] && genres[0].delta > 0)
		lines.push(
			`You rate ${genres[0].name} ${genres[0].delta.toFixed(1)} points higher than the crowd (${genres[0].count} titles).`,
		)
	const low = genres[genres.length - 1]
	if (low && low.delta < 0)
		lines.push(
			`You rate ${low.name} ${Math.abs(low.delta).toFixed(1)} points lower than the crowd (${low.count} titles).`,
		)
	if (attributes[0] && attributes[0].delta > 0) {
		const down = attributes[attributes.length - 1]
		lines.push(
			down && down.delta < 0
				? `${attributes[0].name} lifts your scores most against the crowd; ${down.name.toLowerCase()} drags them down.`
				: `${attributes[0].name} lifts your scores most against the crowd.`,
		)
	}
	lines.push(
		`${Math.abs(c.offset) < 0.1 ? "Overall your scores sit right in line with the GoodWatch score" : `Overall you score ${Math.abs(c.offset).toFixed(1)} points ${c.offset > 0 ? "above" : "below"} the GoodWatch score`}, and agree with it ${c.agreement >= 0.5 ? "often" : c.agreement >= 0.25 ? "about half the time" : "rarely"} (${count(c.counted)} ratings).`,
	)
	return lines
}

type Filter = "all" | Kind
const KIND_LABEL: Record<Kind, string> = {
	movie: "Movie",
	show: "Show",
	anime: "Anime",
}

export function Crowd() {
	const { taste, owner, handle } = useTaste()
	const [filter, setFilter] = useState<Filter>("all")
	const c = taste.crowd
	if (c.status !== "ready" || c.higher.length + c.lower.length === 0)
		return null
	const keep = (r: CrowdRow) => filter === "all" || r.kind === filter
	const n = (k: Filter) =>
		[...c.higher, ...c.lower].filter((r) => k === "all" || r.kind === k).length
	return (
		<section aria-labelledby="crowd" className="flex flex-col gap-5">
			<SectionHead
				id="crowd"
				eyebrow="Hot takes"
				lead={owner ? "You vs the" : `@${handle} vs the`}
				accent="crowd"
				sub={`Where ${owner ? "your" : "their"} scores stand apart from the GoodWatch score, after ${owner ? "your" : "their"} usual generosity. ${c.headline}.`}
				right={
					<Pills
						label="Show"
						value={filter}
						onChange={setFilter}
						options={[
							{ value: "all", label: "All", count: n("all") },
							{ value: "movie", label: "Movies", count: n("movie") },
							{ value: "show", label: "Shows", count: n("show") },
							{ value: "anime", label: "Anime", count: n("anime") },
						]}
					/>
				}
			/>
			<div className={`${PANEL} p-4 sm:p-5`}>
				<p className="mb-2 text-xs font-bold tracking-[0.16em] text-gray-500 uppercase">
					Taste summary
				</p>
				<ul className="flex flex-col gap-1.5 text-sm text-gray-300">
					{summaryOf(c).map((line) => (
						<li key={line} className="flex gap-2">
							<span
								aria-hidden
								className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400"
							/>
							{owner ? line : theirs(line)}
						</li>
					))}
				</ul>
			</div>
			<TakePanel
				tone="up"
				title="Rated higher than the crowd"
				word="Underrated"
				rows={c.higher.filter(keep)}
				owner={owner}
			/>
			<TakePanel
				tone="down"
				title="Rated lower than the crowd"
				word="Overrated"
				rows={c.lower.filter(keep)}
				owner={owner}
			/>
			{(c.attributes.length > 0 || c.genres.length > 0) && (
				<div className="grid gap-4 lg:grid-cols-2">
					{c.attributes.length > 0 && (
						<GapBars
							title="Attributes"
							note="Average gap on titles strong in it"
							gaps={c.attributes}
						/>
					)}
					{c.genres.length > 0 && (
						<GapBars
							title="Genres"
							note="Average gap per genre"
							gaps={c.genres}
						/>
					)}
				</div>
			)}
		</section>
	)
}

const theirs = (line: string) =>
	line
		.replace(/^You're/, "They're")
		.replace(/^You /, "They ")
		.replace(/your /g, "their ")
		.replace(/ you /g, " they ")

function TakePanel({
	tone,
	title,
	word,
	rows,
	owner,
}: {
	tone: "up" | "down"
	title: string
	word: string
	rows: CrowdRow[]
	owner: boolean
}) {
	const { title: tt } = useTaste()
	const [shown, setShown] = useState(8)
	const up = tone === "up"
	const biggest = rows[0]?.delta ?? 0
	return (
		<div
			className={`relative overflow-hidden rounded-2xl p-4 ring-1 sm:p-5 ${up ? "bg-emerald-500/[0.06] ring-emerald-400/25" : "bg-rose-500/[0.06] ring-rose-400/25"}`}
		>
			<span
				aria-hidden
				className={`pointer-events-none absolute top-2 right-4 hidden text-6xl font-black tracking-tight uppercase select-none md:block ${up ? "text-emerald-400/[0.08]" : "text-rose-400/[0.08]"}`}
			>
				{word}
			</span>
			<div className="relative mb-4 flex items-center gap-4">
				<span
					className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 ring-1 ${up ? "text-emerald-300 ring-emerald-400/50" : "text-rose-300 ring-rose-400/50"}`}
				>
					<span className="text-2xl font-black tabular-nums">
						{signed(biggest)}
					</span>
					<span className="text-[10px] font-bold tracking-wider uppercase opacity-70">
						biggest gap
					</span>
				</span>
				<span>
					<span className="block text-lg font-bold text-white">{title}</span>
					<span className="block text-xs text-gray-400">
						{owner ? "Your" : "Their"} score against the GoodWatch score, in
						points out of 10
					</span>
				</span>
			</div>
			{rows.length ? (
				<ul className="relative grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
					{rows.slice(0, shown).map((r, i) => {
						const t = tt(r.key)
						return (
							// Phones start with 4; the first Show more reveals the rest of the 8.
							<li
								key={r.key}
								className={`min-w-0 ${shown === 8 && i >= 4 ? "max-sm:hidden" : ""}`}
							>
								<Link
									to={t.href}
									className="flex items-center gap-3 rounded-xl bg-gray-950/50 p-2 ring-1 ring-white/10 hover:bg-gray-950/80"
								>
									<span className="block w-10 shrink-0">
										<PosterImg title={t} className="rounded" />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold text-gray-100">
											{t.title}
										</span>
										<span className="block text-[11px] text-gray-500">
											{t.year} · {KIND_LABEL[r.kind]}
										</span>
										<span className="block text-xs text-gray-400">
											<b className="text-amber-300">★ {r.mine}</b> vs{" "}
											{(r.everyone / 10).toFixed(1)}
										</span>
									</span>
									<span
										className={`shrink-0 text-sm font-black tabular-nums ${up ? "text-emerald-400" : "text-rose-400"}`}
									>
										{signed(r.delta)}
									</span>
								</Link>
							</li>
						)
					})}
				</ul>
			) : (
				<p className="text-sm text-gray-500">None in this filter.</p>
			)}
			{rows.length > shown && (
				<button
					type="button"
					onClick={() => setShown((s) => s + 8)}
					className="relative mt-3 min-h-9 rounded-full px-4 text-sm font-semibold text-gray-300 ring-1 ring-white/15 hover:text-white"
				>
					Show more ({rows.length - shown})
				</button>
			)}
		</div>
	)
}

function GapBars({
	title,
	note,
	gaps,
}: { title: string; note: string; gaps: Gap[] }) {
	const max = Math.max(0.5, ...gaps.map((g) => Math.abs(g.delta)))
	const sorted = [...gaps].sort((a, b) => b.delta - a.delta)
	return (
		<div className={`${PANEL} p-4 sm:p-5`}>
			<p className="font-bold text-white">{title}</p>
			<p className="mb-3 text-xs text-gray-500">{note}</p>
			<ul className="flex flex-col gap-1.5">
				{sorted.map((g) => (
					<li
						key={g.id}
						className="grid grid-cols-[8rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-sm sm:grid-cols-[10rem_1fr_3rem]"
					>
						<span className="truncate text-gray-300">
							{g.name} <span className="text-xs text-gray-600">{g.count}</span>
						</span>
						<span
							className="relative h-2.5 rounded-full bg-white/[0.06]"
							aria-hidden
						>
							<span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
							<span
								className={`absolute inset-y-0 rounded-full ${g.delta >= 0 ? "bg-emerald-400" : "bg-rose-400"}`}
								style={{
									left:
										g.delta >= 0
											? "50%"
											: `${50 - (Math.abs(g.delta) / max) * 50}%`,
									width: `${(Math.abs(g.delta) / max) * 50}%`,
								}}
							/>
						</span>
						<span
							className={`text-right text-xs font-bold tabular-nums ${g.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}
						>
							{signed(g.delta)}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}
