import type { WithSimilar } from "~/routes/api.similar-media"
import type {
	CombinationType,
	StreamingPreset,
	WatchedType,
} from "~/server/discover.server"
import { sortedDNACategories } from "~/ui/dna/dna_utils"
import {
	VOTE_COUNT_THRESHOLD_HIGH,
	VOTE_COUNT_THRESHOLD_LOW,
	VOTE_COUNT_THRESHOLD_MID,
	WEIGHT_CLUSTER_TAG_PRIMARY,
	WEIGHT_CLUSTER_TAG_SECONDARY,
	WEIGHT_ORIGINAL_TAG,
} from "~/utils/constants"
import { getRatingKeys } from "~/utils/ratings"
import { duplicateProviders } from "~/utils/streaming-links"

export const mediaTypes = ["movie", "tv"] as const
export type MediaType = (typeof mediaTypes)[number]

export const filterMediaTypes = ["all", "movies", "movie", "tv"] as const
export type FilterMediaType = (typeof filterMediaTypes)[number]

type StreamType = "flatrate" | "free" | "ads" | "buy" | "rent"

interface StreamingConfig {
	streamingPreset?: StreamingPreset
	countryCode?: string
	streamTypes?: StreamType[]
	providerIds?: number[]
}

interface Media {
	type: MediaType
	tmdb_id: number
}

interface Similarity {
	category: string
	similarDNAIds: number[]
	similarDNACombinationType: CombinationType
	withSimilar: WithSimilar[]
	media?: Media
}

interface Conditions {
	minScore?: string
	maxScore?: string
	minYear?: string
	maxYear?: string
	similarityVector?: string
	watchedType?: WatchedType
	withCast?: string
	withCastCombinationType?: CombinationType
	withoutCast?: string
	withCrew?: string
	withCrewCombinationType?: CombinationType
	withoutCrew?: string
	withGenres?: string[]
	withoutGenres?: string[]
}

interface ConstructSimilarityQueryParams {
	type: MediaType
	similarity?: Similarity
}

interface SimilarityParams {
	categories?: string[]
	categoriesArray?: string
}

interface ConstructUserQueryParams {
	userId?: string
	type: MediaType
	watchedType?: WatchedType
}

interface OrderByConfig {
	column:
		| "popularity"
		| "aggregated_overall_score_normalized_percent"
		| "release_date"
		| "vector"
	direction: "ASC" | "DESC"
}
interface ConstructSelectQueryParams {
	userId?: string
	type: MediaType
	streaming?: StreamingConfig
	similarity?: Similarity
	conditions: Conditions
	orderBy: OrderByConfig
	page: number
	pageSize: number
}

interface ConstructUnionQueryParams
	extends Omit<ConstructSelectQueryParams, "type"> {
	filterMediaType: FilterMediaType
}

interface ConstructFullQueryParams extends ConstructUnionQueryParams {}

export const constructFullQuery = ({
	userId,
	filterMediaType,
	streaming,
	similarity,
	conditions,
	orderBy,
	page,
	pageSize,
}: ConstructFullQueryParams) => {
	// Validate orderBy.column and orderBy.direction
	const validOrderByColumns = [
		"popularity",
		"aggregated_overall_score_normalized_percent",
		"release_date",
		"vector",
	]
	if (!validOrderByColumns.includes(orderBy.column)) {
		throw new Error("Invalid orderBy.column")
	}
	if (!["ASC", "DESC"].includes(orderBy.direction)) {
		throw new Error("Invalid orderBy.direction")
	}

	// Validate similarity.category
	if (
		similarity?.category &&
		!sortedDNACategories.includes(similarity.category)
	) {
		throw new Error("Invalid similarity category")
	}

	const offset = (page - 1) * pageSize

	// Construct the query and collect parameters
	const { query: unionQuery, params: collectedParams } = constructUnionQuery({
		userId,
		filterMediaType,
		streaming,
		conditions,
		similarity,
		orderBy,
		page,
		pageSize,
	})

	// Build the final query
	const namedQuery = `
		${unionQuery}
		SELECT
			m.*,
			sl.streaming_links
		FROM media m
		JOIN LATERAL (
			${getStreamingLinksJoin(streaming)}
		) sl on TRUE
		${similarity?.withSimilar?.length ? "WHERE similarity_score IS NOT NULL" : ""}
		ORDER BY ${
			similarity?.withSimilar?.length
				? `similarity_score DESC, ${orderBy.column} ${orderBy.direction}`
				: `${orderBy.column} ${orderBy.direction}`
		} NULLS LAST
		LIMIT :::pageSize OFFSET :::offset
	`

	// Collect additional parameters for the final query
	const params: Record<string, unknown> = {
		...collectedParams,
		similarityVector: conditions.similarityVector,
		limit: pageSize,
		offset,
		subquery_limit: pageSize * page,
	}

	// Convert named parameters to positional parameters once
	return convertNamedToPositionalParams(namedQuery, params)
}

