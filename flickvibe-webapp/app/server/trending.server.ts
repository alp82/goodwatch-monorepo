import { cached } from '~/utils/api'

export interface TrendingMovie {
  adult: boolean
  backdrop_path: string
  genre_ids: number[]
  id: number
  original_language: string
  original_title: string
  overview: string
  trendingity: number
  poster_path: string
  release_date: string
  title: string
  video: boolean
  vote_average: number
  vote_count: number
}

export interface TrendingTV {
  backdrop_path: string
  first_air_date: string
  genre_ids: number[]
  id: number
  name: string
  origin_country: string[]
  original_language: string
  original_name: string
  overview: string
  trendingity: number
  poster_path: string
  vote_average: number
  vote_count: number
}
export type TrendingMovieResults = TrendingMovie[]
export type TrendingTVResults = TrendingTV[]

export interface TrendingMovieParams {
  type: string
}
export interface TrendingTVParams {
  type: string
}

export const getTrendingMovie = async (params: TrendingMovieParams) => {
  return await cached<TrendingMovieParams, TrendingMovieResults>({
    name: 'trending-movie',
    target: _getTrendingMovie,
    params,
    ttlMinutes: 30,
  })
}

export async function _getTrendingMovie({}: TrendingMovieParams): Promise<TrendingMovieResults> {
  return await fetch(
    `https://api.themoviedb.org/3/trending/movie/day?api_key=${process.env.TMDB_API_KEY}`
  ).then((res) => res.json())
}

export const getTrendingTV = async (params: TrendingTVParams) => {
  return await cached<TrendingTVParams, TrendingTVResults>({
    name: 'trending-tv',
    target: _getTrendingTV,
    params,
    ttlMinutes: 30,
  })
}

export async function _getTrendingTV({}: TrendingTVParams): Promise<TrendingTVResults> {
  return await fetch(
    `https://api.themoviedb.org/3/trending/tv/day?api_key=${process.env.TMDB_API_KEY}`
  ).then((res) => res.json())
}
