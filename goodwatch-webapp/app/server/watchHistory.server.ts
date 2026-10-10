// Today's Seen button, and "I watched it": one press marks a title Seen, one more takes that back. Both go through
// the tracking writer (docs/implementation/tracking/data-model.md).
//
// A movie's press records one watch dated now; pressing again deletes the watches the member logged. A show's press
// is the state machine's Seen press, which records an undated watch for every aired regular episode, and pressing
// again takes exactly that press back. The watch log and the episode list that replace this toggle come later.
import { randomUUID } from "node:crypto"
import {
	type TrackedTitle,
	type TrackingResult,
	applyTrackingEvent,
	getMovieTracking,
	getShowTracking,
	settleMovie,
} from "~/server/tracking.server"
import { resetUserDataCache } from "~/server/userData.server"
import { canonicalTitleId } from "~/utils/title-identity"

interface UpdateWatchHistoryParams {
	user_id?: string
	tmdb_id: number | null
	media_type: "movie" | "show"
	action: "add" | "remove"
	/** The id the browser made for this press, so that a request sent twice records once. */
	action_id?: string
}

export interface UpdateWatchHistoryPayload {
	tmdb_id: number
	media_type: "movie" | "show"
	action: "add" | "remove"
	action_id?: string
}

export interface UpdateWatchHistoryResult {
	status: "success" | "failed"
}

export interface SeenMark {
	/**
	 * What the press recorded: the `watch_id` of a movie's watch, or the group id of a show's Seen press. Null when
	 * the title was Seen already and nothing was written.
	 */
	id: string | null
	/** The writer's answer; null when nothing was sent to it. */
	result: TrackingResult | null
}

const canonical = (title: TrackedTitle): TrackedTitle => ({
	mediaType: title.mediaType,
	tmdbId: canonicalTitleId(title.mediaType, title.tmdbId),
})

/**
 * Marks a title Seen with one press. A movie the member has logged a watch for, and a show that is Seen, are left
 * as they are, so a second press of "mark" never records a second watch. A movie that is Seen only through its
 * score gets the watch, which replaces the score's.
 */
export async function markSeen(
	userId: string,
	title: TrackedTitle,
	actionId: string = randomUUID(),
): Promise<SeenMark> {
	const target = canonical(title)
	if (target.mediaType === "movie") {
		const { log } = await getMovieTracking(userId, target.tmdbId)
		if (log.some((watch) => watch.origin !== "score"))
			return { id: null, result: null }
		const result = await applyTrackingEvent(
			userId,
			target,
			{ type: "watch" },
			actionId,
		)
		return { id: result.status === "applied" ? actionId : null, result }
	}
	const { state } = await getShowTracking(userId, target.tmdbId)
	if (state?.state === "seen") return { id: null, result: null }
	const result = await applyTrackingEvent(
		userId,
		target,
		{ type: "pressSeen" },
		actionId,
	)
	return { id: result.status === "applied" ? actionId : null, result }
}

/**
 * Takes Seen back. With `only`, takes back just what that press recorded and leaves a watch made since. Answers
 * whether anything was removed.
 *
 * A movie keeps the watch its score owns, so a rated movie stays Seen. A show returns to the state it was pressed
 * from; a show that became Seen another way has no press to take back.
 */
export async function unmarkSeen(
	userId: string,
	title: TrackedTitle,
	only?: string,
): Promise<boolean> {
	const target = canonical(title)
	if (target.mediaType === "movie") {
		const { log } = await getMovieTracking(userId, target.tmdbId)
		const mine = log.filter(
			(watch) =>
				watch.origin !== "score" &&
				(only === undefined || watch.watch_id === only),
		)
		let removed = false
		for (const watch of mine) {
			const result = await applyTrackingEvent(userId, target, {
				type: "deleteWatch",
				watchId: watch.watch_id,
			})
			removed ||= result.deleted.includes(watch.watch_id)
		}
		// A movie that is Seen through a score's watch and has no score: the score was cleared where no settle
		// followed, as by the build before the watch log between the migration and its second run. The movie rule
		// removes that watch. For a rated movie it changes nothing.
		if (!mine.length && only === undefined && log.length) {
			const settled = await settleMovie(userId, target.tmdbId)
			if (settled.deleted.length) {
				await resetUserDataCache({ user_id: userId })
				removed = true
			}
		}
		return removed
	}
	const { state } = await getShowTracking(userId, target.tmdbId)
	if (state?.state !== "seen" || !state.seen_press_group) return false
	if (only !== undefined && state.seen_press_group !== only) return false
	const result = await applyTrackingEvent(userId, target, { type: "undoSeen" })
	return result.status === "applied"
}

/** The Seen button's endpoint: `add` marks the title Seen, `remove` takes it back. */
export const updateWatchHistory = async ({
	user_id,
	tmdb_id,
	media_type,
	action,
	action_id,
}: UpdateWatchHistoryParams): Promise<UpdateWatchHistoryResult> => {
	const failed: UpdateWatchHistoryResult = { status: "failed" }
	if (!user_id || !tmdb_id) return failed
	if (media_type !== "movie" && media_type !== "show") return failed
	const title: TrackedTitle = { mediaType: media_type, tmdbId: Number(tmdb_id) }
	if (action === "add") {
		const { id, result } = await markSeen(
			user_id,
			title,
			typeof action_id === "string" ? action_id : undefined,
		)
		// Seen already is what the press asked for.
		return id !== null || result === null ? { status: "success" } : failed
	}
	if (action === "remove")
		return (await unmarkSeen(user_id, title)) ? { status: "success" } : failed
	return failed
}
