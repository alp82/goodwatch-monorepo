// PROTOTYPE - throwaway (episodes section, round 4). A season's facts at the top of its opened rows: when it
// aired and how each site scores it (today's grid shows the same scores in the season label's popup).
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { ProviderLogo } from "~/ui/details/episode-grid/shared"
import { PROVIDERS, describeProviderScore } from "~/ui/details/episode-grid/scale"
import type { Season } from "~/ui/tracking/store"

const MONTH = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" })
const YEAR = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "UTC" })

/** "Sep 2006 – May 2007", "2016", or "Oct 2026 – airing". */
export function airedRange(season: Season, today: string, short = false): string | null {
	const dates = season.episodes.map((e) => e.airDate).filter((d): d is string => !!d).sort()
	if (!dates.length) return null
	const fmt = (d: string) => (short ? YEAR : MONTH).format(new Date(`${d}T00:00:00Z`))
	const first = fmt(dates[0])
	const lastDate = dates[dates.length - 1]
	if (lastDate > today) return `${first} – airing`
	const last = fmt(lastDate)
	return first === last ? first : `${first} – ${last}`
}

export function gridSeason(grid: EpisodeGrid | null, number: number) {
	return grid?.seasons.find((s) => s.number === number) ?? null
}

/** The sites' season scores as a row of logo and number pairs; the full wording is in each pair's title. */
export function SeasonScores({ grid, number, max }: { grid: EpisodeGrid | null; number: number; max?: number }) {
	const season = gridSeason(grid, number)
	if (!season || !grid) return null
	const rows = grid.providers.flatMap((p) => {
		const value = season.scores[p]
		return value ? [{ p, value }] : []
	})
	if (!rows.length) return null
	return (
		<ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
			{rows.slice(0, max).map(({ p, value }) => (
				<li key={p} title={describeProviderScore(p, value)} className="inline-flex items-center gap-1.5">
					<ProviderLogo provider={p} />
					{(PROVIDERS[p].site === "rotten" || PROVIDERS[p].site === "metacritic") && (
						<span className="text-[11px] text-gray-400">{PROVIDERS[p].short}</span>
					)}
					<span className="text-sm font-semibold tabular-nums text-white">{PROVIDERS[p].format(value.score)}</span>
				</li>
			))}
		</ul>
	)
}

/** One block: "Aired Sep 2006 – May 2007 · 22 episodes", then the sites' scores. */
export default function SeasonInfo({ season, grid, today }: { season: Season; grid: EpisodeGrid | null; today: string }) {
	const aired = airedRange(season, today)
	return (
		<div data-season-info={season.number} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/[0.06] px-3 py-2.5">
			<p className="text-xs text-gray-400">
				{aired && <>Aired <span className="text-gray-200">{aired}</span> · </>}
				{season.episodes.length} episodes
			</p>
			<SeasonScores grid={grid} number={season.number} />
		</div>
	)
}
