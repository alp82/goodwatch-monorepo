import { cached } from '~/utils/cache'
import { MovieDetails, TVDetails } from '~/server/details.server'
import { executeQuery } from '~/utils/postgres'

export type TrendingMovieResults = MovieDetails[]
export type TrendingTVResults = TVDetails[]

export interface TrendingMovieParams {
  type: string
}
export interface TrendingTVParams {
  type: string
}

export const getTrendingMovies = async (params: TrendingMovieParams) => {
  return await cached<TrendingMovieParams, TrendingMovieResults>({
    name: 'trending-movie',
    target: _getTrendingMovies,
    params,
    ttlMinutes: 60 * 2,
  })
}

export async function _getTrendingMovies({}: TrendingMovieParams): Promise<TrendingMovieResults> {
  const trendingResults = await fetch(
    `https://api.themoviedb.org/3/trending/movie/day?api_key=${process.env.TMDB_API_KEY}`
  ).then((res) => res.json())
  const trendingIds = trendingResults.results.map((movie) => movie.id)

  const result = await executeQuery(`
    SELECT
      *
    FROM
      movies
    WHERE
      tmdb_id IN (${trendingIds.join(', ')})
      AND poster_path IS NOT NULL
      AND aggregated_overall_score_normalized_percent > 0
    ORDER BY
      popularity;
  `);
  if (!result.rows.length) throw Error(`no trending movies found`)
  return result.rows
}

export const getTrendingTV = async (params: TrendingTVParams) => {
  return await cached<TrendingTVParams, TrendingTVResults>({
    name: 'trending-tv',
    target: _getTrendingTV,
    params,
    ttlMinutes: 60 * 2,
  })
}

export async function _getTrendingTV({}: TrendingTVParams): Promise<TrendingTVResults> {
  const trendingResults = await fetch(
    `https://api.themoviedb.org/3/trending/tv/day?api_key=${process.env.TMDB_API_KEY}`
  ).then((res) => res.json())
  const trendingIds = trendingResults.results.map((tv) => tv.id)

  const result = await executeQuery(`
    SELECT
      *
    FROM
      tv
    WHERE
      tmdb_id IN (${trendingIds.join(', ')})
      AND poster_path IS NOT NULL
      AND aggregated_overall_score_normalized_percent > 0
    ORDER BY
      popularity;
  `);
  if (!result.rows.length) throw Error(`no trending tv shows found`)
  return result.rows
}
