import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"
import { makePointId, recommend } from "~/utils/qdrant"
import type { AllRatings } from "~/utils/ratings"
import {
	type QdrantMediaPayload,
	getStringValue,
	buildExcludeFilter,
	getUserExcludeItems,
	buildBaseFilterConditions,
	buildPayloadFields,
} from "~/server/utils/recommend"


export interface UserRecommendation extends Partial<AllRatings> {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	release_year: string
	poster_path: string
	backdrop_path: string
	essence_tags: string[]
	goodwatch_overall_score_voting_count: number
	goodwatch_overall_score_normalized_percent: number
	ann_score: number
	match_percentage: number
}

interface UserScore {
	tmdb_id: number
	media_type: "movie" | "show"
	score: number
}

export interface GetUserRecommendationsParams {
	userId: string
	mediaType?: "movie" | "show" | "all"
	limit?: number
}

// Note: We now use relative scoring - top scores as positive, bottom as negative
// These thresholds are kept for the SQL query but the logic uses relative comparison
const MAX_POSITIVE_EXAMPLES = 50
const MAX_NEGATIVE_EXAMPLES = 50
export const getUserRecommendations = async (params: GetUserRecommendationsParams) => {
	return await cached({
		name: "user-recommendations",
		target: _getUserRecommendations as any,
		params,
		ttlMinutes: 0, // No cache for now, can increase later
	}) as unknown as UserRecommendation[]
}

