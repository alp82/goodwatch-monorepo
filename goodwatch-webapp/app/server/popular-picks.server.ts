import {
	type StreamingProviders,
	getCountrySpecificDetails,
} from "~/server/details.server"
import {
	increasePriorityForMovies,
	increasePriorityForTVs,
} from "~/server/utils/priority"
import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"
import { type AllRatings, getRatingKeys } from "~/utils/ratings"

export interface PopularPicksMovie extends AllRatings {
	tmdb_id: number
	poster_path: string
	title: string
	streaming_providers: StreamingProviders
}

export interface PopularPicksTV extends AllRatings {
	tmdb_id: number
	poster_path: string
	title: string
	streaming_providers: StreamingProviders
}

export interface PopularPicksMovieParams {
	type: string
	country: string
	language: string
}
export interface PopularPicksTVParams {
	type: string
	country: string
	language: string
}

export const getPopularPicksMovies = async (
	params: PopularPicksMovieParams,
) => {
	return await cached<PopularPicksMovieParams, PopularPicksMovie[]>({
		name: "popular-picks-movie",
		target: _getPopularPicksMovies,
		params,
		ttlMinutes: 10,
		// ttlMinutes: 0,
	})
}

export async function _getPopularPicksMovies({
	country,
	language,
}: PopularPicksMovieParams): Promise<PopularPicksMovie[]> {
	const result = await executeQuery(`
    SELECT
      tmdb_id,
      title,
      poster_path,
      streaming_providers,
      ${getRatingKeys().join(", ")}
    FROM
      movies
    WHERE
      popularity > 30
      AND poster_path IS NOT NULL
      AND aggregated_overall_score_normalized_percent >= 80
      AND aggregated_overall_score_voting_count >= 500
    ORDER BY
      RANDOM()
    LIMIT 50;
  `)
	if (!result.rows.length) throw Error("no popular picks for movies found")

	// increasePriorityForMovies(result.rows.map((row) => row.tmdb_id))
	return result.rows.map((row) =>
		getCountrySpecificDetails(row, country, language),
	)
}

export const getPopularPicksTV = async (params: PopularPicksTVParams) => {
	return await cached<PopularPicksTVParams, PopularPicksTV[]>({
		name: "popular-picks-tv",
		target: _getPopularPicksTV,
		params,
		ttlMinutes: 10,
		// ttlMinutes: 0,
	})
}

export async function _getPopularPicksTV({
	country,
	language,
}: PopularPicksTVParams): Promise<PopularPicksTV[]> {
	const result = await executeQuery(`
    SELECT
      tmdb_id,
      title,
      poster_path,
      streaming_providers,
      ${getRatingKeys().join(", ")}
    FROM
      tv
    WHERE
      popularity > 30
      AND poster_path IS NOT NULL
      AND aggregated_overall_score_normalized_percent >= 80
      AND aggregated_overall_score_voting_count >= 500
    ORDER BY
      RANDOM()
    LIMIT 40;
  `)
	if (!result.rows.length) throw Error("no popular picks for tv shows found")

	// increasePriorityForTVs(result.rows.map((row) => row.tmdb_id))
	return result.rows.map((row) =>
		getCountrySpecificDetails(row, country, language),
	)
}