const constructUnionQuery = ({
	userId,
	filterMediaType,
	streaming,
	similarity,
	conditions,
	orderBy,
	page,
	pageSize,
}: ConstructUnionQueryParams) => {
	const selectQueries = []
	let collectedParams: Record<string, unknown> = {}

	if (["all", "movies", "movie"].includes(filterMediaType)) {
		const { query: selectMovies, params: paramsMovies } = constructSelectQuery({
			userId,
			type: "movie",
			streaming,
			similarity,
			conditions,
			orderBy,
			page,
			pageSize,
		})
		selectQueries.push(selectMovies)
		collectedParams = { ...collectedParams, ...paramsMovies }
	}

	if (["all", "tv"].includes(filterMediaType)) {
		const { query: selectTv, params: paramsTv } = constructSelectQuery({
			userId,
			type: "tv",
			streaming,
			similarity,
			conditions,
			orderBy,
			page,
			pageSize,
		})
		selectQueries.push(selectTv)
		collectedParams = { ...collectedParams, ...paramsTv }
	}

	const unionQuery = `
		WITH media AS (
			${selectQueries.map((query) => `(${query})`).join("\nUNION\n")}
		)
	`

	return { query: unionQuery, params: collectedParams }
}

const constructSelectQuery = ({
	userId,
	type,
	streaming,
	similarity,
	conditions,
	orderBy,
	page,
	pageSize,
}: ConstructSelectQueryParams) => {
	const {
		minYear,
		maxScore,
		minScore,
		maxYear,
		watchedType,
		withCast,
		withCastCombinationType,
		withCrew,
		withCrewCombinationType,
		withGenres,
	} = conditions

	// Validate type
	if (!["movie", "tv"].includes(type)) {
		throw new Error("Invalid media type")
	}

	const userJoin = constructUserQuery({ userId, type, watchedType })

	// Construct similarity CTE and conditions if similarity is requested
	const categories = similarity?.withSimilar?.[0]?.categories || ["Sub-Genres"]
	const categoriesArray = `ARRAY[${categories.map((cat) => `'${cat}'`).join(",")}]`

	const { similarityCTE, similarityJoins } = constructSimilarityQuery({
		type,
		similarity,
		categories,
		categoriesArray,
	})

	const { dnaJoins, dnaParams } = constructDNAQuery({
		type,
		similarity,
	})

	// Prepare castIds and crewIds, ensuring they are valid numbers
	const castIds = (withCast || "")
		.split(",")
		.map((castId) => Number(castId))
		.filter((id) => !Number.isNaN(id))
	const crewIds = (withCrew || "")
		.split(",")
		.map((crewId) => Number(crewId))
		.filter((id) => !Number.isNaN(id))

	// Get streaming condition and parameters
	const { condition: streamingCondition, params: streamingParams } =
		getStreamingLinksCondition(type, streaming)

	// Build the query with placeholders
	const query = `
		${similarityCTE}
		SELECT DISTINCT
			'${type}' as media_type,
			${similarity?.withSimilar?.length ? "m_similar.shared_dna_score as similarity_score," : ""}
		  ${getCommonFields()
				.map((field) => `m.${field}`)
				.join(",\n\t")}
		FROM ${type === "movie" ? "movies" : "tv"} m
			${similarityJoins}
			${dnaJoins}
			${userJoin}
		WHERE
			m.title IS NOT NULL
			AND m.release_year IS NOT NULL
			AND m.poster_path IS NOT NULL
			AND ${orderBy.column} IS NOT NULL
			${streaming?.streamingPreset ? `AND ${streamingCondition}` : ""}
			${minScore ? "AND aggregated_overall_score_normalized_percent >= :::minScore" : ""}
			${maxScore ? "AND aggregated_overall_score_normalized_percent <= :::maxScore" : ""}
			${minYear ? "AND release_year >= :::minYear" : ""}
			${maxYear ? "AND release_year <= :::maxYear" : ""}
			${
				withCast && castIds.length
					? `AND (${castIds
							.map((castId) => `m.cast @> '[{"id": ${castId}}]'`)
							.join(withCastCombinationType === "all" ? " AND " : " OR ")})`
					: ""
			}
			${
				withCrew && crewIds.length
					? `AND (${crewIds
							.map((crewId) => `m.crew @> '[{"id": ${crewId}}]'`)
							.join(withCrewCombinationType === "all" ? " AND " : " OR ")})`
					: ""
			}
			${withGenres?.length ? "AND m.genres && :::withGenres::varchar[]" : ""}
			${
				minScore ||
				["popularity", "aggregated_overall_score_normalized_percent"].includes(
					orderBy.column,
				)
					? `AND m.aggregated_overall_score_voting_count >= ${
							orderBy.column === "aggregated_overall_score_normalized_percent"
								? VOTE_COUNT_THRESHOLD_MID
								: VOTE_COUNT_THRESHOLD_LOW
						}`
					: ""
			}
			${orderBy.column === "release_date" ? "AND m.release_date <= NOW()" : ""}
			${userId && watchedType === "didnt-watch" ? "AND uwh.user_id IS NULL" : ""}
		ORDER BY
			${
				similarity?.withSimilar?.length
					? `similarity_score DESC, ${orderBy.column} ${orderBy.direction}`
					: `${orderBy.column} ${orderBy.direction}`
			}
		  -- TODO: performance hack but not accurate
			LIMIT :::subquery_limit
	`

	// Collect parameters
	const params: Record<string, unknown> = {
		minScore,
		maxScore,
		minYear,
		maxYear,
		withGenres: withGenres || [],
		page,
		pageSize,
		userId,
		...streamingParams,
		...dnaParams,
	}

	// Add categories to params if similarity is being used
	if (similarity?.withSimilar?.length) {
		params.categories = categories
	}

	return { query, params }
}

