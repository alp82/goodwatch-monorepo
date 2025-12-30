import { cached } from "~/utils/cache"
import { getDetailsForMovie, getDetailsForShow } from "~/server/details.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { PillarTiers } from "~/server/utils/fingerprint"

export interface ShowcaseExample {
	tmdb_id: number
	mediaType: "movie" | "show"
	title: string
	poster_path: string | null
	backdrop_path: string | null
	release_year: number
	fingerprint_pillars: PillarTiers | null
	fingerprint_scores: Record<string, number> | null
	streaming_services: Array<{
		id: number
		name: string
		logo_path: string
	}>
	ratings: {
		goodwatch: number | null
		imdb: number | null
		metacritic: number | null
		rotten_tomatoes: number | null
	}
	[key: string]: unknown
}

export type ShowcaseExamplesResult = ShowcaseExample[]

export interface ShowcaseExamplesParams {
	country: string
}

const SHOWCASE_ITEMS: Array<{ id: string; type: "movie" | "show" }> = [
	{ id: "27205", type: "movie" },   // Inception - Sci-Fi thriller
	{ id: "2316", type: "show" },     // The Office - Comedy
	{ id: "129", type: "movie" },     // Spirited Away - Animation
	{ id: "1396", type: "show" },     // Breaking Bad - Drama
]

export const getShowcaseExamples = async (
	params: ShowcaseExamplesParams
): Promise<ShowcaseExamplesResult> => {
	return await cached<ShowcaseExamplesParams, ShowcaseExamplesResult & { [key: string]: unknown }>({
		name: "showcase-examples",
		target: _getShowcaseExamples as (params: ShowcaseExamplesParams) => Promise<ShowcaseExamplesResult & { [key: string]: unknown }>,
		params,
		//ttlMinutes: 60 * 24,
        ttlMinutes: 0,
	}) as ShowcaseExamplesResult
}

async function _getShowcaseExamples(
	params: ShowcaseExamplesParams
): Promise<ShowcaseExamplesResult> {
	const { country } = params
	const language = "en"

	const results = await Promise.all(
		SHOWCASE_ITEMS.map(async (item) => {
			try {
				let media: MovieResult | ShowResult

				if (item.type === "movie") {
					media = await getDetailsForMovie({
						movieId: item.id,
						country,
						language,
					})
				} else {
					media = await getDetailsForShow({
						showId: item.id,
						country,
						language,
					})
				}

				return transformToShowcaseExample(media)
			} catch (error) {
				console.error(`Failed to fetch showcase item ${item.type}/${item.id}:`, error)
				return null
			}
		})
	)

	return results.filter((r): r is ShowcaseExample => r !== null)
}

function transformToShowcaseExample(
	media: MovieResult | ShowResult
): ShowcaseExample {
	const { details, mediaType, fingerprint, streaming_services, streaming_availabilities } = media

	const streamingServiceIds = new Set(
		streaming_availabilities
			?.filter((sa) => sa.streaming_type === "flatrate")
			.map((sa) => sa.streaming_service_id) || []
	)

	const streamingServicesForDisplay = streaming_services
		?.filter((s) => streamingServiceIds.has(s.tmdb_id))
		.slice(0, 5)
		.map((s) => ({
			id: s.tmdb_id,
			name: s.name,
			logo_path: s.logo,
		})) || []

	return {
		tmdb_id: details.tmdb_id,
		mediaType,
		title: details.title,
		poster_path: details.poster_path,
		backdrop_path: details.backdrop_path,
		release_year: Number(details.release_year),
		fingerprint_pillars: fingerprint?.pillars ?? null,
		fingerprint_scores: fingerprint?.scores ?? null,
		streaming_services: streamingServicesForDisplay,
		ratings: {
			goodwatch: details.goodwatch_overall_score_normalized_percent || null,
			imdb: details.imdb_user_score_original || null,
			metacritic: details.metacritic_meta_score_original || null,
			rotten_tomatoes: details.rotten_tomatoes_tomato_score_original || null,
		},
	}
}
