import { cached } from "~/utils/cache"
import { makePointId, recommend } from "~/utils/qdrant"
import { type AllRatings } from "~/utils/ratings"
import type { CoreScores } from "~/server/utils/fingerprint"
import { getStreamingProviders } from "~/server/streaming-providers.server"
import type { StreamingProvider } from "~/routes/api.streaming-providers"

const STREAMING_PROVIDERS_WHITELIST: number[] = [
	2,    // Apple TV
	8,    // Netflix
	9,    // Amazon Prime
	15,   // Hulu
	192,  // YouTube
	283,  // Crunchyroll
	337,  // Disney+
	386,  // Peacock Premium
	531,  // Paramount+
	1899, // HBO Max
] as const

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
	streaming_availability?: string[]
}

export interface RelatedMovie extends AllRatings {
	tmdb_id: number
	title: string
	release_year: string
	poster_path: string
	backdrop_path: string
	goodwatch_overall_score_voting_count: number
	goodwatch_overall_score_normalized_percent: number
	fingerprint_score: number
	ann_score: number
	score: number
	streaming_availability?: string[]
}

export interface RelatedShow extends AllRatings {
	tmdb_id: number
	title: string
	release_year: string
	poster_path: string
	backdrop_path: string
	goodwatch_overall_score_voting_count: number
	goodwatch_overall_score_normalized_percent: number
	fingerprint_score: number
	ann_score: number
	score: number
	streaming_availability?: string[]
}

export interface RelatedMovieParams {
	tmdb_id: number
	fingerprint_key?: string
	source_fingerprint_score?: number
	source_media_type: "movie" | "show"
	streaming_combinations?: string[]
}

export interface RelatedShowParams {
	tmdb_id: number
	fingerprint_key?: string
	source_fingerprint_score?: number
	source_media_type: "movie" | "show"
	streaming_combinations?: string[]
}

export const getRelatedMovies = async (params: RelatedMovieParams) => {
	// Create cache key that includes streaming combinations to prevent stale data
	const cacheKey = `related-movie-${params.tmdb_id}-${params.fingerprint_key || 'all'}-${params.source_media_type}-${params.streaming_combinations?.join(',') || 'none'}`
	
	return await cached({
		name: cacheKey,
		target: _getRelatedMovies as any,
		params,
		//ttlMinutes: 60 * 24,
		ttlMinutes: 0,
	}) as unknown as RelatedMovie[]
}

export const getRelatedShows = async (params: RelatedShowParams) => {
	// Create cache key that includes streaming combinations to prevent stale data
	const cacheKey = `related-show-${params.tmdb_id}-${params.fingerprint_key || 'all'}-${params.source_media_type}-${params.streaming_combinations?.join(',') || 'none'}`
	
	return await cached({
		name: cacheKey,
		target: _getRelatedShows as any,
		params,
		//ttlMinutes: 60 * 24,
		ttlMinutes: 0,
	}) as unknown as RelatedShow[]
}

const extractRatingsFromPayload = (payload: QdrantMediaPayload): AllRatings => {
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
	source_fingerprint_score,
	source_media_type,
	target_media_type,
	streaming_combinations,
}: {
	tmdb_id: number
	fingerprint_key?: string
	source_fingerprint_score?: number
	source_media_type: "movie" | "show"
	target_media_type: "movie" | "show"
	streaming_combinations?: string[]
}): Promise<(RelatedMovie | RelatedShow)[]> {
	const collectionName = "media"
	const sourcePointId = makePointId(source_media_type, tmdb_id)
	const withKey = Boolean(fingerprint_key && fingerprint_key.length > 0)

	const sourceFingerprintScore = source_fingerprint_score ?? null

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
		must_not: [
			{
				key: "poster_path",
				match: { value: null },
			},
			{
				key: "backdrop_path",
				match: { value: null },
			},
		],
	}

	if (source_media_type === target_media_type) {
		filterConditions.must_not.push({
			key: "tmdb_id",
			match: { value: tmdb_id },
		})
	}


	if (withKey && sourceFingerprintScore !== null) {
		filterConditions.must.push({
			key: `fingerprint_scores_v1.${fingerprint_key}`,
			range: {
				gte: sourceFingerprintScore - 1,
				lte: sourceFingerprintScore + 1,
			},
		})
	}

	// Add streaming combinations filter if provided
	if (streaming_combinations && streaming_combinations.length > 0) {
		// Create should clause with multiple match conditions for each combination
		const streamingShouldConditions = streaming_combinations.map(combination => ({
			key: "streaming_availability",
			match: { value: combination }
		}))
		
		filterConditions.must.push({
			should: streamingShouldConditions,
			minimum_should: 1 // At least one streaming combination must match
		})
	}

	const payloadFields = [
		"tmdb_id",
		"title",
		"release_year",
		"poster_path",
		"backdrop_path",
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
		"streaming_availability",
	]

	if (withKey && fingerprint_key) {
		payloadFields.push(`fingerprint_scores_v1.${fingerprint_key}`)
	}

	const results = await recommend<QdrantMediaPayload>({
		collectionName,
		positive: [sourcePointId],
		using: "fingerprint_v1",
		filter: filterConditions,
		limit: 100,
		withPayload: { include: payloadFields },
		hnswEf: 64,
		exact: false,
	})

	const mappedResults = results
		.filter(result => result.payload.poster_path)
		.map((result) => {
			const payload = result.payload
			const annScore = result.score
			const targetFingerprintScore = payload?.fingerprint_scores_v1?.[fingerprint_key ?? ""] ?? 0
			
			let finalScore = annScore
			if (withKey && sourceFingerprintScore !== null) {
				const distance = Math.abs(targetFingerprintScore - sourceFingerprintScore)
				const maxDistance = 10
				const normalizedDistance = Math.min(distance / maxDistance, 1)
				const fingerprintSimilarity = 1 - normalizedDistance
				finalScore = (0.2 * annScore) + (0.8 * fingerprintSimilarity)
			}

			return {
				tmdb_id: payload.tmdb_id,
				title: Array.isArray(payload.title) ? payload.title[0] : (payload.title ?? ""),
				release_year: String(payload.release_year ?? ""),
				poster_path: Array.isArray(payload.poster_path) ? payload.poster_path[0] : (payload.poster_path ?? ""),
				backdrop_path: Array.isArray(payload.backdrop_path) ? payload.backdrop_path[0] : (payload.backdrop_path ?? ""),
				fingerprint_score: targetFingerprintScore,
				ann_score: annScore,
				score: finalScore,
				streaming_availability: payload.streaming_availability,
				...extractRatingsFromPayload(payload),
			}
		})

	return mappedResults
		.sort((a, b) => b.score - a.score)
		.slice(0, 32)
}

