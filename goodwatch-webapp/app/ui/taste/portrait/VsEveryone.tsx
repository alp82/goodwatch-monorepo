// You vs everyone: the titles the member rates far above and below the GoodWatch score, after their usual generosity,
// then where they part ways by genre and by trait. Movies, Shows or All; a filter never moves the page: every slot
// keeps the height of the unfiltered row it holds, and an emptied slot holds that row, invisible.
import { Link } from "@remix-run/react"
import { useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { DISPLAY } from "~/ui/my-pages/bits"
import { PosterImg, backdropUrl } from "~/ui/profile/parts"
import {
	type CrowdRow,
	type TasteTitle,
	signed,
	useTaste,
} from "~/ui/profile/taste/model"
import { Pills } from "~/ui/profile/taste/parts"
import { YourScore, vibe } from "../tabs/parts"
import { type GapRow, gapRows } from "./gaps"

const PAGE = 8
const MOST = 30

type Kind = "all" | "movie" | "show"
const KIND_WORD: Record<Exclude<Kind, "all">, string> = {
	movie: "movies",
	show: "shows",
}

function Ring({
	gw,
	size,
	label = false,
}: { gw: number | null; size: number; label?: boolean }) {
	return (
		<ScoreRing
			media={
				{
					details: { goodwatch_overall_score_normalized_percent: gw },
				} as Parameters<typeof ScoreRing>[0]["media"]
			}
			size={size}
			label={label}
		/>
	)
}

/** A row's gap in GoodWatch points. */
const points = (r: CrowdRow) => Math.round(r.delta * 10)

export function VsEveryone() {
	const { taste, title, attributeByKey } = useTaste()
	const c = taste.crowd
	const [kind, setKind] = useState<Kind>("all")
	const [n, setN] = useState(PAGE)
	if (c.status !== "ready" || c.higher.length + c.lower.length === 0)
		return null
	const typeOf = (r: CrowdRow) => title(r.key).mediaType
	const keep = (r: CrowdRow) => kind === "all" || typeOf(r) === kind
	const count = (k: Kind) =>
		[...c.higher, ...c.lower].filter((r) => k === "all" || typeOf(r) === k)
			.length
	const gaps = gapRows(c.gapGroups, (id) => {
		const a = attributeByKey.get(id)
		return a ? { label: a.label, emoji: a.emoji } : null
	})
	const more = n < MOST && (c.higher.length > n || c.lower.length > n)
	const empty = kind === "all" ? null : `No ${KIND_WORD[kind]} here yet.`

	return (
		<section
			id="everyone"
			aria-labelledby="everyone-head"
			className="scroll-mt-44"
		>
			<p className="mb-1 text-xs font-bold tracking-[0.18em] text-amber-400/80 uppercase">
				Where your scores differ from the GoodWatch score
			</p>
			<h2 id="everyone-head" className={`${DISPLAY} text-3xl sm:text-4xl`}>
				You vs everyone
			</h2>
			<div className="mt-8 flex flex-wrap items-center gap-2">
				<Pills
					label="Show"
					value={kind}
					onChange={setKind}
					options={[
						{ value: "all", label: "All", count: count("all") },
						{ value: "movie", label: "Movies", count: count("movie") },
						{ value: "show", label: "Shows", count: count("show") },
					]}
				/>
				<span className="ml-auto flex items-center gap-4 text-xs text-gray-400">
					<span className="flex items-center gap-1.5">
						<span className="h-3 w-3 rounded-full border-2 border-gray-300" />{" "}
						GoodWatch score
					</span>
					<span className="flex items-center gap-1.5">
						<span className="h-3 w-3 rounded-sm bg-emerald-600" /> Your score
					</span>
				</span>
			</div>

			<div className="mt-8 grid gap-10 md:grid-cols-2">
				<Column
					heading="You rate higher than everyone"
					all={c.higher.slice(0, n)}
					rows={c.higher.filter(keep).slice(0, n)}
					tone="up"
					empty={empty}
				/>
				<Column
					heading="You rate lower than everyone"
					all={c.lower.slice(0, n)}
					rows={c.lower.filter(keep).slice(0, n)}
					tone="down"
					empty={empty}
				/>
			</div>
			{more && (
				<div className="mt-6">
					<button
						type="button"
						onClick={() => setN((x) => Math.min(MOST, x + PAGE))}
						className="min-h-11 cursor-pointer text-sm font-semibold text-amber-300 underline underline-offset-4 md:min-h-0"
					>
						Show more
					</button>
				</div>
			)}

			{(gaps.genres.length > 0 || gaps.traits.length > 0) && (
				<div className="mt-16">
					<h3 className="text-2xl font-bold md:text-3xl">
						Where you part ways
					</h3>
					<p className="mt-1 text-gray-400">
						Your average score against the GoodWatch score, allowing for how
						generous you are with movies and with shows.
					</p>
					<div className="mt-8 grid gap-x-12 gap-y-10 md:grid-cols-2">
						<GapList heading="Genres" rows={gaps.genres} max={gaps.max} />
						<GapList heading="Traits" rows={gaps.traits} max={gaps.max} />
					</div>
				</div>
			)}
		</section>
	)
}

function Column({
	heading,
	all,
	rows,
	tone,
	empty,
}: {
	heading: string
	/** The unfiltered rows on show: each slot keeps the height of the row it holds here. */
	all: CrowdRow[]
	rows: CrowdRow[]
	tone: "up" | "down"
	empty: string | null
}) {
	const { title } = useTaste()
	return (
		<div className="relative min-w-0">
			<h3
				className={`mb-4 text-xl font-bold ${tone === "up" ? "text-emerald-300" : "text-rose-300"}`}
			>
				{heading}
			</h3>
			{rows.length === 0 && empty && (
				<p className="absolute inset-x-0 top-12 text-gray-400">{empty}</p>
			)}
			{all[0] && (
				<div className={rows[0] ? "" : "invisible"} aria-hidden={!rows[0]}>
					<Lead
						row={rows[0] ?? all[0]}
						tone={tone}
						t={title((rows[0] ?? all[0]).key)}
					/>
				</div>
			)}
			<ul className="space-y-3">
				{all.slice(1).map((slot, i) => {
					const row = rows[i + 1]
					return (
						<li
							key={row?.key ?? `slot-${slot.key}`}
							className={row ? "" : "invisible"}
							aria-hidden={!row}
						>
							<Row row={row ?? slot} t={title((row ?? slot).key)} />
						</li>
					)
				})}
			</ul>
		</div>
	)
}

function Lead({
	row,
	tone,
	t,
}: { row: CrowdRow; tone: "up" | "down"; t: TasteTitle }) {
	const backdrop = backdropUrl(t.backdrop, "w780")
	const delta = points(row)
	return (
		<Link
			to={t.href}
			className="relative isolate mb-4 block overflow-hidden rounded-2xl border border-gray-800 hover:border-gray-600"
		>
			{backdrop && (
				<img
					src={backdrop}
					alt=""
					className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
				/>
			)}
			<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-transparent" />
			<div className="flex items-end gap-4 p-4 md:gap-5 md:p-5">
				<span className="w-20 shrink-0 sm:w-28 md:w-32">
					<PosterImg
						title={t}
						className="rounded-lg border-2 border-gray-700"
					/>
				</span>
				<div className="min-w-0 pb-1">
					<p className="text-xl leading-tight font-bold md:text-2xl">
						{t.title}{" "}
						{t.year && (
							<span className="font-normal text-gray-400">({t.year})</span>
						)}
					</p>
					<div className="mt-3 flex flex-wrap items-center gap-3 md:mt-4 md:gap-4">
						<YourScore score={row.mine} size="lg" label="You" />
						<Ring gw={row.everyone} size={48} label />
					</div>
					<p className="mt-3 text-sm text-gray-300">
						{tone === "up"
							? `${delta} points above everyone, after your usual generosity.`
							: `${-delta} points below everyone, after your usual generosity.`}
					</p>
				</div>
			</div>
		</Link>
	)
}

function Row({ row, t }: { row: CrowdRow; t: TasteTitle }) {
	const mine = row.mine * 10
	const lo = Math.min(mine, row.everyone)
	const hi = Math.max(mine, row.everyone)
	return (
		<Link
			to={t.href}
			className="grid grid-cols-[3.5rem_1fr] gap-4 rounded-xl border border-gray-800 bg-gray-950/60 p-2 pr-4 hover:border-gray-600"
		>
			<span className="block w-14">
				<PosterImg title={t} className="aspect-[2/3] rounded-md object-cover" />
			</span>
			<div className="min-w-0 self-center">
				<div className="flex items-center justify-between gap-3">
					<p className="truncate font-semibold">
						{t.title}{" "}
						{t.year && (
							<span className="font-normal text-gray-400">({t.year})</span>
						)}
					</p>
					<span className="flex shrink-0 items-center gap-2">
						<YourScore score={row.mine} size="sm" />
						<Ring gw={row.everyone} size={30} />
					</span>
				</div>
				<div className="relative mt-3 h-4" aria-hidden>
					<span className="absolute inset-x-0 top-1/2 h-px bg-gray-700" />
					<span
						className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25"
						style={{ left: `${lo}%`, width: `${hi - lo}%` }}
					/>
					<span
						className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-300 bg-gray-900"
						style={{ left: `${row.everyone}%` }}
					/>
					<span
						className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm"
						style={{ left: `${mine}%`, background: vibe(row.mine) }}
					/>
				</div>
			</div>
		</Link>
	)
}

function GapList({
	heading,
	rows,
	max,
}: { heading: string; rows: GapRow[]; max: number }) {
	if (!rows.length) return null
	return (
		<div>
			<h4 className="mb-4 text-sm font-bold tracking-wide text-gray-400 uppercase">
				{heading}
			</h4>
			<ul className="flex flex-col gap-3.5">
				{rows.map((gap) => {
					const width = `${Math.min(50, (Math.abs(gap.delta) / max) * 50)}%`
					return (
						<li
							key={gap.id}
							className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-4 text-sm"
						>
							<span className="truncate text-gray-200">
								{gap.emoji && (
									<span aria-hidden className="mr-1.5">
										{gap.emoji}
									</span>
								)}
								{gap.label}
							</span>
							<span className="relative h-2 rounded-full bg-gray-800">
								<span className="absolute inset-y-0 left-1/2 w-px bg-gray-500" />
								<span
									className={`absolute inset-y-0 rounded-full ${gap.delta > 0 ? "bg-emerald-500" : "bg-rose-500"}`}
									style={
										gap.delta > 0
											? { left: "50%", width }
											: { right: "50%", width }
									}
								/>
							</span>
							<span
								className={`text-right font-bold tabular-nums ${gap.delta > 0 ? "text-emerald-400" : "text-rose-400"}`}
							>
								{signed(gap.delta)}
							</span>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
