import { queryKeyOnboardingMedia } from "~/routes/api.onboarding.media"
import { type PrefetchParams, prefetchQuery } from "~/server/utils/prefetch"
import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"
import { type AllRatings, getRatingKeys } from "~/utils/ratings"

const LIMIT_PER_MEDIA_TYPE = 3

export interface OnboardingMedia extends AllRatings {
	tmdb_id: number
	media_type: "movie" | "tv"
	title: string
	release_year: string
	popularity: number
	poster_path: string
	backdrop_path: string
	genres: string[]
	decade: number
}

export interface OnboardingMovie extends OnboardingMedia {}

export interface OnboardingTV extends OnboardingMedia {}

export type OnboardingResult = OnboardingMovie | OnboardingTV

export type OnboardingMediaResult = {
	movies: OnboardingMovie[]
	tv: OnboardingTV[]
}

export interface OnboardingMediaParams {
	userId: string
	searchTerm: string
}

export const getOnboardingMedia = async (params: OnboardingMediaParams) => {
	return await cached<OnboardingMediaParams, OnboardingMediaResult>({
		name: "countries",
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
		tableName: "movies",
		searchTerm,
		userId,
	})
	const [tvSearchResult, tvGroupResult] = await _getCombinedResults({
		tableName: "tv",
		searchTerm,
		userId,
	})

	const uniqueMovies = _getUniqueByDecade(movieGroupResult)
	const uniqueTv = _getUniqueByDecade(tvGroupResult)

	const movies = [...movieSearchResult, ...uniqueMovies].slice(
		0,
		LIMIT_PER_MEDIA_TYPE,
	)
	const tv = [...tvSearchResult, ...uniqueTv].slice(0, LIMIT_PER_MEDIA_TYPE)
	return {
		movies,
		tv,
	}
}

interface CombinedResultProps {
	tableName: "movies" | "tv"
	searchTerm: string
	userId: string
}

const _getCombinedResults = async <T extends OnboardingResult>({
	tableName,
	searchTerm,
	userId,
}: CombinedResultProps) => {
	const mediaType = tableName === "movies" ? "movie" : "tv"

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
			LEFT JOIN user_scores
				ON m.tmdb_id = user_scores.tmdb_id
				AND user_scores.media_type = '${mediaType}'
				AND user_scores.user_id = '${userId}'
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
				AND user_scores.tmdb_id IS NULL
				AND user_skipped.tmdb_id IS NULL
				AND user_wishlist.tmdb_id IS NULL
		)
		SELECT *
		FROM ranked_movies
    ORDER BY
			%ORDER_BY% 
      popularity DESC
    LIMIT %LIMIT%;
  `

	// search query - only if search term was provided
	let searchRows: T[] = []
	if (searchTerm) {
		const exactMatchCondition = `
			m.title ILIKE $1
			OR m.original_title ILIKE $1
			OR m.alternative_titles_text ILIKE $1
		`

		const words = searchTerm.split(" ").filter(Boolean)
		const wordConditions = words
			.map(
				(_, index) => `
					m.title ILIKE $${index + 2}
					OR m.original_title ILIKE $${index + 2}
					OR m.alternative_titles_text ILIKE $${index + 2}
				`,
			)
			.join(" OR ")

		const searchWhereConditions = `
			(${exactMatchCondition})
			OR (${wordConditions})
		`
		const searchQuery = commonQuery
			.replace(
				"%SELECTED_FIELDS%",
				`
				,ts_rank_cd(
					setweight(to_tsvector(m.title), 'A') ||
					setweight(to_tsvector(m.original_title), 'B') ||
					setweight(to_tsvector(m.alternative_titles_text), 'C'),
					plainto_tsquery($1)
				) AS relevance
			`,
			)
			.replace("%WHERE_CONDITIONS%", searchWhereConditions)
			.replace("%ORDER_BY%", "relevance DESC NULLS LAST,")
			.replace("%LIMIT%", "10")
		const searchParams = [
			`%${searchTerm}%`,
			...words.map((word) => `%${word}%`),
		]
		const searchResult = await executeQuery<T>(searchQuery, searchParams)
		searchRows = searchResult.rows
	}

	// grouped query
	const groupWhereConditions = `
		m.release_year >= 2000
		AND m.aggregated_overall_score_normalized_percent >= 60
	`
	const groupQuery = commonQuery
		.replace("%SELECTED_FIELDS%", "")
		.replace("%WHERE_CONDITIONS%", groupWhereConditions)
		.replace("%ORDER_BY%", "")
		.replace("%LIMIT%", "500")
	const groupedResult = await executeQuery<T>(groupQuery)

	return [searchRows, groupedResult.rows]
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