async function _getUserRecommendations({
	userId,
	mediaType = "all",
	limit = 20,
}: GetUserRecommendationsParams): Promise<UserRecommendation[]> {
	console.log('[User Recommendations] userId:', userId, 'mediaType:', mediaType, 'limit:', limit)

	// Fetch all scores - we'll use relative scoring (top half positive, bottom half negative)
	const highScores = await query<UserScore>(`
		SELECT * FROM (
			SELECT us.tmdb_id, us.media_type, us.score, us.updated_at
			FROM user_score us
			INNER JOIN movie m ON us.tmdb_id = m.tmdb_id
			WHERE us.user_id = ?
				AND us.media_type = 'movie'
				AND m.essence_tags IS NOT NULL
			
			UNION ALL
			
			SELECT us.tmdb_id, us.media_type, us.score, us.updated_at
			FROM user_score us
			INNER JOIN show s ON us.tmdb_id = s.tmdb_id
			WHERE us.user_id = ?
				AND us.media_type = 'show'
				AND s.essence_tags IS NOT NULL
		) AS combined_results
		WHERE score >= 6
		ORDER BY score DESC, updated_at DESC
		LIMIT ?
	`, [userId, userId, MAX_POSITIVE_EXAMPLES])

	const lowScores = await query<UserScore>(`
		SELECT * FROM (
			SELECT us.tmdb_id, us.media_type, us.score, us.updated_at
			FROM user_score us
			INNER JOIN movie m ON us.tmdb_id = m.tmdb_id
			WHERE us.user_id = ?
				AND us.media_type = 'movie'
				AND m.essence_tags IS NOT NULL
			
			UNION ALL
			
			SELECT us.tmdb_id, us.media_type, us.score, us.updated_at
			FROM user_score us
			INNER JOIN show s ON us.tmdb_id = s.tmdb_id
			WHERE us.user_id = ?
				AND us.media_type = 'show'
				AND s.essence_tags IS NOT NULL
		) AS combined_results
		WHERE score <= 5
		ORDER BY score ASC, updated_at DESC
		LIMIT ?
	`, [userId, userId, MAX_NEGATIVE_EXAMPLES])

	// Fetch all items to exclude (scored, skipped, watched, wishlist)
	// Only those with vectors in Qdrant
	const allExcluded = await getUserExcludeItems(userId)
	const excludeIds = allExcluded.map(s => s.tmdb_id)

	console.log('[User Recommendations] highScores:', highScores.length, 'lowScores:', lowScores.length, 'allExcluded:', allExcluded.length)

	// Need at least one score to make recommendations
	if (highScores.length === 0) {
		console.log('[User Recommendations] No scores found, returning empty')
		return []
	}

	// Convert to Qdrant point IDs
	const positivePoints = highScores.map(s => 
		makePointId(s.media_type as "movie" | "show", s.tmdb_id)
	)
	const negativePoints = lowScores.map(s => 
		makePointId(s.media_type as "movie" | "show", s.tmdb_id)
	)

	// Build filter conditions
	const mustConditions: any[] = [
		{
			key: "goodwatch_overall_score_voting_count",
			range: { gte: 50000 },
		},
		{
			key: "goodwatch_overall_score_normalized_percent",
			range: { gte: 50 },
		},
	]

	// Add media type filter if not "all"
	if (mediaType !== "all") {
		mustConditions.push({
			key: "media_type",
			match: { value: mediaType },
		})
		
	}

	// Build filter conditions using shared utility
	const { must, must_not } = buildBaseFilterConditions({
		mediaType,
		minVotingCount: 10000,
		minScore: 60,
		additionalMust: mustConditions,
		additionalMustNot: [
			{ key: "poster_path", match: { value: null } },
			...buildExcludeFilter(excludeIds),
		],
	})

	const filterConditions = { must, must_not }

	// Build payload fields using shared utility
	const payloadFields = buildPayloadFields({
		includeRatings: true,
		additionalFields: ["essence_tags", "genres"],
	})

	// Call Qdrant recommend
	const recommendParams: any = {
		collectionName: "media",
		using: "fingerprint_v1",
		strategy: "average_vector",
		positive: positivePoints,
		negative: negativePoints,
		filter: filterConditions,
		limit,
		withPayload: { include: payloadFields },
		hnswEf: 128,
		exact: false,
	}

	if (negativePoints.length > 0) {
		recommendParams.negative = negativePoints
	}

	const results = await recommend<QdrantMediaPayload>(recommendParams)

	// Map results to UserRecommendation format
	const mappedResults = results
		.map<UserRecommendation>((result) => {
			const payload = result.payload
			const annScore = result.score

			// Convert to match percentage (0-100)
			const matchPercentage = Math.round(Math.min(annScore * 100, 99))

			const title = getStringValue(payload.title, "")
			const posterPath = getStringValue(payload.poster_path, "")
			const backdropPath = getStringValue(payload.backdrop_path, "")
			const essenceTags = Array.isArray(payload.essence_tags) ? payload.essence_tags : []

			return {
				tmdb_id: payload.tmdb_id,
				media_type: payload.media_type,
				title,
				release_year: String(payload.release_year ?? ""),
				poster_path: posterPath,
				backdrop_path: backdropPath,
				essence_tags: essenceTags,
				goodwatch_overall_score_voting_count: payload.goodwatch_overall_score_voting_count ?? 0,
				goodwatch_overall_score_normalized_percent: payload.goodwatch_overall_score_normalized_percent ?? 0,
				ann_score: annScore,
				match_percentage: matchPercentage,
				tmdb_user_score_normalized_percent: payload.tmdb_user_score_normalized_percent ?? 0,
				tmdb_user_score_rating_count: payload.tmdb_user_score_rating_count ?? 0,
				imdb_user_score_normalized_percent: payload.imdb_user_score_normalized_percent ?? 0,
				imdb_user_score_rating_count: payload.imdb_user_score_rating_count ?? 0,
				metacritic_user_score_normalized_percent: payload.metacritic_user_score_normalized_percent ?? 0,
				metacritic_user_score_rating_count: payload.metacritic_user_score_rating_count ?? 0,
				metacritic_meta_score_normalized_percent: payload.metacritic_meta_score_normalized_percent ?? 0,
				metacritic_meta_score_review_count: payload.metacritic_meta_score_review_count ?? 0,
				rotten_tomatoes_audience_score_normalized_percent: payload.rotten_tomatoes_audience_score_normalized_percent ?? 0,
				rotten_tomatoes_audience_score_rating_count: payload.rotten_tomatoes_audience_score_rating_count ?? 0,
				rotten_tomatoes_tomato_score_normalized_percent: payload.rotten_tomatoes_tomato_score_normalized_percent ?? 0,
				rotten_tomatoes_tomato_score_review_count: payload.rotten_tomatoes_tomato_score_review_count ?? 0,
				goodwatch_user_score_normalized_percent: payload.goodwatch_user_score_normalized_percent ?? 0,
				goodwatch_user_score_rating_count: payload.goodwatch_user_score_rating_count ?? 0,
				goodwatch_official_score_normalized_percent: payload.goodwatch_official_score_normalized_percent ?? 0,
				goodwatch_official_score_review_count: payload.goodwatch_official_score_review_count ?? 0,
			}
		})

	// Sort by match percentage and return top results
	return mappedResults
		.sort((a, b) => b.match_percentage - a.match_percentage)
		.slice(0, limit)
}
