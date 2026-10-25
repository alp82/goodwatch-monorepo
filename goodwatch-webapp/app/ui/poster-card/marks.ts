// What a poster says about the viewer's own standing with a title: their score, Wishlist, the watch state (a show's
// status, or Seen), and Not interested. Read from the member data; a guest's local actions land there too.
import {
	useIsNotInterested,
	useIsOnWishlist,
	useUserScore,
	useWatchState,
} from "~/hooks/useUserDataAccessors"
import type { Score } from "~/server/scores.server"
import type { WatchStateEntry } from "~/types/user-data"

export type WatchStatus = WatchStateEntry["state"]

export interface TitleMarks {
	score: Score | null
	want: boolean
	/** Null while the title is Not started. */
	status: WatchStatus | null
	hidden: boolean
}

export function useTitleMarks(
	mediaType: "movie" | "show",
	tmdbId: number,
): TitleMarks {
	const score = useUserScore(mediaType, tmdbId)?.score ?? null
	const want = useIsOnWishlist(mediaType, tmdbId)
	const status = useWatchState(mediaType, tmdbId)?.state ?? null
	const hidden = useIsNotInterested(mediaType, tmdbId)
	return { score, want, status, hidden }
}

/** The one state icon at the end of the score pill. */
export type PillMark = Exclude<WatchStatus, "seen"> | "want" | "seen"

/**
 * Which state icon the pill ends with: a show status other than Seen (Watching, On hold, Dropped), else the Wishlist
 * bookmark (left out where the whole list is the Wishlist), else Seen for a title Seen without a score. A score says
 * Seen by itself, so a scored Seen title has no icon.
 */
export function pillMark(
	marks: Pick<TitleMarks, "score" | "want" | "status">,
	skipWant = false,
): PillMark | null {
	if (marks.status && marks.status !== "seen") return marks.status
	if (marks.want && !skipWant) return "want"
	if (marks.status === "seen" && marks.score == null) return "seen"
	return null
}
