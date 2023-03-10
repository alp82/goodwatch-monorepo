import { cached } from '~/utils/api'

export interface PopularMovie {
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

export interface PopularTV {
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
export type PopularMovieResults = PopularMovie[]
export type PopularTVResults = PopularTV[]

export interface PopularMovieParams {
  language: string
}
export interface PopularTVParams {
  language: string
}

export const getPopularMovie = async (params: PopularMovieParams) => {
  return await cached<PopularMovieParams, PopularMovieResults>({
    name: 'popular-movie',
    target: _getPopularMovie,
    params,
    ttlMinutes: 30,
  })
}

export async function _getPopularMovie({ language }: PopularMovieParams): Promise<PopularMovieResults> {
  return await fetch(
    `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_API_KEY}&language=${language}`
  ).then((res) => res.json())
}

export const getPopularTV = async (params: PopularTVParams) => {
  return await cached<PopularTVParams, PopularTVResults>({
    name: 'popular-tv',
    target: _getPopularTV,
    params,
    ttlMinutes: 30,
  })
}

export async function _getPopularTV({ language }: PopularTVParams): Promise<PopularTVResults> {
  return await fetch(
    `https://api.themoviedb.org/3/tv/popular?api_key=${process.env.TMDB_API_KEY}&language=${language}`
  ).then((res) => res.json())
}
