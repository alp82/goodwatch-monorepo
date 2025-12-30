import { query } from "~/utils/crate"

// Unified QdrantMediaPayload interface that combines fields from all recommendation systems
export interface QdrantMediaPayload {
	tmdb_id: number
	media_type: "movie" | "show"
	title?: string | string[]
	original_title?: string | string[]
	poster_path?: string | string[]
	backdrop_path?: string | string[]
	essence_tags?: string[]
	genres?: string[]
	release_year?: number
	release_decade?: number
	is_anime?: boolean
	production_method?: "Live-Action" | "Animation" | "Mixed-Media"
	// Scores
	tmdb_user_score_normalized_percent?: number
	imdb_user_score_normalized_percent?: number
	metacritic_user_score_normalized_percent?: number
	metacritic_meta_score_normalized_percent?: number
	rotten_tomatoes_audience_score_normalized_percent?: number
	rotten_tomatoes_tomato_score_normalized_percent?: number
	goodwatch_user_score_normalized_percent?: number
	goodwatch_official_score_normalized_percent?: number
	goodwatch_overall_score_normalized_percent?: number
	// Vote counts
	tmdb_user_score_rating_count?: number
	imdb_user_score_rating_count?: number
	metacritic_user_score_rating_count?: number
	metacritic_meta_score_review_count?: number
	rotten_tomatoes_audience_score_rating_count?: number
	rotten_tomatoes_tomato_score_review_count?: number
	goodwatch_user_score_rating_count?: number
	goodwatch_official_score_review_count?: number
	goodwatch_overall_score_voting_count?: number
	// Fingerprint scores
	fingerprint_scores_v1?: Record<string, number>
	// Suitability scores
	suitability_solo_watch?: boolean
	suitability_date_night?: boolean
	suitability_group_party?: boolean
	suitability_family?: boolean
	suitability_partner?: boolean
	suitability_friends?: boolean
	suitability_kids?: boolean
	suitability_teens?: boolean
	suitability_adults?: boolean
	suitability_intergenerational?: boolean
	suitability_public_viewing_safe?: boolean
	// Context scores
	context_is_thought_provoking?: boolean
	context_is_pure_escapism?: boolean
	context_is_background_friendly?: boolean
	context_is_comfort_watch?: boolean
	context_is_binge_friendly?: boolean
	context_is_drop_in_friendly?: boolean
	// Streaming
	streaming_pairs?: [string, string][]
	streaming_pair_codes?: string[]
	streaming_availability?: string[]
}

// Helper function to extract single value from potentially array field
export function getSingleValue<T>(value: T | T[] | undefined): T {
	if (Array.isArray(value)) {
		return value[0]
	}
	return value as T
}

// Helper function to extract single string value with fallback
export function getStringValue(value: string | string[] | undefined, fallback = ""): string {
	if (!value) return fallback
	if (Array.isArray(value)) {
		return value[0] || fallback
	}
	return value
}

// Helper function to build exclude filter for qdrant
export function buildExcludeFilter(excludeIds: number[]): any[] {
	return excludeIds.map(id => ({
		key: "tmdb_id",
		match: { value: id },
	}))
}

