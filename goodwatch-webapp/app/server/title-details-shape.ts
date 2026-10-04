import type {
	CastMember,
	MovieDetails,
	MovieResult,
	MovieSeriesResult,
	ResultBase,
	SeasonResult,
	ShowDetails,
	ShowResult,
	TitleFingerprint,
} from "~/server/types/details-types"
import {
	type DNAAnalysis,
	type FingerprintResult,
	buildFingerprint,
} from "~/server/utils/fingerprint"
import { SOURCE_KEYWORDS, featuredTropes } from "~/ui/details/titleQuestions"
import { documentCast } from "~/utils/title-cast"
import {
	COMMON_DETAILS_FIELDS,
	MOVIE_DETAILS_FIELDS,
	SHOW_DETAILS_FIELDS,
} from "./title-details-fields"

export interface CastRow {
	id: number
	name: string
	character: string | null
	profile_path: string | null
	order_default: number
}
export interface RawTitleDetails {
	details: Partial<MovieDetails & ShowDetails> &
		Partial<DNAAnalysis> & {
			original_title?: string
			fingerprint_scores?: DNAAnalysis["scores"]
			fingerprint_highlight_keys?: DNAAnalysis["highlightKeys"]
			essence_tags?: DNAAnalysis["essenceTags"]
			essence_text?: DNAAnalysis["essenceText"]
		}
	movie_series?: MovieSeriesResult | null
	seasons?: SeasonResult[] | null
	streaming_availabilities?: ResultBase["streaming_availabilities"] | null
	streaming_services?: ResultBase["streaming_services"] | null
	images?: { backdrops?: { file_path: string }[] | null }
	videos?: ResultBase["videos"]
	cast_rows?: CastRow[] | null
	cast_total?: number
	cast_lead_rows?: ResultBase["credits"]["actors"] | null
	crew?: ResultBase["crew"]
	credits?: Omit<ResultBase["credits"], "actors">
}

export function toCastMembers(
	rows: readonly CastRow[] | null | undefined,
): CastMember[] {
	const people = new Map<number, { member: CastMember; order: number }>()
	for (const row of rows ?? []) {
		if (!row.profile_path) continue
		let entry = people.get(row.id)
		if (!entry) {
			entry = {
				member: {
					id: row.id,
					name: row.name,
					characters: [],
					profile_path: row.profile_path,
				},
				order: row.order_default,
			}
			people.set(row.id, entry)
		}
		if (row.character && !entry.member.characters.includes(row.character))
			entry.member.characters.push(row.character)
	}
	return [...people.values()]
		.sort((a, b) => a.order - b.order)
		.map((entry) => entry.member)
}

/** The country whose age rating the page falls back to (see ageInfo in titleQuestions) and the structured data names. */
const FALLBACK_RATING_COUNTRY = "US"

/**
 * The details as every consumer reads them, and as the data cache stores them: the title page, its meta tags and
 * structured data, the Open Graph card, the showcase and the related-by-category lookup. `country` is the country of
 * the request and part of the cache key.
 */
