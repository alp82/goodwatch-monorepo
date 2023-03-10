import { createClient } from '@supabase/supabase-js'
import { Ratings } from '~/server/ratings.server'

const supabase = createClient(process.env.SUPABASE_PROJECT_URL || '', process.env.SUPABASE_API_KEY || '')

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

export async function getPopularMovie(language: string = 'en'): Promise<PopularMovieResults> {
  const cachedData = await supabase
    .from('cached-popular-movie')
    .select()
    .eq('language', language)
  if (cachedData.data?.length && (Date.now() - new Date(cachedData.data[0].lastUpdated)) < 1000 * 60 * 60 * 1) {
    return cachedData.data[0].popular as unknown as PopularMovieResults
  }

  const popular = await fetch(
    `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_API_KEY}&language=${language}`
  ).then((res) => res.json())

  const lastUpdated = (new Date()).toISOString()
  const { data, error} = await supabase
    .from('cached-popular-movie')
    .upsert({ language, lastUpdated, popular })
    .select()
  return popular
}

export async function getPopularTV(language: string = 'en'): Promise<PopularTVResults> {
  const cachedData = await supabase
    .from('cached-popular-tv')
    .select()
    .eq('language', language)
  if (cachedData.data?.length && (Date.now() - new Date(cachedData.data[0].lastUpdated)) < 1000 * 60 * 60 * 1) {
    return cachedData.data[0].popular as unknown as PopularTVResults
  }

  const popular = await fetch(
    `https://api.themoviedb.org/3/tv/popular?api_key=${process.env.TMDB_API_KEY}&language=${language}`
  ).then((res) => res.json())

  const lastUpdated = (new Date()).toISOString()
  const { data, error} = await supabase
    .from('cached-popular-tv')
    .upsert({ language, lastUpdated, popular })
    .select()
  return popular
}
