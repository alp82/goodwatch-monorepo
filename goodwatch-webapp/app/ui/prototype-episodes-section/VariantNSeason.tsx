// PROTOTYPE - throwaway. Round 4, variant N: the open season, stripped to what a member needs. One head line
// (season and when it aired, a ⋯ that folds out the season actions in place, close), the sites' scores, and
// today's rows with short fold lines. No counts, no steppers, no explanations.
import { CheckIcon, ChevronDownIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import { displayNumber, displaySeason, episodeLabel } from "~/domain/tracking/machine"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { type Model, type Nav, NumberingNote, Row } from "~/ui/tracking/EpisodeList"
import { FOCUS, SURFACE, type Season, seasonTitle } from "~/ui/tracking/store"
import { SeasonScores, airedRange } from "./SeasonInfo"

const ICON_BUTTON = `flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white lg:h-8 lg:w-8 ${FOCUS}`
const ACTION = `inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold lg:h-8 ${FOCUS}`
const FOLD = `flex h-10 w-full cursor-pointer items-center gap-2 border-t border-white/[0.06] px-3 text-left text-xs tabular-nums text-gray-400 hover:bg-white/[0.05] hover:text-white lg:h-8 ${FOCUS}`

export default function QuietSeason({ nav, model, grid }: { nav: Nav; model: Model; grid: EpisodeGrid | null }) {
	const season = nav.season
	const special = season.number === 0
	const count = model.count(season)
	const [menu, setMenu] = useState(false)
	useEffect(() => setMenu(false), [season.number])
	const aired = special ? null : airedRange(season, model.today)
	const left = count.aired - count.watched
	return (
		<div
			data-season-panel={season.number}
			data-quiet-season
			className={`min-w-0 overflow-hidden rounded-xl border border-white/[0.06] ${SURFACE}`}
		>
			<div className="flex min-h-11 items-center gap-1 py-1 pl-3 pr-1">
				<h3 className="min-w-0 flex-1 truncate text-sm">
					<span className="font-bold text-white">{special ? "Specials" : seasonTitle(season.number)}</span>
					{aired && <span className="text-gray-400"> · {aired}</span>}
				</h3>
				{!special && (
					<button
						type="button"
						aria-expanded={menu}
						aria-label="Season actions"
						onClick={() => setMenu(!menu)}
						className={`${ICON_BUTTON} ${menu ? "bg-white/10 text-white" : ""}`}
					>
						<EllipsisHorizontalIcon className="h-5 w-5" />
					</button>
				)}
				<button type="button" aria-label={`Close ${seasonTitle(season.number)}`} onClick={nav.close} className={ICON_BUTTON}>
					<ChevronDownIcon className="h-4 w-4 rotate-180" />
				</button>
			</div>
			{menu && (
				<div className="flex flex-wrap justify-end gap-1.5 px-2 pb-2">
					{left > 0 && (
						<button
							type="button"
							onClick={() => {
								model.actions.markSeason(season.number)
								setMenu(false)
							}}
							className={`${ACTION} bg-white/10 text-green-300 hover:bg-white/20`}
						>
							<CheckIcon className="h-3.5 w-3.5" />
							Mark season watched
						</button>
					)}
					{count.watched > 0 && (
						<button
							type="button"
							onClick={() => {
								model.actions.unmarkSeason(season.number)
								setMenu(false)
							}}
							className={`${ACTION} text-pink-300 hover:bg-white/10`}
						>
							Unmark season
						</button>
					)}
				</div>
			)}
			{!special && (
				<div className="px-3 pb-2.5">
					<SeasonScores grid={grid} number={season.number} />
				</div>
			)}
			<NumberingNote season={season} model={model} />
			<QuietRows key={season.number} season={season} nav={nav} model={model} limit={8} />
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
