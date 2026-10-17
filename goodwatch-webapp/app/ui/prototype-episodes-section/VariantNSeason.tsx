// PROTOTYPE - throwaway. Round 5, variant N: the open season, stripped to what a member needs. One head line,
// pressable as a whole to close: season and when it aired, Mark and Unmark, the season score (pressing it shows
// every site's score in a small popup, as the hero's chips), close. Then today's rows with short fold lines.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import { displayNumber, displaySeason, episodeLabel } from "~/domain/tracking/machine"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { type Model, type Nav, NumberingNote, Row, ScoreTile, useIsDesktop } from "~/ui/tracking/EpisodeList"
import { formatScore } from "~/ui/details/episode-grid/scale"
import { FloatLayer, useFloat } from "~/ui/details/episode-grid/shared"
import { stickyHeadersBottom } from "~/ui/details/header-height"
import { RatingChipRow } from "~/ui/details/hero/RatingChips"
import { FOCUS, SURFACE, type Season, seasonTitle } from "~/ui/tracking/store"
import { airedRange, gridSeason } from "./SeasonInfo"

const ICON_BUTTON = `flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white lg:h-8 lg:w-8 ${FOCUS}`
const ACTION = `inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold lg:h-8 ${FOCUS}`
const FOLD = `flex h-10 w-full cursor-pointer items-center gap-2 border-t border-white/[0.06] px-3 text-left text-xs tabular-nums text-gray-400 hover:bg-white/[0.05] hover:text-white lg:h-8 ${FOCUS}`

export default function QuietSeason({ nav, model, grid }: { nav: Nav; model: Model; grid: EpisodeGrid | null }) {
	const season = nav.season
	const special = season.number === 0
	const count = model.count(season)
	const float = useFloat()
	const desktop = useIsDesktop()
	const aired = special ? null : airedRange(season, model.today, !desktop)
	const left = count.aired - count.watched
	const scores = gridSeason(grid, season.number)?.scores
	const score = scores?.imdb?.score ?? model.seasonScore(season.number)
	const title = special ? "Specials" : seasonTitle(season.number)
	const stop = (event: { stopPropagation: () => void }) => event.stopPropagation()
	const seasonActions = (
		<>
			{!special && left > 0 && (
				<button
					type="button"
					onClick={(event) => {
						stop(event)
						model.actions.markSeason(season.number)
					}}
					className={`${ACTION} bg-white/10 text-green-300 hover:bg-white/20`}
				>
					<CheckIcon className="h-3.5 w-3.5" />
					Mark season
				</button>
			)}
			{!special && count.watched > 0 && (
				<button
					type="button"
					onClick={(event) => {
						stop(event)
						model.actions.unmarkSeason(season.number)
					}}
					className={`${ACTION} text-pink-300 hover:bg-white/10`}
				>
					Unmark
				</button>
			)}
		</>
	)
	const scoreTrigger = float.trigger(`season-${season.number}`, () => <SiteScores grid={grid} number={season.number} />)
	return (
		<div
			data-season-panel={season.number}
			data-quiet-season
			className={`min-w-0 overflow-hidden rounded-xl border border-white/[0.06] ${SURFACE}`}
		>
			{/* The whole head closes the season; its buttons do their own thing. */}
			<div
				data-season-head
				onClick={nav.close}
				className="flex min-h-12 cursor-pointer items-center gap-1.5 bg-white/[0.04] py-1.5 pl-3 pr-1.5 hover:bg-white/[0.07]"
			>
				<h3 className="min-w-0 flex-1 truncate text-sm">
					<span className="font-bold text-white">{title}</span>
					{aired && <span className="text-gray-400"> · {aired}</span>}
				</h3>
				{desktop && seasonActions}
				{!special && score != null && (
					<button
						type="button"
						aria-label={`Season score ${formatScore(score)}. Show every site's score`}
						{...scoreTrigger}
						onClick={(event) => {
							stop(event)
							scoreTrigger.onClick(event)
						}}
						className={`flex h-10 shrink-0 cursor-pointer items-center rounded-md px-1 hover:bg-white/10 lg:h-8 ${FOCUS} ${float.isOpen(`season-${season.number}`) ? "bg-white/10" : ""}`}
					>
						<ScoreTile score={score} className="h-6 min-w-9 text-[12.5px]" />
					</button>
				)}
				{desktop && <button
					type="button"
					aria-label={`Close ${title}`}
					onClick={(event) => {
						stop(event)
						nav.close()
					}}
					className={ICON_BUTTON}
				>
					<ChevronDownIcon className="h-4 w-4 rotate-180" />
				</button>}
			</div>
			{!desktop && !special && (count.watched > 0 || left > 0) && (
				// On a phone the season's actions get a line of their own, still part of the pressable head.
				<div onClick={nav.close} className="-mt-1.5 flex cursor-pointer justify-start gap-1.5 bg-white/[0.04] px-2 pb-2 hover:bg-white/[0.07]">
					{seasonActions}
				</div>
			)}
			<NumberingNote season={season} model={model} />
			<QuietRows key={season.number} season={season} nav={nav} model={model} limit={8} />
			<FloatLayer state={float.state} topInset={() => stickyHeadersBottom(64)} />
		</div>
	)
}

