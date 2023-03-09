import { createClient } from '@supabase/supabase-js'
import { Ratings } from '~/server/ratings.server'

const supabase = createClient(process.env.SUPABASE_PROJECT_URL || '', process.env.SUPABASE_API_KEY || '')

export enum MediaType {
  MOVIE = 'movie',
  TV = 'tv',
}

export interface KnownFor {
  adult: boolean
  backdrop_path: string
  id: number
  title: string
  original_language: string
  original_title: string
  overview: string
  poster_path: string
  media_type: string
  genre_ids: number[]
  popularity: number
  release_date: string
  video: boolean
  vote_average: number
  vote_count: number
}

export interface SearchResult {
  adult: boolean
  backdrop_path: string
  id: number
  title: string
  original_language: string
  original_title: string
  overview: string
  poster_path: string
  media_type: MediaType
  genre_ids: number[]
  popularity: number
  release_date: string
  video: boolean
  vote_average: number
  vote_count: number
  name: string
  original_name: string
  gender?: number
  known_for_department: string
  profile_path?: any
  known_for: KnownFor[]
  first_air_date: string
  origin_country: string[]
}

export type SearchResults = SearchResult[]

export async function getSearchResults(query: string, language: string = 'en'): Promise<SearchResults> {
  const cachedData = await supabase
    .from('cached-search')
    .select()
    .eq('query', query)
    .eq('language', language)
  if (cachedData.data?.length && (Date.now() - new Date(cachedData.data[0].lastUpdated)) < 1000 * 60 * 60 * 2) {
    return cachedData.data[0].relevantResults as unknown as SearchResults
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&language=${language}&query=${query}`
  ).then((res) => res.json())

  const relevantResults = response.results.filter((result: SearchResult) => ['movie', 'tv'].includes(result.media_type))
  const lastUpdated = (new Date()).toISOString()
  const { data, error} = await supabase
    .from('cached-search')
    .upsert({ query, language, lastUpdated, relevantResults })
    .select()
  return relevantResults
}
