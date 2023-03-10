import { cached } from '~/utils/api'

export enum StreamingProvider {
  apple_tv = 2,
}

export interface StreamingUrls {
  netflix?: string
  prime?: string
  disney_plus?: string
}

export interface Flatrate {
  logo_path: string
  provider_id: number
  provider_name: string
  display_priority: number
}

export interface Buy {
  logo_path: string
  provider_id: number
  provider_name: string
  display_priority: number
}

export interface Rent {
  logo_path: string
  provider_id: number
  provider_name: string
  display_priority: number
}

export interface ProviderData {
  link: string
  flatrate: Flatrate[]
  buy: Buy[]
  rent: Rent[]
}

export interface WatchProviders {
  results: Record<string, ProviderData>
}

export interface Genre {
  id: number
  name: string
}

export interface ProductionCompany {
  id: number
  logo_path: string
  name: string
  origin_country: string
}

export interface ProductionCountry {
  iso_3166_1: string
  name: string
}

export interface SpokenLanguage {
  english_name: string
  iso_639_1: string
  name: string
}

export interface MovieDetails {
  adult: boolean
  backdrop_path: string
  belongs_to_collection?: any
  budget: number
  genres: Genre[]
  homepage: string
  id: number
  imdb_id: string
  original_language: string
  original_title: string
  overview: string
  popularity: number
  poster_path: string
  production_companies: ProductionCompany[]
  production_countries: ProductionCountry[]
  release_date: string
  revenue: number
  runtime: number
  spoken_languages: SpokenLanguage[]
  status: string
  tagline: string
  title: string
  video: boolean
  vote_average: number
  vote_count: number
  ['watch/providers']: WatchProviders
  streaming_urls: StreamingUrls
}

export interface CreatedBy {
  id: number
  credit_id: string
  name: string
  gender: number
  profile_path: string
}

export interface LastEpisodeToAir {
  id: number
  name: string
  overview: string
  vote_average: number
  vote_count: number
  air_date: string
  episode_number: number
  production_code: string
  runtime: number
  season_number: number
  show_id: number
  still_path: string
}

export interface Network {
  id: number
  logo_path: string
  name: string
  origin_country: string
}

export interface Season {
  air_date: string
  episode_count: number
  id: number
  name: string
  overview: string
  poster_path: string
  season_number: number
}

export interface ExternalIds {
  imdb_id: string
  freebase_mid: string
  freebase_id: string
  tvdb_id: number
  tvrage_id: number
  wikidata_id: string
  facebook_id: string
  instagram_id: string
  twitter_id: string
}

export interface TVDetails {
  adult: boolean
  backdrop_path: string
  created_by: CreatedBy[]
  episode_run_time: number[]
  first_air_date: string
  genres: Genre[]
  homepage: string
  id: number
  in_production: boolean
  languages: string[]
  last_air_date: string
  last_episode_to_air: LastEpisodeToAir
  name: string
  next_episode_to_air?: any
  networks: Network[]
  number_of_episodes: number
  number_of_seasons: number
  origin_country: string[]
  original_language: string
  original_name: string
  overview: string
  popularity: number
  poster_path: string
  production_companies: ProductionCompany[]
  production_countries: ProductionCountry[]
  seasons: Season[]
  spoken_languages: SpokenLanguage[]
  status: string
  tagline: string
  type: string
  vote_average: number
  vote_count: number
  external_ids: ExternalIds
  ['watch/providers']: WatchProviders
  streaming_urls: StreamingUrls
}

export interface DetailsMovieParams {
  movieId: string
  language: string
}

export interface DetailsTVParams {
  tvId: string
  language: string
}

export const getDetailsForMovie = async (params: DetailsMovieParams) => {
  return await cached<DetailsMovieParams, MovieDetails>({
    name: 'details-movie',
    target: _getDetailsForMovie,
    params,
    ttlMinutes: 60 * 12,
  })
}

export async function _getDetailsForMovie({ movieId, language }: DetailsMovieParams): Promise<MovieDetails> {
  const details = await fetch(
    `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=videos,watch/providers`
  ).then((res) => res.json())

  return {
    ...details,
    streaming_urls: {

    }
  }
}

export const getDetailsForTV = async (params: DetailsTVParams) => {
  return await cached<DetailsTVParams, TVDetails>({
    name: 'details-tv',
    target: _getDetailsForTV,
    params,
    ttlMinutes: 60 * 12,
  })
}

export async function _getDetailsForTV({ tvId, language }: DetailsTVParams): Promise<TVDetails> {
  const details = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=external_ids,videos,watch/providers`
  ).then((res) => res.json())

  return {
    ...details,
    streaming_urls: {

    }
  }
}
