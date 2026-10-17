import { readNotInterested, excludeNotInterested } from "~/server/not-interested-store.server"
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
		name: "smart-titles-guest-recognition",
		target: _getSmartTitlesForGuest,
		params,
		ttlMinutes: 60 * 24,
		//ttlMinutes: 0,
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
			goodwatch_overall_score_normalized_percent,
			goodwatch_overall_score_voting_count
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
			goodwatch_overall_score_normalized_percent,
			goodwatch_overall_score_voting_count
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
	return recognitionOrder(movies, shows).slice(0, count)
}

export const getSmartTitlesForUser = async (
	params: GetSmartTitlesForUserParams,
) => {
	const titles = await cached<GetSmartTitlesForUserParams, SmartTitle[]>({
		name: "smart-titles-user-recognition",
		target: _getSmartTitlesForUser,
		params,
		ttlMinutes: 1,
		staleMinutes: 0,
		//ttlMinutes: 0,
	})
	return excludeNotInterested(params.userId, titles)
}

async function _getSmartTitlesForUser({
	userId,
	count = 20,
	excludeIds = [],
}: GetSmartTitlesForUserParams): Promise<SmartTitle[]> {
	excludeIds = [...excludeIds, ...await readNotInterested(userId)]
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
			m.goodwatch_overall_score_normalized_percent,
			m.goodwatch_overall_score_voting_count
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
				FROM user_watch_state
				WHERE user_id = ? AND media_type = 'movie' AND state <> 'not_started'
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
			s.goodwatch_overall_score_normalized_percent,
			s.goodwatch_overall_score_voting_count
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
				FROM user_watch_state
				WHERE user_id = ? AND media_type = 'show' AND state <> 'not_started'
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
	return recognitionOrder(movies, shows).slice(0, count)
}

/** How likely someone has seen a title: many votes and still talked about. Votes alone favor titles with heavy IMDb
 * voting that few people outside one country know (Aspirants: 320k votes, TMDB popularity 5). */
const recognition = (t: SmartTitle) =>
	Math.log(Math.max(Number(t.goodwatch_overall_score_voting_count) || 1, 1)) +
	0.5 * Math.log(Math.max(t.popularity || 1, 1))

/** Best-known first, alternating movies and shows; shuffled only within windows of 10, so every visit varies but the first titles stay famous. */
function recognitionOrder(movies: SmartTitle[], shows: SmartTitle[]): SmartTitle[] {
	const byRecognition = (list: SmartTitle[]) => [...list].sort((a, b) => recognition(b) - recognition(a))
	const m = byRecognition(movies)
	const s = byRecognition(shows)
	const mixed: SmartTitle[] = []
	for (let i = 0; i < Math.max(m.length, s.length); i++) {
		if (m[i]) mixed.push(m[i])
		if (s[i]) mixed.push(s[i])
	}
	const out: SmartTitle[] = []
	for (let i = 0; i < mixed.length; i += 10) out.push(...shuffleArray(mixed.slice(i, i + 10)))
	return out
}