const constructSimilarityQuery = ({
	type,
	similarity,
	categories,
	categoriesArray,
}: ConstructSimilarityQueryParams & SimilarityParams): {
	similarityCTE: string
	similarityJoins: string
} => {
	if (!similarity?.withSimilar?.length) {
		return { similarityCTE: "", similarityJoins: "" }
	}

	// Separate movie and TV IDs from the similarity items
	const movieIds = similarity.withSimilar
		.filter((item) => item.mediaType === "movie")
		.map((item) => item.tmdbId)
	const tvIds = similarity.withSimilar
		.filter((item) => item.mediaType === "tv")
		.map((item) => item.tmdbId)

	const similarityCTE = `
    /*+ SET enable_nestloop = on */
    /*+ SET random_page_cost = 1.1 */
    WITH input_items AS (
      SELECT 
        ${movieIds.length ? `ARRAY[${movieIds.join(",")}]` : "ARRAY[]::int[]"} AS movie_ids,
        ${tvIds.length ? `ARRAY[${tvIds.join(",")}]` : "ARRAY[]::int[]"} AS tv_ids
    ),
    source_items AS (
      -- Get source data once to reuse throughout the query
      SELECT 
        dna, 
        trope_names, 
        'movie' as media_type,
        tmdb_id
      FROM movies
      WHERE tmdb_id = ANY((SELECT movie_ids FROM input_items LIMIT 1)::int[])
        AND dna IS NOT NULL
        AND trope_names IS NOT NULL
      UNION ALL
      SELECT 
        dna, 
        trope_names, 
        'tv' as media_type,
        tmdb_id
      FROM tv
      WHERE tmdb_id = ANY((SELECT tv_ids FROM input_items LIMIT 1)::int[])
        AND dna IS NOT NULL
        AND trope_names IS NOT NULL
    ),
    all_source_tags AS (
      -- Extract all DNA tags once and aggregate them by category
      SELECT 
        category,
        array_agg(DISTINCT tag) AS tags
      FROM (
        SELECT 
          t.key as category,
          jsonb_array_elements_text(t.value) AS tag
        FROM source_items
        CROSS JOIN LATERAL jsonb_each(source_items.dna) AS t(key, value)
        WHERE t.key = ANY(${categoriesArray}::text[])
      ) AS source_dna_tags
      GROUP BY category
    ),
    source_tropes AS (
      -- Get all tropes for the input movies/TV shows
      SELECT 
        DISTINCT unnest(trope_names) AS trope
      FROM source_items
      WHERE trope_names IS NOT NULL
      LIMIT 1000
    ),
    dna_tag_matches AS (
      -- Pre-calculate the number of DNA tag matches for each item
      SELECT
        m.tmdb_id as item_id,
        'movie'::text as media_type,
        COUNT(DISTINCT ast.category || ':' || item_tag) as matching_tag_count
      FROM 
        movies m
      CROSS JOIN all_source_tags ast
      JOIN LATERAL (
        SELECT jsonb_array_elements_text(m.dna->ast.category) AS item_tag
      ) tags ON TRUE
      WHERE m.popularity >= 2
        AND m.aggregated_overall_score_voting_count > ${VOTE_COUNT_THRESHOLD_MID} 
        AND m.trope_names IS NOT NULL
        AND m.dna IS NOT NULL
        AND tags.item_tag = ANY(ast.tags)
      GROUP BY m.tmdb_id
      
      UNION ALL
      
      SELECT
        t.tmdb_id as item_id,
        'tv'::text as media_type,
        COUNT(DISTINCT ast.category || ':' || item_tag) as matching_tag_count
      FROM 
        tv t
      CROSS JOIN all_source_tags ast
      JOIN LATERAL (
        SELECT jsonb_array_elements_text(t.dna->ast.category) AS item_tag
      ) tags ON TRUE
      WHERE t.popularity >= 2
        AND t.aggregated_overall_score_voting_count > ${VOTE_COUNT_THRESHOLD_MID} 
        AND t.trope_names IS NOT NULL
        AND t.dna IS NOT NULL
        AND tags.item_tag = ANY(ast.tags)
      GROUP BY t.tmdb_id
    ),
    popular_items AS (
      -- Select the top items with the most DNA tag matches efficiently
      SELECT
        m.tmdb_id as item_id,
        m.title,
        m.release_year,
        m.popularity,
        m.aggregated_overall_score_voting_count,
        'movie'::text as media_type,
        m.trope_names,
        m.dna,
        dtm.matching_tag_count
      FROM dna_tag_matches dtm
      JOIN movies m ON 
        m.tmdb_id = dtm.item_id AND dtm.media_type = 'movie'
      WHERE NOT m.tmdb_id = ANY((SELECT movie_ids FROM input_items LIMIT 1)::int[])
      
      UNION ALL
      
      SELECT
        t.tmdb_id as item_id,
        t.title,
        t.release_year,
        t.popularity,
        t.aggregated_overall_score_voting_count,
        'tv'::text as media_type,
        t.trope_names,
        t.dna,
        dtm.matching_tag_count
      FROM dna_tag_matches dtm
      JOIN tv t ON 
        t.tmdb_id = dtm.item_id AND dtm.media_type = 'tv'
      WHERE NOT t.tmdb_id = ANY((SELECT tv_ids FROM input_items LIMIT 1)::int[])
      
      ORDER BY matching_tag_count DESC, popularity DESC
      LIMIT 2000
    ),
    matching_items AS (
      SELECT
        p.item_id,
        -- New trope-based scoring with better performance
        (SELECT count(*) FROM unnest(p.trope_names) t(trope) 
         WHERE trope IN (SELECT trope FROM source_tropes)) * 10 + -- Base score per matching trope
        -- Calculate percentage score more efficiently
        (SELECT 
          (count(*)::float / array_length(p.trope_names, 1)::float) * 500
         FROM unnest(p.trope_names) t(trope) 
         WHERE trope IN (SELECT trope FROM source_tropes)) +
        -- Calculate coverage score more efficiently
        (SELECT 
          (count(*)::float / (SELECT count(*) FROM source_tropes)::float) * 500
         FROM unnest(p.trope_names) t(trope) 
         WHERE trope IN (SELECT trope FROM source_tropes)) +
        -- Add weight for DNA tag matches
        p.matching_tag_count * 100 AS shared_dna_score,
        p.media_type
      FROM popular_items p
      WHERE EXISTS (
        SELECT 1 FROM source_tropes st 
        WHERE st.trope = ANY(p.trope_names)
      )
      -- No need for explicit exclusion as we've added WHERE clauses in popular_items
      -- Add a minimum trope match threshold to filter out weak matches
      AND (
        SELECT count(*) FROM unnest(p.trope_names) t(trope) 
        WHERE trope IN (SELECT trope FROM source_tropes)
      ) >= 5
    )`

	const similarityJoins = `
    JOIN matching_items m_similar 
			ON m.tmdb_id = m_similar.item_id 
			AND m_similar.media_type = '${type}'
	`

	return { similarityCTE, similarityJoins }
}

