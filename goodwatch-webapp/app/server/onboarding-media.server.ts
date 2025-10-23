import { queryKeyOnboardingMedia } from "~/routes/api.onboarding.media"
import { type PrefetchParams, prefetchQuery } from "~/server/utils/prefetch"
import { cached, resetCache } from "~/utils/cache"
import { query } from "~/utils/crate"
import { type AllRatings, getRatingKeys } from "~/utils/ratings"

const LIMIT_PER_MEDIA_TYPE = 1
const LIMIT_PER_SEARCH = 6

export interface OnboardingMedia extends AllRatings {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	release_year: string
	popularity: number
	poster_path: string
	backdrop_path: string
	genres: string[]
	decade: number
}

export interface OnboardingMovie extends OnboardingMedia {}

export interface OnboardingShow extends OnboardingMedia {}

export type OnboardingResult = OnboardingMovie | OnboardingShow

export type OnboardingMediaResult = {
	movies: OnboardingMovie[]
	shows: OnboardingShow[]
}

export interface OnboardingMediaParams {
	userId: string
	searchTerm: string
}

export const getOnboardingMedia = async (params: OnboardingMediaParams) => {
	return await cached<OnboardingMediaParams, OnboardingMediaResult>({
		name: "onboarding-media",
		target: _getOnboardingMedia,
		params,
		// TTL can't be set here because every user action affects the results
		ttlMinutes: 0,
	})
}

async function _getOnboardingMedia({
	userId,
	searchTerm,
}: OnboardingMediaParams): Promise<OnboardingMediaResult> {
	const [movieSearchResult, movieGroupResult] = await _getCombinedResults({
		tableName: "movie",
		searchTerm,
		userId,
	})
	const [tvSearchResult, tvGroupResult] = await _getCombinedResults({
		tableName: "show",
		searchTerm,
		userId,
	})

	const uniqueMovies = _getUniqueByDecade(movieGroupResult)
	const uniqueTv = _getUniqueByDecade(tvGroupResult)

	const limit = searchTerm ? LIMIT_PER_SEARCH : LIMIT_PER_MEDIA_TYPE
	const movies = [...movieSearchResult, ...uniqueMovies].slice(0, limit)
	const shows = [...tvSearchResult, ...uniqueTv].slice(0, limit)
	return {
		movies,
		shows,
	}
}

interface CombinedResultProps {
	tableName: "movie" | "show"
	searchTerm: string
	userId: string
}

const _getCombinedResults = async <T extends OnboardingResult>({
	tableName,
	searchTerm,
	userId,
}: CombinedResultProps) => {
	const mediaType = tableName === "movie" ? "movie" : "show"

	const commonQuery = `
		WITH ranked_movies AS (
			SELECT
				m.tmdb_id,
				'${mediaType}' as media_type,
				m.title,
				m.release_year,
				m.popularity,
				m.poster_path,
				m.backdrop_path,
				m.genres,
				(FLOOR(m.release_year / 10) * 10) AS decade,
				${getRatingKeys()
					.map((key) => `m.${key}`)
					.join(", ")}
				%SELECTED_FIELDS%
			FROM
				${tableName} as m
			LEFT JOIN user_score
				ON m.tmdb_id = user_score.tmdb_id
				AND user_score.media_type = '${mediaType}'
				AND user_score.user_id = '${userId}'
			LEFT JOIN user_skipped
				ON m.tmdb_id = user_skipped.tmdb_id
				AND user_skipped.media_type = '${mediaType}'
				AND user_skipped.user_id = '${userId}'
			LEFT JOIN user_wishlist
				ON m.tmdb_id = user_wishlist.tmdb_id
				AND user_wishlist.media_type = '${mediaType}'
				AND user_wishlist.user_id = '${userId}'
			WHERE
				(%WHERE_CONDITIONS%)
				AND user_score.tmdb_id IS NULL
				AND user_skipped.tmdb_id IS NULL
				AND user_wishlist.tmdb_id IS NULL
		)
		SELECT *
		FROM ranked_movies
    ORDER BY
			%ORDER_BY% 
      goodwatch_overall_score_voting_count DESC
    LIMIT %LIMIT%;
  `

	// search query - only if search term was provided
	let searchRows: T[] = []
	if (searchTerm) {
		const searchWhereConditions = `
			MATCH((m.title 3.0, m.original_title 2.0), ?) using phrase_prefix
		`
		const searchQuery = commonQuery
			.replace("%SELECTED_FIELDS%", ", m._score AS relevance")
			.replace("%WHERE_CONDITIONS%", searchWhereConditions)
			.replace("%ORDER_BY%", "relevance DESC,")
			.replace("%LIMIT%", LIMIT_PER_SEARCH.toString())
		const searchParams = [searchTerm]
		searchRows = await query<T>(searchQuery, searchParams)
	}

	// grouped query
	const groupWhereConditions = `
		m.release_year >= 1980
		AND m.goodwatch_overall_score_normalized_percent >= 60
		AND m.popularity >= 50
	`
	const groupQuery = commonQuery
		.replace("%SELECTED_FIELDS%", "")
		.replace("%WHERE_CONDITIONS%", groupWhereConditions)
		.replace("%ORDER_BY%", "")
		.replace("%LIMIT%", "10")
	const groupedRows = await query<T>(groupQuery)

	return [searchRows, groupedRows]
}

const _getUniqueByDecade = <T extends OnboardingResult>(result: T[]): T[] => {
	const uniqueMedia: { [key: string]: T } = {}

	const decades = new Set(result.map((m) => m.decade))
	for (const decade of decades) {
		const media = result.find(
			(m) => m.decade === decade && !uniqueMedia[decade],
		)
		if (media) {
			uniqueMedia[decade] = media
		}
	}

	return Object.values(uniqueMedia)
}

// cache reset

type ResetOnboardingMediaCacheParams = {
	userId: string
	searchTerm?: string
}

export const resetOnboardingMediaCache = async ({
	userId,
	searchTerm = "",
}: ResetOnboardingMediaCacheParams) => {
	return await resetCache({
		name: "onboarding-media",
		params: { userId, searchTerm },
	})
}

// loader prefetch

export const prefetchOnboardingMedia = async ({
	queryClient,
	request,
}: PrefetchParams) => {
	await prefetchQuery({
		queryClient,
		queryKey: queryKeyOnboardingMedia,
		getter: async ({ userId }) =>
			await getOnboardingMedia({ userId: userId || "", searchTerm: "" }),
		request,
	})
}
