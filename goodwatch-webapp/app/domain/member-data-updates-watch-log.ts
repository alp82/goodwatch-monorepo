// What the browser expects the member data map to be right after an action in a movie's watch log
// (docs/implementation/tracking/data-model.md, "The browser"). It belongs with member-data-updates.ts and is a file
// of its own because that one is in the first view of the home and title pages, and this is needed only once a log
// is used.
import type { WatchLogEntry } from "~/domain/watch-log"
import {
	type ActionTimestamp,
	type UserData,
	type WatchStateEntry,
	type WishlistEntry,
	createMediaKey,
} from "~/types/user-data"

// The same entry as `seenEntry` in member-data-updates.ts. It is written out here and not imported: a second
// importer would move that module into the scripts of every page (the build puts small shared modules there).
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
	if (!log.length) delete updated.watchState[key]
	else {
		// The latest dated watch. Of two at the same instant, the one with a time says how exact it is.
		let latest: WatchLogEntry | null = null
		// "Watched lately": the dated watches, and the undated ones that were not imported by when they were recorded.
		let activity: number | null = null
		for (const watch of log) {
			const active =
				watch.at ?? (watch.origin === "import" ? null : watch.createdAt)
			if (active !== null && (activity === null || active > activity))
				activity = active
			if (watch.at === null) continue
			const later = latest === null || watch.at > (latest.at ?? 0)
			const exact = watch.at === latest?.at && watch.precision === "moment"
			if (later || exact) latest = watch
		}
		updated.watchState[key] = seenEntry(data.watchState[key], {
			count: log.length,
			watchedAt: latest?.at == null ? null : new Date(latest.at),
			precision: latest?.precision ?? "unknown",
			lastActivityAt: activity === null ? null : new Date(activity),
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
