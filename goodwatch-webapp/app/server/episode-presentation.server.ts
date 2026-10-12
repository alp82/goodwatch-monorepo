import { episodeMapping } from "~/domain/tracking/episode-mappings.server"
import {
	buildEpisodePresentation,
	type EpisodePresentation,
	type ImdbEpisodeRating,
} from "~/domain/tracking/episode-presentation"
import { getEpisodeList } from "~/server/tracking.server"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

class RatingsUnavailable extends Error {
	readonly presentation: EpisodePresentation
	constructor(presentation: EpisodePresentation) {
		super("IMDb episode ratings are unavailable")
		this.presentation = presentation
	}
}

export async function getEpisodePresentation(
	showId: number,
): Promise<EpisodePresentation | null> {
	const mapping = episodeMapping(showId)
	if (!mapping) return null
	try {
		return await cached<
			{ showId: number; version: string },
			EpisodePresentation
		>({
			name: "episode-presentation-v2",
			params: { showId, version: mapping.version },
			ttlMinutes: 10,
			target: async () => {
				const list = await getEpisodeList(showId)
				if (!list.length)
					throw new Error("The selected show's episode catalog is unavailable")
				const catalog = list.map((e) => ({
					id: e.tmdb_id,
					season: e.season_number,
					number: e.episode_number,
					name: e.name,
					airDate: e.air_date,
					runtime: e.runtime,
					still: e.still_path,
					overview: e.overview || null,
				}))
				let ratings
				try {
					ratings = await query<
						Omit<ImdbEpisodeRating, "parentId"> & { parent_id: string }
					>(
						`SELECT imdb_episode_id AS id, imdb_show_id AS parent_id, season_number AS season,
       episode_number AS number, name, imdb_user_score_original AS score, imdb_user_score_rating_count AS votes
       FROM imdb_episode WHERE show_id = ?`,
						[showId],
					)
				} catch {
					// Preserve labels and tracking, but retry ratings on the next read instead of caching the failed result.
					throw new RatingsUnavailable({
						...buildEpisodePresentation(catalog, [], mapping),
						note: "IMDb ratings are temporarily unavailable.",
					})
				}
				return buildEpisodePresentation(
					catalog,
					ratings.map(({ parent_id, ...e }) => ({ ...e, parentId: parent_id })),
					mapping,
				)
			},
		})
	} catch (error) {
		if (error instanceof RatingsUnavailable) return error.presentation
		throw error
	}
}
