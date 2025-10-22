import { query } from "~/utils/crate"
import { DISCOVER_PAGE_SIZE } from "~/utils/constants"
import type { AllRatings } from "~/utils/ratings"
import type { FingerprintCondition } from "~/server/utils/query-db"
import { generateFingerprintSQL as generateFingerprintSQLBase } from "~/server/utils/query-db"
import { getGenresAll } from "~/server/genres.server"
import { recommend, makePointId, parsePointId } from "~/utils/qdrant"

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
	similarTitles: string
	fingerprintPillars: string
	fingerprintPillarMinTier: string
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
	withStreamingProviders?: string
	withGenres?: string
	withCast?: string
	withCrew?: string
	withSimilarTitles?: string
	fingerprintPillars?: string
	fingerprintPillarMinTier?: string
	sortBy?: DiscoverSortBy
	sortDirection?: "asc" | "desc"
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
		withStreamingProviders: params.withStreamingProviders,
		withGenres: params.withGenres,
		withCast: params.withCast,
		withCrew: params.withCrew,
		withSimilarTitles: params.similarTitles,
		fingerprintPillars: params.fingerprintPillars,
		fingerprintPillarMinTier: params.fingerprintPillarMinTier,
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
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
	withStreamingProviders,
	withGenres,
	withCast,
	withCrew,
	withSimilarTitles,
	fingerprintPillars,
	fingerprintPillarMinTier,
	sortBy = "popularity",
	sortDirection = "desc",
	page,
}: SimpleDiscoverParams): Promise<DiscoverResult[]> {
	const offset = (page - 1) * DISCOVER_PAGE_SIZE
	
	// Determine which media types to include
	const includeMovies = ["all", "movies", "movie"].includes(type)
	const includeShows = ["all", "show", "shows"].includes(type)
	
	// Get candidate IDs from Qdrant only if similarity filter is active
	// (Fingerprint-only filtering is handled in CrateDB)
	let candidateIds: Set<number> | null = null
	if (withSimilarTitles) {
		candidateIds = await getQdrantCandidates({
			withSimilarTitles,
			fingerprintPillars,
			fingerprintPillarMinTier,
			includeMovies,
			includeShows,
			minScore,
			maxScore,
			minYear,
			maxYear,
		})
	}
	
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
			country,
			withStreamingProviders,
			withGenres,
			withCast,
			withCrew,
			candidateIds,
			fingerprintPillars,
			fingerprintPillarMinTier,
			sortBy,
			sortDirection,
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
			country,
			withStreamingProviders,
			withGenres,
			withCast,
			withCrew,
			candidateIds,
			fingerprintPillars,
			fingerprintPillarMinTier,
			sortBy,
			sortDirection,
			limit: includeMovies ? Math.ceil(DISCOVER_PAGE_SIZE / 2) : DISCOVER_PAGE_SIZE,
			offset: includeMovies ? Math.floor(offset / 2) : offset,
		})
		results.push(...showResults)
	}
	
	// Sort results based on sortBy parameter
	const sortedResults = results.sort((a, b) => {
		let comparison = 0
		if (sortBy === "aggregated_score") {
			const aScore = a.goodwatch_overall_score_normalized_percent ?? 0
			const bScore = b.goodwatch_overall_score_normalized_percent ?? 0
			comparison = bScore - aScore
		} else if (sortBy === "release_date") {
			const aDate = a.release_date ? new Date(a.release_date).getTime() : 0
			const bDate = b.release_date ? new Date(b.release_date).getTime() : 0
			comparison = bDate - aDate
		} else {
			comparison = (b.popularity ?? 0) - (a.popularity ?? 0)
		}
		return sortDirection === "asc" ? -comparison : comparison
	})
	return sortedResults.slice(0, DISCOVER_PAGE_SIZE)
}

interface QdrantCandidatesParams {
	withSimilarTitles?: string
	fingerprintPillars?: string
	fingerprintPillarMinTier?: string
	includeMovies: boolean
	includeShows: boolean
	minScore?: string
	maxScore?: string
	minYear?: string
	maxYear?: string
}

