// Chapter 6, tropes and title analysis: the common tropes as chips in three size steps (each with its own pixel
// effect), the trope-richest shows, and what title analysis says about shows and movies.
import { Link } from "@remix-run/react"
import type { StatsSnapshot } from "~/domain/stats/snapshot"
import { tropePath } from "~/domain/tropes/destination"
import { TROPE_SPOTS } from "../effects/trope-spots"
import { count, titleHref } from "../format"
import { Chapter, LABEL, PANEL, RankRows, titleRows } from "../parts"

export function Tropes({ s }: { s: StatsSnapshot }) {
	const t = s.tropes
	const most = t.top[0]?.titles ?? 1
	const step = (n: number) =>
		n / most > 0.8
			? "text-xl px-4 py-2"
			: n / most > 0.5
				? "text-base px-3.5 py-1.5"
				: "text-sm px-3 py-1"
	const moods = [
		["Binge-friendly", t.moods.binge],
		["Comfort watches", t.moods.comfort],
		["Thought-provoking", t.moods.thoughtProvoking],
		["Good in the background", t.moods.background],
	] as const
	return (
		<Chapter
			id="tropes"
			n={6}
			name="Tropes and title analysis"
			lead="Our titles carry"
			accent={`${count(t.distinct)} tropes`}
			tail="between them."
			sub={`${count(t.mentions)} trope mentions in all. Title analysis has read ${count(s.sources.titleAnalysis)} titles for their feel.`}
		>
			<div className={`${PANEL} p-4 sm:p-6`}>
				<p className="mb-4 text-sm font-bold text-gray-200">The most common tropes</p>
				<ul className="flex flex-wrap items-center gap-2">
					{t.top.map((x) => (
						<li key={x.url}>
							<Link
								to={tropePath(x.url)}
								prefetch="intent"
								data-fx-spot={TROPE_SPOTS[x.url.split("/").at(-1) ?? ""]}
								className={`inline-flex items-baseline gap-1.5 rounded-full bg-white/[0.06] text-gray-200 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white ${step(x.titles)}`}
							>
								{x.name}
								<b className="text-[0.75em] text-white tabular-nums">{count(x.titles)}</b>
							</Link>
						</li>
					))}
				</ul>
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<RankRows
					heading="Most tropes on one show"
					rows={titleRows(s.records.mostTropes, (x) => `${count(x.tropes)} tropes`).map(
						(row, i) => ({
							...row,
							href: `${titleHref(s.records.mostTropes[i])}/tropes`,
						}),
					)}
				/>
				<div className={`${PANEL} flex flex-col gap-4 p-4`}>
					<p className={LABEL}>Shows, by title analysis</p>
					<dl className="grid grid-cols-2 gap-3">
						{moods.map(([label, n]) => (
							<div key={label} className="flex flex-col">
								<dt className="order-2 text-[11px] text-gray-500">{label}</dt>
								<dd className="text-xl font-black text-white tabular-nums">{count(n)}</dd>
							</div>
						))}
					</dl>
					<p className={LABEL}>Common essence tags, movies</p>
					<ul className="flex flex-wrap gap-1.5">
						{t.essenceTags.map((e) => (
							<li
								key={e.name}
								className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-gray-300 ring-1 ring-white/10"
							>
								{e.name} <b className="text-white tabular-nums">{count(e.titles)}</b>
							</li>
						))}
					</ul>
				</div>
			</div>
		</Chapter>
	)
}
