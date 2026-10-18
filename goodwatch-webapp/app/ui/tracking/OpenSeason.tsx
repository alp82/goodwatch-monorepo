// An opened season of the episode list (#699), under its row of the ratings grid. The head is one pressable line
// that closes the season: its name and when it aired, Mark season and Unmark season, and the season score, which
// opens every site's season score as the hero's rating chips. On a phone the two season actions take a line of
// their own, half the width each. Then the season's rows.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { ScoreTile } from "~/ui/details/episode-grid/ScoreTile"
import { formatScore } from "~/ui/details/episode-grid/scale"
import { FloatLayer, useFloat } from "~/ui/details/episode-grid/shared"
import { stickyHeadersBottom } from "~/ui/details/header-height"
import { RatingChipRow } from "~/ui/details/hero/RatingChips"
import { type Model, type Nav, Rows, useIsDesktop } from "./EpisodeList"
import { FOCUS, SURFACE, type Season, seasonTitle } from "./store"

// The site bar above the sticky title header.
const SITE_BAR_HEIGHT = 64
const ACTION = `inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:pointer-events-none disabled:opacity-35 lg:h-8 ${FOCUS}`
const MARK = `${ACTION} bg-white/10 text-green-300 hover:bg-white/20`
const UNMARK = `${ACTION} text-pink-300 hover:bg-white/10`

const MONTH = new Intl.DateTimeFormat("en", {
	month: "short",
	year: "numeric",
	timeZone: "UTC",
})
const YEAR = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "UTC" })

/** When a season aired: "Sep 2006 – May 2007", "2016", or "Oct 2026 – airing"; years only when `short`. */
export function airedRange(
	season: Season,
	today: string,
	short = false,
): string | null {
	const dates = season.episodes
		.map((episode) => episode.airDate)
		.filter((day): day is string => !!day)
		.sort()
	if (!dates.length) return null
	const format = (day: string) =>
		(short ? YEAR : MONTH).format(new Date(`${day}T00:00:00Z`))
	const first = format(dates[0])
	const lastDay = dates[dates.length - 1]
	if (lastDay > today) return `${first} – airing`
	const last = format(lastDay)
	return first === last ? first : `${first} – ${last}`
}

export default function OpenSeason({
	nav,
	model,
	grid,
}: {
	nav: Nav
	model: Model
	/** The ratings grid's data, for every site's season score; null for a show without one. */
	grid: EpisodeGrid | null
}) {
	const season = nav.season
	const special = season.number === 0
	const count = model.count(season)
	const left = count.aired - count.watched
	const desktop = useIsDesktop()
	const float = useFloat()
	const aired = special ? null : airedRange(season, model.today, !desktop)
	const sites = grid?.seasons.find(
		(each) => each.number === season.number,
	)?.scores
	const score = sites?.imdb?.score ?? model.seasonScore(season.number)
	const title = special ? "Specials" : seasonTitle(season.number)
	const scoreTrigger = float.trigger(`season-${season.number}`, () => (
		<SiteScores number={season.number} scores={sites ?? null} score={score} />
	))
	// The head closes the season; its buttons do only their own thing.
	const own = (event: { stopPropagation: () => void }) =>
		event.stopPropagation()
	const mark = (
		<button
			type="button"
			data-mark-season
			disabled={left === 0}
			onClick={(event) => {
				own(event)
				model.actions.markSeason(season.number)
			}}
			className={MARK}
		>
			<CheckIcon className="h-3.5 w-3.5" />
			Mark season
		</button>
	)
	const unmark = (
		<button
			type="button"
			data-unmark-season
			disabled={count.watched === 0}
			onClick={(event) => {
				own(event)
				model.actions.unmarkSeason(season.number)
			}}
			className={`${UNMARK} ${desktop ? "" : "bg-white/[0.06]"}`}
		>
			{desktop ? "Unmark" : "Unmark season"}
		</button>
	)
	return (
		<div
			data-season-panel={season.number}
			className={`min-w-0 overflow-hidden rounded-xl border border-white/[0.06] ${SURFACE}`}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: the close button in the head is the keyboard's way */}
			<div
				data-season-head
				onClick={nav.close}
				className="cursor-pointer bg-white/[0.04] hover:bg-white/[0.07]"
			>
				<div className="flex min-h-12 items-center gap-1.5 py-1.5 pl-3 pr-1.5">
					<h3 className="min-w-0 flex-1 truncate text-sm">
						<span className="font-bold text-white">{title}</span>
						{aired && <span className="text-gray-400"> · {aired}</span>}
					</h3>
					{desktop && !special && (
						<>
							{left > 0 && mark}
							{count.watched > 0 && unmark}
						</>
					)}
					{!special && score != null && (
						<button
							type="button"
							data-season-score
							aria-label={`Season score ${formatScore(score)}. Show every site's score`}
							{...scoreTrigger}
							onClick={(event) => {
								own(event)
								scoreTrigger.onClick(event)
							}}
							className={`flex h-10 shrink-0 cursor-pointer items-center rounded-md px-1 hover:bg-white/10 lg:h-8 ${FOCUS} ${float.isOpen(`season-${season.number}`) ? "bg-white/10" : ""}`}
						>
							<ScoreTile score={score} className="h-6 min-w-9 text-[12.5px]" />
						</button>
					)}
					<button
						type="button"
						aria-label={`Close ${title}`}
						onClick={(event) => {
							own(event)
							nav.close()
						}}
						// A phone presses the whole head to close; the arrow is for a pointer and the keyboard.
						className={`h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white ${desktop ? "flex" : "sr-only"} ${FOCUS}`}
					>
						<ChevronDownIcon className="h-4 w-4 rotate-180" />
					</button>
				</div>
				{!desktop && !special && (
					// Both actions are always in place, a button with nothing to do dimmed, so nothing moves.
					<div className="grid grid-cols-2 gap-2 px-2.5 pb-3">
						{mark}
						{unmark}
					</div>
				)}
			</div>
			<Rows
				key={season.number}
				season={season}
				nav={nav}
				model={model}
				limit={8}
			/>
			<FloatLayer
				state={float.state}
				topInset={() => stickyHeadersBottom(SITE_BAR_HEIGHT)}
			/>
		</div>
	)
}

/** Behind the season score: every site's season score, as the hero's rating chips at their small size. */
function SiteScores({
	number,
	scores,
	score,
}: {
	number: number
	scores: EpisodeGrid["seasons"][number]["scores"] | null
	/** IMDb's season score, for a show whose grid has no row for this season. */
	score: number | null
}) {
	const value = (
		entry: { score: number } | null | undefined,
		format: (n: number) => string,
	) => (entry ? format(entry.score) : null)
	return (
		<div className="flex flex-col gap-2">
			<p className="text-xs font-semibold text-gray-300">
				{seasonTitle(number)}
			</p>
			<RatingChipRow
				small
				imdb={
					value(scores?.imdb, (n) => n.toFixed(1)) ??
					(score == null ? null : score.toFixed(1))
				}
				mc={value(scores?.metascore, (n) => String(Math.floor(n)))}
				mcUser={value(scores?.metacriticUser, (n) => n.toFixed(1))}
				rt={value(scores?.tomatometer, (n) => `${Math.floor(n)}%`)}
				rtUser={value(scores?.popcornmeter, (n) => `${Math.floor(n)}%`)}
			/>
		</div>
	)
}
