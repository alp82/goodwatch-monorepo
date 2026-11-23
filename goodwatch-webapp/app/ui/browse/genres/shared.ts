// What the genres pickers share: a title small enough to send by the
// hundred, and the words for how much of something a genre has. Pure: loader and browser.
import type { PlaceRef, ShowTitle, TraitWord } from "~/domain/browse/types"

/** A title as a poster with its name: the least a tile needs. */
export interface Lite {
	key: string
	to: string
	title: string
	year: number | null
	poster: string | null
	score: number | null
}

export const lite = (t: ShowTitle): Lite => ({
	key: String(t.card.key),
	to: t.to,
	title: t.card.title,
	year: t.card.release_year,
	poster: t.card.poster_path,
	score: t.card.goodwatch_overall_score_normalized_percent,
})

/** A trait word with only what a colored word needs. */
export interface Word {
	word: string
	color: string
}
export const word = (t: TraitWord): Word => ({ word: t.word, color: t.color })

export interface GenreHead {
	place: PlaceRef
	/** The copy deck's one line. */
	short: string | null
	/** "Comedies", "Horror movies". */
	plural: string
}

/** Lowercases the first letter, unless the word is an abbreviation ("TV movies"). */
export const low = (s: string) =>
	/^[A-Z][A-Z]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1)

/**
 * Under movies and shows together the atlas merges the genres one kind splits ("Science Fiction", "Fantasy" and the
 * shows' "Sci-Fi & Fantasy" are one place), so no genre reads like a double any more and none needs a mark.
 */
const ONLY: Record<string, "movies" | "shows"> = {}
export const onlyOf = (kind: string, slug: string) => (kind === "all" ? (ONLY[slug] ?? null) : null)

/** A genre and the mood that says the same thing: "Romantic romances" is not a place worth pointing to. */
const TWIN: Record<string, string[]> = {
	romance: ["romantic"],
	comedy: ["funny"],
	horror: ["scary"],
	mystery: ["mysterious"],
	crime: ["mysterious"],
	history: ["history"],
	thriller: ["thrilling"],
}
export const twins = (genre: string, mood: string) => TWIN[genre]?.includes(mood) ?? false
