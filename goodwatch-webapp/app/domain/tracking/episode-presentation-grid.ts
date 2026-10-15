import type { EpisodePresentation } from "./episode-presentation.ts"
import type { EpisodeGrid } from "~/server/episode-grid.server"

/** Scores cover exactly the displayed membership; other providers need their own membership proof. */
export function presentationGrid(
	showId: number,
	presentation: EpisodePresentation,
): EpisodeGrid {
	const seasons = presentation.seasons.map((s) => {
		const episodes = presentation.episodes
			.filter((e) => e.displaySeason === s.number)
			.map((e) => ({
				number: e.displayNumber,
				tmdbId: e.id,
				name: e.name ?? "",
				score: e.rating ?? 0,
				votes: e.votes,
				...(e.rating === null ? { unrated: true } : {}),
				...(s.number < 0
					? { canonicalLabel: `TMDB S${e.season} E${e.number}` }
					: {}),
			}))
		return {
			number: s.number,
			coverage: { rated: s.rated, total: s.total },
			episodes,
			maxEpisodeNumber: Math.max(0, ...episodes.map((e) => e.number)),
			scores: {
				imdb:
					s.score === null
						? null
						: {
								score: s.score,
								count: episodes.reduce((n, e) => n + e.votes, 0),
							},
				tmdb: null,
				tomatometer: null,
				popcornmeter: null,
				metascore: null,
				metacriticUser: null,
			},
		}
	})
	return {
		showId,
		seasons,
		specials: presentation.episodes
			.filter((e) => e.season === 0)
			.map((e) => ({ tmdbId: e.id, name: e.name ?? "", score: 0, votes: 0, unrated: true })),
		maxEpisodeNumber: Math.max(0, ...seasons.map((s) => s.maxEpisodeNumber)),
		hasEpisodeZero: false,
		providers: seasons.some((s) => s.scores.imdb) ? ["imdb"] : [],
		presentationVersion: presentation.version,
		note: presentation.note,
	}
}