async function getQdrantCandidates({
	withSimilarTitles,
	fingerprintPillars,
	fingerprintPillarMinTier,
	includeMovies,
	includeShows,
	minScore,
	maxScore,
	minYear,
	maxYear,
}: QdrantCandidatesParams): Promise<Set<number>> {
	const candidateIds = new Set<number>()
	
	// Build base filter conditions for Qdrant
	const mustConditions: any[] = [
		{
			key: "goodwatch_overall_score_voting_count",
			range: { gte: 1000 },
		},
	]
	
	// Add media type filter
	const mediaTypes: string[] = []
	if (includeMovies) mediaTypes.push("movie")
	if (includeShows) mediaTypes.push("show")
	
	if (mediaTypes.length === 1) {
		mustConditions.push({
			key: "media_type",
			match: { value: mediaTypes[0] },
		})
	}
	
	// Add score filter
	if (minScore || maxScore) {
		const scoreRange: any = {}
		if (minScore) scoreRange.gte = Number(minScore)
		if (maxScore) scoreRange.lte = Number(maxScore)
		mustConditions.push({
			key: "goodwatch_overall_score_normalized_percent",
			range: scoreRange,
		})
	}
	
	// Add year filter
	if (minYear || maxYear) {
		const yearRange: any = {}
		if (minYear) yearRange.gte = Number(minYear)
		if (maxYear) yearRange.lte = Number(maxYear)
		mustConditions.push({
			key: "release_year",
			range: yearRange,
		})
	}
	
	const mustNotConditions: any[] = [
		{ key: "poster_path", match: { value: null } },
	]
	
	// Map pillar names to their underlying fingerprint scores
	const PILLAR_TO_SCORES: Record<string, string[]> = {
		Energy: ['adrenaline', 'tension', 'scare', 'fast_pace', 'spectacle', 'violence'],
		Heart: ['romance', 'wholesome', 'pathos', 'melancholy', 'hopefulness', 'catharsis', 'nostalgia', 'coming_of_age', 'family_dynamics', 'wonder'],
		Humor: ['situational_comedy', 'wit_wordplay', 'physical_comedy', 'cringe_humor', 'absurdist_humor', 'satire_parody', 'dark_humor'],
		World: ['world_immersion', 'dialogue_centrality', 'rewatchability', 'ambiguity', 'novelty'],
		Craft: ['direction', 'acting', 'narrative_structure', 'dialogue_quality', 'character_depth', 'intrigue', 'complexity', 'non_linear_narrative', 'meta_narrative'],
		Style: ['cinematography', 'editing', 'music_composition', 'visual_stylization', 'music_centrality', 'sound_centrality'],
	}
	
	// Tier to score mapping (approximate - tiers are computed from aggregated scores)
	// Higher tier = more selective (higher score required)
	// Tier 1 (Low) ≈ score 4+, Tier 2 (Mid) ≈ 6+, Tier 3 (High) ≈ 8+
	const tierToMinScore = (tier: number): number => {
		if (tier >= 3) return 8  // High: very high scores
		if (tier >= 2) return 6  // Mid: medium-high scores
		return 4                  // Low: medium scores
	}
	
	// Note: Fingerprint pillar filtering in Qdrant is disabled because scores are stored
	// in Firestore format (nested fields.{score}.integerValue as strings) which Qdrant
	// cannot efficiently filter. Pillar filtering works in CrateDB standalone mode.
	// TODO: Re-index Qdrant with flattened fingerprint scores for filtering support
	if (fingerprintPillars && withSimilarTitles) {
		console.log(`[Qdrant] Fingerprint pillar filter requested but not supported in similarity mode`)
		console.log(`[Qdrant] Pillars: ${fingerprintPillars}, Tier: ${fingerprintPillarMinTier}`)
		console.log(`[Qdrant] Filtering will be applied in CrateDB after similarity results`)
	}
	
	// Handle similarity filter OR standalone pillar filter
	const hasSimilarityFilter = !!withSimilarTitles
	const hasPillarFilter = fingerprintPillars && fingerprintPillars.split(",").filter(Boolean).length > 0
	
	if (hasSimilarityFilter) {
		// Similarity filter with optional pillar filters
		const similarTitles = withSimilarTitles.split(",").filter(Boolean)
		const positiveIds: number[] = []
		
		for (const titleStr of similarTitles) {
			const [tmdbIdStr, mediaType] = titleStr.split(":")
			const tmdbId = Number(tmdbIdStr)
			if (!Number.isNaN(tmdbId) && (mediaType === "movie" || mediaType === "show")) {
				positiveIds.push(makePointId(mediaType, tmdbId))
			}
		}
		
		if (positiveIds.length > 0) {
			const results = await recommend({
				collectionName: "media",
				positive: positiveIds,
				using: "fingerprint_v1",
				filter: {
					must: mustConditions,
					must_not: mustNotConditions,
				},
				limit: 5000,
				withPayload: ["tmdb_id"],
				hnswEf: 128,
				exact: false,
			})
			
			for (const result of results) {
				if (result.payload?.tmdb_id) {
					candidateIds.add(result.payload.tmdb_id)
				}
			}
		}
	}
	// Note: Standalone pillar filter (without similarity) is handled in CrateDB
	
	return candidateIds
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
	country?: string
	withStreamingProviders?: string
	withGenres?: string
	withCast?: string
	withCrew?: string
	candidateIds?: Set<number> | null
	fingerprintPillars?: string
	fingerprintPillarMinTier?: string
	sortBy: DiscoverSortBy
	sortDirection: "asc" | "desc"
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
	country,
	withStreamingProviders,
	withGenres,
	withCast,
	withCrew,
	candidateIds,
	fingerprintPillars,
	fingerprintPillarMinTier,
	sortBy,
	sortDirection,
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
	
	// Add candidate IDs filter from Qdrant
	if (candidateIds && candidateIds.size > 0) {
		const ids = Array.from(candidateIds)
		const placeholders = ids.map(() => "?").join(", ")
		conditions.push(`m.tmdb_id IN (${placeholders})`)
		params.push(...ids)
	}
	
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
	
	// Add fingerprint pillar filter
	// Works in both standalone mode and with Qdrant candidates (filters after similarity)
	if (fingerprintPillars) {
		const PILLAR_TO_SCORES: Record<string, string[]> = {
			Energy: ['adrenaline', 'tension', 'scare', 'fast_pace', 'spectacle', 'violence'],
			Heart: ['romance', 'wholesome', 'pathos', 'melancholy', 'hopefulness', 'catharsis', 'nostalgia', 'coming_of_age', 'family_dynamics', 'wonder'],
			Humor: ['situational_comedy', 'wit_wordplay', 'physical_comedy', 'cringe_humor', 'absurdist_humor', 'satire_parody', 'dark_humor'],
			World: ['world_immersion', 'dialogue_centrality', 'rewatchability', 'ambiguity', 'novelty'],
			Craft: ['direction', 'acting', 'narrative_structure', 'dialogue_quality', 'character_depth', 'intrigue', 'complexity', 'non_linear_narrative', 'meta_narrative'],
			Style: ['cinematography', 'editing', 'music_composition', 'visual_stylization', 'music_centrality', 'sound_centrality'],
		}
		
		const tierToMinScore = (tier: number): number => {
			if (tier >= 3) return 8
			if (tier >= 2) return 6
			return 4
		}
		
		const pillarNames = fingerprintPillars.split(",").filter(Boolean).map((name) => name.trim())
		const minTier = fingerprintPillarMinTier ? Number(fingerprintPillarMinTier) : 1
		const minScore = tierToMinScore(minTier)
		
		// For each pillar, require at least 2 scores to meet the threshold
		// This approximates the pillar computation (especially top2 aggregation)
		for (const pillarName of pillarNames) {
			const scores = PILLAR_TO_SCORES[pillarName]
			if (scores) {
				// Count how many scores meet the threshold
				const countExpr = scores.map((score) => {
					params.push(minScore)
					return `CASE WHEN COALESCE(m.fingerprint_scores['${score}'], 0) >= ? THEN 1 ELSE 0 END`
				}).join(" + ")
				
				// Require at least 2 scores to meet threshold
				conditions.push(`(${countExpr}) >= 2`)
			}
		}
	}
	
	// Add streaming provider filter
	if (withStreamingProviders && country) {
		const providerIds = withStreamingProviders
			.split(",")
			.map((id) => Number(id))
			.filter((id) => !Number.isNaN(id))
		if (providerIds.length > 0) {
			const streamingPatterns = providerIds.map((id) => `${country}_${id}`)
			const streamingConditions = streamingPatterns.map((pattern) => {
				params.push(pattern)
				return "? = ANY(m.streaming_availabilities)"
			})
			conditions.push(`(${streamingConditions.join(" OR ")})`)
		}
	}
	
	// Add genre filter
	if (withGenres) {
		const genreIds = withGenres
			.split(",")
			.map((id) => Number(id))
			.filter((id) => !Number.isNaN(id))
		if (genreIds.length > 0) {
			const allGenres = await getGenresAll()
			const genreNames = genreIds
				.map((id) => allGenres.find((g) => g.id === id)?.name)
				.filter((name): name is string => Boolean(name))
			if (genreNames.length > 0) {
				const genreConditions = genreNames.map((genreName) => {
					params.push(genreName)
					return "? = ANY(m.genres)"
				})
				conditions.push(`(${genreConditions.join(" OR ")})`)
			}
		}
	}
	
	// Add cast filter
	if (withCast) {
		const castIds = withCast
			.split(",")
			.map((id) => Number(id))
			.filter((id) => !Number.isNaN(id))
		if (castIds.length > 0) {
			const castPlaceholders = castIds.map(() => "?").join(", ")
			conditions.push(`m.tmdb_id IN (
				SELECT DISTINCT media_tmdb_id 
				FROM person_appeared_in 
				WHERE media_type = ? 
				AND person_tmdb_id IN (${castPlaceholders})
			)`)
			params.push(mediaType, ...castIds)
		}
	}
	
	// Add crew filter
	if (withCrew) {
		const crewIds = withCrew
			.split(",")
			.map((id) => Number(id))
			.filter((id) => !Number.isNaN(id))
		if (crewIds.length > 0) {
			const crewPlaceholders = crewIds.map(() => "?").join(", ")
			conditions.push(`m.tmdb_id IN (
				SELECT DISTINCT media_tmdb_id 
				FROM person_worked_on 
				WHERE media_type = ? 
				AND person_tmdb_id IN (${crewPlaceholders})
			)`)
			params.push(mediaType, ...crewIds)
		}
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
		} else if (watchedType === "plan-to-watch") {
			userJoin = `
				INNER JOIN user_wishlist uwl ON
					uwl.user_id = ? AND
					uwl.tmdb_id = m.tmdb_id AND
					uwl.media_type = ?
			`
			params.push(userId, mediaType)
		}
	}
	
	// Build the query
	const releaseField = mediaType === "movie" ? "m.release_date" : "m.first_air_date"
	
	// Determine ORDER BY clause
	let orderByClause = "m.popularity DESC"
	if (sortBy === "aggregated_score") {
		orderByClause = `m.goodwatch_overall_score_normalized_percent ${sortDirection === "asc" ? "ASC" : "DESC"}`
		// Add minimum vote count requirement for score sorting
		conditions.push("m.goodwatch_overall_score_normalized_percent IS NOT NULL")
	} else if (sortBy === "release_date") {
		orderByClause = `${releaseField} ${sortDirection === "asc" ? "ASC" : "DESC"}`
		conditions.push(`${releaseField} IS NOT NULL`)
	} else {
		orderByClause = `m.popularity ${sortDirection === "asc" ? "ASC" : "DESC"}`
	}
	
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
		ORDER BY ${orderByClause}
		LIMIT ? OFFSET ?
	`
	
	params.push(limit, offset)
	
	const results = await query<DiscoverResult>(sql, params)
	return results
}
