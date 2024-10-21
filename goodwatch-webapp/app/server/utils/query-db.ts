import type { StreamingPreset } from "~/server/discover.server"
import { VOTE_COUNT_THRESHOLD } from "~/utils/constants"
import { getRatingKeys } from "~/utils/ratings"
import { ignoredProviders } from "~/utils/streaming-links"

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
	media?: Media
}

interface Conditions {
	minScore?: string
	maxScore?: string
	minYear?: string
	maxYear?: string
	similarityVector?: string
	withCast?: string
	withCrew?: string
	withGenres?: string[]
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
	filterMediaType,
	streaming,
	similarity,
	conditions,
	orderBy,
	limit,
}: ConstructFullQueryParams) => {
	const namedQuery = `
	${constructUnionQuery({ filterMediaType, streaming, conditions, similarity, orderBy, limit })}
	SELECT
		m.*,
		sl.streaming_links
	FROM media m
	JOIN LATERAL (
		${getStreamingLinksJoin(streaming)}
	) sl on TRUE
	ORDER BY ${similarity ? `m.${similarity.category}_vector <=> :::similarityVector ASC` : `${orderBy.column} ${orderBy.direction}`}
	LIMIT ${limit}
	`
	return convertNamedToPositionalParams(namedQuery, conditions)
}

const constructUnionQuery = ({
	filterMediaType,
	streaming,
	similarity,
	conditions,
	orderBy,
	limit,
}: ConstructUnionQueryParams) => {
	const selectQueries = []

	if (["all", "movies"].includes(filterMediaType)) {
		const selectMovies = constructSelectQuery({
			type: "movie",
			streaming,
			similarity,
			conditions,
			orderBy,
			limit,
		})
		selectQueries.push(selectMovies)
	}

	if (["all", "tv"].includes(filterMediaType)) {
		const selectTv = constructSelectQuery({
			type: "tv",
			streaming,
			similarity,
			conditions,
			orderBy,
			limit,
		})
		selectQueries.push(selectTv)
	}

	return `
	WITH media AS (
		${selectQueries.map((query) => `(${query})`).join("\nUNION\n")}
  )
  `
}

const constructSelectQuery = ({
	type,
	streaming,
	similarity,
	conditions,
	orderBy,
	limit,
}: ConstructSelectQueryParams) => {
	const {
		minYear,
		maxYear,
		minScore,
		maxScore,
		withCast,
		withCrew,
		withGenres,
	} = conditions

	return `
	SELECT
		'${type}' as media_type,
		${similarity ? `v.${similarity.category}_vector,` : ""}
		${getCommonFields()
			.map((field) => `m.${field}`)
			.join(",\n\t")}
	FROM ${type === "movie" ? "movies" : "tv"} m
	${
		similarity
			? `JOIN vectors_media v ON v.tmdb_id = m.tmdb_id AND v.media_type = media_type AND v.${similarity.category}_vector IS NOT NULL`
			: ""
	}
	WHERE
	  m.title IS NOT NULL 
	  AND m.release_year IS NOT NULL 
	  AND m.poster_path IS NOT NULL 
	  ${similarity ? `AND v.${similarity.category}_vector` : `AND ${orderBy.column}`} IS NOT NULL
		${streaming ? `AND ${getStreamingLinksCondition(type, streaming)}` : ""}
		${minScore ? "AND aggregated_overall_score_normalized_percent >= :::minScore" : ""}
		${maxScore ? "AND aggregated_overall_score_normalized_percent <= :::maxScore" : ""}
		${minYear ? "AND release_year >= :::minYear" : ""}
		${maxYear ? "AND release_year <= :::maxYear" : ""}
		${withCast ? "AND m.cast @> ANY (SELECT jsonb_agg(jsonb_build_object('id', id)) FROM unnest(ARRAY[:::withCast]::int[]) AS t(id))" : ""}
		${withCrew ? "AND m.crew @> ANY (SELECT jsonb_agg(jsonb_build_object('id', id)) FROM unnest(ARRAY[:::withCast]::int[]) AS t(id))" : ""}
		${withGenres?.length ? "AND m.genres && :::withGenres::varchar[]" : ""}
		${minScore || orderBy.column === "aggregated_overall_score_normalized_percent" ? `AND m.aggregated_overall_score_voting_count >= ${VOTE_COUNT_THRESHOLD}` : ""}
	ORDER BY ${similarity ? `v.${similarity.category}_vector <=> :::similarityVector ASC` : `${orderBy.column} ${orderBy.direction}`} 
	LIMIT ${limit}
  `
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
	{ streamingPreset, countryCode, streamTypes, providerIds }: StreamingConfig,
) => {
	// TODO validation for country code
	// TODO validation for stream types
	// TODO validation for provider ids
	return `EXISTS (
		SELECT 1
		FROM streaming_provider_links spl
		WHERE spl.tmdb_id = m.tmdb_id
			AND spl.media_type = '${type}'
			AND spl.provider_id ${streamingPreset !== "everywhere" && providerIds ? `IN (${providerIds.join(",")})` : `NOT IN (${ignoredProviders.join(",")})`}
			${streamingPreset !== "everywhere" && countryCode ? `AND spl.country_code = '${countryCode}'` : ""}
			${streamTypes ? `AND spl.stream_type IN (${streamTypes.map((streamType) => `'${streamType}'`).join(",")})` : ""}
		LIMIT 1
	)`
}

const getStreamingLinksJoin = ({
	streamingPreset,
	countryCode,
	streamTypes,
	providerIds,
}: StreamingConfig = {}) => {
	// TODO validation for country code
	// TODO validation for stream types
	// TODO validation for provider ids
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
				AND spl.provider_id ${streamingPreset !== "everywhere" && providerIds ? `IN (${providerIds.join(",")})` : `NOT IN (${ignoredProviders.join(",")})`}
				${streamingPreset !== "everywhere" && countryCode ? `AND spl.country_code = '${countryCode}'` : ""}
				${streamTypes ? `AND spl.stream_type IN (${streamTypes.map((streamType) => `'${streamType}'`).join(",")})` : ""}
			ORDER BY spl.provider_id, spl.quality DESC, spl.price_dollar ASC
    ) spl
    INNER JOIN streaming_providers sp ON sp.id = spl.provider_id
	`
}

// generic query helpers

const convertNamedToPositionalParams = <T extends string>(
	query: string,
	params: Partial<Record<T, unknown>>,
) => {
	let index = 1
	const nameToIndex: Partial<Record<T, string>> = {}
	const orderedValues: string[] = []

	const positionalQuery = query.replace(/:::(\w+)/g, (match, name) => {
		if (!(name in nameToIndex)) {
			if (Object.prototype.hasOwnProperty.call(params, name)) {
				nameToIndex[name as T] = `$${index++}`
				orderedValues.push(params[name as T] as string)
			} else {
				throw new Error(`Parameter '${name}' is missing in the params object`)
			}
		}
		return nameToIndex[name as T] as string
	})

	return { query: positionalQuery, params: orderedValues }
}
