import { cached } from '~/utils/api'
import {PAGES_TO_DISCOVER, VOTE_COUNT_THRESHOLD} from "~/utils/constants";

export interface DiscoverMovieResult {
  adult: boolean
  backdrop_path: string
  genre_ids: number[]
  id: number
  original_language: string
  original_title: string
  overview: string
  popularity: number
  poster_path: string
  release_date: string
  title: string
  video: boolean
  vote_average: number
  vote_count: number
}

export interface DiscoverMovieResults {
  page: number
  results: DiscoverMovieResult[]
  total_pages: number
  total_results: number
}

export interface DiscoverTVResult {
  backdrop_path: string
  first_air_date: string
  genre_ids: number[]
  id: number
  name: string
  origin_country: string[]
  original_language: string
  original_name: string
  overview: string
  popularity: number
  poster_path: string
  vote_average: number
  vote_count: number
}

export interface DiscoverTVResults {
  page: number
  results: DiscoverTVResult[]
  total_pages: number
  total_results: number
}

export type DiscoverMovieSortBy =
  'popularity.asc' |  'popularity.desc' |
  'release_date.asc' |  'release_date.desc' |
  'revenue.asc' |  'revenue.desc' |
  'primary_release_date.asc' |  'primary_release_date.desc' |
  'original_title.asc' |  'original_title.desc' |
  'vote_average.asc' |  'vote_average.desc' |
  'vote_count.asc' |  'vote_count.desc'

export interface DiscoverMovieParams {
  language: string
  age_rating_country: string
  min_age_rating: string
  max_age_rating: string
  min_year: string
  max_year: string
  with_keywords: string
  without_keywords: string
  with_genres: string
  without_genres: string
  with_watch_providers: string
  watch_region: string
  sort_by: DiscoverMovieSortBy
}

export type DiscoverTVSortBy =
  'popularity.asc' |  'popularity.desc' |
  'first_air_date.asc' |  'first_air_date.desc' |
  'vote_average.asc' |  'vote_average.desc'

export interface DiscoverTVParams {
  language: string
  min_year: string
  max_year: string
  with_keywords: string
  without_keywords: string
  with_genres: string
  without_genres: string
  with_watch_providers: string
  watch_region: string
  sort_by: DiscoverTVSortBy
}

export const getDiscoverMovieResults = async (params: DiscoverMovieParams) => {
  return await cached<DiscoverMovieParams, DiscoverMovieResult[]>({
    name: 'discover-movie',
    target: _getDiscoverMovieResults,
    params,
    ttlMinutes: 60 * 2,
  })
}

async function _getDiscoverMovieResults({ language, age_rating_country, min_age_rating, max_age_rating, min_year, max_year, with_keywords, without_keywords, with_genres, without_genres, with_watch_providers, watch_region, sort_by }: DiscoverMovieParams): Promise<DiscoverMovieResult[]> {
  const watchProviderIds = with_watch_providers.split(',')
  const urls: string[] = []
  watchProviderIds.forEach((providerId) => {
    for (let page = 1; page <= PAGES_TO_DISCOVER; page++) {
      urls.push(`https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&language=${language}` +
        `&certification_country=${age_rating_country.toUpperCase()}` +
        `&certification.gte=${min_age_rating}&certification.lte=${max_age_rating}` +
        `&with_keywords=${with_keywords}&without_keywords=${without_keywords}` +
        `&with_genres=${with_genres}&without_genres=${without_genres}` +
        `&primary_release_date.gte=${min_year}&primary_release_date.lte=${max_year}` +
        `&with_watch_providers=${providerId}&watch_region=${watch_region}` +
        `&sort_by=${sort_by}&page=${page}`)
    }
  })
  return await _combineResults<DiscoverMovieResult>(urls, sort_by)
}

export const getDiscoverTVResults = async (params: DiscoverTVParams) => {
  return await cached<DiscoverTVParams, DiscoverTVResult[]>({
    name: 'discover-tv',
    target: _getDiscoverTVResults,
    params,
    ttlMinutes: 60 * 2,
  })
}

async function _getDiscoverTVResults({ language, min_year, max_year, with_keywords, without_keywords, with_genres, without_genres, with_watch_providers, watch_region, sort_by }: DiscoverTVParams): Promise<DiscoverTVResult[]> {
  const watchProviderIds = with_watch_providers.split(',')
  const urls: string[] = []
  watchProviderIds.forEach((providerId) => {
    for (let page = 1; page <= PAGES_TO_DISCOVER; page++) {
      urls.push(`https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&language=${language}` +
        `&with_keywords=${with_keywords}&without_keywords=${without_keywords}` +
        `&with_genres=${with_genres}&without_genres=${without_genres}` +
        `&first_air_date.gte=${min_year}&first_air_date.lte=${max_year}` +
        `&with_watch_providers=${providerId}&watch_region=${watch_region}&with_watch_monetization_types=flatrate` +
        `&sort_by=${sort_by}&page=${page}`)
    }
  })
  return await _combineResults<DiscoverTVResult>(urls, sort_by)
}

async function _combineResults<T extends DiscoverMovieResult | DiscoverTVResult>(urls: string[], sort_by: DiscoverMovieSortBy | DiscoverTVSortBy): Promise<T[]> {
  return Promise.all(urls.map((url) => fetch(url)))
    .then((responses) => Promise.all(responses.map(res => res.json())))
    .then((results) => {
      const mergedResults = results.reduce((combination, result) => {
        return [
          ...combination,
          ...result.results,
        ]
      }, [])
      const uniqueResults = mergedResults.filter((value: T, index: number, self: T[]) =>
          index === self.findIndex((t) => (
            t.id === value.id
          ))
      )
      const filteredResults = uniqueResults.filter((result: T) => {
          const isSortByVote = sort_by === 'vote_average.desc'
          return !isSortByVote || result.vote_count > VOTE_COUNT_THRESHOLD
      }
      )
      if (sort_by === 'vote_average.desc') {
        return filteredResults.sort((a: T, b: T) => a.vote_average > b.vote_average ? -1 : 1)
      }
      else if (sort_by === 'primary_release_date.desc') {
        return filteredResults.sort((a: DiscoverMovieResult, b: DiscoverMovieResult) => a.release_date > b.release_date ? -1 : 1)
      }
      else if (sort_by === 'first_air_date.desc') {
        return filteredResults.sort((a: DiscoverTVResult, b: DiscoverTVResult) => a.first_air_date > b.first_air_date ? -1 : 1)
      }
      return filteredResults.sort((a: T, b: T) => a.popularity > b.popularity ? -1 : 1)
    })
}
