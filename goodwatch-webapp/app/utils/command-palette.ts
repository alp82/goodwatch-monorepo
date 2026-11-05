import { canonicalMediaTitle } from "./media-presentation"
import type { PresentedMedia } from "~/utils/media-presentation"
// What the command palette's server lookup and the palette in the browser share: the title row, and how typed text
// becomes the prefix the lookup (and its cache) keys on.
import type { MediaType } from "~/types/user-data"
import { titleToDashed } from "~/utils/helpers"

/** Shorter text matches too much to be useful; the palette still offers "Search for …". */
export const MIN_PREFIX_CHARS = 2
const MAX_PREFIX_CHARS = 80

export interface PaletteTitle extends PresentedMedia {
	mediaType: MediaType
	tmdbId: number
	title: string
	year: string
	posterPath: string | null
	/** The localized name the text matched, when it matched by one and not by the title. */
	matchedAlias?: { text: string; language: string }
}

/** The lookup's answer: the titles to show, and about how many more match (a guess, for "Show 120 more"). */
export type PaletteTitles = {
	titles: PaletteTitle[]
	more: number
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
	`/${title.mediaType}/${title.tmdbId}-${titleToDashed(canonicalMediaTitle(title))}`

// ---------------------------------------------------------------- grouped answers

/** The kinds of matches the palette groups, in the order it shows them. Pages are matched in the browser. */
export const PALETTE_GROUP_ORDER = [
	"movies",
	"shows",
	"people",
	"tropes",
	"moods",
	"genres",
	"sequels",
	"services",
	"lists",
	"members",
	"blog",
] as const
export type PaletteGroupKey = (typeof PALETTE_GROUP_ORDER)[number]

export interface PaletteItem {
	/** Unique within the answer, e.g. "person-287". */
	key: string
	label: string
	/** The second line; left out when it would only repeat the group's name. */
	sub?: string
	href: string
	image?: {
		kind: "poster" | "portrait" | "logo" | "avatar" | "hue"
		path?: string
		hue?: string
	}
	/** Movies and shows: everything the poster card needs. */
	title?: PaletteTitle
	/** How well the text matches, 0 to 1 (an exact name is 1); orders the group. */
	match: number
}

export interface PaletteGroup {
	key: PaletteGroupKey
	label: string
	total: number
	/** The total is an estimate. */
	estimated?: boolean
	/** Up to twelve, best first; the panel decides how many it shows. */
	items: PaletteItem[]
	/** The group's full page ("All ›"); absent when there is none. */
	href?: string
}

/** GET /api/command-palette?q= answers the old title fields and the groups (fixed order, empty groups left out). */
export type PaletteAnswer = PaletteTitles & { groups: PaletteGroup[] }

/** GET /api/command-palette-start: what the palette shows before anything is typed. */
export interface PaletteStart {
	forYou:
		| {
				state: "picks"
				tiles: { label: string; href: string; titles: PaletteTitle[] }[]
		  }
		| {
				state: "rate" | "warming" | "guest"
				message: string
				cta: { label: string; href: string }
		  }
	trending: PaletteTitle[]
}
