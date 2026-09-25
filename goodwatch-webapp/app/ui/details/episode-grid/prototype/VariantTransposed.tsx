// PROTOTYPE (#153) variant B, "Season columns": the grid turned on its side. Each season is
// a column headed by a scorecard with every site's season score; its episodes run down
// below. Specials get the last column. Short shows fit a phone without scrolling; long
// shows scroll sideways inside the box with the row labels pinned.
import { useState } from "react"
import type { GridEpisode, GridSpecial } from "~/server/episode-grid.server"
import type { GridVariantProps } from "~/ui/details/episode-grid/EpisodeGridSection"
import { PROVIDERS, cellColors, formatScore } from "~/ui/details/episode-grid/scale"
import {
	EpisodeReadout,
	ProviderMark,
	type Selection,
	ScoreLegend,
	isLowVotes,
	providerTitle,
	selectionLabel,
} from "~/ui/details/episode-grid/shared"

const LABEL_BG = "bg-[#141923]"

function Cell({ season, episode, selection, onSelect }: { season: number | null; episode: GridEpisode | GridSpecial; selection: Selection | null; onSelect: (s: Selection) => void }) {
	const colors = cellColors(episode.score)
	const value = { season, episode }
	return (
		<button
			type="button"
			aria-label={selectionLabel(value)}
			onMouseEnter={() => onSelect(value)}
			onFocus={() => onSelect(value)}
			onClick={() => onSelect(value)}
			className={`h-7 w-full rounded-[3px] text-xs font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-white ${selection?.episode === episode ? "outline-2 outline-white" : ""}`}
			style={isLowVotes(episode.votes) ? { boxShadow: `inset 0 0 0 2px ${colors.background}`, color: "#e5e7eb" } : { background: colors.background, color: colors.color }}
		>
			{formatScore(episode.score)}
		</button>
	)
}

export default function VariantTransposed({ grid }: GridVariantProps) {
	const [selection, setSelection] = useState<Selection | null>(null)
	const first = grid.hasEpisodeZero ? 0 : 1
	const rows = Math.max(grid.maxEpisodeNumber - first + 1, grid.specials.length)
	const byNumber = grid.seasons.map((s) => new Map(s.episodes.map((e) => [e.number, e])))
	const hasSpecials = grid.specials.length > 0

	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,auto)_16rem] lg:justify-start lg:items-start">
			<div className="max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-white/8 bg-[#141923]">
				<table className="border-separate border-spacing-x-[3px] border-spacing-y-[3px] p-2">
					<caption className="sr-only">Season scores from every site, then the IMDb rating of every episode, one column per season</caption>
					<thead>
						<tr>
							<th scope="col" className={`sticky left-0 z-10 ${LABEL_BG} w-16 text-left text-[11px] font-medium text-gray-400`}>
								<span className="sr-only">Row</span>
							</th>
							{grid.seasons.map((s) => (
								<th key={s.number} scope="col" className="w-16 min-w-11 pb-1 text-sm font-semibold text-gray-100">
									S{s.number}
								</th>
							))}
							{hasSpecials && (
								<th scope="col" className="min-w-11 pb-1 text-sm font-semibold text-gray-300">
									<abbr title="Specials" className="no-underline">
										Sp
									</abbr>
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{grid.providers.map((p) => (
							<tr key={p}>
								<th scope="row" className={`sticky left-0 z-10 ${LABEL_BG} pr-1 text-left font-normal`}>
									<ProviderMark provider={p} label className="flex-col items-start" />
								</th>
								{grid.seasons.map((s) => {
									const value = s.scores[p]
									return (
										<td key={s.number} className="text-center text-[13px] tabular-nums" title={providerTitle(p, value)}>
											{value ? (
												p === "imdb" ? (
													<span className="flex h-7 items-center justify-center rounded-[3px] font-bold" style={cellColors(value.score)}>
														{formatScore(value.score)}
													</span>
												) : (
													<span className="font-medium text-gray-100">{PROVIDERS[p].format(value.score)}</span>
												)
											) : (
												<span className="text-gray-600">–</span>
											)}
										</td>
									)
								})}
								{hasSpecials && <td />}
							</tr>
						))}
						<tr>
							<th scope="row" className={`sticky left-0 z-10 ${LABEL_BG} pt-3 pb-1 text-left text-[11px] font-medium text-gray-400`}>
								Episode
							</th>
							<td colSpan={grid.seasons.length + (hasSpecials ? 1 : 0)} className="pt-3 pb-1">
								<span aria-hidden="true" className="block h-px bg-white/10" />
							</td>
						</tr>
						{Array.from({ length: rows }, (_, i) => {
							const number = first + i
							return (
								<tr key={number}>
									<th scope="row" className={`sticky left-0 z-10 ${LABEL_BG} pr-2 text-right text-xs font-medium tabular-nums text-gray-400`}>
										{number <= grid.maxEpisodeNumber ? number : ""}
									</th>
									{grid.seasons.map((s, si) => {
										const episode = byNumber[si].get(number)
										return (
											<td key={s.number} className="p-0">
												{episode ? (
													<Cell season={s.number} episode={episode} selection={selection} onSelect={setSelection} />
												) : number >= 1 && number <= s.maxEpisodeNumber ? (
													<span className="block h-7 rounded-[3px] bg-white/[0.06]" title={`S${s.number} E${number}: not rated`}>
														<span className="sr-only">Not rated</span>
													</span>
												) : null}
											</td>
										)
									})}
									{hasSpecials && (
										<td className="p-0">
											{grid.specials[i] && <Cell season={null} episode={grid.specials[i]} selection={selection} onSelect={setSelection} />}
										</td>
									)}
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
			<aside className="flex flex-col gap-4 lg:sticky lg:top-40">
				<EpisodeReadout selection={selection} placeholder="Point at or tap an episode to see its title and votes." className="rounded-2xl border border-white/8 bg-white/4 p-3" />
				<ScoreLegend compact />
			</aside>
		</div>
	)
}
