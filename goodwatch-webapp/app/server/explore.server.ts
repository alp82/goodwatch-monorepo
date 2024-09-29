import type { StreamingLink, StreamingProviders } from "~/server/details.server"
import type { FilterMediaType } from "~/server/search.server"
import { generateVectorResults } from "~/server/vector.server"
import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"
import { type AllRatings, getRatingKeys } from "~/utils/ratings"
import { ignoredProviders } from "~/utils/streaming-links"

const RESULT_LIMIT = 120

export const AVAILABLE_TYPES = ["all", "movies", "tv"]
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
	query: string
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
	query,
	country,
}: ExploreParams): Promise<ExploreResults> {
	if (!AVAILABLE_TYPES.includes(type)) return { results: [] }
	if (!AVAILABLE_CATEGORIES.includes(category)) return { results: [] }

	const queryText = `${category}: ${query}`
	const { queryVectorParam } = await generateVectorResults({ queryText })

	const ratingFields = getRatingKeys()
		.map((key) =>
			type === "all"
				? `COALESCE(m.${key}, t.${key}) AS ${key}`
				: `${type === "movies" ? `m.${key}` : `t.${key}`} AS ${key}`,
		)
		.join(", ")

	const pg_query = `
    SELECT
      ${type === "all" ? "COALESCE(m.tmdb_id, t.tmdb_id) AS tmdb_id" : `${type === "movies" ? "m.tmdb_id" : "t.tmdb_id"} AS tmdb_id`},
      ${type === "all" ? "COALESCE(m.title, t.title) AS title" : `${type === "movies" ? "m.title" : "t.title"} AS title`},
      ${type === "all" ? "COALESCE(m.release_year, t.release_year) AS release_year" : `${type === "movies" ? "m.release_year" : "t.release_year"} AS release_year`},
      ${type === "all" ? "COALESCE(m.poster_path, t.poster_path) AS poster_path" : `${type === "movies" ? "m.poster_path" : "t.poster_path"} AS poster_path`},
      ${type === "all" ? "COALESCE(m.streaming_providers, t.streaming_providers) AS streaming_providers" : `${type === "movies" ? "m.streaming_providers" : "t.streaming_providers"} AS streaming_providers`},
      
      ${
				type === "all"
					? `
							CASE
								WHEN m.tmdb_id IS NOT NULL THEN 'movie'
								WHEN t.tmdb_id IS NOT NULL THEN 'tv'
								ELSE NULL
							END AS media_type
						`
					: `'${type === "movies" ? "movie" : "tv"}' AS media_type`
			},
			
      (
				SELECT json_agg(json_build_object(
					'provider_id', spl.provider_id,
					'provider_name', sp.name,
					'provider_logo_path', sp.logo_path,
					'media_type', spl.media_type,
					'country_code', spl.country_code,
					'stream_type', spl.stream_type
				))
				FROM streaming_provider_links spl
				INNER JOIN streaming_providers sp ON sp.id = spl.provider_id
				WHERE spl.tmdb_id = ${type === "all" ? "COALESCE(m.tmdb_id, t.tmdb_id)" : `${type === "movies" ? "m.tmdb_id" : "t.tmdb_id"}`}
					AND spl.media_type = v.media_type
					AND spl.country_code = $1
					AND spl.provider_id NOT IN (${ignoredProviders.join(",")})
			) AS streaming_links,
		
      ${ratingFields}
      
		FROM LATERAL (
      SELECT v.tmdb_id, v.media_type
      FROM vectors_media v
      WHERE v.${category}_vector IS NOT NULL
      	${type === "movies" ? "AND v.media_type = 'movie'" : ""}
      	${type === "tv" ? "AND v.media_type = 'tv'" : ""}
      ORDER BY v.${category}_vector <=> $2 ASC
      LIMIT ${RESULT_LIMIT}
    ) v
		
		${["all", "movies"].includes(type) ? `LEFT JOIN movies m ON m.tmdb_id = v.tmdb_id AND v.media_type = 'movie'` : ""}
		${["all", "tv"].includes(type) ? `LEFT JOIN tv t ON t.tmdb_id = v.tmdb_id AND v.media_type = 'tv'` : ""}
  `

	const queryParams = [country, queryVectorParam]
	const results = await executeQuery(pg_query, queryParams)

	return {
		results: results.rows as unknown as ExploreResult[],
	}
}
