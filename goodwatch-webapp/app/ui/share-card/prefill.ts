// "Share your top 5": which rated titles start a new list, and which prompt fits them.
// Shared by the server (signed-in ratings) and the browser (guest ratings), so both order titles the same way.
import { LIST_PROMPTS, LIST_SIZE, type MediaType, titleKey } from "./model"

export interface RatedTitle {
	media_type: MediaType
	tmdb_id: number
	score: number
	/** When the rating was given or last changed, in epoch milliseconds. */
	ratedAt: number
}

// A few extra candidates cover rated titles the catalog can't show (no title yet, or removed).
export const PREFILL_CANDIDATES = LIST_SIZE * 2

/**
 * Highest score first. Ties go to the more recent rating, since it reflects current taste,
 * then to the lower TMDB id so the order never changes between visits.
 */
export function rankRatings(ratings: RatedTitle[]): RatedTitle[] {
	return [...ratings].sort(
		(a, b) =>
			b.score - a.score || b.ratedAt - a.ratedAt || a.tmdb_id - b.tmdb_id,
	)
}

export const prefillKeys = (ratings: RatedTitle[]) =>
	rankRatings(ratings)
		.slice(0, PREFILL_CANDIDATES)
		.map((r) => titleKey(r.media_type, r.tmdb_id))

const promptById = (id: string) => LIST_PROMPTS.find((p) => p.id === id)

/**
 * The prompt for a prefilled list: "My top 5 movies of all time" for movies, the shows prompt for shows.
 * A mix of both matches no prompt, so it gets its own title and no prompt.
 */
export function prefillPrompt(types: MediaType[]): {
	promptId: string | null
	title: string
} {
	const onlyShows = types.length > 0 && types.every((t) => t === "show")
	const mixed = types.includes("movie") && types.includes("show")
	if (mixed) return { promptId: null, title: "My top 5 of all time" }
	const prompt = promptById(onlyShows ? "binge" : "all-time")
	return {
		promptId: prompt?.id ?? null,
		title: prompt?.title ?? "My top 5 of all time",
	}
}
