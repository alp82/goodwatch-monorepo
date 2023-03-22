import { cached } from '~/utils/api'
import { titleToDashed } from '~/utils/helpers'
import { createClient } from '@supabase/supabase-js'

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

export interface BelongsToCollection {
  id:            number
  name:          string
  overview:      string
  poster_path:   string
  backdrop_path: string
  parts:         Part[]
}

export interface BaseDetails {
  title_dashed: string
  title_underscored: string
  year: string
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

export interface ContentRatingResult {
  descriptors: any[]
  iso_3166_1: string
  rating: string
}

export interface ContentRatings {
  results: ContentRatingResult[]
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
  results: VideoResult[]
}

export interface MovieDetails extends BaseDetails {
  adult: boolean
  backdrop_path: string
  belongs_to_collection?: BelongsToCollection
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
  keywords: Keywords
  recommendations: Recommendations
  release_dates: ReleaseDates
  videos: Videos
  ['watch/providers']: WatchProviders
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
  external_ids: ExternalIds
  keywords: Keywords
  recommendations: Recommendations
  videos: Videos
  ['watch/providers']: WatchProviders
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
    `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=keywords,recommendations,release_dates,videos,watch/providers`
  ).then((res) => res.json())

  if (details.belongs_to_collection) {
    details.belongs_to_collection = await fetch(
      `https://api.themoviedb.org/3/collection/${details.belongs_to_collection.id}?api_key=${process.env.TMDB_API_KEY}`
    ).then((res) => res.json())
  }

  const title_dashed = titleToDashed(details.title)
  const title_underscored = title_dashed.replace(/-/g, '_')
  const year = details?.release_date?.split('-')?.[0] || '0'

  const { data, error } = await supabase
    .from('keywords')
    .upsert(details.keywords.keywords)
    .select()
  if (error) {
    console.error({ data, error })
  }

  return {
    ...details,
    keywords: {
      results: details.keywords.keywords,
    },
    title_dashed,
    title_underscored,
    year,
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
    `https://api.themoviedb.org/3/tv/${tvId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=content_ratings,external_ids,keywords,recommendations,videos,watch/providers`
  ).then((res) => res.json())

  const title_dashed = titleToDashed(details.name)
  const title_underscored = title_dashed.replace(/-/g, '_')
  const year = details?.first_air_date?.split('-')?.[0] || '0'

  const { data, error } = await supabase
    .from('keywords')
    .upsert(details.keywords.results)
    .select()
  if (error) {
    console.error({ data, error })
  }

  return {
    ...details,
    title_dashed,
    title_underscored,
    year,
  }
}
