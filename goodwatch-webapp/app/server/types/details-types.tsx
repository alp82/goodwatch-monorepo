import type { AllRatings } from "~/utils/ratings"
import type { FingerprintResult } from "~/server/utils/fingerprint"

export interface Collection {
	id: number
	name: string
	overview: string
	poster_path: string
	backdrop_path: string
	movie_ids: number[]
}

export interface Trope {
	url: string
	name: string
	html: string
}

export type StreamingType =
	| "ads"
	| "buy"
	| "flatrate"
	| "flatrate_and_buy"
	| "free"
	| "rent"

export interface StreamingAvailability {
	streaming_service_id: number
	streaming_type: StreamingType
	tmdb_link: string
	stream_url: string | null
	price_dollar: number | null
	quality: string | null
}

export interface StreamingService {
	tmdb_id: number
	name: string
	logo: string
	order_default: number
}

export interface Genre {
	id: number
	name: string
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

export interface Actor {
	id: number
	credit_id: string
	name: string
	character: string
	popularity: number
	profile_path: null | string
	order_default: number
	episode_count_character: number | null
	episode_count_total: number | null
}

export interface Crew {
	id: number
	credit_id: string
	name: string
	job: string
	department: string
	popularity: number
	episode_count_job: number | null
	episode_count_total: number | null
}

export interface AgeCertification {
	certification_code: string
	meaning: string
	order_default: number
}

export interface Release {
	country_code: string
	release_type: number
	release_date: string
	certification: string
	note: string
	descriptors: string[]
}

export interface ImageResult {
	iso_639_1?: string
	file_path: string
	width: number
	height: number
	aspect_ratio: number
	vote_count: number
	vote_average: number
}

export interface Images {
	backdrops: ImageResult[]
	logos: ImageResult[]
	posters: ImageResult[]
}

export interface VideoResult {
	id: string
	iso_639_1: string
	iso_3166_1: string
	name: string
	key: string
	published_at: string | Date
	site: string
	size: number
	type: string
	official: boolean
}

export interface Videos {
	clips: VideoResult[]
	featurettes: VideoResult[]
	trailers: VideoResult[]
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

export interface BaseDetails extends AllRatings {
	tmdb_id: number
	title: string
	original_title: string
	tagline: string
	synopsis: string
	popularity: number
	status: string
	adult: boolean
	poster_path: string
	backdrop_path: string
	release_year: string
	budget: number | null
	revenue: number | null

	age_certifications: string[]
	genres: string[]
	keywords: string[]
	tropes: string[]
	homepage: string | null
	imdb_id: string | null
	freebase_mid: string | null
	freebase_id: string | null
	tvdb_id: number | null
	tvrage_id: number | null
	wikidata_id: string | null
	facebook_id: string | null
	instagram_id: string | null
	twitter_id: string | null

	production_company_ids: number[]
	production_country_codes: string[]
	origin_country_codes: string[]
	original_language_code: string
	spoken_language_codes: string[]
	streaming_country_codes: string[]
	streaming_service_ids: number[]
	streaming_availabilities: string[]
	tmdb_recommendation_ids: number[]
	tmdb_similar_ids: number[]

