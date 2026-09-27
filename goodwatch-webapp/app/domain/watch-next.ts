// Watch next: the top of the Wishlist under the person's chosen sort and moods. The sorts and tiers the server
// (server/watch-next.server.ts) and the page share. Pure and shared by the server and the browser.
//
// The sort keys appear in URLs (`sort=waiting`), so they never change; the labels live with the page.

// Every sort reads a stored, populated field. Titles missing the value go last; ties go to the newest added.
export const WATCH_NEXT_SORTS = [
	"match", // Best match: taste match, highest first
	"waiting", // Waiting longest: added to the Wishlist earliest first
	"added", // Last added: added to the Wishlist most recently first
	"newest", // Newest release: a film's release date, a show's last air date; dates still ahead count as missing
	"score", // Top rated: GoodWatch score
	"popular", // Popular now: TMDB popularity; 0 counts as missing
] as const

export type WatchNextSort = (typeof WATCH_NEXT_SORTS)[number]

export const isWatchNextSort = (value: string): value is WatchNextSort =>
	(WATCH_NEXT_SORTS as readonly string[]).includes(value)

/**
 * The stepped grid under the hero and its Then column, from large to small.
 * - Without a filter: upNext (4), soon (8), later (20), someday (the rest).
 * - With On my services or moods: upNext (4), soon (12), later (the rest of the titles that fit), then the titles one
 *   condition short (otherMoods with moods only, elsewhere with On my services only, close with both), then notTonight
 *   (fails both).
 */
export type WatchNextTierKey =
	| "upNext"
	| "soon"
	| "later"
	| "someday"
	| "otherMoods"
	| "elsewhere"
	| "close"
	| "notTonight"

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
