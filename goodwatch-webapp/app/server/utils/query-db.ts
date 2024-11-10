import type { WithSimilar } from "~/routes/api.similar-media"
import type {
	SimilarDNACombinationType,
	StreamingPreset,
	WatchedType,
} from "~/server/discover.server"
import { mapCategoryToVectorName } from "~/ui/dna/dna_utils"
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
	similarDNA: string
	similarDNACombinationType: SimilarDNACombinationType
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
	withoutCast?: string
	withCrew?: string
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
	const namedQuery = `
		${constructUnionQuery({ userId, filterMediaType, streaming, conditions, similarity, orderBy, limit })}
		SELECT
			m.*,
			sl.streaming_links
		FROM media m
		JOIN LATERAL (
			${getStreamingLinksJoin(streaming)}
		) sl on TRUE
		${
			similarity?.withSimilar?.[0]?.categories
				? "WHERE similarity_score IS NOT NULL"
				: ""
		}
		ORDER BY ${similarity?.category ? `m.${similarity.category}_vector <=> :::similarityVector ASC` : `${orderBy.column} ${orderBy.direction}`}
		LIMIT ${limit}
	`
	return convertNamedToPositionalParams(namedQuery, conditions)
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

	if (["all", "movies"].includes(filterMediaType)) {
		const selectMovies = constructSelectQuery({
			userId,
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
			userId,
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
		maxYear,
		minScore,
		maxScore,
		watchedType,
		withCast,
		withCrew,
		withGenres,
	} = conditions

	const userJoin = constructUserQuery({ userId, type, watchedType })
	const similarityJoins = constructSimilarityQueryParams({ type, similarity })

	const castIds = (withCast || "").split(",").map((castId) => Number(castId))
	const crewIds = (withCrew || "").split(",").map((crewId) => Number(crewId))

	return `
	SELECT DISTINCT
		'${type}' as media_type,
		${
			similarity?.withSimilar?.[0]?.categories
				? `(${similarity.withSimilar[0].categories
						.map((category) => {
							const categoryName = mapCategoryToVectorName(category)
							return `(COALESCE(vm.${categoryName}_vector <=> vm1.${categoryName}_vector, 1))`
						})
						.join(" + ")}) as similarity_score,`
				: ""
		}
		${getCommonFields()
			.map((field) => `m.${field}`)
			.join(",\n\t")}
	FROM ${type === "movie" ? "movies" : "tv"} m
	${similarityJoins}
	${userJoin}
	WHERE
	  m.title IS NOT NULL 
	  AND m.release_year IS NOT NULL 
	  AND m.poster_path IS NOT NULL 
	  AND ${orderBy.column} IS NOT NULL
		${streaming ? `AND ${getStreamingLinksCondition(type, streaming)}` : ""}
		${minScore ? "AND aggregated_overall_score_normalized_percent >= :::minScore" : ""}
		${maxScore ? "AND aggregated_overall_score_normalized_percent <= :::maxScore" : ""}
		${minYear ? "AND release_year >= :::minYear" : ""}
		${maxYear ? "AND release_year <= :::maxYear" : ""}
		${withCast ? `AND (${castIds.map((castId) => `m.cast @> '[{"id": ${castId}}]'`).join(" OR ")})` : ""}
		${withCrew ? `AND (${crewIds.map((crewId) => `m.crew @> '[{"id": ${crewId}}]'`).join(" OR ")})` : ""}
		${withGenres?.length ? "AND m.genres && :::withGenres::varchar[]" : ""}
		${minScore || orderBy.column === "aggregated_overall_score_normalized_percent" ? `AND m.aggregated_overall_score_voting_count >= ${VOTE_COUNT_THRESHOLD}` : ""}
		${userId && watchedType === "didnt-watch" ? "AND uwh.user_id IS NULL" : ""}
	ORDER BY 
	  ${
			similarity?.withSimilar?.[0]?.categories
				? "similarity_score ASC NULLS LAST"
				: `${orderBy.column} ${orderBy.direction}`
		}
	LIMIT ${limit}
  `
}

const constructSimilarityQueryParams = ({
	type,
	similarity,
}: ConstructSimilarityQueryParams) => {
	const { similarDNA, similarDNACombinationType, withSimilar } =
		similarity || {}
	const similarDNAList = similarDNA
		? similarDNA.split(",").map((dna) => {
				const [category, label] = dna.split(":", 2)
				return {
					category,
					label,
				}
			})
		: []

	const similarDNAJoins =
		similarDNAList.length > 0
			? similarDNACombinationType === "all"
				? // For "all", join each category/label pair as a separate JOIN
					similarDNAList
						.map(
							(dna, index) =>
								`JOIN dna d${index} ON m.tmdb_id = ANY(d${index}.${type}_tmdb_id)
							 AND d${index}.category = '${dna.category}' 
							 AND d${index}.label = '${dna.label}'`,
						)
						.join("\n")
				: // For "any", join once with OR conditions
					`JOIN dna d ON m.tmdb_id = ANY(d.${type}_tmdb_id) 
				   AND (${similarDNAList
							.map(
								(dna) =>
									`(d.category = '${dna.category}' AND d.label = '${dna.label}')`,
							)
							.join(" OR ")})`
			: ""

	const withSimilarList = withSimilar || []
	const similarTitleJoins =
		withSimilarList.length > 0
			? [
					`JOIN vectors_media vm ON vm.tmdb_id = m.tmdb_id AND vm.media_type = '${type}'`,
					...withSimilarList.map((similar) => {
						// TODO add support for multiple titles
						return `
						JOIN vectors_media vm1 ON vm1.tmdb_id = ${similar.tmdbId} AND vm1.media_type = '${similar.mediaType}'
					`
					}),
				].join("\n")
			: ""

	return [similarDNAJoins, similarTitleJoins].filter(Boolean).join("\n")
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
				uwh.user_id = '${userId}'
				AND uwh.tmdb_id = m.tmdb_id 
				AND uwh.media_type = '${type}' 
		`
	}
	if (watchedType === "didnt-watch") {
		// requires addition WHERE condition
		return `
			LEFT JOIN user_watch_history uwh ON
				uwh.user_id = '${userId}'
				AND uwh.tmdb_id = m.tmdb_id 
				AND uwh.media_type = '${type}' 
		`
	}
	if (watchedType === "plan-to-watch") {
		return `
			INNER JOIN user_wishlist uwl ON
				uwl.user_id = '${userId}'
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
