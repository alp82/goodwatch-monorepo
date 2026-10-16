// Watch next: the top of the Wishlist under the person's chosen sort and moods. The sorts and tiers the server
// (server/watch-next.server.ts) and the page share. Pure and shared by the server and the browser.
//
// The sort keys appear in URLs (`sort=waiting`), so they never change; the labels live with the page. Best match,
// Newest, Top rated, and Popular carry the keys Discover uses (domain/filter-state.ts); Waiting longest and Last added
// exist only here.
import { filterStateFromParams } from "./filter-state"
import type { MoodKey } from "./moods"
import { tasteRefsOf, trimPicks } from "./taste-picker"
import type { StyleKey, ThemeKey } from "./themes-styles"

// Every sort reads a stored, populated field. Titles missing the value go last; ties go to the newest added.
export const WATCH_NEXT_SORTS = [
	"match", // Best match: taste match, highest first
	"waiting", // Waiting longest: added to the Wishlist earliest first
	"added", // Last added: added to the Wishlist most recently first
	"newest", // Newest: a film's release date, a show's last air date; dates still ahead count as missing
	"top", // Top rated: GoodWatch score
	"popular", // Popular: TMDB popularity; 0 counts as missing
] as const

export type WatchNextSort = (typeof WATCH_NEXT_SORTS)[number]

export const isWatchNextSort = (value: string): value is WatchNextSort =>
	(WATCH_NEXT_SORTS as readonly string[]).includes(value)

// Top rated was `sort=score` before it took Discover's key; links shared with the old key keep working.
const EARLIER_SORT_KEYS: Partial<Record<string, WatchNextSort>> = {
	score: "top",
}

/** The sort a URL names; null for none or an unknown one, which is the viewer's default sort. */
export function watchNextSortOf(
	value: string | null | undefined,
): WatchNextSort | null {
	if (!value) return null
	return isWatchNextSort(value) ? value : (EARLIER_SORT_KEYS[value] ?? null)
}

/**
 * What a person chooses on the page, as the URL carries it: `sort=waiting&moods=funny,scary&services=all`. With the
 * taste picker (#677), also `themes=crime&styles=slow&taste=movie-603`: up to three picks in all.
 */
export interface WatchNextChoice {
	/** Null: the viewer's default sort (Best match, or Last added without taste). */
	sort: WatchNextSort | null
	moods: MoodKey[]
	/** The taste picker's themes, styles, and taste groups (by key, see tasteRefsOf); empty without it. */
	themes: ThemeKey[]
	styles: StyleKey[]
	taste: string[]
	onMyServices: boolean
}

// On my services is on unless the URL says otherwise; without saved services the server leaves it off.
const CHOICE_DEFAULTS = { onMyServices: true, notSeenYet: false }

/** The choice from the URL. Moods and services read as the filter bar reads them (`moods`, `services=mine|all`). */
export function watchNextChoiceOf(params: URLSearchParams): WatchNextChoice {
	const filters = filterStateFromParams(params, CHOICE_DEFAULTS)
	const taste = tasteRefsOf(params.get("taste"))
	// Three picks at most, taste groups first: the groups stand in by their place in the URL while the rest is trimmed.
	const picks = trimPicks({
		moods: filters.moods,
		themes: filters.themes,
		styles: filters.styles,
		taste: taste.map((_, i) => i + 1),
	})
	return {
		sort: watchNextSortOf(params.get("sort")),
		...picks,
		taste: taste.slice(0, picks.taste.length),
		onMyServices: filters.onMyServices,
	}
}

/**
 * The stepped grid under the hero and its Then column, from large to small.
 * - Without a filter: upNext (4), soon (8), later (20), someday (the rest).
 * - With On my services or moods: upNext (4), soon (12), later (the rest of the titles that fit), then the titles one
 *   condition short (otherMoods with moods only, elsewhere with On my services only, close with both), then notTonight
 *   (fails both).
 * - With a taste group picked: closeToTaste (titles close to it that fit everything else) right after later, on My
 *   movies too.
 */
export type WatchNextTierKey =
	| "upNext"
	| "soon"
	| "later"
	| "someday"
	| "otherMoods"
	// The taste picker (#677): one pick short, when the picks go beyond moods.
	| "otherPicks"
	// With a taste group picked (#680): close to it, not in it, and fitting everything else. Right after the fits.
	| "closeToTaste"
	| "elsewhere"
	| "close"
	| "notTonight"
	// My movies (#385): everything that does not fit tonight, in one group.
	| "notTonightsFit"

export type WatchNextTierSize = "xl" | "lg" | "md" | "sm"

/** How many posters a tier shows before its "+N" button. */
export const TIER_CAPS: Record<WatchNextTierSize, number> = {
	xl: Number.POSITIVE_INFINITY,
	lg: Number.POSITIVE_INFINITY,
	md: 40,
	sm: 30,
}

/** Why Best match can't sort, or what to tell a guest whose Best match works. */
export type BestMatchPrompt =
	| "signUpToLearn" // a guest with fewer than 5 guest ratings: "Sign up so Best match can learn your taste"
	| "signUpToKeep" // a guest whose Best match works: "Sign up to keep your taste"
	| "rateMore" // fewer than 5 liked titles: "Rate a few more titles you love"
