import { cached } from '~/utils/cache'
import { VOTE_COUNT_THRESHOLD } from '~/utils/constants'
import { executeQuery } from '~/utils/postgres'
import { getCountrySpecificDetails, StreamingProviders } from '~/server/details.server'
import { AllRatings, getRatingKeys } from '~/utils/ratings'
import { StreamingProvider } from '~/server/streaming-providers.server'

export type DiscoverSortBy =
  'popularity' |
  'aggregated_score' |
  'release_date' |
  'title'

export interface DiscoverParams {
  type: 'movie' | 'tv'
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
  sortBy: DiscoverSortBy
  sortDirection: 'asc' | 'desc'
}

export interface DiscoverResult extends AllRatings {
  tmdb_id: number
  poster_path: string
  title: string
  streaming_providers: StreamingProviders
}

export interface DiscoverFilters {
  castMembers: string[]
  crewMembers: string[]
  streamingProviders: StreamingProvider[]
}

export interface DiscoverResults {
  results: DiscoverResult[]
  filters: DiscoverFilters
}

export const getDiscoverResults = async (params: DiscoverParams) => {
  return await cached<DiscoverParams, DiscoverResults>({
    name: 'discover-results',
    target: _getDiscoverResults,
    params,
    ttlMinutes: 60 * 2,
  })
}

async function _getDiscoverResults({
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
  }: DiscoverParams): Promise<DiscoverResults> {
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

  if (withCast) {
    const castConditions: string[] = []
    withCast.split(',').forEach((castId) => {
      castConditions.push(`m.cast @> '[{"id": ${castId}}]'`)
    })
    conditions.push(`(${castConditions.join(' OR ')})`)
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
  const results = result.rows.map((row) => getCountrySpecificDetails(row, country, language)) as unknown as DiscoverResult[]

  const castResult = await executeQuery(`SELECT DISTINCT id, name FROM "cast" WHERE id = ANY($1)`, [withCast ? withCast.split(',') : []])
  const castMembers = castResult.rows.map((row) => row.name) as string[]

  const crewMembers = [] as string[]

  const streamingProviders = [] as StreamingProvider[]

  const filters = {
    castMembers,
    crewMembers,
    streamingProviders,
  }

  return {
    results,
    filters,
  }
}
