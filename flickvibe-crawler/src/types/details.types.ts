import {Ratings} from '../scraper/ratings'

export interface BaseDetails {
  titles_dashed: string[]
  titles_underscored: string[]
  titles_pascal_cased: string[]
  year: string
}

export interface TMDBMovieDetails extends BaseDetails {
  adult: boolean
  backdrop_path: string
  belongs_to_collection?: TMDBCollection
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
  alternative_titles: AlternativeTitlesMovie
  credits: CreditsMovie
  external_ids: ExternalIds
  images: Images
  keywords: Keywords
  recommendations: Recommendations
  release_dates: ReleaseDates
  similar: Recommendations
  translations: Translations
  videos: Videos
  ['watch/providers']: WatchProviders
}

export interface TMDBTvDetails extends BaseDetails {
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
  aggregate_credits: CreditsTv
  alternative_titles: AlternativeTitlesTV
  content_ratings: ContentRatings
  external_ids: ExternalIds
  images: Images
  keywords: Keywords
  recommendations: Recommendations
  similar: Recommendations
  translations: Translations
  videos: Videos
  ['watch/providers']: WatchProviders
}

export interface AlternativeTitlesMovie {
  titles: AlternativeTitle[]
}

export interface AlternativeTitlesTV {
  results: AlternativeTitle[]
}

export interface AlternativeTitle {
  iso_3166_1: string
  title: string
  type: string
}

export interface TMDBCollection {
  id: number
  name: string
  overview: string
  poster_path: string
  backdrop_path: string
  parts: Part[]
}

export interface Part {
  adult: boolean
  backdrop_path: string
  id: string
  title: string
  original_language: string
  original_title: string
  overview: string
  poster_path: string
  media_type: string
  genre_ids: number[]
  popularity: number
  release_date: Date
  video: boolean
  vote_average: number
  vote_count: number
}

export interface WatchProviders {
  results: Record<string, ProviderData>
}

export interface ProviderData {
  link: string
  flatrate: Provider[]
  buy: Provider[]
  rent: Provider[]
  ads: Provider[]
  free: Provider[]
}

export interface Provider {
  logo_path: string
  provider_id: number
  provider_name: string
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
  iso_639_1: string
  english_name: string
  name?: string
  native_name?: string
  folded_name?: string
}

export interface ContentRatingResult {
  descriptors: any[]
  iso_3166_1: string
  rating: string
}

export interface ContentRatings {
  results: ContentRatingResult[]
}

export interface CreditsMovie {
  cast: CastMovie[]
  crew: CrewMovie[]
}

export interface CreditsTv {
  cast: CastTv[]
  crew: CrewTv[]
}

export interface CastMovie {
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path: null | string
  cast_id?: number
  credit_id: string
  character?: string
  order?: number
}

export interface CrewMovie {
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path: null | string
  crew_id?: number
  credit_id: string
  department?: string
  job?: string
  order?: number
}

export interface CastTv {
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path: null | string
  roles: Role[]
  total_episode_count: number
  order?: number
}

export interface CrewTv {
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path: null | string
  jobs: Job[]
  department: number
  total_episode_count: number
}

export interface Role {
  credit_id: string
  character: string
  episode_count: number
}

export interface Job {
  credit_id: string
  job: string
  episode_count: number
}

export interface Images {
  backdrops: Backdrop[]
  logos: Backdrop[]
  posters: Backdrop[]
}

export interface Backdrop {
  aspect_ratio: number
  height: number
  iso_639_1: null | string
  file_path: string
  vote_average: number
  vote_count: number
  width: number
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
  iso_639_1: SpokenLanguage
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

export interface Translations {
  translations: Translation[]
}

export interface Translation {
  iso_3166_1: string
  iso_639_1: string
  name: string
  english_name: string
  data: TranslationData
}

export interface TranslationData {
  homepage?: string
  overview: string
  runtime: number
  tagline: string
  title?: string
  name?: string
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
