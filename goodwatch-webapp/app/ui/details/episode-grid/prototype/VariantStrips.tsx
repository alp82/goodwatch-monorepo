// PROTOTYPE (#153) variant C, "Season strips": small multiples. Each season is a line with
// its scores from every site and a bar per episode, where the height and the colour both
// show the IMDb rating (5 at the floor, 10 at the top). Only the best and the worst episode
// carry a number; tap or point at a bar for the rest. Nothing scrolls sideways: bars share
// the width, and long shows show ten seasons until asked for more.
import { useState } from "react"
import type { GridEpisode, GridSeason, GridSpecial } from "~/server/episode-grid.server"
import type { GridVariantProps } from "~/ui/details/episode-grid/EpisodeGridSection"
import { PROVIDERS, cellColors, formatCount, formatScore, formatVotesShort } from "~/ui/details/episode-grid/scale"
import {
	EpisodeReadout,
	ProviderMark,
	type Selection,
	ScoreLegend,
	episodeSlots,
	isLowVotes,
	providerTitle,
	selectionLabel,
} from "~/ui/details/episode-grid/shared"

const FLOOR = 5
const HEIGHT = 64
const SEASONS_SHOWN = 10

const barHeight = (score: number) => Math.max(4, ((Math.max(score, FLOOR) - FLOOR) / (10 - FLOOR)) * HEIGHT)

function Bars({
	season,
	items,
	selection,
	onSelect,
}: {
	season: number | null
	items: { key: string | number; episode: GridEpisode | GridSpecial | null }[]
	selection: Selection | null
	onSelect: (s: Selection) => void
}) {
	const rated = items.flatMap((i) => (i.episode ? [i.episode] : []))
	const best = rated.reduce<GridEpisode | GridSpecial | null>((a, e) => (!a || e.score > a.score ? e : a), null)
	const worst = rated.reduce<GridEpisode | GridSpecial | null>((a, e) => (!a || e.score < a.score ? e : a), null)
	return (
		<div className="relative" style={{ height: HEIGHT + 16 }}>
			{/* reference lines at 7 and 9 */}
			{[7, 9].map((v) => (
				<span key={v} aria-hidden="true" className="absolute inset-x-0 border-t border-white/[0.07]" style={{ bottom: barHeight(v) }} />
			))}
			<div className="absolute inset-x-0 bottom-0 flex items-end gap-[2px]" style={{ height: HEIGHT + 16 }}>
				{items.map(({ key, episode }) => {
					if (!episode)
						return (
							<span key={key} className="flex h-full min-w-0 flex-1 items-end" title="Not rated">
								<span className="block h-1 w-full rounded-full bg-white/10" />
								<span className="sr-only">Not rated</span>
							</span>
						)
					const colors = cellColors(episode.score)
					const low = isLowVotes(episode.votes)
					const value = { season, episode }
					const selected = selection?.episode === episode
					const labelled = episode === best || (episode === worst && worst !== best)
					return (
						<button
							key={key}
							type="button"
							aria-label={selectionLabel(value)}
							onMouseEnter={() => onSelect(value)}
							onFocus={() => onSelect(value)}
							onClick={() => onSelect(value)}
							className="group flex h-full min-w-0 max-w-8 flex-1 flex-col items-center justify-end focus-visible:outline-2 focus-visible:outline-white"
						>
							{(labelled || selected) && (
								<span className="mb-0.5 text-[10px] font-semibold leading-none tabular-nums text-gray-100">{formatScore(episode.score)}</span>
							)}
							<span
								className={`block w-full rounded-t-[3px] ${selected ? "outline-2 outline-white" : "group-hover:brightness-110"}`}
								style={{
									height: barHeight(episode.score),
									...(low ? { boxShadow: `inset 0 0 0 2px ${colors.background}` } : { background: colors.background }),
								}}
							/>
						</button>
					)
				})}
			</div>
		</div>
	)
}

function SeasonScores({ season }: { season: GridSeason }) {
	const imdb = season.scores.imdb
	const others = (Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).filter((p) => p !== "imdb" && season.scores[p])
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
			{imdb && (
				<span className="flex items-center gap-2" title={providerTitle("imdb", imdb)}>
					<span className="rounded-md px-2 py-0.5 text-lg font-bold tabular-nums" style={cellColors(imdb.score)}>
						{formatScore(imdb.score)}
					</span>
					{imdb.count && <span className="text-xs text-gray-400">{formatVotesShort(imdb.count)} votes</span>}
				</span>
			)}
			{others.map((p) => {
				const value = season.scores[p]
				if (!value) return null
				return (
					<span key={p} className="flex items-center gap-1" title={providerTitle(p, value)}>
						<ProviderMark provider={p} label />
						<span className="text-sm font-semibold tabular-nums text-gray-100">{PROVIDERS[p].format(value.score)}</span>
					</span>
				)
			})}
		</div>
	)
}

export default function VariantStrips({ grid }: GridVariantProps) {
	const [selection, setSelection] = useState<Selection | null>(null)
	const [showAll, setShowAll] = useState(false)
	const seasons = showAll ? grid.seasons : grid.seasons.slice(0, SEASONS_SHOWN)

	return (
		<div>
			<div className="mb-4">
				<ScoreLegend />
			</div>
			<ol className="flex flex-col divide-y divide-white/8 rounded-2xl border border-white/8 bg-white/4">
				{seasons.map((season) => {
					const slots = episodeSlots(season.episodes, season.episodes[0].number === 0 ? 0 : 1, season.maxEpisodeNumber)
					const inSeason = selection && selection.season === season.number ? selection : null
					return (
						<li key={season.number} className="grid gap-3 p-4 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-6">
							<div>
								<h3 className="text-base font-semibold text-gray-100">Season {season.number}</h3>
								<p className="mb-2 text-xs text-gray-400">
									{season.episodes.length} rated episode{season.episodes.length === 1 ? "" : "s"}
								</p>
								<SeasonScores season={season} />
							</div>
							<div>
								<Bars
									season={season.number}
									items={slots.map(({ number, episode }) => ({ key: number, episode }))}
									selection={selection}
									onSelect={setSelection}
								/>
								{inSeason && <EpisodeReadout selection={inSeason} placeholder="" className="mt-2" />}
							</div>
						</li>
					)
				})}
				{grid.specials.length > 0 && (showAll || grid.seasons.length <= SEASONS_SHOWN) && (
					<li className="grid gap-3 p-4 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-6">
						<div>
							<h3 className="text-base font-semibold text-gray-100">Specials</h3>
							<p className="text-xs text-gray-400">
								{grid.specials.length} rated, counted in no season. {formatCount(grid.specials.reduce((s, e) => s + e.votes, 0))} votes.
							</p>
						</div>
						<div>
							<Bars season={null} items={grid.specials.map((episode, i) => ({ key: i, episode }))} selection={selection} onSelect={setSelection} />
							{selection?.season === null && <EpisodeReadout selection={selection} placeholder="" className="mt-2" />}
						</div>
					</li>
				)}
			</ol>
			{grid.seasons.length > SEASONS_SHOWN && (
				<button
					type="button"
					onClick={() => setShowAll((v) => !v)}
					className="mt-3 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-white/10"
				>
					{showAll ? `Show the first ${SEASONS_SHOWN} seasons` : `Show all ${grid.seasons.length} seasons${grid.specials.length ? " and specials" : ""}`}
				</button>
			)}
		</div>
	)
}
