// A movie's watch log for its page and its cards: the read, and what a member does in the log
// (docs/implementation/tracking/data-model.md, Q4 and the movie rows of "Per action"). Every write goes through the
// tracking writer; this module names the log's actions, answers each with the log as it is afterwards, and gives
// Undo of the first watch its Wishlist place back.
import {
	type LoggedWhen,
	type WatchLogEntry,
	type WatchWhen,
	orderWatches,
} from "~/domain/watch-log"
import { updateNotInterested } from "~/server/not-interested.server"
import {
	type RestoredWatch,
	type TrackedTitle,
	type TrackingAction,
	applyTrackingEvent,
	getMovieTracking,
} from "~/server/tracking.server"
import { updateWishList } from "~/server/wishList.server"
import { query } from "~/utils/crate"

/** What a member does in a movie's watch log. */
export type WatchLogAction =
	/** One tap on Seen, "Watched it again", or "I watched it" on a movie that is Seen through its score. */
	| { type: "watch"; watchId: string; when?: WatchWhen }
	| { type: "editDate"; watchId: string; when: LoggedWhen }
	/**
	 * Deletes one watch. `back`: Undo of the first watch, which took the movie off the Wishlist or off Not
	 * interested, hands back what it took.
	 */
	| {
			type: "delete"
			watchId: string
			back?: { wantToSeeAddedAt?: string | null; notInterested?: boolean }
	  }
	| { type: "removeAll" }
	/** Undo of a delete: the rows as the log showed them. */
	| { type: "restore"; rows: RestoredEntry[] }

export type RestoredEntry = Pick<
	WatchLogEntry,
	"id" | "at" | "precision" | "importId" | "createdAt"
> & { origin: "single" | "import" }

export interface WatchLogAnswer {
	status: "applied" | "refused"
	/** Why nothing was written, in member words. */
	refused: string | null
	/** The log after the action, or as it stays after a refusal. */
	watches: WatchLogEntry[]
}

/**
 * The member's watches of a movie, dated ones newest first and the undated ones below. A rated movie without a
 * watch has one row, the one its score owns. As fresh as the member's last write, which ends with a refresh.
 */
export async function getMovieWatchLog(
	userId: string,
	movieId: number,
): Promise<WatchLogEntry[]> {
	const { log } = await getMovieTracking(userId, movieId)
	const imports = [
		...new Set(log.flatMap((row) => (row.import_id ? [row.import_id] : []))),
	]
	const sources = new Map<string, string>()
	if (imports.length) {
		const rows = await query<{ id: string; source: string }>(
			`SELECT id, source FROM user_import WHERE user_id = ? AND id IN (${imports.map(() => "?").join(", ")})`,
			[userId, ...imports],
		)
		for (const row of rows) sources.set(row.id, row.source)
	}
	return orderWatches(
		log.map((row) => ({
			id: row.watch_id,
			at: row.watched_at,
			precision: row.watched_at_precision,
			origin:
				row.origin === "score" || row.origin === "import"
					? row.origin
					: "single",
			importId: row.import_id,
			source: row.import_id ? (sources.get(row.import_id) ?? null) : null,
			createdAt: row.created_at,
		})),
	)
}

const event = (action: WatchLogAction): TrackingAction => {
	switch (action.type) {
		case "watch":
			return { type: "watch", when: action.when }
		case "editDate":
			return {
				type: "editWatchDate",
				watchId: action.watchId,
				when: action.when,
			}
		case "delete":
			return { type: "deleteWatch", watchId: action.watchId }
		case "removeAll":
			return { type: "removeWatches" }
		case "restore":
			return {
				type: "restoreWatches",
				rows: action.rows.map(
					(row): RestoredWatch => ({
						watchId: row.id,
						watchedAt: row.at,
						precision: row.precision,
						origin: row.origin,
						importId: row.importId,
						createdAt: row.createdAt,
					}),
				),
			}
	}
}

/** Applies one action of the log to the member's own log of the movie, and answers with the log afterwards. */
export async function applyWatchLogAction(
	userId: string,
	movieId: number,
	action: WatchLogAction,
): Promise<WatchLogAnswer> {
	const title: TrackedTitle = { mediaType: "movie", tmdbId: movieId }
	const result = await applyTrackingEvent(
		userId,
		title,
		event(action),
		action.type === "watch" ? action.watchId : undefined,
	)
	// Undo of the first watch: the movie goes back where that watch took it from. Only when the watch was there to
	// delete and the movie is no longer Seen, so sending it twice or for another watch adds nothing.
	if (
		action.type === "delete" &&
		action.back &&
		result.status === "applied" &&
		result.deleted.includes(action.watchId) &&
		result.state === null
	) {
		const { wantToSeeAddedAt, notInterested } = action.back
		if (wantToSeeAddedAt) {
			const addedAt = new Date(wantToSeeAddedAt)
			await updateWishList({
				user_id: userId,
				tmdb_id: movieId,
				media_type: "movie",
				action: "add",
				// A time in the future would sort first in Last added forever; it can only come from a tampered request.
				addedAt: addedAt.getTime() <= Date.now() ? addedAt : undefined,
			})
		} else if (notInterested)
			await updateNotInterested({
				user_id: userId,
				tmdb_id: movieId,
				media_type: "movie",
				action: "add",
			})
	}
	return {
		status: result.status,
		refused: result.refused,
		watches: await getMovieWatchLog(userId, movieId),
	}
}
