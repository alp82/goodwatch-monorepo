import { excludeNotInterested } from "~/server/not-interested-store.server"
import { getFeatureMode, isEnabled } from "~/server/features.server"
import { loadTaste, logRecommendedOverlap } from "~/server/taste/index.server"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"
import { MEDIA_COLLECTION, makePointId, recommend } from "~/utils/qdrant"
import type { AllRatings } from "~/utils/ratings"
import {
	type QdrantMediaPayload,
	getStringValue,
	buildExcludeFilter,
	getUserExcludeItems,
	buildBaseFilterConditions,
	buildPayloadFields,
	searchByTaste,
} from "~/server/utils/recommend"
import { titleKey } from "~/utils/title-key"


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
const MIN_VOTING_COUNT = 50000
const MIN_SCORE = 60
export const getUserRecommendations = async (params: GetUserRecommendationsParams) => {
	const titles = await cached({
		name: `${MEDIA_COLLECTION}:user-recommendations`,
		target: _getUserRecommendations as any,
		params,
		ttlMinutes: 1,
		staleMinutes: 0,
		//ttlMinutes: 0,
	}) as unknown as UserRecommendation[]
	return excludeNotInterested(params.userId, titles)
}

async function _getUserRecommendations({
	userId,
	mediaType = "all",
	limit = 20,
}: GetUserRecommendationsParams): Promise<UserRecommendation[]> {
	console.log('[User Recommendations] userId:', userId, 'mediaType:', mediaType, 'limit:', limit)

	// With taste match on, one vector query with the stored taste vector. A member below the minimum signal (or any
	// member before the title snapshot has loaded) has no vector and keeps the recommend call.
	if (isEnabled("tasteMatch", { userId })) {
		const [taste, excluded] = await Promise.all([
			loadTaste({ kind: "member", userId }),
			getUserExcludeItems(userId),
		])
		if (taste.vector) {
			const results = await searchByTaste<QdrantMediaPayload>({
				taste,
				filter: recommendationFilter(mediaType, excluded),
				limit,
				payloadFields: PAYLOAD_FIELDS,
			})
			// Best match first; a title not in the title snapshot yet shows no match (0 hides the pill).
			return results.map((result) =>
				toUserRecommendation(result.payload, result.score, result.match ?? 0),
			)
		}
	}
	return recommendFromExamples({ userId, mediaType, limit })
}

const PAYLOAD_FIELDS = buildPayloadFields({
	includeRatings: true,
	additionalFields: ["essence_tags", "genres"],
})

/** At least MIN_VOTING_COUNT votes and MIN_SCORE, a poster and a backdrop, none of the person's excluded titles. */
function recommendationFilter(
	mediaType: "movie" | "show" | "all",
	excluded: { media_type: string; tmdb_id: number }[],
) {
	return buildBaseFilterConditions({
		mediaType,
		minVotingCount: MIN_VOTING_COUNT,
		minScore: MIN_SCORE,
		additionalMustNot: buildExcludeFilter(excluded),
	})
}

// Qdrant's recommend API over the newest 50 liked and 50 disliked titles: a points read plus a recommend call.
// Serves while REC_TASTE_MATCH is off or shadow, and for members without a taste vector.
async function recommendFromExamples({
	userId,
	mediaType,
	limit,
}: Required<GetUserRecommendationsParams>): Promise<UserRecommendation[]> {
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

	const filterConditions = recommendationFilter(mediaType, allExcluded)

	// Call Qdrant recommend
	const recommendParams: any = {
		collectionName: MEDIA_COLLECTION,
		using: "fingerprint_v1",
		strategy: "average_vector",
		positive: positivePoints,
		negative: negativePoints,
		filter: filterConditions,
		limit,
		withPayload: { include: PAYLOAD_FIELDS },
		hnswEf: 128,
		exact: false,
	}

	if (negativePoints.length > 0) {
		recommendParams.negative = negativePoints
	}

	const results = await recommend<QdrantMediaPayload>(recommendParams)

	// Compares the stored taste vector with this list and logs it, off the request path; the page doesn't change.
	if (getFeatureMode("tasteMatch") === "shadow")
		void logRecommendedOverlap({
			userId,
			mediaType,
			minVotes: MIN_VOTING_COUNT,
			minScore: MIN_SCORE,
			excluded: allExcluded,
			recommended: results.map((result) =>
				titleKey(result.payload.media_type, result.payload.tmdb_id),
			),
		})

	// The recommend path shows the raw cosine as the match, capped at 99
	const mappedResults = results.map((result) =>
		toUserRecommendation(
			result.payload,
			result.score,
			Math.round(Math.min(result.score * 100, 99)),
		),
	)

	// Sort by match percentage and return top results
	return mappedResults
		.sort((a, b) => b.match_percentage - a.match_percentage)
		.slice(0, limit)
}

function toUserRecommendation(
	payload: QdrantMediaPayload,
	annScore: number,
	matchPercentage: number,
): UserRecommendation {
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
}
