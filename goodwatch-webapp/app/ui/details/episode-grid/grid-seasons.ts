import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { Season } from "~/ui/tracking/store"

/** A read-only season: its episodes keep the language of their names, which an episode link compares (episode-link.ts). */
type GridSeason = Season & {
	episodes: (Season["episodes"][number] & { nameLanguage?: string })[]
}

/** Read-only positions are local UI identities, never submitted as watch identities. */
export function gridSeasons(grid: EpisodeGrid): GridSeason[] {
	let id = 0
	const seasons: GridSeason[] = grid.seasons.map((season) => ({
		number: season.number,
		episodes: season.episodes.map((episode) => ({
			id: --id,
			season: season.number,
			number: episode.number,
			airDate: null,
			name: episode.name,
			...(episode.nameLanguage ? { nameLanguage: episode.nameLanguage } : {}),
			runtime: null,
			still: null,
			overview: null,
			rating: episode.unrated ? null : episode.score,
			ratedBy: null,
		})),
	}))
	if (grid.specials.length)
		seasons.push({
			number: 0,
			episodes: grid.specials.map((episode, i) => ({
				id: --id,
				season: 0,
				number: i + 1,
				airDate: null,
				name: episode.name,
				runtime: null,
				still: null,
				overview: null,
				rating: episode.unrated ? null : episode.score,
				ratedBy: null,
			})),
		})
	return seasons
}
