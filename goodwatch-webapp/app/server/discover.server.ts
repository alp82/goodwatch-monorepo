import { cached } from '~/utils/cache'
import { VOTE_COUNT_THRESHOLD } from '~/utils/constants'
import { executeQuery } from '~/utils/postgres'
import { getCountrySpecificDetails, StreamingProviders } from '~/server/details.server'
import { AllRatings, getRatingKeys } from '~/utils/ratings'

export type DiscoverSortBy =
  'popularity' |
  'aggregated_score' |
  'release_date' |
  'title'

export interface DiscoverParams<Type, SortBy extends DiscoverSortBy> {
  type: Type
  mode: 'advanced'
  country: string
  language: string
  minAgeRating: string
  maxAgeRating: string
  minYear: string
  maxYear: string
  minScore: string
  withCast: string
  withCrew: string
  withKeywords: string
  withoutKeywords: string
  withGenres: string
  withoutGenres: string
  withStreamingProviders: string
  sortBy: SortBy
  sortDirection: 'asc' | 'desc'
}

export type DiscoverMovieParams = DiscoverParams<'movie', DiscoverSortBy>
export type DiscoverTVParams = DiscoverParams<'tv', DiscoverSortBy>

export interface DiscoverMovie extends AllRatings {
  tmdb_id: number
  poster_path: string
  title: string
  streaming_providers: StreamingProviders
}

export interface DiscoverTV extends AllRatings {
  tmdb_id: number
  poster_path: string
  title: string
  streaming_providers: StreamingProviders
}

export const getDiscoverMovieResults = async (params: DiscoverMovieParams) => {
  return await cached<DiscoverMovieParams, DiscoverMovie[]>({
    name: 'discover-movie',
    target: _getDiscoverResults<DiscoverMovieParams, DiscoverMovie[]>,
    params,
    ttlMinutes: 60 * 2,
  })
}

export const getDiscoverTVResults = async (params: DiscoverTVParams) => {
  return await cached<DiscoverTVParams, DiscoverTV[]>({
    name: 'discover-tv',
    target: _getDiscoverResults<DiscoverTVParams, DiscoverTV[]>,
    params,
    ttlMinutes: 60 * 2,
  })
}

async function _getDiscoverResults<
  Params extends DiscoverMovieParams | DiscoverTVParams,
  Result extends DiscoverMovie[] | DiscoverTV[]
>({
    type,
    country,
    language,
    minAgeRating,
    maxAgeRating,
    minYear,
    maxYear,
    minScore,
    withCast,
    withCrew,
    withKeywords,
    withoutKeywords,
    withGenres,
    withoutGenres,
    withStreamingProviders,
    sortBy,
    sortDirection,
  }: Params): Promise<Result> {
  const joins = []
  const conditions = []

  let placeholderNumber = 1
  function getNextPlaceholder() {
    return `$${placeholderNumber++}`
  }
  const placeholderValues = []

  if(minYear) {
    conditions.push(`m.release_year >= ${getNextPlaceholder()}`)
    placeholderValues.push(minYear)
  }
  if(maxYear) {
    conditions.push(`m.release_year <= ${getNextPlaceholder()}`)
    placeholderValues.push(maxYear)
  }
  if(withGenres) {
    const genresArray = withGenres.split(',');
    const genrePlaceholders = genresArray.map(_ => getNextPlaceholder());
    conditions.push(`m.genres::text[] && ARRAY[${genrePlaceholders.join(', ')}]`);
    placeholderValues.push(...genresArray)
  }
  if(withKeywords) {
    const keywordsArray = withKeywords.split(',');
    const keywordPlaceholders = keywordsArray.map(_ => getNextPlaceholder());
    conditions.push(`m.keywords::text[] && ARRAY[${keywordPlaceholders.join(', ')}]`);
    placeholderValues.push(...keywordsArray)

  }
  if(minScore) {
    conditions.push(`m.aggregated_overall_score_normalized_percent >= ${getNextPlaceholder()}`)
    placeholderValues.push(minScore)
  }

  if(withStreamingProviders) {
    const streamingProviderIds = withStreamingProviders.split(',').map((id) => parseInt(id)).join(',')
    joins.push(`INNER JOIN
      streaming_provider_links spl
      ON spl.tmdb_id = m.tmdb_id
      AND spl.media_type = ${getNextPlaceholder()}
      AND spl.country_code = ${getNextPlaceholder()}
      AND spl.stream_type = 'flatrate'
      AND spl.provider_id IN (${streamingProviderIds})
    `)
    placeholderValues.push(type)
    placeholderValues.push(country)
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

  // TODO random sort
  const query = `
    SELECT
      m.tmdb_id,
      m.title,
      m.poster_path,
      m.streaming_providers,
      ${getRatingKeys().map((key) => `m.${key}`).join(', ')}
    FROM
      ${type === 'movie' ? 'movies' : 'tv'} m
    --TABLESAMPLE BERNOULLI(1)
    ${joins.join(' ')}
    ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    GROUP BY
      m.tmdb_id
    ORDER BY
      ${orderBy}
    LIMIT 20;
  `
  const result = await executeQuery(query, placeholderValues)
  return result.rows.map((row) => getCountrySpecificDetails(row, country, language)) as Result
}
