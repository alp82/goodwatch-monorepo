import type { WatchStateEntry } from "~/domain/tracking/storage"
import type { Score } from "~/server/scores.server"

export type { WatchStateEntry }

// Media type union
export type MediaType = "movie" | "show"

// Composite key: "movie-123" or "show-456"
export type MediaKey = `${MediaType}-${number}`

// Individual action data structures
export interface ScoreData {
	score: Score
	review: string | null
	updatedAt: Date
}

export interface ActionTimestamp {
	updatedAt: Date
}

// When the title was added to the Wishlist. Adding it again keeps the first time; removing and adding starts anew.
export interface WishlistEntry extends ActionTimestamp {
	createdAt: Date
}

// User data structure - grouped by action type
export interface UserData {
	scores: Record<MediaKey, ScoreData>
	wishlist: Record<MediaKey, WishlistEntry>
	/**
	 * Where the member stands with each title whose state is not Not started, and what their watch log says about it
	 * (docs/implementation/tracking/data-model.md). Empty for a guest.
	 */
	watchState: Record<MediaKey, WatchStateEntry>
	favorites: Record<MediaKey, ActionTimestamp>
	skipped: Record<MediaKey, ActionTimestamp>
	notInterested: Record<MediaKey, ActionTimestamp>
	[key: string]: unknown
}

// Helper to create media key
export const createMediaKey = (mediaType: MediaType, tmdbId: number): MediaKey => {
	return `${mediaType}-${tmdbId}`
}

// Helper to parse media key
export const parseMediaKey = (key: MediaKey): { mediaType: MediaType; tmdbId: number } => {
	const [mediaType, tmdbId] = key.split("-")
	return {
		mediaType: mediaType as MediaType,
		tmdbId: Number.parseInt(tmdbId, 10),
	}
}

type SeenSource = Pick<UserData, "watchState" | "scores"> | undefined

/**
 * Counts as Seen, for a card's seen flag and the Not seen yet filter: the state Seen, or a score. A rated movie has
 * the state too; a rated show counts through its score alone.
 */
export const isSeen = (data: SeenSource, key: MediaKey): boolean =>
	data?.watchState[key]?.state === "seen" || (data ? key in data.scores : false)

/** The titles that count as Seen. */
export const seenKeys = (data: SeenSource): MediaKey[] => {
	if (!data) return []
	const keys = new Set(Object.keys(data.scores) as MediaKey[])
	for (const [key, entry] of Object.entries(data.watchState))
		if (entry.state === "seen") keys.add(key as MediaKey)
	return [...keys]
}

/**
 * Changes whenever a title enters, leaves or changes its watch state, or gets another watch: what a query that
 * depends on the watch state puts in its key. Short, also for a member with a thousand entries.
 */
export const watchStateSignature = (watchState: UserData["watchState"]): string => {
	const tally: Record<string, number> = {}
	let watches = 0
	for (const entry of Object.values(watchState)) {
		tally[entry.state] = (tally[entry.state] ?? 0) + 1
		watches += entry.count
	}
	return `${Object.keys(tally)
		.sort()
		.map((state) => `${state}:${tally[state]}`)
		.join(",")}/${watches}`
}

/**
 * Two builds meet for a moment at the deploy that replaced `watched` by `watchState`
 * (docs/implementation/tracking/switch-to-the-watch-state.md). Both helpers go with the retired table.
 *
 * `withLegacyWatched`: what the server answers to a page that was loaded from the build before. That page reads
 * `watched` on every card and would fail without it, so the answer still carries it: the titles in the state Seen.
 */
export const withLegacyWatched = (data: UserData): UserData => ({
	...data,
	watched: Object.fromEntries(
		Object.entries(data.watchState)
			.filter(([, entry]) => entry.state === "seen")
			.map(([key, entry]) => [
				key,
				{ updatedAt: entry.watchedAt ?? entry.lastActivityAt ?? new Date(0) },
			]),
	),
})

/** `watchState` is there also when the build before answered a page of this one. */
export const withWatchState = (data: UserData): UserData =>
	data.watchState ? data : { ...data, watchState: {} }

/** The member data entries whose keys every "already acted on" filter in the browser excludes. */
export const ACTED_ON = ["scores", "skipped", "watchState", "wishlist", "notInterested"] as const
