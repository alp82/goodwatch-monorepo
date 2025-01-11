import type { WithSimilar } from "~/routes/api.similar-media"
import type {
	CombinationType,
	StreamingPreset,
	WatchedType,
} from "~/server/discover.server"
import {
	mapCategoryToVectorName,
	sortedDNACategories,
} from "~/ui/dna/dna_utils"
import {
	VOTE_COUNT_THRESHOLD_HIGH,
	VOTE_COUNT_THRESHOLD_LOW,
	VOTE_COUNT_THRESHOLD_MID,
	WEIGHT_CLUSTER_TAG_PRIMARY,
	WEIGHT_CLUSTER_TAG_SECONDARY,
	WEIGHT_ORIGINAL_TAG,
} from "~/utils/constants"
import { SEPARATOR_SECONDARY } from "~/utils/navigation"
import { getRatingKeys } from "~/utils/ratings"
import { duplicateProviders } from "~/utils/streaming-links"

export const mediaTypes = ["movie", "tv"] as const
export type MediaType = (typeof mediaTypes)[number]

export const filterMediaTypes = ["all", "movies", "tv"] as const
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
	limit: number
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
	limit,
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

	// Construct the query and collect parameters
	const { query: unionQuery, params: collectedParams } = constructUnionQuery({
		userId,
		filterMediaType,
		streaming,
		conditions,
		similarity,
		orderBy,
		limit,
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
		}
		LIMIT :::limit
	`

	// Collect additional parameters for the final query
	const params: Record<string, unknown> = {
		...collectedParams,
		similarityVector: conditions.similarityVector,
		limit: limit,
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
	limit,
}: ConstructUnionQueryParams) => {
	const selectQueries = []
	let collectedParams: Record<string, unknown> = {}

	if (["all", "movies"].includes(filterMediaType)) {
		const { query: selectMovies, params: paramsMovies } = constructSelectQuery({
			userId,
			type: "movie",
			streaming,
			similarity,
			conditions,
			orderBy,
			limit,
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
			limit,
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
	limit,
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
	const categories = similarity?.withSimilar?.[0]?.categories || []
	const { similarityCTE, similarityJoins } = constructSimilarityQuery({
		type,
		similarity,
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
			LIMIT :::limit
	`

	// Collect parameters
	const params: Record<string, unknown> = {
		minScore,
		maxScore,
		minYear,
		maxYear,
		withGenres: withGenres || [],
		limit,
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
}: ConstructSimilarityQueryParams): {
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
    WITH input_items AS (
      SELECT 
        ${movieIds.length ? `ARRAY[${movieIds.join(",")}]` : "ARRAY[]::int[]"} AS movie_ids,
        ${tvIds.length ? `ARRAY[${tvIds.join(",")}]` : "ARRAY[]::int[]"} AS tv_ids
    ),
		source_tags AS (
			-- First get the initial tags that match our movie/tv criteria
			SELECT DISTINCT d.id, d.cluster_id
			FROM dna d
			CROSS JOIN input_items i
			WHERE (
				d.movie_tmdb_id && i.movie_ids
				OR d.tv_tmdb_id && i.tv_ids
			)
			AND d.category = ANY(:::categories::text[])
		),
		source_dnas AS (
		  -- For each tag, get all related tags in its cluster with weights
		  SELECT DISTINCT
			 d.*,
			 CASE
				 WHEN st.id = d.id THEN ${WEIGHT_ORIGINAL_TAG}  -- Original tag
				 WHEN st.cluster_id IS NULL AND d.cluster_id = st.id THEN ${WEIGHT_CLUSTER_TAG_SECONDARY}  -- Other tags in cluster of a primary tag
				 WHEN st.cluster_id IS NOT NULL THEN
					 CASE
						 WHEN d.id = st.cluster_id THEN ${WEIGHT_CLUSTER_TAG_PRIMARY}  -- Primary tag of a secondary tag's cluster
						 ELSE ${WEIGHT_CLUSTER_TAG_SECONDARY}  -- Other secondary tags in the same cluster
						 END
				 END as weight
		  FROM source_tags st
			JOIN dna d ON
			  CASE
				  WHEN st.cluster_id IS NULL THEN
					  d.cluster_id = st.id OR d.id = st.id
				  ELSE
					  d.cluster_id = st.cluster_id
						  OR d.id = st.cluster_id
						  OR d.id = st.id
				  END
		  WHERE d.count_all >= 2
		  ORDER BY d.count_all DESC
			LIMIT 100
		),
		popular_items AS (
			SELECT
				tmdb_id as item_id,
				title,
				release_year,
				popularity,
				aggregated_overall_score_voting_count,
				'movie'::text as media_type
			FROM movies
			WHERE popularity >= 10 AND aggregated_overall_score_voting_count > ${VOTE_COUNT_THRESHOLD_HIGH}
			UNION ALL
			SELECT
				tmdb_id as item_id,
				title,
				release_year,
				popularity,
				aggregated_overall_score_voting_count,
				'tv'::text as media_type
			FROM tv
			WHERE popularity >= 10 AND aggregated_overall_score_voting_count > ${VOTE_COUNT_THRESHOLD_HIGH}
		),
    matching_items AS (
      SELECT
        sub.item_id,
        SUM(
          CASE d.category 
						WHEN 'Plot' THEN 10
						WHEN 'Sub-Genres' THEN 6
						WHEN 'Mood' THEN 5
            WHEN 'Themes' THEN 4
						WHEN 'Cinematic Style' THEN 4
						WHEN 'Character Types' THEN 4
						WHEN 'Dialog' THEN 3
						WHEN 'Narrative' THEN 3
						WHEN 'Humor' THEN 3
						WHEN 'Time' THEN 3
						WHEN 'Place' THEN 3
						WHEN 'Score and Sound' THEN 3
						WHEN 'Costume and Set' THEN 3
						WHEN 'Pacing' THEN 2
						WHEN 'Key Props' THEN 3
						WHEN 'Cultural Impact' THEN 2
						WHEN 'Target Audience' THEN 2
						WHEN 'Flag' THEN 2
            ELSE 1 
          END * s.weight
			  ) AS shared_dna_score,
        sub.media_type
      FROM dna d
      CROSS JOIN LATERAL (
        SELECT unnest(movie_tmdb_id) AS item_id, 'movie'::text AS media_type
        UNION ALL
        SELECT unnest(tv_tmdb_id) AS item_id, 'tv'::text AS media_type
      ) sub
      JOIN source_dnas s ON s.id = d.id
      JOIN popular_items pop ON pop.item_id = sub.item_id AND pop.media_type = sub.media_type
      AND NOT (
        (sub.media_type='movie' AND sub.item_id = ANY((SELECT movie_ids FROM input_items LIMIT 1)::int[]))
        OR (sub.media_type='tv' AND sub.item_id = ANY((SELECT tv_ids FROM input_items LIMIT 1)::int[]))
      )  
      GROUP BY sub.item_id, sub.media_type
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
}: ConstructSimilarityQueryParams) => {
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

	// const withSimilarList = withSimilar || []
	// const similarTitleJoins =
	// 	withSimilarList.length > 0
	// 		? [
	// 				`JOIN vectors_media vm ON vm.tmdb_id = m.tmdb_id AND vm.media_type = '${type}'`,
	// 				...withSimilarList.map((similar, index) => {
	// 					// Validate mediaType
	// 					if (!["movie", "tv"].includes(similar.mediaType)) {
	// 						throw new Error("Invalid similar mediaType")
	// 					}
	// 					// Use parameter placeholders
	// 					dnaParams[`similarTmdbId${index}`] = similar.tmdbId
	// 					return `
	//             JOIN vectors_media vm1 ON vm1.tmdb_id = :::similarTmdbId${index} AND vm1.media_type = '${similar.mediaType}'
	//           `
	// 				}),
	// 			].join("\n")
	// 		: ""

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
