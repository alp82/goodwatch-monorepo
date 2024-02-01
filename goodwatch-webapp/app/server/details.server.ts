import { cached } from '~/utils/cache'
import { executeQuery } from '~/utils/postgres'
import { AllRatings } from '~/utils/ratings'

export interface Collection {
  id:            number
  name:          string
  overview:      string
  poster_path:   string
  backdrop_path: string
  movie_ids:      number[]
}

export interface BaseDetails extends AllRatings {
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

export interface StreamingLink {
  provider_id: number
  provider_name: string
  provider_logo_path: string
  tmdb_url: string
  stream_type: 'ads' | 'buy' | 'flatrate' | 'flatrate_and_buy' | 'free' | 'rent'
  stream_url: string
  price_dollar: number
  quality: string
  display_priority: number
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
  release_date: string | Date
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
  published_at: string | Date
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
  tmdb_id: number
  adult: boolean
  backdrop_path: string
  belongs_to_collection?: Collection
  budget: number
  genres: Genre[]
  homepage: string
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
  tmdb_id: number
  adult: boolean
  backdrop_path: string
  created_by: CreatedBy[]
  episode_run_time: number[]
  first_air_date: string
  genres: Genre[]
  homepage: string
  in_production: boolean
  languages: string[]
  last_air_date: string
  last_episode_to_air: LastEpisodeToAir
  title: string
  next_episode_to_air?: any
  networks: Network[]
  number_of_episodes: number
  number_of_seasons: number
  origin_country: string[]
  original_language: string
  original_title: string
  overview: string
  popularity: number
  poster_path: string
  production_companies: ProductionCompany[]
  production_countries: ProductionCountry[]
  seasons: Season[]
  spoken_languages: SpokenLanguage[]
  streaming_providers: StreamingProviders
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
}

export interface DetailsMovieParams {
  movieId: string
  country: string
  language: string
}

export interface DetailsTVParams {
  tvId: string
  country: string
  language: string
}

export const getCountrySpecificDetails = (details: any, country: string, language: string) => {
  const alternative_titles = (details.alternative_titles || []).filter((title: Record<string, string>) => title.iso_3166_1 === country)
  details.alternative_title = alternative_titles.length ? alternative_titles[0].title : null
  delete details.alternative_titles

  // const certifications = (details.certifications || []).filter((certification: Record<string, string>) => certification.iso_3166_1 === country)
  // details.certifications = certifications.length ? certifications[0].release_dates : null
  const certifications = (details.certifications || {})[country.toUpperCase()]
  details.certifications = certifications || null

  const streaming_providers = (details.streaming_providers || {})[country.toUpperCase()]
  details.streaming_providers = streaming_providers || null

  const translations = (details.translations || []).filter((translation: Record<string, string>) => translation.iso_3166_1 === country || translation.iso_639_1 === language)
  details.translations = translations.length ? translations : null
  return details
}

export const getDetailsForMovie = async (params: DetailsMovieParams) => {
  return await cached<DetailsMovieParams, MovieDetails>({
    name: 'details-movie',
    target: _getDetailsForMovie,
    params,
    ttlMinutes: 10,
  })
}

// TODO country & language
export async function _getDetailsForMovie({ movieId, language, country }: DetailsMovieParams): Promise<MovieDetails> {
  const result = await executeQuery(`
    SELECT
      m.*,
      json_agg(
        json_build_object(
          'provider_id', spl.provider_id,
          'provider_name', sp.name,
          'provider_logo_path', sp.logo_path,
          'tmdb_url', spl.tmdb_url,
          'stream_type', spl.stream_type,
          'stream_url', spl.stream_url,
          'price_dollar', spl.price_dollar,
          'quality', spl.quality,
          'display_priority', spl.display_priority
        )
      ) AS streaming_links
    FROM
      movies m
    LEFT JOIN
      streaming_provider_links spl
    ON
      spl.tmdb_id = m.tmdb_id
      AND spl.media_type = 'movie'
      AND spl.country_code = '${country}'
    LEFT JOIN
      streaming_providers sp
    ON
      spl.provider_id = sp.id
    WHERE
      m.tmdb_id = ${movieId}
    GROUP BY
      m.tmdb_id
    ORDER BY
      MIN(sp.display_priority);
  `);
  if (!result.rows.length) throw Error(`movie with ID "${movieId}" not found`)

  const movie = result.rows[0]
  return getCountrySpecificDetails(movie, country, language)
}

export const getDetailsForTV = async (params: DetailsTVParams) => {
  return await cached<DetailsTVParams, TVDetails>({
    name: 'details-tv',
    target: _getDetailsForTV,
    params,
    ttlMinutes: 10,
  })
}

export async function _getDetailsForTV({ tvId, language, country }: DetailsTVParams): Promise<TVDetails> {
  const result = await executeQuery(`
    SELECT
      t.*,
      json_agg(
        json_build_object(
          'provider_id', spl.provider_id,
          'provider_name', sp.name,
          'provider_logo_path', sp.logo_path,
          'stream_type', spl.stream_type,
          'stream_url', spl.stream_url,
          'price_dollar', spl.price_dollar,
          'quality', spl.quality,
          'display_priority', spl.display_priority
        )
      ) AS streaming_links
    FROM
      tv t
    LEFT JOIN
      streaming_provider_links spl
    ON
      spl.tmdb_id = t.tmdb_id
      AND spl.media_type = 'tv'
      AND spl.country_code = '${country}'
    LEFT JOIN
      streaming_providers sp
    ON
      spl.provider_id = sp.id
    WHERE
      t.tmdb_id = ${tvId}
    GROUP BY
      t.tmdb_id
    ORDER BY
      MIN(sp.display_priority);
  `);
  if (!result.rows.length) throw Error(`movie with ID "${tvId}" not found`)

  const tv = result.rows[0]
  return getCountrySpecificDetails(tv, country, language)
}
