import { query } from "~/utils/crate"
import { DISCOVER_PAGE_SIZE } from "~/utils/constants"
import type { AllRatings } from "~/utils/ratings"

export type WatchedType = "didnt-watch" | "plan-to-watch" | "watched"
export type StreamingPreset = "everywhere" | "mine" | "custom"
export type CombinationType = "all" | "any"
export type DiscoverSortBy = "popularity" | "aggregated_score" | "release_date"

// Legacy interface for backward compatibility
export interface DiscoverParams {
	userId?: string
	type: "all" | "movies" | "movie" | "show" | "shows"
	country: string
	language: string
	watchedType: WatchedType
	minAgeRating: string
	maxAgeRating: string
	minYear: string
	maxYear: string
	minScore: string
	maxScore: string
	withCast: string
	withCastCombinationType: CombinationType
	withoutCast: string
	withCrew: string
	withCrewCombinationType: CombinationType
	withoutCrew: string
	withGenres: string
	withoutGenres: string
	withKeywords: string
	withoutKeywords: string
	streamingPreset: StreamingPreset
	withStreamingProviders: string
	withStreamingTypes: string
	similarDNA: string
	similarDNACombinationType: CombinationType
	similarTitles: string
	fingerprintConditions: string
	suitabilityFilters: string
	contextFilters: string
	sortBy: DiscoverSortBy
	sortDirection: "asc" | "desc"
	page: number
}

export interface DiscoverResult extends AllRatings {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	release_year: string
	release_date: string
	backdrop_path: string
	poster_path: string
	popularity: number
	streaming_service_ids: number[]
}

export interface SimpleDiscoverParams {
	userId?: string
	type: "all" | "movies" | "movie" | "show" | "shows"
	country: string
	language: string
	watchedType?: "didnt-watch" | "plan-to-watch" | "watched"
	minScore?: string
	maxScore?: string
	minYear?: string
	maxYear?: string
	page: number
}

export type DiscoverResults = DiscoverResult[]

export const getDiscoverResults = async (params: DiscoverParams): Promise<DiscoverResults> => {
	// Convert legacy DiscoverParams to SimpleDiscoverParams
	const simpleParams: SimpleDiscoverParams = {
		userId: params.userId,
		type: params.type,
		country: params.country,
		language: params.language,
		watchedType: params.watchedType,
		minScore: params.minScore,
		maxScore: params.maxScore,
		minYear: params.minYear,
		maxYear: params.maxYear,
		page: params.page,
	}
	
	return await _getSimpleDiscoverResults(simpleParams)
}

async function _getSimpleDiscoverResults({
	userId,
	type,
	country,
	language,
	watchedType,
	minScore,
	maxScore,
	minYear,
	maxYear,
	page,
}: SimpleDiscoverParams): Promise<DiscoverResult[]> {
	const offset = (page - 1) * DISCOVER_PAGE_SIZE
	
	// Determine which media types to include
	const includeMovies = ["all", "movies", "movie"].includes(type)
	const includeShows = ["all", "show", "shows"].includes(type)
	
	const results: DiscoverResult[] = []
	
	// Get movies if needed
	if (includeMovies) {
		const movieResults = await getMediaResults({
			mediaType: "movie",
			tableName: "movie",
			userId,
			watchedType,
			minScore,
			maxScore,
			minYear,
			maxYear,
			limit: includeShows ? Math.ceil(DISCOVER_PAGE_SIZE / 2) : DISCOVER_PAGE_SIZE,
			offset: includeShows ? Math.floor(offset / 2) : offset,
		})
		results.push(...movieResults)
	}
	
	// Get shows if needed
	if (includeShows) {
		const showResults = await getMediaResults({
			mediaType: "show",
			tableName: "show",
			userId,
			watchedType,
			minScore,
			maxScore,
			minYear,
			maxYear,
			limit: includeMovies ? Math.ceil(DISCOVER_PAGE_SIZE / 2) : DISCOVER_PAGE_SIZE,
			offset: includeMovies ? Math.floor(offset / 2) : offset,
		})
		results.push(...showResults)
	}
	
	// Sort by popularity and return requested page
	const sortedResults = results.sort((a, b) => b.popularity - a.popularity)
	return sortedResults.slice(0, DISCOVER_PAGE_SIZE)
}

