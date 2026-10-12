/** Display numbers are optional; tracking comparisons always use the canonical numbers. */
export const episodeCode = (episode: {
	season: number
	number: number
	displaySeason?: number
	displayNumber?: number
}) =>
	(episode.displaySeason ?? episode.season) < 0
		? `TMDB S${episode.season} E${episode.number}`
		: `S${episode.displaySeason ?? episode.season} E${episode.displayNumber ?? episode.number}`
