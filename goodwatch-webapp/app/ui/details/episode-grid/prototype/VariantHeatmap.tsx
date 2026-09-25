// PROTOTYPE (#153) variant A, "Heatmap": the classic grid. One row per season, one cell per
// episode with its score printed inside, and the season scores as columns at the end of
// each row. The grid scrolls sideways inside its own box; the season label stays pinned.
import { useState } from "react"
import type { GridEpisode } from "~/server/episode-grid.server"
import type { GridVariantProps } from "~/ui/details/episode-grid/EpisodeGridSection"
import { PROVIDERS, cellColors, formatScore } from "~/ui/details/episode-grid/scale"
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

const CELL = "h-9 w-11 shrink-0"

function Cell({ season, episode, onSelect, selected }: { season: number | null; episode: GridEpisode | { name: string; score: number; votes: number }; onSelect: (s: Selection) => void; selected: boolean }) {
	const colors = cellColors(episode.score)
	const low = isLowVotes(episode.votes)
	const selection = { season, episode }
	return (
		<button
			type="button"
			aria-label={selectionLabel(selection)}
			onMouseEnter={() => onSelect(selection)}
			onFocus={() => onSelect(selection)}
			onClick={() => onSelect(selection)}
			className={`${CELL} rounded-[4px] text-[13px] font-semibold tabular-nums outline-offset-1 focus-visible:outline-2 focus-visible:outline-white ${selected ? "outline-2 outline-white" : ""}`}
			style={low ? { boxShadow: `inset 0 0 0 2px ${colors.background}`, color: "#e5e7eb" } : { background: colors.background, color: colors.color }}
		>
			{formatScore(episode.score)}
		</button>
	)
}

export default function VariantHeatmap({ grid }: GridVariantProps) {
	const [selection, setSelection] = useState<Selection | null>(null)
	const first = grid.hasEpisodeZero ? 0 : 1
	const providers = grid.providers.filter((p) => p !== "imdb")
	const columns = grid.maxEpisodeNumber - first + 1

	return (
		<div>
			<div className="rounded-2xl border border-white/8 bg-[#141923] p-3 sm:p-4">
				<div className="overflow-x-auto overscroll-x-contain pb-2" tabIndex={-1}>
					<table className="border-collapse [&_td]:p-[1.5px] [&_th]:p-[1.5px]">
						<caption className="sr-only">IMDb rating of every episode, one row per season</caption>
						<thead>
							<tr className="text-[11px] text-gray-400">
								<th scope="col" className="sticky left-0 z-10 w-12 min-w-12 bg-[#141923] text-left font-medium">
									Season
								</th>
								<th scope="col" className="sticky left-12 z-10 bg-[#141923] font-medium shadow-[8px_0_8px_-6px_rgba(0,0,0,0.7)]">
									<ProviderMark provider="imdb" />
								</th>
								{Array.from({ length: columns }, (_, i) => (
									<th key={i} scope="col" className="w-11 font-medium tabular-nums">
										<span className="sr-only">Episode </span>
										{first + i}
									</th>
								))}
								{providers.map((p) => (
									<th key={p} scope="col" className="px-1 font-medium">
										<ProviderMark provider={p} label className="flex-col" />
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{grid.seasons.map((season) => {
								const slots = episodeSlots(season.episodes, first, season.maxEpisodeNumber)
								const imdb = season.scores.imdb
								return (
									<tr key={season.number}>
										<th scope="row" className="sticky left-0 z-10 w-12 min-w-12 bg-[#141923] text-left text-sm font-semibold text-gray-200">
											S{season.number}
										</th>
										<td className="sticky left-12 z-10 bg-[#141923] !pr-2 shadow-[8px_0_8px_-6px_rgba(0,0,0,0.7)]" title={providerTitle("imdb", imdb)}>
											{imdb ? (
												<span
													className="flex h-9 w-12 items-center justify-center rounded-[4px] text-sm font-bold tabular-nums ring-2 ring-[#141923] outline outline-1 outline-white/60"
													style={cellColors(imdb.score)}
												>
													{formatScore(imdb.score)}
												</span>
											) : (
												<span className="block w-12 text-center text-gray-500">–</span>
											)}
										</td>
										{slots.map(({ number, episode }) => (
											<td key={number}>
												{episode ? (
													<Cell
														season={season.number}
														episode={episode}
														onSelect={setSelection}
														selected={selection?.episode === episode}
													/>
												) : number >= 1 ? (
													<span className={`${CELL} block rounded-[4px] bg-white/[0.06]`} title={`S${season.number} E${number}: not rated`}>
														<span className="sr-only">Episode {number} not rated</span>
													</span>
												) : null}
											</td>
										))}
										{Array.from({ length: columns - slots.length }, (_, i) => (
											<td key={`pad-${i}`} />
										))}
										{providers.map((p) => {
											const value = season.scores[p]
											return (
												<td key={p} className="px-1 text-center text-sm tabular-nums" title={providerTitle(p, value)}>
													{value ? <span className="text-gray-100">{PROVIDERS[p].format(value.score)}</span> : <span className="text-gray-600">–</span>}
												</td>
											)
										})}
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
				{grid.specials.length > 0 && (
					<div className="mt-3 border-t border-white/8 pt-3">
						<h3 className="text-sm font-semibold text-gray-200">
							Specials <span className="font-normal text-gray-400">not counted in any season</span>
						</h3>
						<div className="mt-2 flex flex-wrap gap-[3px]">
							{grid.specials.map((special, i) => (
								<Cell key={i} season={null} episode={special} onSelect={setSelection} selected={selection?.episode === special} />
							))}
						</div>
					</div>
				)}
				<EpisodeReadout selection={selection} placeholder="Point at or tap an episode to see its title and votes." className="mt-3 border-t border-white/8 pt-3" />
			</div>
			<div className="mt-4">
				<ScoreLegend />
			</div>
		</div>
	)
}
