// What the open page is about, for the Feedback tab's fix mode: the title page and the person page publish their own
// data here (the props they render), so the questions offer the page's real services, cast, episodes and credits.
// Other pages publish nothing and get the generic areas (areas.ts). Kept tiny: the pages import it eagerly; the Feedback
// drawer that reads it loads later.
import { useEffect, useSyncExternalStore } from "react"
/** A title page: the media as shown (country and language picks applied), its offers' country, the episode grid. */
export type TitleSubject = {
	kind: "title"
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	/** The country the page's offers are for. */
	country: string
	/** Release date (movie) or first air date (show), as the page has it (YYYY-MM-DD). */
	date: string | null
	seasons: number | null
	episodes: number | null
	/** The page's offers for `country`, one per service and offer type. */
	offers: { providerId: number; name: string; logo: string; type: string }[]
	cast: {
		id: number
		name: string
		character: string
		profilePath: string | null
	}[]
	castTotal: number
	scores: { id: string; label: string; value: string }[]
	/** The episode grid's seasons, as far as the page has them. */
	grid: {
		number: number
		episodes: {
			number: number
			name: string
			score: number | null
			canonicalSeason?: number
			canonicalNumber?: number
		}[]
	}[]
}

/** A person page: who it is and the credits the page shows. */
export type PersonSubject = {
	kind: "person"
	tmdbId: number
	name: string
	department: string | null
	firstYear: number | null
	lastYear: number | null
	titleCount: number
	credits: {
		tmdbId: number
		mediaType: "movie" | "tv"
		title: string
		year: string | null
		role: string
		/** Raw character or job represented by the displayed role, for correction routing. */
		currentRole: string
	}[]
}

export type FeedbackSubject = TitleSubject | PersonSubject

let current: FeedbackSubject | null = null
const listeners = new Set<() => void>()
const emit = () => {
	for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
	listeners.add(l)
	return () => {
		listeners.delete(l)
	}
}

/** Publishes the page's subject while the page is mounted (client only: effects don't run on the server). */
export function usePublishFeedbackSubject(subject: FeedbackSubject | null) {
	useEffect(() => {
		current = subject
		emit()
		return () => {
			if (current === subject) {
				current = null
				emit()
			}
		}
	}, [subject])
}

/** The subject of the page that is open now, or null. */
export const useFeedbackSubject = () =>
	useSyncExternalStore(
		subscribe,
		() => current,
		() => null,
	)
