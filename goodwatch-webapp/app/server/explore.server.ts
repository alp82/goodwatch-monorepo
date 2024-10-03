import type { StreamingLink, StreamingProviders } from "~/server/details.server"
import { AVAILABLE_TYPES, type FilterMediaType } from "~/server/search.server"
import {
	getMediaType,
	getRatingFieldsForType,
	getSelectFieldsForType,
	getStreamingLinksForType,
} from "~/server/utils/query"
import { constructFullQuery } from "~/server/utils/query-db"
import { generateVectorResults } from "~/server/vector.server"
import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"
import { type AllRatings, getRatingKeys } from "~/utils/ratings"
import { ignoredProviders } from "~/utils/streaming-links"

const RESULT_LIMIT = 120

export const AVAILABLE_CATEGORIES = [
	"subgenres",
	"mood",
	"themes",
	"plot",
	"cultural_impact",
	"character_types",
	"dialog",
	"narrative",
	"humor",
	"pacing",
	"time",
	"place",
	"cinematic_style",
	"score_and_sound",
	"costume_and_set",
	"key_props",
	"target_audience",
	"flag",
] as const

export interface ExploreParams {
	type: FilterMediaType
	category: (typeof AVAILABLE_CATEGORIES)[number]
	text: string
	country: string
}

export interface ExploreResult extends AllRatings {
	tmdb_id: number
	poster_path: string
	title: string
	// TODO remove streaming_providers
	streaming_providers: StreamingProviders
	streaming_links: StreamingLink[]
	media_type: "movie" | "tv"
}

export interface ExploreResults {
	results: ExploreResult[]
}

export const getExploreResults = async (params: ExploreParams) => {
	return await cached<ExploreParams, ExploreResults>({
		name: "explore-results",
		target: _getExploreResults,
		params,
		// ttlMinutes: 60 * 2,
		ttlMinutes: 0,
	})
}

async function _getExploreResults({
	type,
	category,
	text,
	country,
}: ExploreParams): Promise<ExploreResults> {
	if (!AVAILABLE_TYPES.includes(type)) return { results: [] }
	if (!AVAILABLE_CATEGORIES.includes(category)) return { results: [] }

	const queryText = `${category}: ${text}`
	const { queryVectorParam } = await generateVectorResults({ queryText })

	const { query, params } = constructFullQuery({
		filterMediaType: type,
		streaming: {
			countryCode: country,
			streamTypes: ["free", "flatrate"],
		},
		similarity: {
			category,
		},
		conditions: {
			similarityVector: queryVectorParam,
		},
		orderBy: {
			column: "vector",
			direction: "ASC",
		},
		limit: 120,
	})

	const results = await executeQuery(query, params)

	return {
		results: results.rows as unknown as ExploreResult[],
	}

	// const pg_query = `
	//   SELECT
	//   	${getSelectFieldsForType(type, [
	// 			"tmdb_id",
	// 			"title",
	// 			"release_year",
	// 			"poster_path",
	// 			"streaming_providers",
	// 		])},
	//     ${getMediaType(type)} AS media_type,
	// 		${getStreamingLinksForType(type)},
	//     ${getRatingFieldsForType(type)}
	// 	FROM LATERAL (
	//     SELECT v.tmdb_id, v.media_type
	//     FROM vectors_media v
	//     WHERE v.${category}_vector IS NOT NULL
	//     	${type === "movies" ? "AND v.media_type = 'movie'" : ""}
	//     	${type === "tv" ? "AND v.media_type = 'tv'" : ""}
	//     ORDER BY v.${category}_vector <=> $2 ASC
	//     LIMIT ${RESULT_LIMIT}
	//   ) v
	//
	// 	${["all", "movies"].includes(type) ? `LEFT JOIN movies m ON m.tmdb_id = v.tmdb_id AND v.media_type = 'movie'` : ""}
	// 	${["all", "tv"].includes(type) ? `LEFT JOIN tv t ON t.tmdb_id = v.tmdb_id AND v.media_type = 'tv'` : ""}
	// `
	//
	// const queryParams = [country, queryVectorParam]
	// const results = await executeQuery(pg_query, queryParams)
	//
	// return {
	// 	results: results.rows as unknown as ExploreResult[],
	// }
}