const constructDNAQuery = ({
	type,
	similarity,
}: ConstructSimilarityQueryParams): {
	dnaJoins: string
	dnaParams: Record<string, unknown>
} => {
	const { similarDNAIds = [], similarDNACombinationType } = similarity || {}

	const dnaParams: Record<string, unknown> = {}

	const similarDNAJoins =
		similarDNAIds.length > 0
			? similarDNACombinationType === "all"
				? similarDNAIds
						.map((dnaId, index) => {
							// Use parameter placeholders
							dnaParams[`dnaId${index}`] = dnaId
							// Join condition now includes both primary DNA and cluster members
							return `JOIN dna d${index} ON m.tmdb_id = ANY(d${index}.${type}_tmdb_id)
                    AND (
                      d${index}.id = :::dnaId${index} OR
                      d${index}.cluster_id = :::dnaId${index}
                    )`
						})
						.join("\n")
				: (() => {
						const conditions = similarDNAIds
							.map((dnaId, index) => {
								// Use parameter placeholders
								dnaParams[`dnaId${index}`] = dnaId
								return `(d.id = :::dnaId${index} OR d.cluster_id = :::dnaId${index})`
							})
							.join(" OR ")
						return `JOIN dna d ON m.tmdb_id = ANY(d.${type}_tmdb_id)
                  AND (${conditions})`
					})()
			: ""

	return {
		dnaJoins: [similarDNAJoins].filter(Boolean).join("\n"),
		dnaParams,
	}
}

