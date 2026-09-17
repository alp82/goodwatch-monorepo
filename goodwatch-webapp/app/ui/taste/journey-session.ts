// Throwaway, tab-local discovery context for the connected-journey prototype.
import type { ScoringMedia } from "~/ui/scoring/types"
import type { Recommendation } from "./types"
export type JourneyView = "picks" | "rate" | "wishlist"
export type JourneySession = {
	view?: JourneyView
	ratingQueue?: ScoringMedia[]
	selectedMedia?: ScoringMedia | null
	picks?: Recommendation[]
	picksSlide?: number
	wishlistSlide?: number
	scrollY?: number
}
const key = "prototype_journey_context"
export function readJourney(): JourneySession {
	if (typeof window === "undefined") return {}
	try {
		return JSON.parse(sessionStorage.getItem(key) || "{}")
	} catch {
		return {}
	}
}
export function rememberJourney(update: Partial<JourneySession>) {
	try {
		sessionStorage.setItem(key, JSON.stringify({ ...readJourney(), ...update }))
	} catch {
		/* Preview still works without browser storage. */
	}
}
export const journeyTitleHref = (
	media: Pick<ScoringMedia, "media_type" | "tmdb_id">,
) => `/${media.media_type}/${media.tmdb_id}?prototype=journey`
export const journeyTasteHref = (view?: JourneyView) =>
	`/taste/quiz?prototype=journey${view ? `&view=${view}` : ""}`
