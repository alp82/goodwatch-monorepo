// What the browser expects the member data map to be right after an action, before the server has answered
// (docs/implementation/tracking/data-model.md, "The browser"). Outside a show's page the browser has the map only,
// so these are guesses from the map: the refetched member data replaces them. Pure, no clock.
import { type WatchLogEntry, summaryOf } from "~/domain/watch-log"
import type { Score } from "~/server/scores.server"
import {
	type ActionTimestamp,
	type MediaType,
	type UserData,
	type WatchStateEntry,
	type WishlistEntry,
	createMediaKey,
} from "~/types/user-data"

const seenEntry = (
	before: WatchStateEntry | undefined,
	change: Partial<WatchStateEntry>,
): WatchStateEntry => ({
	watchedAt: null,
	precision: "unknown",
	count: 0,
	pass: 1,
	episodesWatched: 0,
	furthest: null,
	lastActivityAt: null,
	...before,
	...change,
	state: "seen",
})

/** A movie that is Seen only through the watch its score owns: one undated watch. */
const byScoreAlone = (entry: WatchStateEntry | undefined) =>
	entry !== undefined && entry.count === 1 && entry.watchedAt === null

/**
 * The Seen button, as it works today: `add` marks the title Seen, `remove` takes that back.
 *
 * A watch takes the title off the Wishlist and off Not interested. A movie's press records one watch dated now,
 * which replaces the watch its score owns. A show's press makes it Seen; which episodes that ticks is the server's
 * to say. Taking it back leaves a rated movie Seen through its score, and removes a show's entry: the state the
 * press was made from comes with the refetched data.
 */
export function afterSeenPress(
	data: UserData | undefined,
	mediaType: MediaType,
	tmdbId: number,
	action: "add" | "remove",
	now: Date,
): UserData | undefined {
	if (!data) return data
	const key = createMediaKey(mediaType, tmdbId)
	const updated = {
		...data,
		watchState: { ...data.watchState },
		wishlist: { ...data.wishlist },
		notInterested: { ...data.notInterested },
	}
	const before = data.watchState[key]
	if (action === "add") {
		delete updated.notInterested[key]
		delete updated.wishlist[key]
		updated.watchState[key] =
			mediaType === "movie"
				? seenEntry(before, {
						watchedAt: now,
						precision: "moment",
						count: byScoreAlone(before) ? 1 : (before?.count ?? 0) + 1,
						lastActivityAt: now,
					})
				: seenEntry(before, { lastActivityAt: now })
		return updated
	}
	if (mediaType === "movie" && key in data.scores)
		updated.watchState[key] = seenEntry(undefined, { count: 1 })
	else delete updated.watchState[key]
	return updated
}

/**
 * A score set, changed or cleared. A score takes the title off Not interested. A rated movie is Seen: one without
 * a watch gets the watch its score owns and leaves the Wishlist, and clearing the score takes that watch away
 * again while a watch the member logged stays. A show's score changes no state.
 */
export function afterScore(
	data: UserData | undefined,
	mediaType: MediaType,
	tmdbId: number,
	score: Score | null,
	review: string | null,
	now: Date,
): UserData | undefined {
	if (!data) return data
	const key = createMediaKey(mediaType, tmdbId)
	const updated = {
		...data,
		scores: { ...data.scores },
		notInterested: { ...data.notInterested },
	}
	if (score === null) delete updated.scores[key]
	else {
		delete updated.notInterested[key]
		updated.scores[key] = { score, review, updatedAt: now }
	}
	if (mediaType !== "movie") return updated
	const before = data.watchState[key]
	if (score === null) {
		if (byScoreAlone(before)) {
			updated.watchState = { ...data.watchState }
			delete updated.watchState[key]
		}
		return updated
	}
	if (!before) {
		updated.watchState = {
			...data.watchState,
			[key]: seenEntry(undefined, { count: 1 }),
		}
		updated.wishlist = { ...data.wishlist }
		delete updated.wishlist[key]
	} else if (byScoreAlone(before) && key in data.wishlist) {
		// The server takes a movie off the Wishlist whenever its score's watch is its only watch.
		updated.wishlist = { ...data.wishlist }
		delete updated.wishlist[key]
	}
	return updated
}

/**
 * A movie's watch log after an action in it, as the browser expects it: the entry follows the log. The count, the
 * latest dated watch and the last activity are the log's; an empty log is a movie that is not Seen.
 *
 * `watched`: the action logged a watch, which takes the movie off the Wishlist and off Not interested. `back`: Undo
 * of the first watch puts the movie back where that watch took it from, with its place in the Wishlist.
 */
export function afterWatchLog(
	data: UserData | undefined,
	tmdbId: number,
	log: readonly WatchLogEntry[],
	change: {
		watched?: boolean
		back?: { wishlist?: WishlistEntry; notInterested?: ActionTimestamp }
	} = {},
): UserData | undefined {
	if (!data) return data
	const key = createMediaKey("movie", tmdbId)
	const updated = {
		...data,
		watchState: { ...data.watchState },
		wishlist: { ...data.wishlist },
		notInterested: { ...data.notInterested },
	}
	const summary = summaryOf(log)
	if (!summary) delete updated.watchState[key]
	else {
		// "Watched lately": the dated watches, and the undated ones that were not imported by when they were recorded.
		const activity = log
			.map(
				(watch) =>
					watch.at ?? (watch.origin === "import" ? null : watch.createdAt),
			)
			.filter((at): at is number => at !== null)
		updated.watchState[key] = seenEntry(data.watchState[key], {
			...summary,
			lastActivityAt: activity.length ? new Date(Math.max(...activity)) : null,
		})
	}
	if (change.watched) {
		delete updated.wishlist[key]
		delete updated.notInterested[key]
	}
	if (change.back?.wishlist) updated.wishlist[key] = change.back.wishlist
	if (change.back?.notInterested)
		updated.notInterested[key] = change.back.notInterested
	return updated
}
