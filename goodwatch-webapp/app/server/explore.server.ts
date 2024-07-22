import weaviate from "weaviate-client"
import type { StreamingLink, StreamingProviders } from "~/server/details.server"
import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"
import { type AllRatings, getRatingKeys } from "~/utils/ratings"

const RESULT_LIMIT = 120
export const AVAILABLE_CATEGORIES = [
	"dna",
	"genre",
	"mood",
	"plot",
	"audience",
	"place",
	"time",
	"narration",
	"sound",
	"character",
	"visual",
	"props",
	"flag",
]

export interface ExploreParams {
	type: "movies" | "tv"
	category:
		| "dna"
		| "genre"
		| "mood"
		| "plot"
		| "audience"
		| "place"
		| "time"
		| "narration"
		| "sound"
		| "character"
		| "visual"
		| "props"
		| "flag"
	query: string
}

export interface ExploreResult extends AllRatings {
	tmdb_id: number
	poster_path: string
	title: string
	// TODO remove streaming_providers
	streaming_providers: StreamingProviders
	streaming_links: StreamingLink[]
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
}: ExploreParams): Promise<ExploreResults> {
	const client = await weaviate.connectToCustom({
		httpHost: process.env.WEAVIATE_HOST,
		httpPort: Number(process.env.WEAVIATE_PORT),
		httpSecure: false,
		grpcHost: process.env.WEAVIATE_HOST,
		grpcPort: Number(process.env.WEAVIATE_GRPC_PORT),
		grpcSecure: false,
		// authCredentials: new weaviate.ApiKey("WEAVIATE_INSTANCE_API_KEY"),
	})

	const collection = await client.collections.get(type)
	const vector_results = await collection.query.nearText(query, {
		targetVector: `${category}_vector`,
		limit: RESULT_LIMIT,
		returnMetadata: ["distance"],
	})
	const tmdbIds = vector_results.objects.map(
		(result) => result.properties.tmdb_id,
	)

	const pg_query = `
    SELECT
      m.tmdb_id,
      m.title,
      m.poster_path,
      m.streaming_providers,
      json_agg(json_build_object(
        'provider_id', spl.provider_id,
        'provider_name', sp.name,
        'provider_logo_path', sp.logo_path,
        'media_type', spl.media_type,
        'country_code', spl.country_code,
        'stream_type', spl.stream_type
      )) AS streaming_links,
      ${getRatingKeys()
				.map((key) => `m.${key}`)
				.join(", ")}
    FROM
      ${type === "movies" ? "movies" : "tv"} m
    INNER JOIN
    	streaming_provider_links spl ON spl.tmdb_id = m.tmdb_id
		INNER JOIN
    	streaming_providers sp ON sp.id = spl.provider_id
    WHERE
    	m.tmdb_id = ANY($1)
    GROUP BY
      m.tmdb_id
    LIMIT ${RESULT_LIMIT};
  `
	const queryParams = [tmdbIds]
	const results = await executeQuery(pg_query, queryParams)
	return {
		results: results.rows as unknown as ExploreResult[],
	}
}
