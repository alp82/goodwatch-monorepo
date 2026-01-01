import { queryKeyUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"
import type { UserData, MediaType } from "~/types/user-data"
import { createMediaKey } from "~/types/user-data"
import { type PrefetchParams, prefetchQuery } from "~/server/utils/prefetch"
import { cached, resetCache } from "~/utils/cache"
import { query } from "~/utils/crate"

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

// Normalized user data (optimized for performance)

type GetUserDataParams = {
	user_id?: string
}

export const getUserData = async (params: GetUserDataParams): Promise<UserData> => {
	return await cached<GetUserDataParams, UserData>({
		name: "user-data",
		target: _getUserData,
		params,
		//ttlMinutes: 1,
		ttlMinutes: 0,
	})
}

async function _getUserData({
	user_id,
}: GetUserDataParams): Promise<UserData> {
	if (!user_id) {
		return {
			scores: {},
			wishlist: {},
			watched: {},
			favorites: {},
			skipped: {},
		}
	}

	// Query each table separately
	const [scores, wishlist, watchHistory, favorites, skipped] = await Promise.all([
		query<{ tmdb_id: number; media_type: string; score: number; review: string | null; updated_at: Date }>(
			`SELECT tmdb_id, media_type, score, review, updated_at 
			 FROM user_score WHERE user_id = ?`,
			[user_id],
		),
		query<{ tmdb_id: number; media_type: string; updated_at: Date }>(
			`SELECT tmdb_id, media_type, updated_at 
			 FROM user_wishlist WHERE user_id = ?`,
			[user_id],
		),
		query<{ tmdb_id: number; media_type: string; first_watched_at: Date }>(
			`SELECT tmdb_id, media_type, first_watched_at 
			 FROM user_watch_history WHERE user_id = ?`,
			[user_id],
		),
		query<{ tmdb_id: number; media_type: string; updated_at: Date }>(
			`SELECT tmdb_id, media_type, updated_at 
			 FROM user_favorite WHERE user_id = ?`,
			[user_id],
		),
		query<{ tmdb_id: number; media_type: string; updated_at: Date }>(
			`SELECT tmdb_id, media_type, updated_at 
			 FROM user_skipped WHERE user_id = ?`,
			[user_id],
		),
	])

	const result: UserData = {
		scores: {},
		wishlist: {},
		watched: {},
		favorites: {},
		skipped: {},
	}

	// Populate scores
	scores.forEach((item) => {
		const key = createMediaKey(item.media_type as MediaType, item.tmdb_id)
		result.scores[key] = {
			score: item.score as Score,
			review: item.review,
			updatedAt: new Date(item.updated_at),
		}
	})

	// Populate wishlist
	wishlist.forEach((item) => {
		const key = createMediaKey(item.media_type as MediaType, item.tmdb_id)
		result.wishlist[key] = {
			updatedAt: new Date(item.updated_at),
		}
	})

	// Populate watched
	watchHistory.forEach((item) => {
		const key = createMediaKey(item.media_type as MediaType, item.tmdb_id)
		result.watched[key] = {
			updatedAt: new Date(item.first_watched_at),
		}
	})

	// Populate favorites
	favorites.forEach((item) => {
		const key = createMediaKey(item.media_type as MediaType, item.tmdb_id)
		result.favorites[key] = {
			updatedAt: new Date(item.updated_at),
		}
	})

	// Populate skipped
	skipped.forEach((item) => {
		const key = createMediaKey(item.media_type as MediaType, item.tmdb_id)
		result.skipped[key] = {
			updatedAt: new Date(item.updated_at),
		}
	})

	return result
}

export const resetUserDataCache = async (params: GetUserDataParams) => {
	if (!params.user_id) {
		return 0
	}

	return await resetCache({
		name: "user-data",
		params,
	})
}
