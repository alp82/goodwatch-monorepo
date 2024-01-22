import { cached } from '~/utils/cache'
import { getCountrySpecificDetails, MovieDetails, TVDetails } from '~/server/details.server'
import { executeQuery } from '~/utils/postgres'

export type PopularPicksMovieResults = MovieDetails[]
export type PopularPicksTVResults = TVDetails[]

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

export const getPopularPicksMovies = async (params: PopularPicksMovieParams) => {
  return await cached<PopularPicksMovieParams, PopularPicksMovieResults>({
    name: 'popular-picks-movie',
    target: _getPopularPicksMovies,
    params,
    ttlMinutes: 10,
  })
}

export async function _getPopularPicksMovies({ country, language }: PopularPicksMovieParams): Promise<PopularPicksMovieResults> {
  const result = await executeQuery(`
    SELECT
      *
    FROM
      movies
    WHERE
      popularity > 75
      AND poster_path IS NOT NULL
      AND aggregated_overall_score_normalized_percent > 80
      AND aggregated_overall_score_voting_count > 1000
    ORDER BY
      RANDOM()
    LIMIT 10;
  `);
  if (!result.rows.length) throw Error(`no popular picks for movies found`)
  return result.rows.map((row) => getCountrySpecificDetails(row, country, language))
}

export const getPopularPicksTV = async (params: PopularPicksTVParams) => {
  return await cached<PopularPicksTVParams, PopularPicksTVResults>({
    name: 'popular-picks-tv',
    target: _getPopularPicksTV,
    params,
    ttlMinutes: 10,
  })
}

export async function _getPopularPicksTV({ country, language }: PopularPicksTVParams): Promise<PopularPicksTVResults> {
  const result = await executeQuery(`
    SELECT
      *
    FROM
      tv
    WHERE
      popularity > 50
      AND poster_path IS NOT NULL
      AND aggregated_overall_score_normalized_percent > 80
      AND aggregated_overall_score_voting_count > 1000
    ORDER BY
      RANDOM()
    LIMIT 10;
  `);
  if (!result.rows.length) throw Error(`no popular picks for tv shows found`)
  return result.rows.map((row) => getCountrySpecificDetails(row, country, language))
}
