export const COMMON_DETAILS_FIELDS = [
	"tmdb_id",
	"title",
	"release_year",
	"genres",
	"tagline",
	"synopsis",
	"poster_path",
	"backdrop_path",
	"budget",
	"revenue",
	"age_certifications",
	"keywords",
	"tropes",
	"imdb_id",
	"production_country_codes",
	"original_language_code",
	"spoken_language_codes",
	"streaming_country_codes",
	"content_advisories",
	"imdb_url",
	"metacritic_url",
	"rotten_tomatoes_url",
	"imdb_user_score_original",
	"metacritic_meta_score_original",
	"metacritic_user_score_original",
	"rotten_tomatoes_tomato_score_original",
	"rotten_tomatoes_audience_score_original",
	"goodwatch_overall_score_normalized_percent",
] as const
export const MOVIE_DETAILS_FIELDS = ["runtime", "release_date"] as const
export const SHOW_DETAILS_FIELDS = [
	"number_of_seasons",
	"number_of_episodes",
	"first_air_date",
	"last_air_date",
	"in_production",
	// The length answer of the title page's questions reads the first value.
	"episode_runtime",
] as const
export const FINGERPRINT_INPUT_FIELDS = [
	"original_title",
	"essence_text",
	"essence_tags",
	"fingerprint_scores",
	"fingerprint_highlight_keys",
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
] as const

export const COMMON_FIELDS = [
	...COMMON_DETAILS_FIELDS,
	...FINGERPRINT_INPUT_FIELDS,
] as const
export const MOVIE_SPECIFIC_FIELDS = [
	...MOVIE_DETAILS_FIELDS,
	"movie_series_id",
] as const
export const SHOW_SPECIFIC_FIELDS = SHOW_DETAILS_FIELDS
export const MOVIE_FIELDS = [
	...COMMON_FIELDS,
	...MOVIE_SPECIFIC_FIELDS,
] as const
export const SHOW_FIELDS = [...COMMON_FIELDS, ...SHOW_SPECIFIC_FIELDS] as const
export const getFieldsByMediaType = (mediaType: "movie" | "show") =>
	mediaType === "movie" ? MOVIE_FIELDS : SHOW_FIELDS
export const generateMediaFieldAssignments = (mediaType: "movie" | "show") =>
	getFieldsByMediaType(mediaType)
		.map((field) => `${field} = m.${field}`)
		.join(",\n")
