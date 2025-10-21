import { cached } from "~/utils/cache"
import { makePointId, retrieve, search } from "~/utils/qdrant"
import { type AllRatings } from "~/utils/ratings"

interface QdrantMediaPayload {
	tmdb_id: number
	media_type: "movie" | "show"
	title?: string | string[]
	original_title?: string | string[]
	poster_path?: string | string[]
	backdrop_path?: string | string[]
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
	context_is_thought_provoking?: boolean
	context_is_pure_escapism?: boolean
	context_is_background_friendly?: boolean
	context_is_comfort_watch?: boolean
	context_is_binge_friendly?: boolean
	context_is_drop_in_friendly?: boolean
	streaming_pairs?: [string, string][]
	streaming_pair_codes?: string[]
}

export interface RelatedMovie extends AllRatings {
	tmdb_id: number
	title: string
	release_year: string
	poster_path: string
	goodwatch_overall_score_voting_count: number
	goodwatch_overall_score_normalized_percent: number
	fingerprint_score: number
	ann_score: number
	score: number
}

export interface RelatedShow extends AllRatings {
	tmdb_id: number
	title: string
	release_year: string
	poster_path: string
	goodwatch_overall_score_voting_count: number
	goodwatch_overall_score_normalized_percent: number
	fingerprint_score: number
	ann_score: number
	score: number
}

export interface RelatedMovieParams {
	tmdb_id: number
	fingerprint_key?: string
	source_media_type: "movie" | "show"
}

export interface RelatedShowParams {
	tmdb_id: number
	fingerprint_key?: string
	source_media_type: "movie" | "show"
}

export const getRelatedMovies = async (params: RelatedMovieParams) => {
	return await cached({
		name: "related-movie",
		target: _getRelatedMovies as any,
		params,
		// ttlMinutes: 60 * 24,
		ttlMinutes: 0,
	}) as unknown as RelatedMovie[]
}

export const getRelatedShows = async (params: RelatedShowParams) => {
	return await cached({
		name: "related-show",
		target: _getRelatedShows as any,
		params,
		// ttlMinutes: 60 * 24,
		ttlMinutes: 0,
	}) as unknown as RelatedShow[]
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

async function getRelatedTitles({
	tmdb_id,
	fingerprint_key,
	source_media_type,
	target_media_type,
}: {
	tmdb_id: number
	fingerprint_key?: string
	source_media_type: "movie" | "show"
	target_media_type: "movie" | "show"
}): Promise<(RelatedMovie | RelatedShow)[]> {
	const collectionName = "media"
	const sourcePointId = makePointId(source_media_type, tmdb_id)
	const withKey = Boolean(fingerprint_key && fingerprint_key.length > 0)

	const [sourcePoint] = await retrieve<QdrantMediaPayload>({
		collectionName,
		ids: [sourcePointId],
		withVector: ["fingerprint_v1"],
	})

	if (!sourcePoint?.vector?.fingerprint_v1) {
		return []
	}

	const sourceFingerprint = Array.isArray(sourcePoint.vector)
		? sourcePoint.vector
		: sourcePoint.vector.fingerprint_v1

	const sourceFingerprintScore = fingerprint_key
		? sourcePoint.payload?.fingerprint_scores_v1?.[fingerprint_key]
		: null

	const mustNotConditions: any[] = []
	if (source_media_type === target_media_type) {
		mustNotConditions.push({
			key: "tmdb_id",
			match: { value: tmdb_id },
		})
	}

	const filterConditions: any = {
		must: [
			{ key: "media_type", match: { value: target_media_type } },
			{
				key: "goodwatch_overall_score_voting_count",
				range: { gte: 10000 },
			},
			{
				key: "goodwatch_overall_score_normalized_percent",
				range: { gte: 60 },
			},
		],
	}

	if (withKey && sourceFingerprintScore) {
		filterConditions.must.push({
			key: `fingerprint_scores_v1.${fingerprint_key}`,
			range: {
				gte: sourceFingerprintScore - 2,
				lte: sourceFingerprintScore + 2,
			},
		})
	}

	if (mustNotConditions.length > 0) {
		filterConditions.must_not = mustNotConditions
	}

	const results = await search<QdrantMediaPayload>({
		collectionName,
		vector: {
			name: "fingerprint_v1",
			vector: sourceFingerprint,
		},
		filter: filterConditions,
		limit: 100,
		withPayload: true,
	})

	const mappedResults = results.map((result: { payload: QdrantMediaPayload; score: number }) => {
		const payload = result.payload
		const annScore = result.score
		const targetFingerprintScore = payload?.fingerprint_scores_v1?.[fingerprint_key ?? ""] ?? 0

		let finalScore = annScore
		
		if (withKey && sourceFingerprintScore !== null && sourceFingerprintScore !== undefined) {
			const distance = Math.abs(targetFingerprintScore - sourceFingerprintScore)
			const maxDistance = 10
			const normalizedDistance = Math.min(distance / maxDistance, 1)
			const fingerprintSimilarity = 1 - normalizedDistance
			
			finalScore = (0.3 * annScore) + (0.7 * fingerprintSimilarity)
		}

		return {
			tmdb_id: payload.tmdb_id,
			title: Array.isArray(payload.title) ? payload.title[0] : payload.title ?? "",
			release_year: String(payload.release_year ?? ""),
			poster_path: Array.isArray(payload.poster_path)
				? payload.poster_path[0]
				: payload.poster_path ?? "",
			goodwatch_overall_score_voting_count:
				payload.goodwatch_overall_score_voting_count ?? 0,
			goodwatch_overall_score_normalized_percent:
				payload.goodwatch_overall_score_normalized_percent ?? 0,
			fingerprint_score: targetFingerprintScore,
			ann_score: annScore,
			score: finalScore,
			...extractRatingsFromPayload(payload),
		}
	})

	return mappedResults
		.sort((a, b) => b.score - a.score)
		.slice(0, 50)
}

async function _getRelatedMovies({
	tmdb_id,
	fingerprint_key,
	source_media_type,
}: RelatedMovieParams): Promise<RelatedMovie[]> {
	return getRelatedTitles({
		tmdb_id,
		fingerprint_key,
		source_media_type,
		target_media_type: "movie",
	}) as Promise<RelatedMovie[]>
}

async function _getRelatedShows({
	tmdb_id,
	fingerprint_key,
	source_media_type,
}: RelatedShowParams): Promise<RelatedShow[]> {
	return getRelatedTitles({
		tmdb_id,
		fingerprint_key,
		source_media_type,
		target_media_type: "show",
	}) as Promise<RelatedShow[]>
}
