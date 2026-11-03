import type { GridEpisode, GridSpecial } from "~/server/episode-grid.server"
import { formatCount, formatScore, isLowVotes } from "./scale.ts"

/** Where an episode sits, in words. `season` is null for a special. */
export const episodeWhere = (
	season: number | null,
	episode: GridEpisode | GridSpecial,
	/** The grid is drawn in TMDB's seasons by place: the label is TMDB's number (EpisodeGrid.tmdbNumbers). */
	tmdbNumbers = false,
) =>
	season === null
		? "Special"
		: season < 0
			? (episode.canonicalLabel ?? "Additional episode")
			: `Season ${season}, episode ${tmdbNumbers && episode.canonicalNumber ? episode.canonicalNumber : (episode as GridEpisode).number}`

/** The accessible name of an episode cell: everything the tip shows. */
export const episodeLabel = (
	season: number | null,
	episode: GridEpisode | GridSpecial,
) => {
	if (episode.unrated)
		return `${episodeWhere(season, episode)}: ${episode.name || "Untitled"}. No IMDb rating.`
	const votes = `${formatCount(episode.votes)} IMDb vote${episode.votes === 1 ? "" : "s"}`
	return `${episodeWhere(season, episode)}: ${episode.name || "Untitled"}. Rated ${episode.unrated ? "—" : formatScore(episode.score)}, ${votes}${isLowVotes(episode.votes) ? ", few votes" : ""}.`
}