// Helper function to fetch user's exclude items from CrateDB (only those with vectors in Qdrant)
export async function getUserExcludeItems(userId: string): Promise<{ tmdb_id: number; media_type: string }[]> {
	// Fetch all items to exclude: scored, skipped, watched, and wishlist
	// Only include items that have essence_tags (which means they have vectors in Qdrant)
	const [scored, skipped, watched, wishlist] = await Promise.all([
		query<{ tmdb_id: number; media_type: string }>(`
			SELECT us.tmdb_id, us.media_type FROM user_score us
			INNER JOIN movie m ON us.tmdb_id = m.tmdb_id AND us.media_type = 'movie'
			WHERE us.user_id = ? AND m.essence_tags IS NOT NULL
			UNION ALL
			SELECT us.tmdb_id, us.media_type FROM user_score us
			INNER JOIN show s ON us.tmdb_id = s.tmdb_id AND us.media_type = 'show'
			WHERE us.user_id = ? AND s.essence_tags IS NOT NULL
		`, [userId, userId]),
		query<{ tmdb_id: number; media_type: string }>(`
			SELECT us.tmdb_id, us.media_type FROM user_skipped us
			INNER JOIN movie m ON us.tmdb_id = m.tmdb_id AND us.media_type = 'movie'
			WHERE us.user_id = ? AND m.essence_tags IS NOT NULL
			UNION ALL
			SELECT us.tmdb_id, us.media_type FROM user_skipped us
			INNER JOIN show s ON us.tmdb_id = s.tmdb_id AND us.media_type = 'show'
			WHERE us.user_id = ? AND s.essence_tags IS NOT NULL
		`, [userId, userId]),
		query<{ tmdb_id: number; media_type: string }>(`
			SELECT uw.tmdb_id, uw.media_type FROM user_watch_history uw
			INNER JOIN movie m ON uw.tmdb_id = m.tmdb_id AND uw.media_type = 'movie'
			WHERE uw.user_id = ? AND m.essence_tags IS NOT NULL
			UNION ALL
			SELECT uw.tmdb_id, uw.media_type FROM user_watch_history uw
			INNER JOIN show s ON uw.tmdb_id = s.tmdb_id AND uw.media_type = 'show'
			WHERE uw.user_id = ? AND s.essence_tags IS NOT NULL
		`, [userId, userId]),
		query<{ tmdb_id: number; media_type: string }>(`
			SELECT uw.tmdb_id, uw.media_type FROM user_wishlist uw
			INNER JOIN movie m ON uw.tmdb_id = m.tmdb_id AND uw.media_type = 'movie'
			WHERE uw.user_id = ? AND m.essence_tags IS NOT NULL
			UNION ALL
			SELECT uw.tmdb_id, uw.media_type FROM user_wishlist uw
			INNER JOIN show s ON uw.tmdb_id = s.tmdb_id AND uw.media_type = 'show'
			WHERE uw.user_id = ? AND s.essence_tags IS NOT NULL
		`, [userId, userId]),
	])

	// Combine all items and remove duplicates
	const allItems = [...scored, ...skipped, ...watched, ...wishlist]
	const uniqueItems = allItems.filter((item, index, arr) => 
		arr.findIndex(i => i.tmdb_id === item.tmdb_id && i.media_type === item.media_type) === index
	)

	return uniqueItems
}

// Helper function to fetch user's liked items from CrateDB (only those with vectors in Qdrant)
export async function getUserLikedItems(userId: string, minScore = 6): Promise<{ tmdb_id: number; media_type: "movie" | "show" }[]> {
	const items = await query<{ tmdb_id: number; media_type: "movie" | "show" }>(`
		SELECT us.tmdb_id, us.media_type FROM user_score us
		INNER JOIN movie m ON us.tmdb_id = m.tmdb_id AND us.media_type = 'movie'
		WHERE us.user_id = ? AND us.score >= ? AND m.essence_tags IS NOT NULL
		UNION ALL
		SELECT us.tmdb_id, us.media_type FROM user_score us
		INNER JOIN show s ON us.tmdb_id = s.tmdb_id AND us.media_type = 'show'
		WHERE us.user_id = ? AND us.score >= ? AND s.essence_tags IS NOT NULL
	`, [userId, minScore, userId, minScore])

	return items
}

// Helper function to fetch user's scored items from CrateDB (only those with vectors in Qdrant)
export async function getUserScoredItems(userId: string): Promise<{ tmdb_id: number; media_type: "movie" | "show" }[]> {
	const items = await query<{ tmdb_id: number; media_type: "movie" | "show" }>(`
		SELECT us.tmdb_id, us.media_type FROM user_score us
		INNER JOIN movie m ON us.tmdb_id = m.tmdb_id AND us.media_type = 'movie'
		WHERE us.user_id = ? AND m.essence_tags IS NOT NULL
		UNION ALL
		SELECT us.tmdb_id, us.media_type FROM user_score us
		INNER JOIN show s ON us.tmdb_id = s.tmdb_id AND us.media_type = 'show'
		WHERE us.user_id = ? AND s.essence_tags IS NOT NULL
	`, [userId, userId])

	return items
}

