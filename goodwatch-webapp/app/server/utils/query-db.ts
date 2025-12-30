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

export const mediaTypes = ["movie", "show"] as const
export type MediaType = (typeof mediaTypes)[number]

export const filterMediaTypes = ["all", "movies", "movie", "show", "shows"] as const
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
	fingerprintConditions?: FingerprintCondition[]
	suitabilityFilters?: string[]
	contextFilters?: string[]
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
		| "goodwatch_overall_score_normalized_percent"
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

export interface FingerprintCondition {
	field?: string
	operator?: ">" | ">=" | "<" | "<=" | "=" | "!="
	value?: number
	logic?: "AND" | "OR"
	conditions?: FingerprintCondition[]
}

// Function to generate SQL from fingerprint conditions
export const generateFingerprintSQL = (conditions: FingerprintCondition[]): string => {
	if (!conditions || conditions.length === 0) return ""

	const processCondition = (condition: FingerprintCondition): string => {
		if (
			condition.field &&
			condition.operator &&
			condition.value !== undefined
		) {
			// Single condition: fingerprint_scores['field'] >= value
			return `fingerprint_scores['${condition.field}'] ${condition.operator} ${condition.value}`
		} else if (condition.conditions && condition.conditions.length > 0) {
			// Nested conditions with logic
			const nestedSQL = condition.conditions
				.map(processCondition)
				.filter((sql) => sql.length > 0)
				.join(` ${condition.logic || "AND"} `)
			return nestedSQL ? `(${nestedSQL})` : ""
		}
		return ""
	}

	const sql = conditions
		.map(processCondition)
		.filter((sql) => sql.length > 0)
		.join(" AND ")

	return sql ? `AND ${sql}` : ""
}

// Function to generate SQL from suitability filters
const generateSuitabilitySQL = (filters: string[]): string => {
	if (!filters || filters.length === 0) return ""

	const conditions = filters.map((filter) => `${filter} = true`).join(" AND ")

	return `AND ${conditions}`
}

