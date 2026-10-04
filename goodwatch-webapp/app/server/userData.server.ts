import type { Score } from "~/server/scores.server"
import type { UserData, MediaType } from "~/types/user-data"
import { createMediaKey } from "~/types/user-data"
import { cached, declareResettableCache, resetCache } from "~/utils/cache"
import { execute, query } from "~/utils/crate"

const USER_DATA_CACHE = {
	name: "user-data",
	// Five minutes bounds late timed-out writes, manual changes, old deploys without resets,
	// and unconfirmed resets, matching the share-list view lifetime.
	ttlMinutes: 5,
	staleMinutes: 0,
} as const
declareResettableCache(USER_DATA_CACHE)

// Normalized user data (optimized for performance)

type GetUserDataParams = {
	user_id?: string
}

export const getUserData = async (
	params: GetUserDataParams,
): Promise<UserData> => {
	const { user_id } = params
	if (!user_id)
		return { scores: {}, wishlist: {}, watched: {}, favorites: {}, skipped: {} }
	const data = await cached<GetUserDataParams, UserData>({
		...USER_DATA_CACHE,
		target: _getUserData,
		params: { user_id },
	})
	// JSON cache hits and fresh Crate reads must expose the same Date-valued API.
	for (const collection of [
		data.scores,
		data.wishlist,
		data.watched,
		data.favorites,
		data.skipped,
	]) {
		for (const item of Object.values(collection)) {
			item.updatedAt = new Date(item.updatedAt)
		}
	}
	for (const item of Object.values(data.wishlist))
		item.createdAt = new Date(item.createdAt)
	return data
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
		query<{ tmdb_id: number; media_type: string; created_at: Date | null; updated_at: Date }>(
			`SELECT tmdb_id, media_type, created_at, updated_at 
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
			// Every row had created_at when checked on September 27, 2026; updated_at covers any that lack it.
			createdAt: new Date(item.created_at ?? item.updated_at),
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

	const key = {
		name: USER_DATA_CACHE.name,
		params: { user_id: params.user_id },
	}
	try {
		await execute(
			"REFRESH TABLE user_score, user_wishlist, user_watch_history, user_favorite, user_skipped",
		)
	} catch (error) {
		console.error("Refreshing member data before cache reset failed:", error)
		// Drop any old rows cached before Crate's periodic refresh catches up.
		setTimeout(() => {
			void resetCache(key)
		}, 2000).unref()
	}
	return await resetCache(key)
}
