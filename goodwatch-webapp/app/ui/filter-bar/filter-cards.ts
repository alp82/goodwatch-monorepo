// The Filters sheet's cards by name, in order, and how the bar asks the sheet to open at one. Kept apart from the cards
// themselves, which load on first use.
import type { FilterName } from "~/domain/filter-state"

/** A card of the sheet. Released covers both the presets and the year range. */
export type CardKey = Exclude<
	FilterName,
	| "popularity"
	| "wishlist"
	| "notSeenYet"
	| "anime"
	| "legacy"
	| "content"
	| "years"
>

/** The cards in order: what it is, how good, where, when, then the finer and the personal ones. */
export const CARD_ORDER: CardKey[] = [
	"type",
	"genres",
	"moods",
	"minMatch",
	"minScore",
	"sourceScores",
	"scoreGap",
	"services",
	"released",
	"runtime",
	"themes",
	"styles",
	"people",
	"ageLimit",
	"productionCountries",
	"similarTo",
	"loved",
	"disliked",
]

/** The cards the sheet starts with, before anything is set. */
export const START_CARDS = new Set<CardKey>([
	"type",
	"moods",
	"minMatch",
	"minScore",
])
/** Cards whose long option lists start trimmed to the most used, with "+N more". */
export const TRIMMED = new Set<CardKey>(["services", "genres", "moods"])

/** Which card a chip of activeChips belongs to. */
export const cardOf = (group: FilterName): CardKey | null =>
	group === "content"
		? "ageLimit"
		: group === "years"
			? "released"
			: group === "anime"
				? "type"
				: group === "popularity" ||
						group === "wishlist" ||
						group === "notSeenYet" ||
						group === "legacy"
					? null
					: group

let sheetFocus: CardKey | null = null
/** Asks the sheet, when it next opens, to show and point at this filter's card (the phone's quick filter buttons). */
export function focusSheetOn(key: CardKey | null) {
	sheetFocus = key
}

/** The card the sheet was asked to open at, if any. */
export const askedFocus = () => sheetFocus
