import { createClient } from '@supabase/supabase-js'
import { cached } from '~/utils/api'
import { titleToDashed } from '~/utils/helpers'
import { query } from '~/utils/postgres'

const supabase = createClient(process.env.SUPABASE_PROJECT_URL || '', process.env.SUPABASE_API_KEY || '')

export interface Part {
  adult:             boolean
  backdrop_path:     string
  id:                string
  title:             string
  original_language: string
  original_title:    string
  overview:          string
  poster_path:       string
  media_type:        string
  genre_ids:         number[]
  popularity:        number
  release_date:      Date
  video:             boolean
  vote_average:      number
  vote_count:        number
}

export interface Collection {
  id:            number
  name:          string
  overview:      string
  poster_path:   string
  backdrop_path: string
  movie_ids:      number[]
}

export interface BaseDetails {
  title_dashed: string
  title_underscored: string
  year: string
}

export interface ProviderData {
  logo_path: string
  provider_id: number
  provider_name: string
  display_priority: number
}

export interface ProviderData {
}

export interface StreamingProviders {
  buy: ProviderData[]
  flatrate: ProviderData[]
  flatrate_and_buy: ProviderData[]
  rent: ProviderData[]
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

export interface ContentRatingResult {
  descriptors: any[]
  iso_3166_1: string
  rating: string
}

export interface ContentRatings {
  results: ContentRatingResult[]
}

export enum Department {
  Acting = "Acting",
  Art = "Art",
  Camera = "Camera",
  CostumeMakeUp = "Costume & Make-Up",
  Directing = "Directing",
  Editing = "Editing",
  Lighting = "Lighting",
  Production = "Production",
  Sound = "Sound",
  Writing = "Writing",
}

export interface Cast {
  adult:                boolean
  gender:               number
  id:                   number
  known_for_department: Department
  name:                 string
  original_name:        string
  popularity:           number
  profile_path:         null | string
  cast_id?:             number
  character?:           string
  credit_id:            string
  order?:               number
  department?:          Department
  job?:                 string
}

export interface Credits {
  cast: Cast[]
  crew: Cast[]
}

export interface KeywordResult {
  name: string
  id: number
}

export interface Keywords {
  results: KeywordResult[]
}

export interface RecommendationResult {
  adult: boolean
  backdrop_path: string
  id: number
  name: string
  original_language: string
  original_name: string
  overview: string
  poster_path: string
  media_type: string
  genre_ids: number[]
  popularity: number
  first_air_date: string
  vote_average: number
  vote_count: number
  origin_country: string[]
}

export interface Recommendations {
  page: number
  results: RecommendationResult[]
  total_pages: number
  total_results: number
}

export interface ReleaseDate {
  certification: string
  descriptors: any[]
  iso_639_1: string
  note: string
  release_date: Date
  type: number
}

export interface ReleaseDatesResult {
  iso_3166_1: string
  release_dates: ReleaseDate[]
}

export interface ReleaseDates {
  results: ReleaseDatesResult[]
}

export interface VideoResult {
  iso_639_1: string
  iso_3166_1: string
  name: string
  key: string
  published_at: Date
  site: string
  size: number
  type: string
  official: boolean
  id: string
}

export interface Videos {
  clips: VideoResult[]
  featurettes: VideoResult[]
  trailers: VideoResult[]
}

export interface MovieDetails extends BaseDetails {
  adult: boolean
  backdrop_path: string
  belongs_to_collection?: Collection
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
  credits: Credits
  keywords: Keywords
  recommendations: Recommendations
  release_dates: ReleaseDates
  videos: Videos
  streaming_providers: StreamingProviders
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

export interface TVDetails extends BaseDetails {
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
  content_ratings: ContentRatings
  credits: Credits
  external_ids: ExternalIds
  keywords: Keywords
  recommendations: Recommendations
  videos: Videos
  ['watch/providers']: StreamingProviders
}

export interface DetailsMovieParams {
  movieId: string
  language: string
  country: string
}

export interface DetailsTVParams {
  tvId: string
  language: string
  country: string
}

export const getDetailsForMovie = async (params: DetailsMovieParams) => {
  return await cached<DetailsMovieParams, MovieDetails>({
    name: 'details-movie',
    target: _getDetailsForMovie,
    params,
    //TODO ttlMinutes: 60 * 12,
    ttlMinutes: 0,
  })
}

// TODO country & language
export async function _getDetailsForMovie({ movieId, language, country }: DetailsMovieParams): Promise<MovieDetails> {
  const result = await query(`SELECT * FROM movies WHERE tmdb_id = ${movieId}`);
  if (!result.rows.length) throw Error(`movie with ID "${movieId}" not found`)

  const movie = result.rows[0]

  const alternative_titles = movie.alternative_titles.filter((title: Record<string, string>) => title.iso_3166_1 === country)
  movie.alternative_title = alternative_titles.length ? alternative_titles[0].title : null
  delete movie.alternative_titles

  const certifications = movie.certifications.filter((certification: Record<string, string>) => certification.iso_3166_1 === country)
  movie.certifications = certifications.length ? certifications[0].release_dates : null

  const streaming_providers = movie.streaming_providers[country.toUpperCase()]
  movie.streaming_providers = streaming_providers || null

  const translations = movie.translations.filter((translation: Record<string, string>) => translation.iso_3166_1 === country || translation.iso_639_1 === language)
  movie.translations = translations.length ? translations : null

  const { data, error } = await supabase
      .from('keywords')
      .upsert(movie.keywords)
      .select()
  if (error) {
    console.error({ data, error })
  }

  return movie
}

export const getDetailsForTV = async (params: DetailsTVParams) => {
  return await cached<DetailsTVParams, TVDetails>({
    name: 'details-tv',
    target: _getDetailsForTV,
    params,
    //TODO ttlMinutes: 60 * 12,
    ttlMinutes: 0,
  })
}

export async function _getDetailsForTV({ tvId, language, country }: DetailsTVParams): Promise<TVDetails> {
  const result = await query(`SELECT * FROM tv WHERE tmdb_id = ${tvId}`);
  if (!result.rows.length) throw Error(`movie with ID "${tvId}" not found`)

  const tv = result.rows[0]

  const alternative_titles = tv.alternative_titles.filter((title: Record<string, string>) => title.iso_3166_1 === country)
  tv.alternative_title = alternative_titles.length ? alternative_titles[0].title : null
  delete tv.alternative_titles

  const certifications = tv.certifications[country.toUpperCase()]
  tv.certifications = certifications || null

  const streaming_providers = tv.streaming_providers[country.toUpperCase()]
  tv.streaming_providers = streaming_providers || null

  const translations = tv.translations.filter((translation: Record<string, string>) => translation.iso_3166_1 === country || translation.iso_639_1 === language)
  tv.translations = translations.length ? translations : null

  const { data, error } = await supabase
    .from('keywords')
    .upsert(tv.keywords)
    .select()
  if (error) {
    console.error({ data, error })
  }

  return tv
}