const constructUserQuery = ({
	userId,
	type,
	watchedType,
}: ConstructUserQueryParams) => {
	if (!userId || !watchedType) return ""

	if (watchedType === "watched") {
		return `
			INNER JOIN user_watch_history uwh ON
				uwh.user_id = :::userId
				AND uwh.tmdb_id = m.tmdb_id 
				AND uwh.media_type = '${type}' 
		`
	}
	if (watchedType === "didnt-watch") {
		// requires addition WHERE condition
		return `
			LEFT JOIN user_watch_history uwh ON
				uwh.user_id = :::userId
				AND uwh.tmdb_id = m.tmdb_id 
				AND uwh.media_type = '${type}' 
		`
	}
	if (watchedType === "plan-to-watch") {
		return `
			INNER JOIN user_wishlist uwl ON
				uwl.user_id = :::userId
				AND uwl.tmdb_id = m.tmdb_id 
				AND uwl.media_type = '${type}' 
		`
	}
}

const getCommonFields = () => {
	return [
		"tmdb_id",
		"title",
		"release_year",
		"release_date",
		"backdrop_path",
		"poster_path",
		"popularity",
		"streaming_providers",
		...getRatingKeys(),
	]
}

const getStreamingLinksCondition = (
	type: MediaType,
	{
		streamingPreset,
		countryCode,
		streamTypes,
		providerIds,
	}: StreamingConfig = {},
) => {
	const {
		providerCondition,
		streamTypeCondition,
		countryCodeCondition,
		params,
	} = prepareStreamingConditions(
		streamingPreset,
		providerIds,
		streamTypes,
		countryCode,
	)

	return {
		condition: `EXISTS (
			SELECT 1
			FROM streaming_provider_links spl
			WHERE spl.tmdb_id = m.tmdb_id
				AND spl.media_type = '${type}'
				AND spl.provider_id ${providerCondition}
				${countryCodeCondition}
				${streamTypeCondition}
			LIMIT 1
		)`,
		params,
	}
}

