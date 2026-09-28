// What the command palette's server lookup and the palette in the browser share: the title row, and how typed text
// becomes the prefix the lookup (and its cache) keys on.
import type { MediaType } from "~/types/user-data"
import { titleToDashed } from "~/utils/helpers"

/** Shorter text matches too much to be useful; the palette still offers "Search for …". */
export const MIN_PREFIX_CHARS = 2
const MAX_PREFIX_CHARS = 80

export interface PaletteTitle {
	mediaType: MediaType
	tmdbId: number
	title: string
	year: string
	posterPath: string | null
}

/** The prefix the lookup and its cache key use: lowercase, trimmed, one space between words, at most 80 characters. */
export function normalizePrefix(text: string): string {
	return text
		.normalize("NFC")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_PREFIX_CHARS)
		.trim()
}

/** The title page. */
export const paletteTitlePath = (title: PaletteTitle) =>
	`/${title.mediaType}/${title.tmdbId}-${titleToDashed(title.title)}`
