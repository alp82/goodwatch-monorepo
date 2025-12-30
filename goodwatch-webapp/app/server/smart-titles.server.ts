import { shuffleArray } from "~/utils/array"
import { cached } from "~/utils/cache"
import { query as crateQuery } from "~/utils/crate"

interface SmartTitle {
	tmdb_id: number
	title: string
	poster_path: string
	backdrop_path: string
	media_type: "movie" | "show"
	popularity: number
	goodwatch_overall_score_normalized_percent: number
	release_year: string
	genres: string[]
	synopsis: string
	essence_tags: string[]
	[key: string]: unknown
}

interface ExcludeItem {
	tmdb_id: number
	media_type: string
}

interface GetSmartTitlesForGuestParams {
	count?: number
	locale: {
		country: string
		language: string
	}
	ratingsCount: number
	excludeIds?: ExcludeItem[]
}

interface GetSmartTitlesForUserParams {
	userId: string
	count?: number
	locale: {
		country: string
		language: string
	}
	excludeIds?: ExcludeItem[]
}


export const getSmartTitlesForGuest = async (
	params: GetSmartTitlesForGuestParams,
) => {
	// Don't cache when excludeIds are provided
	if (params.excludeIds && params.excludeIds.length > 0) {
		return await _getSmartTitlesForGuest(params)
	}
	
	return await cached<GetSmartTitlesForGuestParams, SmartTitle[]>({
		name: "smart-titles-guest",
		target: _getSmartTitlesForGuest,
		params,
		ttlMinutes: 0,
	})
}

async function _getSmartTitlesForGuest({
	count = 20,
	excludeIds = [],
}: GetSmartTitlesForGuestParams): Promise<SmartTitle[]> {
	// Get IDs to exclude (grouped by media type)
	const excludeMovieIds = excludeIds.filter(item => item.media_type === 'movie').map(item => item.tmdb_id)
	const excludeShowIds = excludeIds.filter(item => item.media_type === 'show').map(item => item.tmdb_id)
	
	const movieExcludePlaceholders = excludeMovieIds.length > 0 ? excludeMovieIds.map(() => '?').join(',') : null
	const showExcludePlaceholders = excludeShowIds.length > 0 ? excludeShowIds.map(() => '?').join(',') : null
	
	// Fetch both movies and shows, then mix them
	const halfCount = Math.ceil(count / 2)
	
	const movieSql = `
		SELECT 
			tmdb_id,
			'movie' as media_type,
			title,
			poster_path,
			backdrop_path,
			release_year,
			genres,
			synopsis,
			essence_tags,
			popularity,
			goodwatch_overall_score_normalized_percent
		FROM movie
		WHERE 
			poster_path IS NOT NULL
			AND backdrop_path IS NOT NULL
			AND essence_tags IS NOT NULL
			AND goodwatch_overall_score_normalized_percent >= 70
			${movieExcludePlaceholders ? `AND tmdb_id NOT IN (${movieExcludePlaceholders})` : ''}
		ORDER BY goodwatch_overall_score_voting_count DESC
		LIMIT ?
	`
	
	const showSql = `
		SELECT 
			tmdb_id,
			'show' as media_type,
			title,
			poster_path,
			backdrop_path,
			release_year,
			genres,
			synopsis,
			essence_tags,
			popularity,
			goodwatch_overall_score_normalized_percent
		FROM show
		WHERE 
			poster_path IS NOT NULL
			AND backdrop_path IS NOT NULL
			AND essence_tags IS NOT NULL
			AND goodwatch_overall_score_normalized_percent >= 70
			${showExcludePlaceholders ? `AND tmdb_id NOT IN (${showExcludePlaceholders})` : ''}
		ORDER BY goodwatch_overall_score_voting_count DESC
		LIMIT ?
	`
	
	const movieParams = movieExcludePlaceholders ? [...excludeMovieIds, halfCount] : [halfCount]
	const showParams = showExcludePlaceholders ? [...excludeShowIds, halfCount] : [halfCount]
	
	const [movies, shows] = await Promise.all([
		crateQuery<SmartTitle>(movieSql, movieParams),
		crateQuery<SmartTitle>(showSql, showParams)
	])
	
	// Combine and shuffle results
	const combined = [...movies, ...shows]
	return shuffleArray(combined).slice(0, count)
}

