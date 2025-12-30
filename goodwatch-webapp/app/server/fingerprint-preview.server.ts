import { query as crateQuery } from "~/utils/crate"
import { makePointId, recommend } from "~/utils/qdrant"
import { DISTINCT_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import {
	type QdrantMediaPayload,
	getStringValue,
	buildExcludeFilter,
	getUserExcludeItems,
	getUserLikedItems,
	getUserScoredItems,
	buildBaseFilterConditions,
	buildPayloadFields,
} from "~/server/utils/recommend"
import { Recommendation } from "~/ui/taste/types"

interface LikedItem {
	tmdb_id: number
	media_type: "movie" | "show"
}

export interface FingerprintKeyResult {
	key: string
	sum: number
}


export interface FingerprintPreviewResult {
	topKeys: FingerprintKeyResult[]
	recommendations: Record<string, Recommendation[]>
}


export async function getTopFingerprintKeys({
	likedItems,
	topN = 4,
}: {
	likedItems: LikedItem[]
	topN?: number
}): Promise<FingerprintKeyResult[]> {
	if (likedItems.length === 0) {
		return []
	}

	const movieIds = likedItems.filter(i => i.media_type === "movie").map(i => i.tmdb_id)
	const showIds = likedItems.filter(i => i.media_type === "show").map(i => i.tmdb_id)

	const sumColumns = DISTINCT_FINGERPRINT_KEYS.map(key => 
		`SUM(fingerprint_scores['${key}']) as "${key}"`
	).join(", ")

	const results: Record<string, number> = {}
	DISTINCT_FINGERPRINT_KEYS.forEach(key => { results[key] = 0 })

	if (movieIds.length > 0) {
		const moviePlaceholders = movieIds.map(() => "?").join(", ")
		const movieSql = `
			SELECT ${sumColumns}
			FROM movie
			WHERE tmdb_id IN (${moviePlaceholders})
		`
		const movieResult = await crateQuery<Record<string, number>>(movieSql, movieIds)
		if (movieResult.length > 0) {
			DISTINCT_FINGERPRINT_KEYS.forEach(key => {
				results[key] += movieResult[0][key] ?? 0
			})
		}
	}

	if (showIds.length > 0) {
		const showPlaceholders = showIds.map(() => "?").join(", ")
		const showSql = `
			SELECT ${sumColumns}
			FROM show
			WHERE tmdb_id IN (${showPlaceholders})
		`
		const showResult = await crateQuery<Record<string, number>>(showSql, showIds)
		if (showResult.length > 0) {
			DISTINCT_FINGERPRINT_KEYS.forEach(key => {
				results[key] += showResult[0][key] ?? 0
			})
		}
	}

	const sortedKeys = Object.entries(results)
		.filter(([_, sum]) => sum > 0)
		.sort(([, a], [, b]) => b - a)
		.slice(0, topN)
		.map(([key, sum]) => ({
			key,
			sum,
		}))

	return sortedKeys
}

export async function getFingerprintRecommendations({
	fingerprintKey,
	likedItems,
	scoredItems = [],
	excludeIds = [],
	limit = 8,
}: {
	fingerprintKey: string
	likedItems: LikedItem[]
	scoredItems?: LikedItem[]
	excludeIds?: LikedItem[]
	limit?: number
}): Promise<Recommendation[]> {
	if (likedItems.length === 0) {
		return []
	}

	const collectionName = "media"

	const positivePoints = likedItems.map(item =>
		makePointId(item.media_type, item.tmdb_id)
	)

	// Combine all items to exclude: all scored items + additional excludeIds
	const allExcludeIds = [
		...scoredItems.map(i => i.tmdb_id),
		...excludeIds.map(i => i.tmdb_id),
	]
	const uniqueExcludeIds = [...new Set(allExcludeIds)]
	
	// Build filter conditions using shared utility
	const { must, must_not } = buildBaseFilterConditions({
		mediaType: "all",
		minVotingCount: 50000,
		minScore: 65,
		fingerprintKey,
		additionalMustNot: [
			...buildExcludeFilter(uniqueExcludeIds),
		],
	})
	
	const filterConditions = { must, must_not }

	// Build payload fields using shared utility
	const payloadFields = buildPayloadFields({
		includeRatings: false,
		includeFingerprintKey: fingerprintKey,
	})

	const results = await recommend<QdrantMediaPayload>({
		collectionName,
		positive: positivePoints,
		using: "fingerprint_v1",
		filter: filterConditions,
		limit: limit * 2,
		withPayload: { include: payloadFields },
		hnswEf: 64,
		exact: false,
	})

	const mappedResults = results
		.filter(result => result.payload.poster_path)
		.map(result => {
			const payload = result.payload
			const annScore = result.score
			const fingerprintScore = payload.fingerprint_scores_v1?.[fingerprintKey] ?? 0

			const combinedScore = (0.4 * annScore) + (0.6 * (fingerprintScore / 10))
			const matchPercentage = Math.round(Math.min(combinedScore * 100, 99))

			return {
				tmdb_id: payload.tmdb_id,
				media_type: payload.media_type,
				title: getStringValue(payload.title),
				release_year: String(payload.release_year ?? ""),
				poster_path: getStringValue(payload.poster_path),
				backdrop_path: getStringValue(payload.backdrop_path),
				goodwatch_overall_score_normalized_percent: payload.goodwatch_overall_score_normalized_percent ?? 0,
				fingerprint_score: fingerprintScore,
				matchPercentage,
			}
		})


	return mappedResults
		.sort((a, b) => b.matchPercentage - a.matchPercentage)
		.slice(0, limit)
}

export async function getFingerprintPreview({
	likedItems,
	scoredItems = [],
	excludeIds = [],
	topN = 4,
	recsPerKey = 8,
}: {
	likedItems: LikedItem[]
	scoredItems?: LikedItem[]
	excludeIds?: LikedItem[]
	topN?: number
	recsPerKey?: number
}): Promise<FingerprintPreviewResult> {
	const topKeys = await getTopFingerprintKeys({ likedItems, topN })

	if (topKeys.length === 0) {
		return { topKeys: [], recommendations: {} }
	}

	const recommendations: Record<string, Recommendation[]> = {}

	await Promise.all(
		topKeys.map(async ({ key }) => {
			const recs = await getFingerprintRecommendations({
				fingerprintKey: key,
				likedItems,
				scoredItems,
				excludeIds,
				limit: recsPerKey,
			})
			recommendations[key] = recs
		})
	)

	return { topKeys, recommendations }
}

// New function for authenticated users - fetches their liked items and exclude items from DB
export async function getFingerprintPreviewForUser({
	userId,
	topN = 4,
	recsPerKey = 9,
}: {
	userId: string
	topN?: number
	recsPerKey?: number
}): Promise<FingerprintPreviewResult> {
	// Fetch user's liked items (scores 6+) - only those with essence_tags (exist in Qdrant)
	const likedItems = await getUserLikedItems(userId, 6)

	if (likedItems.length === 0) {
		return { topKeys: [], recommendations: {} }
	}

	// Fetch all scored items (any score) - only those with essence_tags
	const scoredItems = await getUserScoredItems(userId)

	// Fetch user's exclude items (skipped, watched, wishlist) - already filtered for essence_tags
	const excludeItems = await getUserExcludeItems(userId)
	
	// Convert to LikedItem format with proper typing
	const excludeIds: LikedItem[] = excludeItems.map(item => ({
		tmdb_id: item.tmdb_id,
		media_type: item.media_type as "movie" | "show",
	}))

	// Get fingerprint preview with all scored items excluded
	return getFingerprintPreview({
		likedItems,
		scoredItems,
		excludeIds,
		topN,
		recsPerKey,
	})
}