interface MediaQueryParams {
	mediaType: "movie" | "show"
	tableName: "movie" | "show"
	userId?: string
	watchedType?: "didnt-watch" | "plan-to-watch" | "watched"
	minScore?: string
	maxScore?: string
	minYear?: string
	maxYear?: string
	limit: number
	offset: number
}

async function getMediaResults({
	mediaType,
	tableName,
	userId,
	watchedType,
	minScore,
	maxScore,
	minYear,
	maxYear,
	limit,
	offset,
}: MediaQueryParams): Promise<DiscoverResult[]> {
	const params: any[] = []
	const conditions: string[] = [
		"m.title IS NOT NULL",
		"m.release_year IS NOT NULL",
		"m.poster_path IS NOT NULL",
		"m.popularity IS NOT NULL",
		"m.goodwatch_overall_score_voting_count >= 1000"
	]
	
	// Add score filters
	if (minScore) {
		conditions.push("m.goodwatch_overall_score_normalized_percent >= ?")
		params.push(Number(minScore))
	}
	if (maxScore) {
		conditions.push("m.goodwatch_overall_score_normalized_percent <= ?")
		params.push(Number(maxScore))
	}
	
	// Add year filters
	if (minYear) {
		conditions.push("m.release_year >= ?")
		params.push(Number(minYear))
	}
	if (maxYear) {
		conditions.push("m.release_year <= ?")
		params.push(Number(maxYear))
	}
	
	// Build user join and condition
	let userJoin = ""
	if (userId && watchedType) {
		if (watchedType === "watched") {
			userJoin = `
				INNER JOIN user_watch_history uwh ON
					uwh.user_id = ? AND
					uwh.tmdb_id = m.tmdb_id AND
					uwh.media_type = ?
			`
			params.push(userId, mediaType)
		} else if (watchedType === "didnt-watch") {
			userJoin = `
				LEFT JOIN user_watch_history uwh ON
					uwh.user_id = ? AND
					uwh.tmdb_id = m.tmdb_id AND
					uwh.media_type = ?
			`
			conditions.push("uwh.user_id IS NULL")
			params.push(userId, mediaType)
		}
	}
	
	// Build the query
	const releaseField = mediaType === "movie" ? "m.release_date" : "m.first_air_date"
	
	const sql = `
		SELECT DISTINCT
			m.tmdb_id,
			'${mediaType}' as media_type,
			m.title,
			m.release_year,
			${releaseField} as release_date,
			m.backdrop_path,
			m.poster_path,
			m.popularity,
			m.streaming_service_ids,
			m.tmdb_user_score_original,
			m.tmdb_user_score_normalized_percent,
			m.tmdb_user_score_rating_count,
			m.imdb_user_score_original,
			m.imdb_user_score_normalized_percent,
			m.imdb_user_score_rating_count,
			m.metacritic_user_score_original,
			m.metacritic_user_score_normalized_percent,
			m.metacritic_user_score_rating_count,
			m.metacritic_meta_score_original,
			m.metacritic_meta_score_normalized_percent,
			m.metacritic_meta_score_review_count,
			m.rotten_tomatoes_audience_score_original,
			m.rotten_tomatoes_audience_score_normalized_percent,
			m.rotten_tomatoes_audience_score_rating_count,
			m.rotten_tomatoes_tomato_score_original,
			m.rotten_tomatoes_tomato_score_normalized_percent,
			m.rotten_tomatoes_tomato_score_review_count,
			m.goodwatch_user_score_normalized_percent,
			m.goodwatch_user_score_rating_count,
			m.goodwatch_official_score_normalized_percent,
			m.goodwatch_official_score_review_count,
			m.goodwatch_overall_score_normalized_percent,
			m.goodwatch_overall_score_voting_count
		FROM ${tableName} m
		${userJoin}
		WHERE ${conditions.join(" AND ")}
		ORDER BY m.popularity DESC
		LIMIT ? OFFSET ?
	`
	
	params.push(limit, offset)
	
	const results = await query<DiscoverResult>(sql, params)
	return results
}
