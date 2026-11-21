// The copy deck's shapes. Every text here was written by hand, once; nothing is generated at request time.
// "all" is movies and shows together.
export type Kind = "movies" | "shows" | "all"

export interface PlaceCopy {
	/** One line for a card: under 60 characters. */
	short: string
	/** Two or three sentences for the top of the place's page. */
	lede: string
}

/**
 * One text for both kinds, or one each where the honest text differs. A missing kind has no page. `all` is the text
 * for movies and shows together, written for every place both kinds have: it never says "movies" alone.
 */
export type Entry = PlaceCopy | { movies?: PlaceCopy; shows?: PlaceCopy; all?: PlaceCopy }

export type Deck = Record<string, Entry>
