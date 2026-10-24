// Where the site navigation goes, and which destination the current page belongs to. The hub sheet, the desktop
// Browse panel, the dock's hub key, the Browse button, and the search palette all read from here.
import {
	BookmarkIcon,
	FilmIcon,
	FireIcon,
	FingerPrintIcon,
	HomeIcon,
	MagnifyingGlassIcon,
	MapIcon,
	PlayIcon,
	SparklesIcon,
	TvIcon,
} from "@heroicons/react/24/solid"
import type { ComponentType, SVGProps } from "react"

export type DestinationKey =
	| "home"
	| "watchNext"
	| "discover"
	| "taste"
	| "explorer"
	| "movies"
	| "shows"
	// The buzz ranking and what is said about it (routes/hot-on-socials.tsx).
	| "hot"
	// A member's pages (#385). They take Watch next's tile in the hub.
	| "myShows"
	| "myMovies"
	| "myLibrary"
	// Recommendations steered by the person's taste (routes/for-you.tsx). Not the For you switch on Discover.
	| "forYou"

export interface Destination {
	key: DestinationKey
	/** The name on tiles and in the Browse button. */
	label: string
	/** The shorter name under the hub key. */
	short: string
	href: string
	icon: ComponentType<SVGProps<SVGSVGElement>>
}

/** Where a search for a query goes: Discover's search mode (`/search` redirects there too). */
export function searchHref(q: string): string {
	const text = q.trim()
	return text ? `/discover?q=${encodeURIComponent(text)}` : "/discover"
}

export function getDestinations(): Record<DestinationKey, Destination> {
	return {
		home: {
			key: "home",
			label: "Home",
			short: "Home",
			href: "/",
			icon: HomeIcon,
		},
		watchNext: {
			key: "watchNext",
			label: "Watch next",
			short: "Watch",
			href: "/watch-next",
			icon: PlayIcon,
		},
		discover: {
			key: "discover",
			label: "Discover",
			short: "Discover",
			href: "/discover",
			icon: MagnifyingGlassIcon,
		},
		taste: {
			key: "taste",
			label: "Taste",
			short: "Taste",
			href: "/taste",
			icon: FingerPrintIcon,
		},
		explorer: {
			key: "explorer",
			label: "Explorer",
			short: "Explorer",
			href: "/explorer",
			icon: MapIcon,
		},
		movies: {
			key: "movies",
			label: "Movies",
			short: "Movies",
			href: "/movies",
			icon: FilmIcon,
		},
		shows: {
			key: "shows",
			label: "Shows",
			short: "Shows",
			href: "/shows",
			icon: TvIcon,
		},
		hot: {
			key: "hot",
			label: "Hot on socials",
			short: "Hot",
			href: "/hot-on-socials",
			icon: FireIcon,
		},
		myShows: {
			key: "myShows",
			label: "My shows",
			short: "My shows",
			href: "/my-shows",
			icon: TvIcon,
		},
		myMovies: {
			key: "myMovies",
			label: "My movies",
			short: "My movies",
			href: "/my-movies",
			icon: FilmIcon,
		},
		myLibrary: {
			key: "myLibrary",
			label: "My library",
			short: "Library",
			href: "/my-library",
			icon: BookmarkIcon,
		},
		forYou: {
			key: "forYou",
			label: "For you",
			short: "For you",
			href: "/for-you",
			icon: SparklesIcon,
		},
	}
}

const PREFIXES: [string, DestinationKey][] = [
	["/my-shows", "myShows"],
	["/my-movies", "myMovies"],
	["/my-library", "myLibrary"],
	["/for-you", "forYou"],
	["/watch-next", "watchNext"],
	["/wishlist", "watchNext"],
	["/discover", "discover"],
	["/taste", "taste"],
	["/explorer", "explorer"],
	["/movies", "movies"],
	["/shows", "shows"],
	["/hot-on-socials", "hot"],
]

/** The destination the page at `pathname` belongs to; null for pages outside them (title pages, settings, …). */
export function currentDestination(pathname: string): DestinationKey | null {
	if (pathname === "/") return "home"
	for (const [prefix, key] of PREFIXES)
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return key
	return null
}
