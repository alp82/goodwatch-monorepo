// Letterboxd's score of a title. Letterboxd rates movies only, so a show never has one, even when its details carry
// stray fields. The details read the fields from the movie table (server/title-details-fields.ts).

export type LetterboxdFields = {
	letterboxd_url?: string | null
	letterboxd_user_score_original?: number | null
	letterboxd_user_score_rating_count?: number | null
}

export type LetterboxdScore = {
	/** Letterboxd's average, 0.5-5 stars. */
	stars: number
	url: string | null
	count: number | null
}

/** A title as its details carry it: only a movie can have Letterboxd fields. */
export type LetterboxdTitle =
	| { mediaType: "movie"; details: LetterboxdFields }
	| { mediaType: "show" }

/** The movie's Letterboxd score, or null for a show or a movie without one. */
export function letterboxdScore(
	title: LetterboxdTitle,
): LetterboxdScore | null {
	if (title.mediaType !== "movie") return null
	const { details } = title
	const stars = details.letterboxd_user_score_original
	if (!stars) return null
	return {
		stars,
		url: details.letterboxd_url || null,
		count: details.letterboxd_user_score_rating_count ?? null,
	}
}

/** Stars with one decimal, as Letterboxd's film pages show them: 4.37 reads 4.4. */
export const letterboxdStars = (stars: number) => stars.toFixed(1)

const compact = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
})

/** The chip's tooltip: "Letterboxd: 4.4 out of 5 from 3.8M ratings". */
export function letterboxdTitle(stars: string, count: number | null) {
	const from = count ? ` from ${compact.format(count)} ratings` : ""
	return `Letterboxd: ${stars} out of 5${from}`
}
