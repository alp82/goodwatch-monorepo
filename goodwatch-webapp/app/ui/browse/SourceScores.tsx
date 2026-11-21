// A ranking where every title shows each source's own score beside the
// GoodWatch score that sets the rank. One rank size, one row height. From `lg` the sources are columns under one
// header; on a phone they fold under the title and open on tap.
import { Link } from "@remix-run/react"
import { useState } from "react"
import { vibeTextColor } from "~/ui/details/episode-grid/scale"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import { CAPTION } from "~/ui/eyebrow"
import { type BestRow, SOURCE_LABELS, type SourceKey } from "~/domain/browse/types"
import { poster } from "~/ui/browse/base"

const SHORT: Record<SourceKey, string> = {
	imdb: "IMDb",
	rtCritics: "RT critics",
	rtAudience: "RT fans",
	metacritic: "Metacritic",
	metacriticUsers: "MC users",
	letterboxd: "Letterboxd",
}
const ORDER: SourceKey[] = [
	"imdb",
	"letterboxd",
	"rtCritics",
	"rtAudience",
	"metacritic",
	"metacriticUsers",
]
const scoreColor = (v: number) => vibeTextColor(Math.min(100, Math.max(0, Math.floor(v / 10) * 10)))

/** The sources any of the rows has, in a fixed order. */
const sourcesOf = (rows: BestRow[]) => ORDER.filter((s) => rows.some((r) => r.sources[s] != null))

/** One title's source scores as a quiet line: label over number, colored by the score scale. */
export function SourceScores({
	sources,
	only,
	className = "",
}: {
	sources: Partial<Record<SourceKey, number>>
	only?: SourceKey[]
	className?: string
}) {
	const keys = (only ?? ORDER).filter((s) => sources[s] != null)
	if (!keys.length) return null
	return (
		<dl className={`flex flex-wrap gap-x-5 gap-y-2 ${className}`}>
			{keys.map((s) => (
				<div key={s}>
					<dt className="text-[11px] font-medium text-gray-500">{SHORT[s]}</dt>
					<dd
						className="text-base leading-tight font-bold tabular-nums"
						style={{ color: scoreColor(sources[s] as number) }}
						title={`${SOURCE_LABELS[s]}: ${sources[s]} of 100`}
					>
						{sources[s]}
					</dd>
				</div>
			))}
		</dl>
	)
}

const COLS = "lg:grid-cols-[2.75rem_3rem_minmax(0,1fr)_var(--src)_5.75rem]"

function Row({ row, cols }: { row: BestRow; cols: SourceKey[] }) {
	const [open, setOpen] = useState(false)
	const t = row.title
	const has = cols.some((s) => row.sources[s] != null)
	return (
		<li className="group/row border-b border-white/[0.07] transition-colors hover:bg-white/[0.035]">
			<div
				className={`grid grid-cols-[2rem_2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-2 py-2.5 ${COLS} lg:gap-x-4`}
			>
				<span className="text-right font-display text-xl font-bold text-gray-500 tabular-nums group-hover/row:text-gray-300">
					{row.rank}
				</span>
				<Link
					to={t.to}
					prefetch="intent"
					tabIndex={-1}
					aria-hidden
					className="block overflow-hidden rounded-[5px] bg-gray-800 ring-1 ring-white/10"
				>
					{t.card.poster_path && (
						<img
							src={poster(t.card.poster_path, "w92")}
							alt=""
							loading="lazy"
							className="block aspect-[2/3] w-full object-cover"
						/>
					)}
				</Link>
				<div className="min-w-0">
					<Link
						to={t.to}
						prefetch="intent"
						className="block truncate rounded-sm text-base font-semibold text-white outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						{t.card.title}
					</Link>
					<p className="truncate text-sm text-gray-400">
						{t.card.release_year}
						{row.genres.length > 0 && ` · ${row.genres.slice(0, 2).join(", ")}`}
					</p>
				</div>
				<div
					className="hidden items-center lg:grid"
					style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
				>
					{cols.map((s) => (
						<span
							key={s}
							className="text-center text-[15px] font-bold tabular-nums"
							style={
								row.sources[s] != null ? { color: scoreColor(row.sources[s] as number) } : undefined
							}
							title={
								row.sources[s] != null
									? `${SOURCE_LABELS[s]}: ${row.sources[s]} of 100`
									: `${SOURCE_LABELS[s]}: no score`
							}
						>
							{row.sources[s] ?? <span className="font-normal text-gray-700">·</span>}
						</span>
					))}
				</div>
				<div className="flex items-center justify-end gap-1.5">
					<ScorePill
						goodwatch={t.card.goodwatch_overall_score_normalized_percent}
						score={null}
						mark={null}
						size="M"
					/>
					{has && (
						<button
							type="button"
							onClick={() => setOpen((o) => !o)}
							aria-expanded={open}
							aria-label={`${open ? "Hide" : "Show"} each source's score for ${t.card.title}`}
							className="grid h-8 w-8 place-items-center rounded-full text-gray-400 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 lg:hidden"
						>
							<svg
								viewBox="0 0 20 20"
								className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
								aria-hidden
							>
								<path
									d="M5 7.5 10 12.5 15 7.5"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</button>
					)}
				</div>
			</div>
			{open && (
				<SourceScores
					sources={row.sources}
					only={cols}
					className="px-2 pb-3 pl-[5.6rem] lg:hidden"
				/>
			)}
		</li>
	)
}

/**
 * The ranked rows. The header names each source once; the last column is the GoodWatch score, the blend of the
 * others that sets the rank.
 */
export function BestTable({ rows }: { rows: BestRow[] }) {
	const cols = sourcesOf(rows)
	if (!rows.length) return null
	return (
		<div style={{ ["--src" as string]: `${cols.length * 5.25}rem` }}>
			<div
				style={{ top: "var(--best-head-top, 4rem)" }}
				className={`sticky z-10 hidden items-end gap-x-4 border-b border-white/10 bg-gray-950/85 px-2 py-2 backdrop-blur lg:grid ${COLS}`}
			>
				<span />
				<span />
				<span className={CAPTION}>Title</span>
				<div
					className="grid"
					style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
				>
					{cols.map((s) => (
						<span key={s} className={`${CAPTION} text-center !tracking-[0.06em]`}>
							{SHORT[s]}
						</span>
					))}
				</div>
				<span className={`${CAPTION} text-right !tracking-[0.06em] !text-gray-300`}>GoodWatch</span>
			</div>
			<ol>
				{rows.map((row) => (
					<Row key={row.title.card.key} row={row} cols={cols} />
				))}
			</ol>
		</div>
	)
}