// Helper function to build base filter conditions for recommendations
export function buildBaseFilterConditions(options: {
	mediaType?: "movie" | "show" | "all"
	minVotingCount?: number
	minScore?: number
	fingerprintKey?: string
	minFingerprintScore?: number
	maxFingerprintScore?: number
	additionalMust?: any[]
	additionalMustNot?: any[]
}) {
	const {
		mediaType = "all",
		minVotingCount = 10000,
		minScore = 60,
		fingerprintKey,
		minFingerprintScore,
		maxFingerprintScore,
		additionalMust = [],
		additionalMustNot = [],
	} = options

	const must: any[] = [
		{
			key: "goodwatch_overall_score_voting_count",
			range: { gte: minVotingCount },
		},
		{
			key: "goodwatch_overall_score_normalized_percent",
			range: { gte: minScore },
		},
		...additionalMust,
	]

	const mustNot: any[] = [
		{
			key: "poster_path",
			match: { value: null },
		},
		{
			key: "backdrop_path",
			match: { value: null },
		},
		...additionalMustNot,
	]

	// Add media type filter if not "all"
	if (mediaType !== "all") {
		must.push({
			key: "media_type",
			match: { value: mediaType },
		})
	}

	// Add fingerprint score filter if key is provided
	if (fingerprintKey) {
		const fingerprintFilter: any = {
			key: `fingerprint_scores_v1.${fingerprintKey}`,
		}

		if (minFingerprintScore !== undefined && maxFingerprintScore !== undefined) {
			fingerprintFilter.range = { gte: minFingerprintScore, lte: maxFingerprintScore }
		} else if (minFingerprintScore !== undefined) {
			fingerprintFilter.range = { gte: minFingerprintScore }
		} else {
			fingerprintFilter.range = { gte: 9 } // Default high threshold
		}

		must.push(fingerprintFilter)
	}

	return { must, must_not: mustNot }
}

// Helper function to build payload fields list
export function buildPayloadFields(options: {
	includeRatings?: boolean
	includeFingerprintKey?: string
	includeStreaming?: boolean
	additionalFields?: string[]
}): string[] {
	const {
		includeRatings = true,
		includeFingerprintKey,
		includeStreaming = false,
		additionalFields = [],
	} = options

	const fields: string[] = [
		"tmdb_id",
		"media_type",
		"title",
		"release_year",
		"poster_path",
		"backdrop_path",
		"goodwatch_overall_score_voting_count",
		"goodwatch_overall_score_normalized_percent",
	]

	if (includeRatings) {
		fields.push(
			"tmdb_user_score_normalized_percent",
			"tmdb_user_score_rating_count",
			"imdb_user_score_normalized_percent",
			"imdb_user_score_rating_count",
			"metacritic_user_score_normalized_percent",
			"metacritic_user_score_rating_count",
			"metacritic_meta_score_normalized_percent",
			"metacritic_meta_score_review_count",
			"rotten_tomatoes_audience_score_normalized_percent",
			"rotten_tomatoes_audience_score_rating_count",
			"rotten_tomatoes_tomato_score_normalized_percent",
			"rotten_tomatoes_tomato_score_review_count",
			"goodwatch_user_score_normalized_percent",
			"goodwatch_user_score_rating_count",
			"goodwatch_official_score_normalized_percent",
			"goodwatch_official_score_review_count"
		)
	}

	if (includeFingerprintKey) {
		fields.push(`fingerprint_scores_v1.${includeFingerprintKey}`)
	}

	if (includeStreaming) {
		fields.push("streaming_availability")
	}

	if (additionalFields.length > 0) {
		fields.push(...additionalFields)
	}

	return fields
}
