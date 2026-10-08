// A show's entry in the member data map, as its page keeps it up to date (docs/implementation/tracking/data-model.md,
// "The browser"). It lives apart from domain/member-data-updates.ts, which every page loads: only the show page of a
// member who tracks needs this.
import {
	type UserData,
	type WatchStateEntry,
	createMediaKey,
} from "~/types/user-data"

const sameEntry = (a: WatchStateEntry | undefined, b: WatchStateEntry) =>
	a !== undefined &&
	a.state === b.state &&
	a.pass === b.pass &&
	a.count === b.count &&
	a.episodesWatched === b.episodesWatched &&
	a.precision === b.precision &&
	String(a.furthest) === String(b.furthest) &&
	(a.watchedAt?.valueOf() ?? null) === (b.watchedAt?.valueOf() ?? null) &&
	(a.lastActivityAt?.valueOf() ?? null) ===
		(b.lastActivityAt?.valueOf() ?? null)

/**
 * A show's tracking changed on its page, where the browser holds the show's rows and so knows the entry exactly:
 * the show's `watchState` entry, or null while the show is Not started. A show in any other state is on neither
 * the Wishlist nor Not interested. The same map comes back when nothing changes.
 */
export function afterShowTracking(
	data: UserData | undefined,
	tmdbId: number,
	entry: WatchStateEntry | null,
): UserData | undefined {
	if (!data) return data
	const key = createMediaKey("show", tmdbId)
	if (entry === null) {
		if (!(key in data.watchState)) return data
		const watchState = { ...data.watchState }
		delete watchState[key]
		return { ...data, watchState }
	}
	if (
		sameEntry(data.watchState[key], entry) &&
		!(key in data.wishlist) &&
		!(key in data.notInterested)
	)
		return data
	const updated = {
		...data,
		watchState: { ...data.watchState, [key]: entry },
		wishlist: { ...data.wishlist },
		notInterested: { ...data.notInterested },
	}
	delete updated.wishlist[key]
	delete updated.notInterested[key]
	return updated
}
