// IMDb's ratings beside the episodes of the episode list (#369). Pure.
//
// The episode grid already knows which TMDB episode each IMDb episode is (episode-alignment.ts, attached as the
// grid episode's `tmdbId`), so the list takes a rating only from the IMDb episode proven to be that episode, and an
// episode never shows its neighbour's rating.

/** A listed episode, as much as the match reads of it. Season 0 holds the specials. */
export interface ListedName {
	id: number
	season: number
	number: number
	name: string | null
}

/** A season of the grid, with its rated episodes. */
export interface RatedSeason {
	number: number
	episodes: readonly {
		number: number
		name: string
		score: number
		votes?: number
		unrated?: boolean
		/** The TMDB episode this IMDb episode is (episode-alignment.ts). */
		tmdbId?: number
	}[]
}

export interface EpisodeRating {
	/** IMDb's rating, 0 to 10. */
	score: number
	votes?: number
	how: "id"
}

export interface EpisodeRatings {
	/** By the listed episode's id. An episode that is not in it has no rating. */
	byEpisode: Map<number, EpisodeRating>
	/**
	 * Per season with some ratings: how many of its episodes were left without one (the page shows them a dash
	 * explaining why). `byTitle` is kept for the page's shape and is always 0.
	 */
	notes: Map<number, { byTitle: number; missing: number }>
}

/** IMDb's rating for each listed episode, or none. Specials take no rating: IMDb lists them without a season. */
export function matchEpisodeRatings(
	episodes: readonly ListedName[],
	seasons: readonly RatedSeason[],
): EpisodeRatings {
	const byEpisode = new Map<number, EpisodeRating>()
	const notes = new Map<number, { byTitle: number; missing: number }>()
	const proven = new Map<number, RatedSeason["episodes"][number] | null>()
	for (const season of seasons)
		for (const e of season.episodes)
			if (e.tmdbId !== undefined && !e.unrated)
				// An id claimed twice names no single episode.
				proven.set(e.tmdbId, proven.has(e.tmdbId) ? null : e)
	const missing = new Map<number, number>()
	for (const episode of episodes) {
		if (episode.season <= 0) continue
		const e = proven.get(episode.id)
		if (e)
			byEpisode.set(episode.id, {
				score: e.score,
				how: "id",
				...(e.votes === undefined ? {} : { votes: e.votes }),
			})
		else missing.set(episode.season, (missing.get(episode.season) ?? 0) + 1)
	}
	const ratedSeasons = new Set(
		episodes.filter((e) => e.season > 0 && byEpisode.has(e.id)).map((e) => e.season),
	)
	for (const [season, count] of missing)
		if (ratedSeasons.has(season)) notes.set(season, { byTitle: 0, missing: count })
	return { byEpisode, notes }
}
