import { cached } from '~/utils/api'
import { VOTE_COUNT_THRESHOLD } from "~/utils/constants";
import { executeQuery } from '~/utils/postgres'
import { MovieDetails, TVDetails } from '~/server/details.server'

export type DiscoverMovieSortBy =
  'popularity' |
  'aggregated_score' |
  'release_date' |
  'title'

export interface DiscoverMovieParams {
  type: 'movie'
  mode: 'advanced'
  country: string
  minAgeRating: string
  maxAgeRating: string
  minYear: string
  maxYear: string
  minScore: string
  withKeywords: string
  withoutKeywords: string
  withGenres: string
  withoutGenres: string
  withStreamingProviders: string
  sortBy: DiscoverMovieSortBy
  sortDirection: 'asc' | 'desc'
}

export type DiscoverTVSortBy =
  'popularity' |
  'aggregated_score' |
  'release_date' |
  'title'

export interface DiscoverTVParams {
  type: 'tv'
  mode: 'advanced'
  country: string
  minAgeRating: string
  maxAgeRating: string
  minYear: string
  maxYear: string
  minScore: string
  withKeywords: string
  withoutKeywords: string
  withGenres: string
  withoutGenres: string
  withStreamingProviders: string
  sortBy: DiscoverTVSortBy
  sortDirection: 'asc' | 'desc'
}

export const getDiscoverMovieResults = async (params: DiscoverMovieParams) => {
  return await cached<DiscoverMovieParams, MovieDetails[]>({
    name: 'discover-movie',
    target: _getDiscoverResults,
    params,
    ttlMinutes: 60 * 2,
  })
}

export const getDiscoverTVResults = async (params: DiscoverTVParams) => {
  return await cached<DiscoverTVParams, TVDetails[]>({
    name: 'discover-tv',
    target: _getDiscoverResults,
    params,
    ttlMinutes: 60 * 2,
  })
}

async function _getDiscoverResults({
    type,
    country,
    minAgeRating,
    maxAgeRating,
    minYear,
    maxYear,
    minScore,
    withKeywords,
    withoutKeywords,
    withGenres,
    withoutGenres,
    withStreamingProviders,
    sortBy,
    sortDirection,
  }: DiscoverMovieParams | DiscoverTVParams): Promise<MovieDetails[] | TVDetails[]> {
  const joins = []
  const conditions = []

  if(minYear) {
    conditions.push(`m.release_year >= ${minYear}`)
  }
  if(maxYear) {
    conditions.push(`m.release_year <= ${maxYear}`)
  }
  if(withGenres) {
    conditions.push(`m.genres && ARRAY[${withGenres}]`)
  }
  if(withKeywords) {
    conditions.push(`m.keywords && ARRAY[${withKeywords}]`)
  }
  if(minScore) {
    conditions.push(`m.aggregated_overall_score_normalized_percent >= ${minScore}`)
  }

  if(withStreamingProviders) {
    joins.push(`INNER JOIN
      streaming_provider_links spl
      ON spl.tmdb_id = m.tmdb_id
      AND spl.media_type = '${type}'
      AND spl.country_code = '${country}'
      AND spl.stream_type = 'flatrate'
      AND spl.provider_id IN (${withStreamingProviders})
    `)
  }

  let orderBy
  if (sortBy === 'release_date') {
    orderBy = 'm.release_date DESC'
  }
  else if (sortBy === 'aggregated_score') {
    orderBy = 'MAX(m.aggregated_overall_score_normalized_percent) DESC'
  }
  else {
    orderBy = 'm.popularity DESC'
  }

  if (sortBy === 'aggregated_score') {
    conditions.push('m.aggregated_overall_score_normalized_percent IS NOT NULL')
  }

  if (sortBy === 'aggregated_score' || minScore) {
    conditions.push(`m.aggregated_overall_score_voting_count >= ${VOTE_COUNT_THRESHOLD}`)
  }

  const query = `
    SELECT
      m.*
    FROM
      ${type === 'movie' ? 'movies' : 'tv'} m
    ${joins.join(' ')}
    ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    GROUP BY
      m.tmdb_id
    ORDER BY
      ${orderBy}
    LIMIT 20;
  `
  const result = await executeQuery(query);
  return result.rows
}
