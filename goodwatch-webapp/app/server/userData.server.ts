import {
	type GroupRow,
	type TitleState,
	watchStateOf,
} from "~/domain/tracking/storage"
import { readNotInterested, refreshNotInterested } from "~/server/not-interested-store.server"
import type { Score } from "~/server/scores.server"
import { GROUPED_QUERY, STATES_QUERY } from "~/server/tracking-sql"
import type { UserData, MediaType } from "~/types/user-data"
import { createMediaKey } from "~/types/user-data"
import { cached, declareResettableCache, resetCache } from "~/utils/cache"
import { execute, query } from "~/utils/crate"

/**
 * v2 since `watched` became `watchState`. The build before it shares Valkey with this one while a deploy rolls, and
 * each would fail on an entry of the other's shape, so the two keep separate entries.
 */
export const USER_DATA_CACHE_NAME = "user-data-v2"

const USER_DATA_CACHE = {
	name: USER_DATA_CACHE_NAME,
	// Five minutes bounds late timed-out writes, manual changes, old deploys without resets,
	// and unconfirmed resets, matching the share-list view lifetime.
	ttlMinutes: 5,
	staleMinutes: 0,
} as const
declareResettableCache(USER_DATA_CACHE)

/**
 * The tables the member data map is read from, refreshed before every cache reset. `user_not_interested` is
 * refreshed apart from them, because it may not exist yet.
 */
export const USER_DATA_TABLES = [
	"user_score",
	"user_wishlist",
	"user_watch_log",
	"user_watch_state",
	"user_favorite",
	"user_skipped",
] as const

// Normalized user data (optimized for performance)

type GetUserDataParams = {
	user_id?: string
}

const empty = (): UserData => ({
	scores: {},
	wishlist: {},
	watchState: {},
	favorites: {},
	skipped: {},
	notInterested: {},
})

const date = (value: Date | string | number | null) =>
	value === null ? null : new Date(value)

export const getUserData = async (
	params: GetUserDataParams,
): Promise<UserData> => {
	const { user_id } = params
	if (!user_id) return empty()
	const data = await cached<GetUserDataParams, UserData>({
		...USER_DATA_CACHE,
		target: _getUserData,
		params: { user_id },
	})
	data.notInterested ??= {}
	// JSON cache hits and fresh Crate reads must expose the same Date-valued API.
	for (const collection of [
		data.scores,
		data.wishlist,
		data.favorites,
		data.skipped,
		data.notInterested,
	]) {
		for (const item of Object.values(collection)) {
			item.updatedAt = new Date(item.updatedAt)
		}
	}
	for (const item of Object.values(data.wishlist))
		item.createdAt = new Date(item.createdAt)
	for (const item of Object.values(data.watchState)) {
		item.watchedAt = date(item.watchedAt)
		item.lastActivityAt = date(item.lastActivityAt)
	}
	return data
}

async function _getUserData({
	user_id,
}: GetUserDataParams): Promise<UserData> {
	if (!user_id) return empty()

	// Query each table separately. The watch state is two reads: the member's states, and one grouped query over
	// their watch log (docs/implementation/tracking/data-model.md, "Reads").
	const [scores, wishlist, states, groups, favorites, skipped, notInterested] = await Promise.all([
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
		query<TitleState>(STATES_QUERY, [user_id]),
		query<GroupRow>(GROUPED_QUERY, [user_id]),
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
		readNotInterested(user_id),
	])

	const result = empty()

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

	// One entry per title whose state is not Not started, never a row per episode.
	result.watchState = watchStateOf(states, groups)

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

	for (const item of notInterested) {
		result.notInterested[createMediaKey(item.media_type, item.tmdb_id)] = { updatedAt: new Date(item.updated_at) }
	}

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
		await refreshNotInterested()
		await execute(`REFRESH TABLE ${USER_DATA_TABLES.join(", ")}`)
	} catch (error) {
		console.error("Refreshing member data before cache reset failed:", error)
		// Drop any old rows cached before Crate's periodic refresh catches up.
		setTimeout(() => {
			void resetCache(key)
		}, 2000).unref()
	}
	return await resetCache(key)
}
