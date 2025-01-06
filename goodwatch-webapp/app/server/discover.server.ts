import { convertSimilarTitles } from "~/routes/api.discover"
import type { WithSimilar } from "~/routes/api.similar-media"
import {
	type StreamingLink,
	type StreamingProviders,
	getCountrySpecificDetails,
} from "~/server/details.server"
import { genreDuplicates, getGenresAll } from "~/server/genres.server"
import {
	type FilterMediaType,
	type MediaType,
	constructFullQuery,
	filterMediaTypes,
} from "~/server/utils/query-db"
import { cached } from "~/utils/cache"
import { SEPARATOR_PRIMARY, SEPARATOR_SECONDARY } from "~/utils/navigation"
import { executeQuery } from "~/utils/postgres"
import type { AllRatings } from "~/utils/ratings"
import { duplicateProviderMapping } from "~/utils/streaming-links"

export type WatchedType = "didnt-watch" | "plan-to-watch" | "watched"
export type StreamingPreset = "everywhere" | "mine" | "custom"
export type CombinationType = "all" | "any"
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
	withCastCombinationType: CombinationType
	withoutCast: string
	withCrew: string
	withCrewCombinationType: CombinationType
	withoutCrew: string
	withGenres: string
	withoutGenres: string
	withKeywords: string
	withoutKeywords: string
	streamingPreset: StreamingPreset
	withStreamingProviders: string
	withStreamingTypes: string
	similarDNA: string
	similarDNACombinationType: CombinationType
	similarTitles: string
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
	withCastCombinationType,
	withoutCast,
	withCrew,
	withCrewCombinationType,
	withoutCrew,
	withGenres,
	withoutGenres,
	withKeywords,
	withoutKeywords,
	withStreamingProviders,
	withStreamingTypes,
	streamingPreset,
	similarDNA,
	similarDNACombinationType,
	similarTitles,
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
		.filter((genre) => {
			// Check if genre ID or its string representation is in withGenres
			const isDirectlyIncluded = withGenres.includes(genre.id.toString())

			// Check if any genre from genreDuplicates has the key present based on name mapping
			const isDuplicateIncluded = Object.keys(genreDuplicates).some((key) => {
				// Check if the key (genre name) corresponds to any genre ID in withGenres
				const keyGenre = genres.find((g) => g.name === key)
				return (
					keyGenre &&
					withGenres.includes(keyGenre.id.toString()) &&
					genreDuplicates[key].includes(genre.name)
				)
			})

			return isDirectlyIncluded || isDuplicateIncluded
		})
		.map((genre) => genre.name)

	const uniqueGenreNames =
		genreNames?.length > 0 ? [...new Set(genreNames)] : undefined

	const providerIds = withStreamingProviders
		? withStreamingProviders
				.split(",")
				.map((id) => Number(id))
				.reduce<number[]>((acc, id) => {
					acc.push(id)
					const duplicateIds = duplicateProviderMapping[id]
					if (duplicateIds) {
						acc.push(...duplicateIds)
					}
					return acc
				}, [])
		: undefined
	const streamTypes = withStreamingTypes ? withStreamingTypes.split(",") : []

	const similarDNAIds = similarDNA
		.split(SEPARATOR_PRIMARY)
		.map((idAndLabel) => idAndLabel.split(SEPARATOR_SECONDARY, 2)[0])
	const withSimilar = convertSimilarTitles(similarTitles)

	const { query, params } = constructFullQuery({
		userId,
		filterMediaType: type,
		streaming: {
			streamingPreset,
			countryCode: country,
			streamTypes,
			providerIds,
		},
		conditions: {
			minScore,
			maxScore,
			minYear,
			maxYear,
			watchedType,
			withCast,
			withCastCombinationType,
			withoutCast,
			withCrew,
			withCrewCombinationType,
			withoutCrew,
			withGenres: uniqueGenreNames,
		},
		similarity: {
			similarDNAIds,
			similarDNACombinationType,
			withSimilar,
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