// Function to generate SQL from context filters
const generateContextSQL = (filters: string[]): string => {
	if (!filters || filters.length === 0) return ""

	const conditions = filters.map((filter) => `${filter} = true`).join(" AND ")

	return `AND ${conditions}`
}

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
		"goodwatch_overall_score_normalized_percent",
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
		WITH media AS (
			${unionQuery}
		)
		SELECT
			m.*,
			NULL as streaming_links
		FROM media m
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
		pageSize,
		offset,
	}

	// Add categories to params if similarity is being used
	if (similarity?.withSimilar?.length) {
		params.categories = conditions.categories
	}

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
		// Ensure movie parameters don't conflict with show parameters
		Object.keys(paramsMovies).forEach(key => {
			if (collectedParams[key] !== undefined) {
				console.warn(`Parameter collision detected for key: ${key}`)
			}
			collectedParams[key] = paramsMovies[key]
		})
	}

	if (["all", "show", "shows"].includes(filterMediaType)) {
		const { query: selectTv, params: paramsTv } = constructSelectQuery({
			userId,
			type: "show",
			streaming,
			similarity,
			conditions,
			orderBy,
			page,
			pageSize,
		})
		selectQueries.push(selectTv)
		// Ensure show parameters don't conflict with movie parameters
		Object.keys(paramsTv).forEach(key => {
			if (collectedParams[key] !== undefined) {
				console.warn(`Parameter collision detected for key: ${key}`)
			}
			collectedParams[key] = paramsTv[key]
		})
	}

	const unionQuery = `
		${selectQueries.join("\nUNION\n")}
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
	if (!["movie", "show"].includes(type)) {
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
	// Note: Similarity functionality is disabled for CrateDB migration
	const query = `${similarityCTE}SELECT DISTINCT
		'${type === "movie" ? "movie" : "show"}' as media_type,
		${similarity?.withSimilar?.length && similarityJoins ? "m_similar.shared_dna_score as similarity_score," : ""}
		${getCommonFields(type)
			.map((field) => `m.${field}`)
			.join(",\n\t\t")}
	FROM ${type === "movie" ? "movie" : "show"} m
		${similarityJoins}
		${dnaJoins}
		${userJoin}
	WHERE
		m.title IS NOT NULL
		AND m.release_year IS NOT NULL
		AND m.poster_path IS NOT NULL
		AND ${orderBy.column} IS NOT NULL
		${streaming?.streamingPreset ? `AND ${streamingCondition}` : ""}
		${minScore ? "AND goodwatch_overall_score_normalized_percent >= :::minScore" : ""}
 		${maxScore ? "AND goodwatch_overall_score_normalized_percent <= :::maxScore" : ""}
		${minYear ? "AND release_year >= :::minYear" : ""}
		${maxYear ? "AND release_year <= :::maxYear" : ""}
		${
			withCast && castIds.length
				? ` AND (${castIds
						.map(
							(castId) => `JSON_EXTRACT(m.cast, '$[*].id') LIKE '%${castId}%'`,
						)
						.join(withCastCombinationType === "all" ? " AND " : " OR ")})`
				: ""
		}
		${
			withCrew && crewIds.length
				? `AND (${crewIds
						.map(
							(crewId) => `JSON_EXTRACT(m.crew, '$[*].id') LIKE '%${crewId}%'`,
						)
						.join(withCrewCombinationType === "all" ? " AND " : " OR ")})`
				: ""
		}
		${withGenres?.length ? `AND (${withGenres.map((genre) => `'${genre.replace(/'/g, "''")}'` + " = ANY(m.genres)").join(" OR ")})` : ""}
		${
			minScore ||
			["popularity", "goodwatch_overall_score_normalized_percent"].includes(
				orderBy.column,
			)
				? `AND m.goodwatch_overall_score_voting_count >= ${
						orderBy.column === "goodwatch_overall_score_normalized_percent"
							? VOTE_COUNT_THRESHOLD_MID
							: VOTE_COUNT_THRESHOLD_LOW
					}`
				: ""
		}
		${orderBy.column === "release_date" ? (type === "movie" ? "AND m.release_date <= CURRENT_TIMESTAMP" : "AND m.first_air_date <= CURRENT_TIMESTAMP") : ""}
		${userId && watchedType === "didnt-watch" ? "AND uwh.user_id IS NULL" : ""}
		${conditions.fingerprintConditions?.length ? generateFingerprintSQL(conditions.fingerprintConditions) : ""}
		${conditions.suitabilityFilters?.length ? generateSuitabilitySQL(conditions.suitabilityFilters) : ""}
		${conditions.contextFilters?.length ? generateContextSQL(conditions.contextFilters) : ""}
	`

	// Collect parameters
	const params: Record<string, unknown> = {
		minScore,
		maxScore,
		minYear,
		maxYear,
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
	// Similarity functionality disabled for CrateDB migration (depends on DNA data)
	return { similarityCTE: "", similarityJoins: "" }
	// Rest of function disabled for CrateDB migration
}

const constructDNAQuery = ({
	type,
	similarity,
}: ConstructSimilarityQueryParams): {
	dnaJoins: string
	dnaParams: Record<string, unknown>
} => {
	// DNA functionality disabled for CrateDB migration
	// const { similarDNAIds = [], similarDNACombinationType } = similarity || {}
	const dnaParams: Record<string, unknown> = {}

	return {
		dnaJoins: "", // DNA joins disabled
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
	if (watchedType === "want-to-watch") {
		return `
			INNER JOIN user_wishlist uwl ON
				uwl.user_id = :::userId
				AND uwl.tmdb_id = m.tmdb_id 
				AND uwl.media_type = '${type}' 
		`
	}
}

const getCommonFields = (type: MediaType) => {
	return [
		"tmdb_id",
		"title",
		"release_year",
		`${type === "movie" ? "release_date" : "first_air_date"} as release_date`,
		"backdrop_path",
		"poster_path",
		"popularity",
		"streaming_service_ids",
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
		`${type}_`, // Use media type as prefix to avoid parameter collision
	)

	return {
		condition: `EXISTS (
			SELECT 1
			FROM streaming_availability sa
			WHERE sa.media_tmdb_id = m.tmdb_id
				AND sa.media_type = '${type}'
				AND sa.streaming_service_id ${providerCondition}
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
			'provider_id', sa.streaming_service_id,
			'provider_name', sp.name,
			'provider_logo_path', sp.logo_path,
			'media_type', sa.media_type,
			'country_code', sa.country_code,
			'stream_type', sa.streaming_type,
			'stream_url', sa.stream_url,
			'price_dollar', sa.price_dollar,
			'quality', sa.quality
																						)) AS streaming_links
		FROM (
			SELECT DISTINCT ON (sa.streaming_service_id) sa.*
			FROM streaming_availability sa
			WHERE sa.media_tmdb_id = m.tmdb_id
				AND sa.media_type = m.media_type
				AND sa.streaming_service_id ${providerCondition}
			${countryCodeCondition}
			${streamTypeCondition}
			ORDER BY sa.streaming_service_id, sa.quality DESC, sa.price_dollar ASC
		) sa
		INNER JOIN streaming_service sp ON sp.tmdb_id = sa.streaming_service_id AND sp.media_type = sa.media_type
	`
}

// Generic query helper

const convertNamedToPositionalParams = <T extends string>(
	query: string,
	params: Partial<Record<T, unknown>>,
) => {
	// For CrateDB, we'll return the query with named parameters replaced by question marks
	// and an ordered array of parameter values
	const orderedValues: unknown[] = []

	// Find all parameter occurrences in order (including duplicates)
	const matches = query.match(/:::([\w_]+)/g)
	if (matches) {
		matches.forEach((match) => {
			const name = match.substring(3) // Remove ':::'
			if (Object.prototype.hasOwnProperty.call(params, name)) {
				orderedValues.push(params[name as T])
			} else {
				// Log missing parameter for debugging UNION query parameter collisions
				console.error(`Parameter '${name}' is missing in the params object. Available params:`, Object.keys(params))
				throw new Error(`Parameter '${name}' is missing in the params object`)
			}
		})
	}

	// Replace all named parameters with question marks
	const positionalQuery = query.replace(/:::([\w_]+)/g, "?")

	return { query: positionalQuery, params: orderedValues }
}

function prepareStreamingConditions(
	streamingPreset: "everywhere" | "mine" | "custom" | undefined,
	providerIds: number[] | undefined,
	streamTypes: StreamType[] | undefined,
	countryCode: string | undefined,
	paramPrefix: string = "",
) {
	const params: Record<string, unknown> = {}
	let providerCondition = ""
	if (streamingPreset !== "everywhere" && providerIds) {
		const validProviderIds = providerIds.filter((id) => !Number.isNaN(id))
		validProviderIds.forEach((id, idx) => {
			params[`${paramPrefix}providerId${idx}`] = id
		})
		providerCondition = `IN (${validProviderIds
			.map((_, idx) => `:::${paramPrefix}providerId${idx}`)
			.join(",")})`
	} else {
		providerCondition = `NOT IN (${duplicateProviders.join(",")})`
	}

	let streamTypeCondition = ""
	if (streamTypes) {
		streamTypeCondition = `AND sa.streaming_type IN (${streamTypes
			.map((streamType, idx) => {
				params[`${paramPrefix}streamType${idx}`] = streamType
				return `:::${paramPrefix}streamType${idx}`
			})
			.join(",")})`
	}

	let countryCodeCondition = ""
	if (streamingPreset !== "everywhere" && countryCode) {
		params[`${paramPrefix}countryCode`] = countryCode
		countryCodeCondition = `AND sa.country_code = :::${paramPrefix}countryCode`
	}
	return {
		providerCondition,
		streamTypeCondition,
		countryCodeCondition,
		params,
	}
}