async function _getRelatedMovies({
	tmdb_id,
	fingerprint_key,
	source_fingerprint_score,
	source_media_type,
	streaming_combinations,
}: RelatedMovieParams): Promise<RelatedMovie[]> {
	return getRelatedTitles({
		tmdb_id,
		fingerprint_key,
		source_fingerprint_score,
		source_media_type,
		target_media_type: "movie",
		streaming_combinations,
	}) as Promise<RelatedMovie[]>
}

async function _getRelatedShows({
	tmdb_id,
	fingerprint_key,
	source_fingerprint_score,
	source_media_type,
	streaming_combinations,
}: RelatedShowParams): Promise<RelatedShow[]> {
	return getRelatedTitles({
		tmdb_id,
		fingerprint_key,
		source_fingerprint_score,
		source_media_type,
		target_media_type: "show",
		streaming_combinations,
	}) as Promise<RelatedShow[]>
}

// --- Related by Category ---

export interface StreamingAvailability {
	id: number
	name: string
	logo: string
}

export interface RelatedTitle {
	title: string
	release_year: string
	link: string
	poster_path: string
	backdrop_path: string
	goodwatch_score: number
	streaming_availability: Record<string, StreamingAvailability[]>
}

export interface CategoryRelated {
	movies: RelatedTitle[]
	shows: RelatedTitle[]
}

export type RelatedByCategory = Record<string, CategoryRelated>

export interface RelatedByCategoryParams {
	tmdb_id: number
	media_type: "movie" | "show"
	highlight_keys: string[]
	fingerprint_scores: CoreScores
	countries: string[]
	streaming_ids?: number[]
}

export const getRelatedByCategory = async (params: RelatedByCategoryParams) => {
	// Create a cache key that includes countries and streaming_ids for proper invalidation
	const cacheKey = `related-by-category-${params.countries.join(',')}-${params.streaming_ids?.join(',') || 'all'}`
	
	return await cached({
		name: cacheKey,
		target: _getRelatedByCategory as any,
		params,
		//ttlMinutes: 60 * 24,
		ttlMinutes: 0,
	}) as unknown as RelatedByCategory
}

