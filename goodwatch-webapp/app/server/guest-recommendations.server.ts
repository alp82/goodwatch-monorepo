import { cached } from "~/utils/cache"
import { makePointId, recommend } from "~/utils/qdrant"
import { type AllRatings } from "~/utils/ratings"

interface QdrantMediaPayload {
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
	tmdb_user_score_normalized_percent?: number
	imdb_user_score_normalized_percent?: number
	metacritic_user_score_normalized_percent?: number
	metacritic_meta_score_normalized_percent?: number
	rotten_tomatoes_audience_score_normalized_percent?: number
	rotten_tomatoes_tomato_score_normalized_percent?: number
	goodwatch_user_score_normalized_percent?: number
	goodwatch_official_score_normalized_percent?: number
	goodwatch_overall_score_normalized_percent?: number
	tmdb_user_score_rating_count?: number
	imdb_user_score_rating_count?: number
	metacritic_user_score_rating_count?: number
	metacritic_meta_score_review_count?: number
	rotten_tomatoes_audience_score_rating_count?: number
	rotten_tomatoes_tomato_score_review_count?: number
	goodwatch_user_score_rating_count?: number
	goodwatch_official_score_review_count?: number
	goodwatch_overall_score_voting_count?: number
	fingerprint_scores_v1?: Record<string, number>
}

export interface GuestRecommendation extends AllRatings {
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
	genre_score: number
	match_percentage: number
}

export interface ScoredItem {
	tmdb_id: number
	media_type: "movie" | "show"
	score: number
}

export interface ExcludeItem {
	tmdb_id: number
	media_type: "movie" | "show"
}

export interface GuestMovieRecommendationsParams {
	scored_items: ScoredItem[]
	exclude_ids?: ExcludeItem[]
	limit?: number
}

export interface GuestShowRecommendationsParams {
	scored_items: ScoredItem[]
	exclude_ids?: ExcludeItem[]
	limit?: number
}

export const getGuestMovieRecommendations = async (params: GuestMovieRecommendationsParams) => {
	return await cached({
		name: "guest-recommendations-movie",
		target: _getGuestMovieRecommendations as any,
		params,
		//ttlMinutes: 5,
		ttlMinutes: 0,
	}) as unknown as GuestRecommendation[]
}

export const getGuestShowRecommendations = async (params: GuestShowRecommendationsParams) => {
	return await cached({
		name: "guest-recommendations-show",
		target: _getGuestShowRecommendations as any,
		params,
		//ttlMinutes: 5,
		ttlMinutes: 0,
	}) as unknown as GuestRecommendation[]
}

const extractRatingsFromPayload = (payload: QdrantMediaPayload): Partial<AllRatings> => {
	return {
		tmdb_url: "",
		tmdb_user_score_original: 0,
		tmdb_user_score_normalized_percent: payload.tmdb_user_score_normalized_percent ?? 0,
		tmdb_user_score_rating_count: payload.tmdb_user_score_rating_count ?? 0,
		imdb_url: "",
		imdb_user_score_original: 0,
		imdb_user_score_normalized_percent: payload.imdb_user_score_normalized_percent ?? 0,
		imdb_user_score_rating_count: payload.imdb_user_score_rating_count ?? 0,
		metacritic_url: "",
		metacritic_user_score_original: 0,
		metacritic_user_score_normalized_percent: payload.metacritic_user_score_normalized_percent ?? 0,
		metacritic_user_score_rating_count: payload.metacritic_user_score_rating_count ?? 0,
		metacritic_meta_score_original: 0,
		metacritic_meta_score_normalized_percent: payload.metacritic_meta_score_normalized_percent ?? 0,
		metacritic_meta_score_review_count: payload.metacritic_meta_score_review_count ?? 0,
		rotten_tomatoes_url: "",
		rotten_tomatoes_audience_score_original: 0,
		rotten_tomatoes_audience_score_normalized_percent: payload.rotten_tomatoes_audience_score_normalized_percent ?? 0,
		rotten_tomatoes_audience_score_rating_count: payload.rotten_tomatoes_audience_score_rating_count ?? 0,
		rotten_tomatoes_tomato_score_original: 0,
		rotten_tomatoes_tomato_score_normalized_percent: payload.rotten_tomatoes_tomato_score_normalized_percent ?? 0,
		rotten_tomatoes_tomato_score_review_count: payload.rotten_tomatoes_tomato_score_review_count ?? 0,
		goodwatch_user_score_normalized_percent: payload.goodwatch_user_score_normalized_percent ?? 0,
		goodwatch_user_score_rating_count: payload.goodwatch_user_score_rating_count ?? 0,
		goodwatch_official_score_normalized_percent: payload.goodwatch_official_score_normalized_percent ?? 0,
		goodwatch_official_score_review_count: payload.goodwatch_official_score_review_count ?? 0,
		goodwatch_overall_score_normalized_percent: payload.goodwatch_overall_score_normalized_percent ?? 0,
		goodwatch_overall_score_voting_count: payload.goodwatch_overall_score_voting_count ?? 0,
	}
}