export function trimTitleDetails(
	raw: RawTitleDetails,
	mediaType: "movie",
	country?: string,
): MovieResult
export function trimTitleDetails(
	raw: RawTitleDetails,
	mediaType: "show",
	country?: string,
): ShowResult
export function trimTitleDetails(
	raw: RawTitleDetails,
	mediaType: "movie" | "show",
	country?: string,
): MovieResult | ShowResult
export function trimTitleDetails(
	raw: RawTitleDetails,
	mediaType: "movie" | "show",
	country = "",
): MovieResult | ShowResult {
	const fields = [
		...COMMON_DETAILS_FIELDS,
		...(mediaType === "movie" ? MOVIE_DETAILS_FIELDS : SHOW_DETAILS_FIELDS),
	]
	const details = Object.fromEntries(
		fields.map((key) => [key, raw.details[key]]),
	) as unknown as MovieDetails & ShowDetails
	details.title = details.title || raw.details.original_title || ""
	details.genres = details.genres || []
	const built = _processFingerprint({
		...raw,
		details: { ...raw.details, genres: details.genres },
	})
	// No consumer reads the essence text, or more than the name of a suitability or context entry.
	const fingerprint: TitleFingerprint | null = built && {
		scores: built.scores,
		highlightKeys: built.highlightKeys,
		essenceTags: built.essenceTags,
		socialSuitability: built.socialSuitability.map(({ name }) => ({ name })),
		viewingContext: built.viewingContext.map(({ name }) => ({ name })),
		pillars: built.pillars,
	}
	// The page shows the rating of the request's country, or the fallback country's.
	const ratingCountries = [country.toUpperCase(), FALLBACK_RATING_COUNTRY]
	details.age_certifications = (details.age_certifications ?? []).filter(
		(certification) =>
			ratingCountries.some(
				(code) => code && certification.startsWith(`${code}_`),
			),
	)
	// featuredTropes must see the full list before tropes_count marks it as trimmed.
	details.tropes = featuredTropes({ details })
	details.tropes_count = raw.details.tropes?.length ?? 0
	details.keywords = (raw.details.keywords ?? []).filter((keyword) =>
		(SOURCE_KEYWORDS as readonly string[]).includes(keyword),
	)
	const video = (rows: { key: string }[] | null | undefined) =>
		rows == null ? null : rows.map(({ key }) => ({ key }))
	const common: ResultBase = {
		fingerprint,
		cast: documentCast(toCastMembers(raw.cast_rows), raw.cast_total ?? 0),
		cast_total: raw.cast_total ?? 0,
		crew: raw.crew ?? {
			directors: [],
			writers: [],
			producers: [],
			composers: [],
		},
		credits: {
			actors: raw.cast_lead_rows ?? [],
			directors: raw.credits?.directors ?? [],
			composers: raw.credits?.composers ?? [],
			executive_producers: raw.credits?.executive_producers ?? [],
		},
		streaming_availabilities: (raw.streaming_availabilities ?? []).map(
			({ streaming_service_id, streaming_type, stream_url }) => ({
				streaming_service_id,
				streaming_type,
				stream_url,
			}),
		),
		streaming_services: (raw.streaming_services ?? []).map(
			({ tmdb_id, name, logo, order_default }) => ({
				tmdb_id,
				name,
				logo,
				order_default,
			}),
		),
		images: {
			backdrops: (raw.images?.backdrops ?? [])
				.slice(0, 1)
				.map(({ file_path }) => ({ file_path })),
		},
		videos: {
			clips: video(raw.videos?.clips),
			trailers: video(raw.videos?.trailers),
			featurettes: video(raw.videos?.featurettes),
		},
	}
	return mediaType === "movie"
		? {
				...common,
				mediaType,
				details,
				...(raw.movie_series
					? {
							movie_series: {
								id: raw.movie_series.id,
								movie_ids: raw.movie_series.movie_ids,
							},
						}
					: {}),
			}
		: {
				...common,
				mediaType,
				details,
				seasons: (raw.seasons ?? []).map(
					({ season_number, episode_count }) => ({
						season_number,
						episode_count,
					}),
				),
			}
}

// Internal function to process fingerprint data
function _processFingerprint(
	result: RawTitleDetails,
): FingerprintResult | null {
	const {
		content_advisories,
		context_is_background_friendly,
		context_is_binge_friendly,
		context_is_comfort_watch,
		context_is_drop_in_friendly,
		context_is_pure_escapism,
		context_is_thought_provoking,
		essence_tags,
		essence_text,
		fingerprint_scores,
		fingerprint_highlight_keys,
		suitability_adults,
		suitability_date_night,
		suitability_family,
		suitability_friends,
		suitability_group_party,
		suitability_intergenerational,
		suitability_kids,
		suitability_partner,
		suitability_public_viewing_safe,
		suitability_solo_watch,
		suitability_teens,
		...rawMedia
	} = result.details

	if (!fingerprint_scores) {
		return null
	}

	const dnaAnalysis = {
		scores: fingerprint_scores,
		highlightKeys: fingerprint_highlight_keys,
		genres: rawMedia.genres ?? [],
		essenceTags: essence_tags,
		essenceText: essence_text,
		content_advisories,
		context_is_background_friendly,
		context_is_binge_friendly,
		context_is_comfort_watch,
		context_is_drop_in_friendly,
		context_is_pure_escapism,
		context_is_thought_provoking,
		suitability_adults,
		suitability_date_night,
		suitability_family,
		suitability_friends,
		suitability_group_party,
		suitability_intergenerational,
		suitability_kids,
		suitability_partner,
		suitability_public_viewing_safe,
		suitability_solo_watch,
		suitability_teens,
	}

	return buildFingerprint(dnaAnalysis as DNAAnalysis)
}
