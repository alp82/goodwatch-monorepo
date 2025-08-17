// TODO: Fix StreamingLink and StreamingProviders imports after details.server.ts migration
// import type { StreamingLink, StreamingProviders } from "~/server/details.server"
import type { FilterMediaType } from "~/server/search.server"
import { constructFullQuery, filterMediaTypes } from "~/server/utils/query-db"
import { generateVectorResults } from "~/server/vector.server"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"
import type { AllRatings } from "~/utils/ratings"

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
	streaming_providers: any // StreamingProviders - TODO: Fix after details.server.ts migration
	streaming_links: any[] // StreamingLink[] - TODO: Fix after details.server.ts migration
	media_type: "movie" | "show"
}

export interface ExploreResults {
	[key: string]: any
	results: ExploreResult[]
}

export const getExploreResults = async (params: ExploreParams) => {
	return await cached<ExploreParams, ExploreResults>({
		name: "explore-results",
		target: _getExploreResults,
		params,
		ttlMinutes: 60 * 4,
		// ttlMinutes: 0,
	})
}

async function _getExploreResults({
	type,
	category,
	text,
	country,
}: ExploreParams): Promise<ExploreResults> {
	if (!filterMediaTypes.includes(type)) return { results: [] }
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
			minScore: "60",
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
	//     	${type === "show" ? "AND v.media_type = 'show'" : ""}
	//     ORDER BY v.${category}_vector <=> $2 ASC
	//     LIMIT ${RESULT_LIMIT}
	//   ) v
}
