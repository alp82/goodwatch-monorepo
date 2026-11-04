// A show's TMDB status as the title page's header says it: one word and a tone for the chip beside the age box
// (ShowStatus.tsx). Running shows (Returning, In production) are "live", announced ones "soon", finished ones "over",
// canceled ones "cut". A status TMDB adds later shows nothing until it is named here.
import type { MovieResult, ShowResult } from "~/server/types/details-types"

export type ShowStatusTone = "live" | "soon" | "over" | "cut"

export interface ShowStatusWords {
	/** The chip's word. */
	word: string
	tone: ShowStatusTone
	/** The chip's tooltip. */
	says: string
}

const STATUS: Record<string, ShowStatusWords> = {
	"Returning Series": {
		word: "Returning",
		tone: "live",
		says: "More seasons are coming",
	},
	"In Production": {
		word: "In production",
		tone: "live",
		says: "Being made now",
	},
	Planned: { word: "Planned", tone: "soon", says: "Announced, not made yet" },
	Pilot: { word: "Pilot", tone: "soon", says: "Only a pilot so far" },
	Ended: { word: "Ended", tone: "over", says: "Finished, no more seasons" },
	Canceled: {
		word: "Canceled",
		tone: "cut",
		says: "Canceled, no more seasons",
	},
}

/** The words for a show's status, or null for a movie, a show without one, or a status not named above. */
export function showStatusOf(
	media: MovieResult | ShowResult,
): ShowStatusWords | null {
	if (media.mediaType !== "show") return null
	const raw = media.details.status
	return raw ? (STATUS[raw] ?? null) : null
}
