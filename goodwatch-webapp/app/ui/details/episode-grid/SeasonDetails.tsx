// Read-only episode details load when a visitor opens a season.
import type { EpisodeGrid } from "~/server/episode-grid.server"
import MediaText from "~/ui/media-text/MediaText"
import type { Season } from "~/ui/tracking/store"
import { ScoreTile } from "./ScoreTile"
import { FOCUS, seasonTitle } from "./presentation"
import { EpisodeTip, SeasonScoreList } from "./shared"

export default function SeasonDetails({
	grid,
	season,
	selected,
	onSelect,
	onClose,
}: {
	grid: EpisodeGrid
	season: Season
	selected: number | null
	onSelect: (id: number | null) => void
	onClose: () => void
}) {
	const source = grid.seasons.find((s) => s.number === season.number)
	return (
		<div
			data-open-season={season.number}
			className="my-2 rounded-xl border border-white/10 bg-[#141923] p-3"
		>
			<button
				type="button"
				onClick={onClose}
				className={`mb-3 font-semibold ${FOCUS}`}
			>
				{seasonTitle(season.number)} <span aria-hidden>⌃</span>
			</button>
			{source && (
				<div className="mb-3 max-w-xs">
					<SeasonScoreList season={source} providers={grid.providers} />
				</div>
			)}
			<ul className="divide-y divide-white/5">
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
