// A visitor's open season, loaded when it opens, in place under its row of the season overview: a head with the
// arrows to the season before and after, its name and size, and the close arrow; every site's season score; the
// episodes as tiles when the overview's squares are too small to read; then a line per episode, which opens its
// details.
import { ChevronDownIcon } from "@heroicons/react/24/solid"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import MediaText from "~/ui/media-text/MediaText"
import type { Season } from "~/ui/tracking/store"
import { ScoreTile } from "./ScoreTile"
import { SeasonStep } from "./SeasonOverview"
import SeasonTiles from "./SeasonTiles"
import type { GridModel } from "./grid-model"
import { FOCUS, seasonTitle } from "./presentation"
import { EpisodeTip, SeasonScoreList } from "./shared"

export default function SeasonDetails({
	grid,
	model,
	season,
	selected,
	onSelect,
	onClose,
	onStep,
	first,
	last,
	tiles = false,
}: {
	grid: EpisodeGrid
	model: GridModel
	season: Season
	selected: number | null
	onSelect: (id: number | null) => void
	onClose: () => void
	/** Steps to the season before or after; the specials have none. */
	onStep?: (delta: -1 | 1) => void
	first?: boolean
	last?: boolean
	/** Show the episodes as tiles over the lines. */
	tiles?: boolean
}) {
	const source = grid.seasons.find((s) => s.number === season.number)
	return (
		<div
			data-open-season={season.number}
			className="my-2 overflow-hidden rounded-xl border border-white/10 bg-[#141923]"
		>
			<div className="flex min-h-12 items-center gap-1.5 bg-white/[0.04] py-1.5 pl-3 pr-2">
				{onStep && <SeasonStep delta={-1} onStep={onStep} disabled={first} />}
				<h3 className="min-w-0 truncate text-sm">
					<span className="font-bold text-white">
						{seasonTitle(season.number)}
					</span>
					<span className="text-gray-400">
						{" "}
						· {season.episodes.length} episodes
					</span>
				</h3>
				{onStep && <SeasonStep delta={1} onStep={onStep} disabled={last} />}
				<span className="flex-1" />
				<button
					type="button"
					aria-label={`Close ${seasonTitle(season.number)}`}
					onClick={onClose}
					className={`grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white ${FOCUS}`}
				>
					<ChevronDownIcon className="h-4 w-4 rotate-180" />
				</button>
			</div>
			{tiles && (
				<SeasonTiles
					season={season}
					model={model}
					selected={selected}
					onPress={(episode) => onSelect(episode.id)}
				/>
			)}
			{source && (
				<div className="mb-3 max-w-xs px-3 pt-2">
					<SeasonScoreList season={source} providers={grid.providers} />
				</div>
			)}
			<ul className="divide-y divide-white/5 px-3 pb-2">
				{season.episodes.map((episode, i) => {
					const original = source?.episodes[i] ?? grid.specials[i]
					return (
						<li key={episode.id}>
							<button
								type="button"
								aria-expanded={selected === episode.id}
								onClick={() =>
									onSelect(selected === episode.id ? null : episode.id)
								}
								className={`flex min-h-10 w-full items-center gap-3 rounded px-1 text-left text-sm ${FOCUS}`}
							>
								<span className="w-9 shrink-0 text-xs text-gray-400">
									{original &&
									"canonicalLabel" in original &&
									original.canonicalLabel
										? original.canonicalLabel
										: `E${episode.number}`}
								</span>
								<span className="min-w-0 flex-1">
									<MediaText
										value={{
											text: episode.name || "Untitled",
											lang: original?.nameLanguage ?? "und",
										}}
									/>
								</span>
								<ScoreTile score={episode.rating} />
							</button>
							{selected === episode.id && original && (
								<div className="px-2 py-3">
									<EpisodeTip
										season={season.number || null}
										episode={original}
										tmdbNumbers={grid.tmdbNumbers}
									/>
								</div>
							)}
						</li>
					)
				})}
			</ul>
		</div>
	)
}
