// What a list row ends in, the same on every list of titles: the score pill (GoodWatch, the viewer's "you N", one
// state icon) in its M look, and on another member's pages that member's filled score square after it. The row's
// thumbnail stays clean; the viewer's own services sit in the row's text line (`RowLogos`).
//
// A list reads the viewer's member data once (`useRowMarks`) instead of four hooks per row: a page of 250 rows would
// otherwise subscribe a thousand times. A guest's marks come from this browser after hydration, so the server's HTML
// (and a crawler) shows the GoodWatch score alone, and the first browser render matches it.
import { useCallback } from "react"
import { useUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"
import { type MediaType, createMediaKey } from "~/types/user-data"
import { OwnerScore } from "~/ui/poster-card/OwnerScore"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import {
	type PillMark,
	type TitleMarks,
	pillMark,
} from "~/ui/poster-card/pill-mark"
import { type PosterService, ServiceLogos } from "~/ui/poster-card/services"

const NO_MARKS: TitleMarks = {
	score: null,
	want: false,
	status: null,
	hidden: false,
}

/** The viewer's marks for any title of the list, from one read of the member data. */
export function useRowMarks(): (
	mediaType: MediaType,
	tmdbId: number,
) => TitleMarks {
	const { data } = useUserData()
	return useCallback(
		(mediaType, tmdbId) => {
			if (!data) return NO_MARKS
			const key = createMediaKey(mediaType, tmdbId)
			return {
				score: data.scores[key]?.score ?? null,
				want: key in data.wishlist,
				status: data.watchState[key]?.state ?? null,
				hidden: key in data.notInterested,
			}
		},
		[data],
	)
}

/** The pill's state icon for a row: none where every row of the list says the same (`skip`). */
export const rowMark = (
	marks: TitleMarks,
	skip: { want?: boolean; all?: boolean } = {},
): PillMark | null => (skip.all ? null : pillMark(marks, skip.want))

export function RowScores({
	goodwatch,
	score,
	mark,
	owner,
	ownerName,
	size = "M",
	className = "",
}: {
	goodwatch: number | null | undefined
	/** The viewer's own score. */
	score: Score | null
	mark: PillMark | null
	/** Another member's score, on their pages only; the viewer's own pages pass none. */
	owner?: number | null
	ownerName?: string | null
	size?: "M" | "L"
	className?: string
}) {
	return (
		<span
			className={`flex shrink-0 items-center gap-2 ${className}`}
			data-row-scores=""
		>
			<ScorePill goodwatch={goodwatch} score={score} mark={mark} size={size} />
			{owner != null && (
				<OwnerScore score={owner as Score} name={ownerName} size={size} />
			)}
		</span>
	)
}

/** The viewer's own services in a row's text line; the one the title just arrived on leads, ringed in sky blue. */
export function RowLogos({
	services,
	newOn,
	max = 2,
}: {
	services: readonly PosterService[] | null | undefined
	newOn?: number | null
	max?: number
}) {
	if (!services?.length) return null
	return (
		<ServiceLogos
			services={services}
			size="S"
			max={max}
			newOn={newOn}
			className="shrink-0"
		/>
	)
}
