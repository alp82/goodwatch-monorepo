// Which state icon the score pill ends with. Pure, so it is tested without the app.
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

/** The one state icon at the end of the score pill. */
export type PillMark = Exclude<WatchStatus, "seen"> | "want" | "seen"

/**
 * Which state icon the pill ends with: a show status other than Seen (Watching, On hold, Dropped), else the Wishlist
 * bookmark (a list row leaves it out where every row of the list is on the Wishlist; a poster card always shows
 * it), else Seen for a title Seen without a score. A score says Seen by itself, so a scored Seen title has no icon.
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
