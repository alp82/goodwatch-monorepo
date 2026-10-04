import type { FingerprintResult } from "~/server/utils/fingerprint"
import type { AllRatings } from "~/utils/ratings"

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

// Fields marked optional are read from the database but left out of the details page payload.
export interface Actor {
	id: number
	credit_id?: string
	name: string
	character: string
	popularity?: number
	profile_path: null | string
	order_default: number
	episode_count_character?: number | null
	episode_count_total?: number | null
}

export interface Crew {
	id: number
	credit_id: string
	name: string
	job: string
	department: string
	popularity: number
	episode_count_job?: number | null
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

export interface BaseDetails
	extends Pick<
		AllRatings,
		| "imdb_url"
		| "metacritic_url"
		| "rotten_tomatoes_url"
		| "imdb_user_score_original"
		| "metacritic_meta_score_original"
		| "metacritic_user_score_original"
		| "rotten_tomatoes_tomato_score_original"
		| "rotten_tomatoes_audience_score_original"
		| "goodwatch_overall_score_normalized_percent"
	> {
	tmdb_id: number
	title: string
	release_year: string
	genres: string[]
	tagline: string
	synopsis: string
	poster_path: string
	backdrop_path: string
	budget: number | null
	revenue: number | null
	age_certifications: string[]
	keywords: string[]
	tropes: string[]
	imdb_id: string | null
	production_country_codes: string[]
	original_language_code: string
	spoken_language_codes: string[]
	streaming_country_codes: string[]
	content_advisories: string[]
	tropes_count: number
}
export interface MovieDetails extends BaseDetails {
	runtime: number | null
	release_date: string
}
export interface ShowDetails extends BaseDetails {
	number_of_seasons: number
	number_of_episodes: number
	first_air_date: string
	last_air_date: string
	in_production: boolean
	/** Episode lengths in minutes. Missing on values cached before the field was read, and on many shows. */
	episode_runtime?: number[] | null
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

export {
	COMMON_FIELDS,
	MOVIE_SPECIFIC_FIELDS,
	SHOW_SPECIFIC_FIELDS,
	MOVIE_FIELDS,
	SHOW_FIELDS,
	getFieldsByMediaType,
	generateMediaFieldAssignments,
} from "~/server/title-details-fields"

/** One actor with a photo and all their characters in this title. */
export interface CastMember {
	id: number
	name: string
	characters: string[]
	profile_path: string
}
export interface CrewPerson {
	id: number
	credit_id: string
	name: string
}
/** The four crew lines, at most three people each. */
export interface CrewLines {
	directors: CrewPerson[]
	writers: CrewPerson[]
	producers: CrewPerson[]
	composers: CrewPerson[]
}
export interface CreditedPeople {
	actors: { id: number; name: string }[]
	directors: { id: number; name: string }[]
	composers: { id: number; name: string }[]
	executive_producers: { id: number; name: string }[]
}
export interface MovieSeriesResult {
	id: number
	movie_ids: number[]
}
export interface SeasonResult {
	season_number: number
	episode_count: number
}
/** The fingerprint as the details carry it: what the title page and the server consumers read. */
export interface TitleFingerprint
	extends Pick<
		FingerprintResult,
		"scores" | "highlightKeys" | "essenceTags" | "pillars"
	> {
	socialSuitability: { name: string }[]
	viewingContext: { name: string }[]
}
export interface ResultBase {
	streaming_availabilities: Pick<
		StreamingAvailability,
		"streaming_service_id" | "streaming_type" | "stream_url"
	>[]
	streaming_services: StreamingService[]
	images: { backdrops: { file_path: string }[] }
	videos: {
		clips: { key: string }[] | null
		trailers: { key: string }[] | null
		featurettes: { key: string }[] | null
	}
	cast: CastMember[]
	cast_total: number
	crew: CrewLines
	credits: CreditedPeople
	fingerprint: TitleFingerprint | null
}
export interface MovieResult extends ResultBase {
	details: MovieDetails
	mediaType: "movie"
	movie_series?: MovieSeriesResult
}
export interface ShowResult extends ResultBase {
	details: ShowDetails
	mediaType: "show"
	seasons: SeasonResult[]
}
export type MovieQueryResult = MovieResult
export type ShowQueryResult = ShowResult
