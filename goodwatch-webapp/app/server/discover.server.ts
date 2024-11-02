import {
	type StreamingLink,
	type StreamingProviders,
	getCountrySpecificDetails,
} from "~/server/details.server"
import { getGenresAll } from "~/server/genres.server"
import {
	type FilterMediaType,
	constructFullQuery,
	filterMediaTypes,
} from "~/server/utils/query-db"
import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"
import type { AllRatings } from "~/utils/ratings"

export type WatchedType = "didnt-watch" | "plan-to-watch" | "watched"
export type StreamingPreset = "everywhere" | "mine" | "custom"
export type DiscoverSortBy = "popularity" | "aggregated_score" | "release_date"

export interface DiscoverParams {
	userId?: string
	type: FilterMediaType
	country: string
	language: string
	watchedType: WatchedType
	minAgeRating: string
	maxAgeRating: string
	minYear: string
	maxYear: string
	minScore: string
	maxScore: string
	withCast: string
	withoutCast: string
	withCrew: string
	withoutCrew: string
	withGenres: string
	withoutGenres: string
	withKeywords: string
	withoutKeywords: string
	streamingPreset: StreamingPreset
	withStreamingProviders: string
	sortBy: DiscoverSortBy
	sortDirection: "asc" | "desc"
}

export interface DiscoverResult extends AllRatings {
	tmdb_id: number
	poster_path: string
	title: string
	// TODO remove streaming_providers
	streaming_providers: StreamingProviders
	streaming_links: StreamingLink[]
	media_type: "movie" | "tv"
}

export type DiscoverResults = DiscoverResult[]

export const getDiscoverResults = async (params: DiscoverParams) => {
	return await cached<DiscoverParams, DiscoverResults>({
		name: "discover-results",
		target: _getDiscoverResults,
		params,
		// ttlMinutes: 60 * 2,
		ttlMinutes: 0,
	})
}

async function _getDiscoverResults({
	userId,
	type,
	country,
	language,
	minAgeRating,
	maxAgeRating,
	minYear,
	maxYear,
	minScore,
	maxScore,
	watchedType,
	withCast,
	withoutCast,
	withCrew,
	withoutCrew,
	withGenres,
	withoutGenres,
	withKeywords,
	withoutKeywords,
	streamingPreset,
	withStreamingProviders,
	sortBy,
	sortDirection,
}: DiscoverParams): Promise<DiscoverResults> {
	if (!filterMediaTypes.includes(type))
		throw new Error(`Invalid type for Discover: ${type}`)
	if (country && country.length !== 2)
		throw new Error(`Invalid value for Country: ${country}`)
	if (language.length !== 2)
		throw new Error(`Invalid value for Language: ${language}`)

	const column =
		sortBy === "release_date"
			? "release_date"
			: sortBy === "aggregated_score"
				? "aggregated_overall_score_normalized_percent"
				: "popularity"
	const direction = sortDirection === "asc" ? "ASC" : "DESC"

	const genres = await getGenresAll()
	const genreNames = genres
		.filter((genre) => withGenres.includes(genre.id.toString()))
		.map((genre) => genre.name)

	const { query, params } = constructFullQuery({
		userId,
		filterMediaType: type,
		streaming: {
			streamingPreset,
			countryCode: country,
			streamTypes: ["free", "flatrate"],
			providerIds: withStreamingProviders
				? withStreamingProviders.split(",").map((id) => Number(id))
				: undefined,
		},
		conditions: {
			minScore,
			maxScore,
			minYear,
			maxYear,
			watchedType,
			withCast,
			withoutCast,
			withCrew,
			withoutCrew,
			withGenres: genreNames?.length > 0 ? genreNames : undefined,
		},
		orderBy: {
			column,
			direction,
		},
		limit: 100,
	})

	const result = await executeQuery(query, params)
	const results = result.rows.map((row) =>
		getCountrySpecificDetails(row, country, language),
	) as unknown as DiscoverResult[]

	return results
}