async function _getRelatedByCategory({
	tmdb_id,
	media_type,
	highlight_keys,
	fingerprint_scores,
	countries,
	streaming_ids,
}: RelatedByCategoryParams): Promise<RelatedByCategory> {
	const categories = ["overall", ...highlight_keys]
	const result: RelatedByCategory = {}

	// Fetch streaming providers once
	const streamingProviders = await getStreamingProviders({ country: "US" })
	const providerMap = new Map<number, StreamingProvider>(
		streamingProviders.map(provider => [provider.id, provider])
	)

	// Determine streaming IDs to use
	let targetStreamingIds: number[]
	if (streaming_ids && streaming_ids.length > 0) {
		targetStreamingIds = streaming_ids
	} else {
		// Get top 10 providers for each country based on order_by_country
		const countryProviderScores = new Map<number, number>()
		
		streamingProviders.forEach(provider => {
			let totalScore = 0
			let hasValidCountry = false
			
			countries.forEach(country => {
				const countryOrder = provider.order_by_country?.[country] ?? provider.order_default
				if (countryOrder !== undefined && countryOrder < 50) { // Reasonable limit
					totalScore += countryOrder
					hasValidCountry = true
				}
			})
			
			if (hasValidCountry) {
				countryProviderScores.set(provider.id, totalScore)
			}
		})

		// Sort by total score (lower is better) and take top 10
		targetStreamingIds = Array.from(countryProviderScores.entries())
			.sort(([, scoreA], [, scoreB]) => scoreA - scoreB)
			.slice(0, 10)
			.map(([providerId]) => providerId)

    // Edge case: if no providers found for requested countries, fallback to using all providers
    if (targetStreamingIds.length === 0) {
        // Use all provider IDs as fallback to ensure availability
        targetStreamingIds = streamingProviders.map(p => p.id);
    }
	}

	// Build exact streaming combinations for filtering
	const targetCombinations = new Set<string>()
	targetStreamingIds.forEach(providerId => {
		countries.forEach(country => {
			targetCombinations.add(`${providerId}_${country}`)
		})
	})

	// Helper function to parse streaming availability by country
	const parseStreamingAvailabilityByCountry = (
		streamingAvailability: string[] | undefined
	): Record<string, StreamingAvailability[]> => {
		if (!streamingAvailability?.length) return {}

		const result: Record<string, StreamingAvailability[]> = {}
		
		// Initialize empty arrays for all requested countries
		countries.forEach(country => {
			result[country] = []
		})

		streamingAvailability.forEach(code => {
			// Handle malformed codes gracefully
			if (typeof code !== 'string' || !code.includes('_')) return
			
			const [providerIdStr, country] = code.split('_', 2)
			if (!providerIdStr || !country) return
			
			const providerId = parseInt(providerIdStr)
			if (isNaN(providerId) || providerId <= 0) return
			
			// Only process if this is one of our target countries and streaming IDs
			if (!countries.includes(country) || !targetStreamingIds.includes(providerId)) return

			const provider = providerMap.get(providerId)
			if (!provider) return

			if (!result[country]) {
				result[country] = []
			}

			// Check if provider already added to this country
			const alreadyAdded = result[country].some(p => p.id === providerId)
			if (!alreadyAdded) {
				result[country].push({
					id: providerId,
					name: provider.name,
					logo: `https://image.tmdb.org/t/p/original${provider.logo_path}`,
				})
			}
		})

		// Sort providers by name within each country
		countries.forEach(country => {
			result[country].sort((a, b) => a.name.localeCompare(b.name))
		})

		return result
	}

	// Helper function to create title slug
	const createSlug = (title: string): string => {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
			.trim()
	}

	await Promise.all(
		categories.map(async (category) => {
			const fingerprintKey = category === "overall" ? undefined : category
			const sourceFingerprintScore = fingerprintKey
				? fingerprint_scores[fingerprintKey as keyof CoreScores]
				: undefined

			const [movies, shows] = await Promise.all([
				getRelatedMovies({
					tmdb_id,
					fingerprint_key: fingerprintKey,
					source_fingerprint_score: sourceFingerprintScore,
					source_media_type: media_type,
					streaming_combinations: Array.from(targetCombinations),
				}),
				getRelatedShows({
					tmdb_id,
					fingerprint_key: fingerprintKey,
					source_fingerprint_score: sourceFingerprintScore,
					source_media_type: media_type,
					streaming_combinations: Array.from(targetCombinations),
				}),
			])

			result[category] = {
				movies: movies.slice(0, 10).map((m) => {
					const title = Array.isArray(m.title) ? m.title[0] : m.title
					const slug = createSlug(title)
					return {
						title,
						release_year: m.release_year,
						link: `https://goodwatch.app/movie/${m.tmdb_id}-${slug}`,
						poster_path: `https://image.tmdb.org/t/p/w300_and_h450_bestv2${m.poster_path}`,
						backdrop_path: m.backdrop_path ? `https://image.tmdb.org/t/p/w1920_and_h800_multi_faces${m.backdrop_path}` : "",
						goodwatch_score: Math.ceil(m.goodwatch_overall_score_normalized_percent),
						streaming_availability: parseStreamingAvailabilityByCountry(m.streaming_availability),
					}
				}),
				shows: shows.slice(0, 10).map((s) => {
					const title = Array.isArray(s.title) ? s.title[0] : s.title
					const slug = createSlug(title)
					return {
						title,
						release_year: s.release_year,
						link: `https://goodwatch.app/show/${s.tmdb_id}-${slug}`,
						poster_path: `https://image.tmdb.org/t/p/w300_and_h450_bestv2${s.poster_path}`,
						backdrop_path: s.backdrop_path ? `https://image.tmdb.org/t/p/w1920_and_h800_multi_faces${s.backdrop_path}` : "",
						goodwatch_score: Math.ceil(s.goodwatch_overall_score_normalized_percent),
						streaming_availability: parseStreamingAvailabilityByCountry(s.streaming_availability),
					}
				}),
			}
		}),
	)

	return result
}