const getStreamingLinksJoin = ({
	streamingPreset,
	countryCode,
	streamTypes,
	providerIds,
}: StreamingConfig = {}) => {
	const { providerCondition, streamTypeCondition, countryCodeCondition } =
		prepareStreamingConditions(
			streamingPreset,
			providerIds,
			streamTypes,
			countryCode,
		)

	return `
		SELECT json_agg(json_build_object(
			'provider_id', spl.provider_id,
			'provider_name', sp.name,
			'provider_logo_path', sp.logo_path,
			'media_type', spl.media_type,
			'country_code', spl.country_code,
			'stream_type', spl.stream_type,
			'stream_url', spl.stream_url,
			'price_dollar', spl.price_dollar,
			'quality', spl.quality
										)) AS streaming_links
		FROM (
			SELECT DISTINCT ON (spl.provider_id) spl.*
			FROM streaming_provider_links spl
			WHERE spl.tmdb_id = m.tmdb_id
				AND spl.media_type = m.media_type
				AND spl.provider_id ${providerCondition}
			${countryCodeCondition}
			${streamTypeCondition}
			ORDER BY spl.provider_id, spl.quality DESC, spl.price_dollar ASC
		) spl
		INNER JOIN streaming_providers sp ON sp.id = spl.provider_id
	`
}

// Generic query helper

const convertNamedToPositionalParams = <T extends string>(
	query: string,
	params: Partial<Record<T, unknown>>,
) => {
	let index = 1
	const nameToIndex: Partial<Record<T, string>> = {}
	const orderedValues: unknown[] = []

	const positionalQuery = query.replace(/:::(\w+)/g, (_, name) => {
		if (!(name in nameToIndex)) {
			if (Object.prototype.hasOwnProperty.call(params, name)) {
				nameToIndex[name as T] = `$${index++}`
				orderedValues.push(params[name as T])
			} else {
				throw new Error(`Parameter '${name}' is missing in the params object`)
			}
		}
		return nameToIndex[name as T] as string
	})

	return { query: positionalQuery, params: orderedValues }
}

function prepareStreamingConditions(
	streamingPreset: "everywhere" | "mine" | "custom" | undefined,
	providerIds: number[] | undefined,
	streamTypes: StreamType[] | undefined,
	countryCode: string | undefined,
) {
	const params: Record<string, unknown> = {}
	let providerCondition = ""
	if (streamingPreset !== "everywhere" && providerIds) {
		const validProviderIds = providerIds.filter((id) => !Number.isNaN(id))
		validProviderIds.forEach((id, idx) => {
			params[`providerId${idx}`] = id
		})
		providerCondition = `IN (${validProviderIds
			.map((_, idx) => `:::providerId${idx}`)
			.join(",")})`
	} else {
		providerCondition = `NOT IN (${duplicateProviders.join(",")})`
	}

	let streamTypeCondition = ""
	if (streamTypes) {
		streamTypeCondition = `AND spl.stream_type IN (${streamTypes
			.map((streamType, idx) => {
				params[`streamType${idx}`] = streamType
				return `:::streamType${idx}`
			})
			.join(",")})`
	}

	let countryCodeCondition = ""
	if (streamingPreset !== "everywhere" && countryCode) {
		params.countryCode = countryCode
		countryCodeCondition = "AND spl.country_code = :::countryCode"
	}
	return {
		providerCondition,
		streamTypeCondition,
		countryCodeCondition,
		params,
	}
}