/** The popup behind the season score: every site's season score, as the hero's chips at the small size. */
function SiteScores({ grid, number }: { grid: EpisodeGrid | null; number: number }) {
	const scores = gridSeason(grid, number)?.scores
	if (!scores) return null
	const num = (v: { score: number } | null | undefined, f: (n: number) => string) => (v ? f(v.score) : null)
	return (
		<div className="flex flex-col gap-2">
			<p className="text-xs font-semibold text-gray-300">{seasonTitle(number)}</p>
			<RatingChipRow
				small
				imdb={num(scores.imdb, (n) => n.toFixed(1))}
				mc={num(scores.metascore, (n) => String(Math.floor(n)))}
				mcUser={num(scores.metacriticUser, (n) => n.toFixed(1))}
				rt={num(scores.tomatometer, (n) => `${Math.floor(n)}%`)}
				rtUser={num(scores.popcornmeter, (n) => `${Math.floor(n)}%`)}
			/>
		</div>
	)
}

/** Today's window of rows around the asked-for or Next episode, with "E1–E3" fold lines above and below. */
function QuietRows({ season, nav, model, limit }: { season: Season; nav: Nav; model: Model; limit: number }) {
	const episodes = season.episodes
	const special = season.number === 0
	const target = nav.target
	const root = useRef<HTMLDivElement>(null)
	const indexOf = (id: number | null | undefined) => (id == null ? -1 : episodes.findIndex((e) => e.id === id))
	const around = (i: number): [number, number] => {
		const to = Math.min(episodes.length, Math.max(0, i - 1) + limit)
		return [Math.max(0, to - limit), to]
	}
	const [range, setRange] = useState<[number, number]>(() =>
		around(Math.max(0, indexOf(target?.id) >= 0 ? indexOf(target?.id) : indexOf(model.nextId))),
	)
	const [openId, setOpenId] = useState<number | null>(null)
	const [flash, setFlash] = useState<number | null>(null)
	useEffect(() => {
		const i = indexOf(target?.id)
		if (!target || i < 0) return
		setRange((now) => (i >= now[0] && i < now[1] ? now : around(i)))
		const id = target.id
		const timer = setTimeout(() => {
			const row = root.current?.querySelector<HTMLElement>(`[data-episode="${id}"]`)
			if (!row) return
			if (target.page) row.scrollIntoView({ behavior: "smooth", block: "center" })
			else if (!target.quiet) row.scrollIntoView({ block: "nearest" })
			if (target.focus) row.querySelector<HTMLElement>("[data-row]")?.focus({ preventScroll: true })
			if (!target.quiet) setFlash(id)
		}, 40)
		return () => clearTimeout(timer)
	}, [target?.at])
	useEffect(() => {
		if (flash === null) return
		const timer = setTimeout(() => setFlash(null), 1600)
		return () => clearTimeout(timer)
	}, [flash])
	const [from, to] = range
	const name = (i: number) =>
		displaySeason(episodes[i]) < 0 ? episodeLabel(episodes[i]) : `E${displayNumber(episodes[i])}`
	const span = (a: number, b: number) => (special ? `${b - a + 1} more` : a === b ? name(a) : `${name(a)}–${name(b)}`)
	return (
		<div ref={root} data-rows={season.number}>
			{/* Rows here: tick, number, name, score; the air date only on a wide screen, no chevron. */}
			<style>
				{
					"[data-quiet-season] [data-row]>svg{display:none}@media (max-width:1023px){[data-quiet-season] [data-row]>span:last-of-type{display:none}}"
				}
			</style>
			{from > 0 && (
				<button type="button" data-fold="earlier" onClick={() => setRange([Math.max(0, from - limit), to])} className={FOLD}>
					<ChevronDownIcon className="h-3.5 w-3.5 rotate-180" />
					{span(0, from - 1)}
				</button>
			)}
			<ul>
				{episodes.slice(from, to).map((episode) => (
					<Row
						key={episode.id}
						episode={episode}
						model={model}
						open={openId === episode.id}
						onToggle={() => setOpenId(openId === episode.id ? null : episode.id)}
						selected={nav.selected === episode.id}
						flash={flash === episode.id}
					/>
				))}
			</ul>
			{to < episodes.length && (
				<button
					type="button"
					data-fold="later"
					onClick={() => setRange([from, Math.min(episodes.length, to + limit)])}
					className={FOLD}
				>
					<ChevronDownIcon className="h-3.5 w-3.5" />
					{span(to, episodes.length - 1)}
				</button>
			)}
		</div>
	)
}
