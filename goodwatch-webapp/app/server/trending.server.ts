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

export interface TrendingMovie extends AllRatings {
	tmdb_id: number
	poster_path: string
	title: string
	streaming_providers: StreamingProviders
}

export interface TrendingTV extends AllRatings {
	tmdb_id: number
	poster_path: string
	title: string
	streaming_providers: StreamingProviders
}

export interface TrendingMovieParams {
	type: string
	country: string
	language: string
}
export interface TrendingTVParams {
	type: string
	country: string
	language: string
}

export const getTrendingMovies = async (params: TrendingMovieParams) => {
	return await cached<TrendingMovieParams, TrendingMovie[]>({
		name: "trending-movie",
		target: _getTrendingMovies,
		params,
		ttlMinutes: 60 * 2,
		// ttlMinutes: 0,
	})
}

export async function _getTrendingMovies({
	country,
	language,
}: TrendingMovieParams): Promise<TrendingMovie[]> {
	const trendingResults = await fetch(
		`https://api.themoviedb.org/3/trending/movie/day?api_key=${process.env.TMDB_API_KEY}`,
	).then((res) => res.json())
	const trendingIds = trendingResults.results
		.filter((movie) => !Number.isNaN(Number(movie.id)))
		.map((movie) => movie.id)

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
      tmdb_id IN (${trendingIds.join(", ")})
      AND poster_path IS NOT NULL
      AND aggregated_overall_score_normalized_percent > 0
    ORDER BY
      popularity;
  `)

	increasePriorityForMovies(result.rows.map((row) => row.tmdb_id))
	return result.rows.map((row) =>
		getCountrySpecificDetails(row, country, language),
	)
}

export const getTrendingTV = async (params: TrendingTVParams) => {
	return await cached<TrendingTVParams, TrendingTV[]>({
		name: "trending-tv",
		target: _getTrendingTV,
		params,
		ttlMinutes: 60 * 2,
		// ttlMinutes: 0,
	})
}

export async function _getTrendingTV({
	country,
	language,
}: TrendingTVParams): Promise<TrendingTV[]> {
	const trendingResults = await fetch(
		`https://api.themoviedb.org/3/trending/tv/day?api_key=${process.env.TMDB_API_KEY}`,
	).then((res) => res.json())
	const trendingIds = trendingResults.results
		.filter((tv) => !Number.isNaN(Number(tv.id)))
		.map((tv) => tv.id)

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
      tmdb_id IN (${trendingIds.join(", ")})
      AND poster_path IS NOT NULL
      AND aggregated_overall_score_normalized_percent > 0
    ORDER BY
      popularity;
  `)

	increasePriorityForTVs(result.rows.map((row) => row.tmdb_id))
	return result.rows.map((row) =>
		getCountrySpecificDetails(row, country, language),
	)
}