export const getSmartTitlesForUser = async (
	params: GetSmartTitlesForUserParams,
) => {
	return await cached<GetSmartTitlesForUserParams, SmartTitle[]>({
		name: "smart-titles-user",
		target: _getSmartTitlesForUser,
		params,
		//ttlMinutes: 5,
		ttlMinutes: 0,
	})
}

async function _getSmartTitlesForUser({
	userId,
	count = 20,
	excludeIds = [],
}: GetSmartTitlesForUserParams): Promise<SmartTitle[]> {
	// Additional excludeIds from client (items already in queue)
	const excludeMovieIds = excludeIds.filter(item => item.media_type === 'movie').map(item => item.tmdb_id)
	const excludeShowIds = excludeIds.filter(item => item.media_type === 'show').map(item => item.tmdb_id)
	
	const movieExcludeClause = excludeMovieIds.length > 0 
		? `AND m.tmdb_id NOT IN (${excludeMovieIds.map(() => '?').join(',')})` 
		: ''
	const showExcludeClause = excludeShowIds.length > 0 
		? `AND s.tmdb_id NOT IN (${excludeShowIds.map(() => '?').join(',')})` 
		: ''

	const movieSql = `
		SELECT 
			m.tmdb_id,
			'movie' as media_type,
			m.title,
			m.poster_path,
			m.backdrop_path,
			m.release_year,
			m.genres,
			m.synopsis,
			m.essence_tags,
			m.popularity,
			m.goodwatch_overall_score_normalized_percent
		FROM movie m
		WHERE 
			m.poster_path IS NOT NULL
			AND m.backdrop_path IS NOT NULL
			AND m.essence_tags IS NOT NULL
			AND m.goodwatch_overall_score_normalized_percent >= 70
			AND m.goodwatch_overall_score_voting_count >= 10000
			AND m.tmdb_id NOT IN (
				SELECT tmdb_id 
				FROM user_score 
				WHERE user_id = ? AND media_type = 'movie'
			)
			AND m.tmdb_id NOT IN (
				SELECT tmdb_id 
				FROM user_skipped 
				WHERE user_id = ? AND media_type = 'movie'
			)
			AND m.tmdb_id NOT IN (
				SELECT tmdb_id 
				FROM user_watch_history
				WHERE user_id = ? AND media_type = 'movie'
			)
			${movieExcludeClause}
		ORDER BY 
			m.goodwatch_overall_score_voting_count DESC
		LIMIT ?
	`

	const showSql = `
		SELECT 
			s.tmdb_id,
			'show' as media_type,
			s.title,
			s.poster_path,
			s.backdrop_path,
			s.release_year,
			s.genres,
			s.synopsis,
			s.essence_tags,
			s.popularity,
			s.goodwatch_overall_score_normalized_percent
		FROM show s
		WHERE 
			s.poster_path IS NOT NULL
			AND s.backdrop_path IS NOT NULL
			AND s.essence_tags IS NOT NULL
			AND s.goodwatch_overall_score_normalized_percent >= 70
			AND s.goodwatch_overall_score_voting_count >= 10000
			AND s.tmdb_id NOT IN (
				SELECT tmdb_id 
				FROM user_score 
				WHERE user_id = ? AND media_type = 'show'
			)
			AND s.tmdb_id NOT IN (
				SELECT tmdb_id 
				FROM user_skipped 
				WHERE user_id = ? AND media_type = 'show'
			)
			AND s.tmdb_id NOT IN (
				SELECT tmdb_id 
				FROM user_watch_history 
				WHERE user_id = ? AND media_type = 'show'
			)
			${showExcludeClause}
		ORDER BY 
			s.goodwatch_overall_score_voting_count DESC
		LIMIT ?
	`

	// Build params arrays
	const movieParams = [userId, userId, userId, ...excludeMovieIds, count]
	const showParams = [userId, userId, userId, ...excludeShowIds, count]

	// Get both movies and shows, then shuffle and mix them
	const [movies, shows] = await Promise.all([
		crateQuery<SmartTitle>(movieSql, movieParams),
		crateQuery<SmartTitle>(showSql, showParams)
	])

	// Combine and shuffle results
	const combined = [...movies, ...shows]
	return shuffleArray(combined).slice(0, count)
}