async function getGuestRecommendations({
	scored_items,
	exclude_ids = [],
	target_media_type,
	limit = 20,
}: {
	scored_items: ScoredItem[]
	exclude_ids?: ExcludeItem[]
	target_media_type: "movie" | "show"
	limit?: number
}): Promise<GuestRecommendation[]> {
	console.log('[Guest Recommendations] target_media_type:', target_media_type, 'scored_items:', scored_items.length)

	if (scored_items.length === 0) {
		return []
	}

	const collectionName = "media"

	// Use relative scoring: top half as positive, bottom half as negative
	// This allows recommendations to work with any ratings, not just scores >= 6
	const sorted = [...scored_items].sort((a, b) => b.score - a.score)
	const midpoint = Math.ceil(sorted.length / 2)
	const positiveItems = sorted.slice(0, midpoint)
	const negativeItems = sorted.length > 1 ? sorted.slice(midpoint) : []

	// Create point IDs for Qdrant
	const positivePoints = positiveItems.map(item => 
		makePointId(item.media_type as "movie" | "show", item.tmdb_id)
	)
	const negativePoints = negativeItems.map(item => 
		makePointId(item.media_type as "movie" | "show", item.tmdb_id)
	)

	// Get IDs to exclude (already rated + explicitly excluded skips/plan-to-watch)
	const scoredIds = scored_items.map(item => item.tmdb_id)
	const additionalExcludeIds = exclude_ids
		.filter(item => item.media_type === target_media_type)
		.map(item => item.tmdb_id)
	const excludeIds = [...new Set([...scoredIds, ...additionalExcludeIds])]

	// Extract preferred genres from highly rated items
	const preferredGenres = new Set<string>()
	// We'll calculate this from the results since we don't have genre data here

	const filterConditions = {
		must: [
			{ key: "media_type", match: { value: target_media_type } },
			{
				key: "goodwatch_overall_score_voting_count",
				range: { gte: 100000 },
			},
			{
				key: "goodwatch_overall_score_normalized_percent",
				range: { gte: 70 },
			},
		],
		must_not: [
			{
				key: "poster_path",
				match: { value: null },
			},
			{
				key: "backdrop_path",
				match: { value: null },
			},
			...excludeIds.map(id => ({
				key: "tmdb_id",
				match: { value: id },
			})),
		],
	}

	const payloadFields = [
		"tmdb_id",
		"title",
		"release_year",
		"poster_path",
		"backdrop_path",
		"essence_tags",
		"genres",
		"goodwatch_overall_score_voting_count",
		"goodwatch_overall_score_normalized_percent",
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
		"goodwatch_official_score_review_count",
	]

	// Use Qdrant's recommend API with positive and negative examples
	const recommendParams: any = {
		collectionName,
		using: "fingerprint_v1",
		filter: filterConditions,
		limit: limit * 2,
		withPayload: { include: payloadFields },
		hnswEf: 128,
		exact: false,
	}

	if (positivePoints.length > 0) {
		recommendParams.positive = positivePoints
	}
	if (negativePoints.length > 0) {
		recommendParams.negative = negativePoints
	}

	const results = await recommend<QdrantMediaPayload>(recommendParams)

	// Build genre preference map from positive items
	const genrePreferences = new Map<string, number>()
	positiveItems.forEach(item => {
		// We'll need to look up genres from the results
		// For now, we'll calculate genre scores from the recommendation results
	})

	const mappedResults = results
		.filter(result => result.payload.poster_path)
		.map((result) => {
			const payload = result.payload
			const annScore = result.score

			// Calculate genre overlap score
			let genreScore = 0
			if (payload.genres && payload.genres.length > 0) {
				// Simple genre scoring - can be enhanced
				genreScore = 0.5 // Placeholder, will be calculated properly
			}

			// Combine scores: 60% ANN similarity, 40% genre match
			const combinedScore = (0.9 * annScore) + (0.1 * genreScore)
			
			// Convert to match percentage (0-100)
			const matchPercentage = Math.round(Math.min(combinedScore * 100, 99))

			const title = Array.isArray(payload.title) ? payload.title[0] : payload.title
			const posterPath = Array.isArray(payload.poster_path) ? payload.poster_path[0] : payload.poster_path
			const backdropPath = Array.isArray(payload.backdrop_path) ? payload.backdrop_path[0] : payload.backdrop_path
			const essenceTags = Array.isArray(payload.essence_tags) ? payload.essence_tags : []

			return {
				tmdb_id: payload.tmdb_id,
				media_type: target_media_type,
				title: title ?? "",
				release_year: String(payload.release_year ?? ""),
				poster_path: posterPath ?? "",
				backdrop_path: backdropPath ?? "",
				essence_tags: essenceTags,
				goodwatch_overall_score_voting_count:
					payload.goodwatch_overall_score_voting_count ?? 0,
				goodwatch_overall_score_normalized_percent:
					payload.goodwatch_overall_score_normalized_percent ?? 0,
				ann_score: annScore,
				genre_score: genreScore,
				match_percentage: matchPercentage,
				...extractRatingsFromPayload(payload),
			} as GuestRecommendation
		})

	// Sort by combined score and return top results
	return mappedResults
		.sort((a, b) => b.match_percentage - a.match_percentage)
		.slice(0, limit)
}

async function _getGuestMovieRecommendations({
	scored_items,
	exclude_ids = [],
	limit = 20,
}: GuestMovieRecommendationsParams): Promise<GuestRecommendation[]> {
	return getGuestRecommendations({
		scored_items,
		exclude_ids,
		target_media_type: "movie",
		limit,
	})
}

async function _getGuestShowRecommendations({
	scored_items,
	exclude_ids = [],
	limit = 20,
}: GuestShowRecommendationsParams): Promise<GuestRecommendation[]> {
	return getGuestRecommendations({
		scored_items,
		exclude_ids,
		target_media_type: "show",
		limit,
	})
}
