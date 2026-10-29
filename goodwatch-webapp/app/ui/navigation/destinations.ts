// Where a search goes, and which of the site's main places the current page is: the command palette reads this for
// "You're here" and for the line that says what is up next. The areas and their tabs live in ./areas.ts.
import { watchPlaceOf } from "./areas.ts"

export type DestinationKey =
	| "home"
	// Watch's three tabs: Up next (shows), Ready to watch (movies), Recommendations (For you).
	| "upNext"
	| "ready"
	| "forYou"
	// Explore's places.
	| "discover"
	| "new"
	| "hot"
	| "movies"
	| "shows"
	| "people"
	| "explorer"
	// The viewer's own Taste: their profile, or /taste without a handle.
	| "taste"

/** Where a search for a query goes: Discover's search mode (`/search` redirects there too). */
export function searchHref(q: string): string {
	const text = q.trim()
	return text ? `/discover?q=${encodeURIComponent(text)}` : "/discover"
}

const under = (pathname: string, prefix: string) =>
	pathname === prefix || pathname.startsWith(`${prefix}/`)

const PREFIXES: [string, DestinationKey][] = [
	["/discover", "discover"],
	["/hot-on-socials", "hot"],
	["/movies", "movies"],
	["/shows", "shows"],
	["/people", "people"],
	["/explorer", "explorer"],
	["/taste", "taste"],
]

/**
 * The main place the page at `pathname` is; null for pages outside them (title pages, settings, someone else's
 * profile). `handle`: the viewer's own, whose profile is their Taste.
 */
export function currentDestination(
	pathname: string,
	handle: string | null = null,
): DestinationKey | null {
	if (pathname === "/") return "home"
	const watch = watchPlaceOf(pathname)?.tab
	if (watch === "up-next") return "upNext"
	if (watch === "ready") return "ready"
	if (watch === "for-you") return "forYou"
	// Only the member's own page: /new/us/netflix and /new/us are public pages for a country.
	if (pathname === "/new") return "new"
	if (handle && under(pathname.toLowerCase(), `/u/${handle.toLowerCase()}`))
		return "taste"
	for (const [prefix, key] of PREFIXES) if (under(pathname, prefix)) return key
	return null
}