	is_anime: boolean | null
	production_method: string | null
	animation_style: string | null
	// TODO remove raw fingerprint fields from result
	fingerprint: FingerprintResult | null
}

export interface MovieDetails extends BaseDetails {
	media_type: "movie"
	collection?: Collection
	release_date: string
	runtime: number | null
}

export interface ShowDetails extends BaseDetails {
	media_type: "show"
	// TODO add created_by
	in_production: boolean
	first_air_date: string
	last_air_date: string
	// TODO add last_episode_to_air
	// TODO add next_episode_to_air
	episode_run_time: number[]
	number_of_episodes: number
	number_of_seasons: number
	network_ids: Network[]
}

export interface AlternativeTitle {
	country_code: string
	title: string
}

export interface Translation {
	country_code: string
	language_code: string
	homepage: string | null
	runtime: number | null
	overview: string | null
	tagline: string | null
	title: string | null
}

export interface DetailsMovieParams {
	movieId: string
	country: string
	language: string
}

export interface DetailsShowParams {
	showId: string
	country: string
	language: string
}

// Dynamic field definitions based on database schema
export const COMMON_FIELDS = [
	"tmdb_id",
	"title",
	"original_title",
	"tagline",
	"synopsis",
	"popularity",
	"status",
	"adult",
	"poster_path",
	"backdrop_path",
	"release_year",
	"budget",
	"revenue",
	"age_certifications",
	"genres",
	"keywords",
	"tropes",
	"homepage",
	"imdb_id",
	"wikidata_id",
	"facebook_id",
	"instagram_id",
	"twitter_id",
	"production_company_ids",
	"production_country_codes",
	"origin_country_codes",
	"original_language_code",
	"spoken_language_codes",
	"is_anime",
	"production_method",
	"animation_style",
	"tmdb_url",
	"tmdb_user_score_original",
	"tmdb_user_score_normalized_percent",
	"tmdb_user_score_rating_count",
	"imdb_url",
	"imdb_user_score_original",
	"imdb_user_score_normalized_percent",
	"imdb_user_score_rating_count",
	"metacritic_url",
	"metacritic_user_score_original",
	"metacritic_user_score_normalized_percent",
	"metacritic_user_score_rating_count",
	"metacritic_meta_score_original",
	"metacritic_meta_score_normalized_percent",
	"metacritic_meta_score_review_count",
	"rotten_tomatoes_url",
	"rotten_tomatoes_audience_score_original",
	"rotten_tomatoes_audience_score_normalized_percent",
	"rotten_tomatoes_audience_score_rating_count",
	"rotten_tomatoes_tomato_score_original",
	"rotten_tomatoes_tomato_score_normalized_percent",
	"rotten_tomatoes_tomato_score_review_count",
	"goodwatch_user_score_normalized_percent",
	"goodwatch_user_score_rating_count",
	"goodwatch_official_score_normalized_percent",
	"goodwatch_official_score_review_count",
	"goodwatch_overall_score_normalized_percent",
	"goodwatch_overall_score_voting_count",
	"streaming_country_codes",
	"streaming_service_ids",
	"streaming_availabilities",
	"tmdb_recommendation_ids",
	"tmdb_similar_ids",
	"essence_text",
	"essence_tags",
	"fingerprint_scores",
	"fingerprint_highlight_keys",
	"content_advisories",
	"suitability_solo_watch",
	"suitability_date_night",
	"suitability_group_party",
	"suitability_family",
	"suitability_partner",
	"suitability_friends",
	"suitability_kids",
	"suitability_teens",
	"suitability_adults",
	"suitability_intergenerational",
	"suitability_public_viewing_safe",
	"context_is_thought_provoking",
	"context_is_pure_escapism",
	"context_is_background_friendly",
	"context_is_comfort_watch",
	"context_is_binge_friendly",
	"context_is_drop_in_friendly",
	"tmdb_details_created_at",
	"tmdb_details_updated_at",
	"tmdb_providers_created_at",
	"tmdb_providers_updated_at",
	"imdb_ratings_created_at",
	"imdb_ratings_updated_at",
	"metacritic_ratings_created_at",
	"metacritic_ratings_updated_at",
	"rotten_tomatoes_ratings_created_at",
	"rotten_tomatoes_ratings_updated_at",
	"tvtropes_tags_created_at",
	"tvtropes_tags_updated_at",
	"dna_created_at",
	"dna_updated_at",
] as const

export const MOVIE_SPECIFIC_FIELDS = [
	"release_date",
	"movie_series_id",
	"runtime",
] as const

export const SHOW_SPECIFIC_FIELDS = [
	"first_air_date",
	"last_air_date",
	"number_of_seasons",
	"number_of_episodes",
	"episode_runtime",
	"in_production",
	"network_ids",
] as const

export type CommonField = (typeof COMMON_FIELDS)[number]
export type MovieSpecificField = (typeof MOVIE_SPECIFIC_FIELDS)[number]
export type ShowSpecificField = (typeof SHOW_SPECIFIC_FIELDS)[number]

export const MOVIE_FIELDS = [
	...COMMON_FIELDS,
	...MOVIE_SPECIFIC_FIELDS,
] as const
export const SHOW_FIELDS = [...COMMON_FIELDS, ...SHOW_SPECIFIC_FIELDS] as const

export type MovieField = (typeof MOVIE_FIELDS)[number]
export type ShowField = (typeof SHOW_FIELDS)[number]

// Helper function to dynamically get fields based on media type
export const getFieldsByMediaType = (
	mediaType: "movie" | "show",
): readonly string[] => {
	return mediaType === "movie" ? MOVIE_FIELDS : SHOW_FIELDS
}

// Helper function to generate SQL field assignments for the media object
export const generateMediaFieldAssignments = (
	mediaType: "movie" | "show",
): string => {
	const fields = getFieldsByMediaType(mediaType)
	return fields.map((field) => `${field} = m.${field}`).join(",\n\t\t\t\t\t\t")
}

// Raw query result types for database fetch
export interface MovieSeriesResult {
	id: number
	name: string
	poster_path: string | null
	backdrop_path: string | null
	movie_ids: number[]
}

export interface SeasonResult {
	id: number
	name: string
	season_number: number
	air_date: string | null
	episode_count: number
	overview: string | null
	poster_path: string | null
	vote_average: number
}

export interface RawMediaResult {
	[key: string]: unknown // This allows for dynamic fields based on mediaType
}

export interface QueryResultBase {
	details: RawMediaResult
	alternative_titles: AlternativeTitle[]
	translations: Translation[]
	releases: Release[]
	age_certifications: AgeCertification[]
	streaming_availabilities: StreamingAvailability[]
	streaming_services: StreamingService[]
	actors: Actor[]
	crew: Crew[]
	images: Images
	videos: Videos
}

export interface MovieQueryResult extends QueryResultBase {
	movie_series?: MovieSeriesResult
}

export interface ShowQueryResult extends QueryResultBase {
	seasons: SeasonResult[]
}

export type QueryResult = MovieQueryResult | ShowQueryResult

export interface MovieResult extends MovieQueryResult {
	details: MovieDetails
	mediaType: "movie"
	fingerprint: FingerprintResult
}

export interface ShowResult extends ShowQueryResult {
	details: ShowDetails
	mediaType: "show"
	fingerprint: FingerprintResult
}
