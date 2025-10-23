import {
	type GetUserDataResult,
	queryKeyUserData,
} from "~/routes/api.user-data"
import type { StreamingLink } from "~/server/details.server"
import type { Score } from "~/server/scores.server"
import { getUserSettings } from "~/server/user-settings.server"
import { type PrefetchParams, prefetchQuery } from "~/server/utils/prefetch"
import { cached, resetCache } from "~/utils/cache"
import { query } from "~/utils/crate"

interface UserDataRow {
	media_type: string
	tmdb_id: number
	on_wishlist: boolean
	on_watch_history: boolean
	on_favorites: boolean
	on_skipped: boolean
	score: Score | null
	review: string | null
	updated_at_wishlist: Date | null
	updated_at_watch_history: Date | null
	updated_at_favorites: Date | null
	updated_at_scores: Date | null
	updated_at_skipped: Date | null
	title: string
	release_year: number
	poster_path: string
	backdrop_path: string
	goodwatch_overall_score_normalized_percent: number | null
	streaming_links: StreamingLink[]
}

type GetUserDataParams = {
	user_id?: string
}

// server call

export const getUserData = async (params: GetUserDataParams) => {
	return await cached<GetUserDataParams, GetUserDataResult>({
		name: "user-data",
		target: _getUserData,
		params,
		//ttlMinutes: 10,
		ttlMinutes: 0,
	})
}

