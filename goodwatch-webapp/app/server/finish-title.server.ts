// "I watched it" in Watch next: records the watch and removes the title from Want to See. Undo removes that watch
// again and restores Want to See with its original added-at time, so the title keeps its place in Waiting longest.
// Members only; a guest's Wishlist lives in the browser.
//
// The watch goes through the tracking writer: one watch dated now for a movie, the Seen press for a show.

import { markSeen, unmarkSeen } from "~/server/watchHistory.server"
import { updateWishList } from "~/server/wishList.server"
import { query } from "~/utils/crate"
import { type TitleKey, parseTitleKey } from "~/utils/title-key"

/** What Undo needs, handed to the browser and sent back as it is. */
export interface FinishUndo {
	key: TitleKey
	/** When the title was added to the Wishlist (ISO); null when it wasn't on it. */
	addedAt: string | null
	/**
	 * What this recorded: the id of the movie's watch, or of the show's Seen press. Null when the person had already
	 * watched the title.
	 */
	watchId: string | null
}

export async function finishTitle(
	userId: string,
	key: TitleKey,
): Promise<FinishUndo> {
	const { mediaType, tmdbId } = parseTitleKey(key)
	// A primary-key read, real-time in Crate.
	const [wish] = await query<{
		created_at: number | string | null
		updated_at: number | string
	}>(
		`SELECT created_at, updated_at FROM user_wishlist
		 WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
		[userId, tmdbId, mediaType],
	)
	const { id, result } = await markSeen(userId, { mediaType, tmdbId })
	// The watch takes the title off the Wishlist. A title that was Seen already is taken off here.
	if (wish && !result?.cleared.wantToSeeAddedAt)
		await updateWishList({
			user_id: userId,
			tmdb_id: tmdbId,
			media_type: mediaType,
			action: "remove",
		})
	return {
		key,
		addedAt: wish
			? new Date(wish.created_at ?? wish.updated_at).toISOString()
			: null,
		watchId: id,
	}
}

export async function undoFinishTitle(
	userId: string,
	undo: Pick<FinishUndo, "key" | "addedAt"> & { watchId?: string | null },
): Promise<void> {
	const { mediaType, tmdbId } = parseTitleKey(undo.key)
	// Only what "I watched it" recorded. A watch recorded since stays, and so does a show that has moved on.
	if (undo.watchId)
		await unmarkSeen(userId, { mediaType, tmdbId }, undo.watchId)
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
