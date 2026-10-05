// "I watched it" in Watch next: records the watch and removes the title from Want to See. Undo removes that watch
// again and restores Want to See with its original added-at time, so the title keeps its place in Waiting longest.
// Members only; a guest's Wishlist lives in the browser.

import { clearNotInterested } from "~/server/not-interested-store.server"
import { resetUserDataCache } from "~/server/userData.server"
import { updateWatchHistory } from "~/server/watchHistory.server"
import { updateWishList } from "~/server/wishList.server"
import { execute, query } from "~/utils/crate"
import { type TitleKey, parseTitleKey } from "~/utils/title-key"

/** What Undo needs, handed to the browser and sent back as it is. */
export interface FinishUndo {
	key: TitleKey
	/** When the title was added to the Wishlist (ISO); null when it wasn't on it. */
	addedAt: string | null
	/** The watch this recorded (ISO); null when the person had already watched the title. */
	watchedAt: string | null
}

export async function finishTitle(
	userId: string,
	key: TitleKey,
): Promise<FinishUndo> {
	const { mediaType, tmdbId } = parseTitleKey(key)
	// Primary-key reads, real-time in Crate.
	const [wish, watch] = await Promise.all([
		query<{ created_at: number | string | null; updated_at: number | string }>(
			`SELECT created_at, updated_at FROM user_wishlist
			 WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
			[userId, tmdbId, mediaType],
		),
		query<{ first_watched_at: number | string }>(
			`SELECT first_watched_at FROM user_watch_history
			 WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
			[userId, tmdbId, mediaType],
		),
	])
	let watchedAt: string | null = null
	if (!watch.length) {
		await updateWatchHistory({
			user_id: userId,
			tmdb_id: tmdbId,
			media_type: mediaType,
			action: "add",
		})
		const [recorded] = await query<{ first_watched_at: number | string }>(
			`SELECT first_watched_at FROM user_watch_history
			 WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
			[userId, tmdbId, mediaType],
		)
		watchedAt = recorded
			? new Date(recorded.first_watched_at).toISOString()
			: null
	}
	await clearNotInterested(userId, tmdbId, mediaType)
	await resetUserDataCache({ user_id: userId })
	const added = wish[0]
	if (added)
		await updateWishList({
			user_id: userId,
			tmdb_id: tmdbId,
			media_type: mediaType,
			action: "remove",
		})
	return {
		key,
		addedAt: added
			? new Date(added.created_at ?? added.updated_at).toISOString()
			: null,
		watchedAt,
	}
}

export async function undoFinishTitle(
	userId: string,
	undo: FinishUndo,
): Promise<void> {
	const { mediaType, tmdbId } = parseTitleKey(undo.key)
	if (undo.watchedAt) {
		// Only the watch "I watched it" recorded: one watch at that time. A watch recorded since stays.
		await execute(
			`DELETE FROM user_watch_history
			 WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND watch_count = 1 AND first_watched_at = ?`,
			[userId, tmdbId, mediaType, new Date(undo.watchedAt)],
		)
		await resetUserDataCache({ user_id: userId })
	}
	if (undo.addedAt) {
		const addedAt = new Date(undo.addedAt)
		await updateWishList({
			user_id: userId,
			tmdb_id: tmdbId,
			media_type: mediaType,
			action: "add",
			// A time in the future would sort first in Last added forever; it can only come from a tampered request.
			addedAt: addedAt.getTime() <= Date.now() ? addedAt : undefined,
		})
	}
}