async function _getUserData({
	user_id,
}: GetUserDataParams): Promise<GetUserDataResult> {
	if (!user_id) {
		return {} as GetUserDataResult
	}

	const userSettings = await getUserSettings({ userId: user_id })

	// Simple approach: query each table separately and combine in code
	const [scores, wishlist, watchHistory, favorites, skipped] = await Promise.all([
		// User scores
		query<{tmdb_id: number, media_type: string, score: number, review: string, updated_at: Date}>(
			`SELECT tmdb_id, media_type, score, review, updated_at 
			 FROM user_score WHERE user_id = ?`, [user_id]
		),
		// User wishlist
		query<{tmdb_id: number, media_type: string, updated_at: Date}>(
			`SELECT tmdb_id, media_type, updated_at 
			 FROM user_wishlist WHERE user_id = ?`, [user_id]
		),
		// User watch history
		query<{tmdb_id: number, media_type: string, first_watched_at: Date}>(
			`SELECT tmdb_id, media_type, first_watched_at 
			 FROM user_watch_history WHERE user_id = ?`, [user_id]
		),
		// User favorites
		query<{tmdb_id: number, media_type: string, updated_at: Date}>(
			`SELECT tmdb_id, media_type, updated_at 
			 FROM user_favorite WHERE user_id = ?`, [user_id]
		),
		// User skipped
		query<{tmdb_id: number, media_type: string, updated_at: Date}>(
			`SELECT tmdb_id, media_type, updated_at 
			 FROM user_skipped WHERE user_id = ?`, [user_id]
		),
	])

	// Create maps for fast lookup
	const scoresMap = new Map<string, {score: number, review: string, updated_at: Date}>()
	const wishlistMap = new Map<string, Date>()
	const watchHistoryMap = new Map<string, Date>()
	const favoritesMap = new Map<string, Date>()
	const skippedMap = new Map<string, Date>()

	// Populate maps
	scores.forEach(item => {
		const key = `${item.media_type}-${item.tmdb_id}`
		scoresMap.set(key, {score: item.score, review: item.review, updated_at: item.updated_at})
	})
	wishlist.forEach(item => {
		const key = `${item.media_type}-${item.tmdb_id}`
		wishlistMap.set(key, item.updated_at)
	})
	watchHistory.forEach(item => {
		const key = `${item.media_type}-${item.tmdb_id}`
		watchHistoryMap.set(key, item.first_watched_at)
	})
	favorites.forEach(item => {
		const key = `${item.media_type}-${item.tmdb_id}`
		favoritesMap.set(key, item.updated_at)
	})
	skipped.forEach(item => {
		const key = `${item.media_type}-${item.tmdb_id}`
		skippedMap.set(key, item.updated_at)
	})

	// Get all unique media items
	const allMediaKeys = new Set([
		...scoresMap.keys(),
		...wishlistMap.keys(),
		...watchHistoryMap.keys(),
		...favoritesMap.keys(),
		...skippedMap.keys(),
	])

	// Group media by type for efficient bulk queries
	const movieIds: number[] = []
	const showIds: number[] = []
	
	for (const key of allMediaKeys) {
		const [media_type, tmdb_id_str] = key.split('-')
		const tmdb_id = parseInt(tmdb_id_str)
		
		if (media_type === 'movie') {
			movieIds.push(tmdb_id)
		} else if (media_type === 'show') {
			showIds.push(tmdb_id)
		}
	}

	// Fetch media details in bulk
	const mediaDetailsMap = new Map<string, {title: string, release_year: number, poster_path: string, backdrop_path: string, goodwatch_overall_score_normalized_percent: number | null, streaming_links: StreamingLink[]}>()
	
	if (movieIds.length > 0) {
		const moviePlaceholders = movieIds.map(() => '?').join(', ')
		const movieDetails = await query<{tmdb_id: number, title: string, release_year: number, poster_path: string, backdrop_path: string, goodwatch_overall_score_normalized_percent: number | null}>(
			`SELECT tmdb_id, title, release_year, poster_path, backdrop_path, goodwatch_overall_score_normalized_percent
			 FROM movie WHERE tmdb_id IN (${moviePlaceholders})`,
			movieIds
		)
		movieDetails.forEach(item => {
			const key = `movie-${item.tmdb_id}`
			mediaDetailsMap.set(key, {
				title: item.title,
				release_year: item.release_year,
				poster_path: item.poster_path,
				backdrop_path: item.backdrop_path,
				goodwatch_overall_score_normalized_percent: item.goodwatch_overall_score_normalized_percent,
				streaming_links: [],
			})
		})
	}
	
	if (showIds.length > 0) {
		const showPlaceholders = showIds.map(() => '?').join(', ')
		const showDetails = await query<{tmdb_id: number, title: string, release_year: number, poster_path: string, backdrop_path: string, goodwatch_overall_score_normalized_percent: number | null}>(
			`SELECT tmdb_id, title, release_year, poster_path, backdrop_path, goodwatch_overall_score_normalized_percent
			 FROM show WHERE tmdb_id IN (${showPlaceholders})`,
			showIds
		)
		showDetails.forEach(item => {
			const key = `show-${item.tmdb_id}`
			mediaDetailsMap.set(key, {
				title: item.title,
				release_year: item.release_year,
				poster_path: item.poster_path,
				backdrop_path: item.backdrop_path,
				goodwatch_overall_score_normalized_percent: item.goodwatch_overall_score_normalized_percent,
				streaming_links: [],
			})
		})
	}

	// Convert to result format
	const result: UserDataRow[] = []
	for (const key of allMediaKeys) {
		const [media_type, tmdb_id_str] = key.split('-')
		const tmdb_id = parseInt(tmdb_id_str)
		
		const scoreData = scoresMap.get(key)
		const mediaDetails = mediaDetailsMap.get(key)
		
		// Skip if media details not found
		if (!mediaDetails) continue
		
		// Get timestamp values safely
		const wishlistTimestamp = wishlistMap.get(key)
		const watchHistoryTimestamp = watchHistoryMap.get(key)
		const favoritesTimestamp = favoritesMap.get(key)
		const skippedTimestamp = skippedMap.get(key)
		
		result.push({
			media_type,
			tmdb_id,
			on_wishlist: wishlistTimestamp != null,
			on_watch_history: watchHistoryTimestamp != null,
			on_favorites: favoritesTimestamp != null,
			on_skipped: skippedTimestamp != null,
			score: scoreData?.score as Score || null,
			review: scoreData?.review || null,
			updated_at_wishlist: wishlistTimestamp || null,
			updated_at_watch_history: watchHistoryTimestamp || null,
			updated_at_favorites: favoritesTimestamp || null,
			updated_at_scores: scoreData?.updated_at || null,
			updated_at_skipped: skippedTimestamp || null,
			title: mediaDetails.title,
			release_year: mediaDetails.release_year,
			poster_path: mediaDetails.poster_path,
			backdrop_path: mediaDetails.backdrop_path,
			goodwatch_overall_score_normalized_percent: mediaDetails.goodwatch_overall_score_normalized_percent,
			streaming_links: mediaDetails.streaming_links,
		})
	}

	const userData = {} as GetUserDataResult

	for (const row of result) {
		const {
			media_type,
			tmdb_id,
			on_wishlist,
			on_watch_history,
			on_favorites,
			on_skipped,
			score,
			review,
			updated_at_wishlist,
			updated_at_watch_history,
			updated_at_favorites,
			updated_at_scores,
			updated_at_skipped,
		} = row

		if (!userData[media_type]) {
			userData[media_type] = {}
		}

		const providerTypeKeys = row.streaming_links.map(
			(link: any) => `${link.provider_id}-${link.stream_type}`,
		)
		const streaming_links = row.streaming_links.filter(
			(link: any, index: number) =>
				index ===
				providerTypeKeys.indexOf(`${link.provider_id}-${link.stream_type}`),
		)

		userData[media_type][tmdb_id] = {
			onWishList: on_wishlist,
			onWatchHistory: on_watch_history,
			onFavorites: on_favorites,
			onSkipped: on_skipped,
			score,
			review,
			onWishListSince: updated_at_wishlist
				? new Date(updated_at_wishlist)
				: null,
			onWatchHistorySince: updated_at_watch_history
				? new Date(updated_at_watch_history)
				: null,
			onFavoritesSince: updated_at_favorites
				? new Date(updated_at_favorites)
				: null,
			onScoresSince: updated_at_scores ? new Date(updated_at_scores) : null,
			onSkippedSince: updated_at_skipped ? new Date(updated_at_skipped) : null,
			title: row.title,
			release_year: row.release_year,
			poster_path: row.poster_path,
			backdrop_path: row.backdrop_path,
			goodwatch_overall_score_normalized_percent:
				row.goodwatch_overall_score_normalized_percent,
			streaming_links,
		}
	}

	return userData
}

// cache reset

type ResetUserDataCacheParams = {
	user_id?: string
}

export const resetUserDataCache = async (params: ResetUserDataCacheParams) => {
	if (!params.user_id) {
		return 0
	}

	return await resetCache({
		name: "user-data",
		params,
	})
}

// loader prefetch

export const prefetchUserData = async ({
	queryClient,
	request,
}: PrefetchParams) => {
	await prefetchQuery({
		queryClient,
		queryKey: queryKeyUserData,
		getter: async ({ userId }) => await getUserData({ user_id: userId }),
		request,
	})
}
