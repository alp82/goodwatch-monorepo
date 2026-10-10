// Where the site navigation goes, and which destination the current page belongs to. The hub sheet, the desktop
// Browse panel, the dock's hub key, and the Browse button all read from here.
import {
	BookmarkIcon,
	FilmIcon,
	FingerPrintIcon,
	HomeIcon,
	MagnifyingGlassIcon,
	MapIcon,
	PlayIcon,
	TvIcon,
} from "@heroicons/react/24/solid"
import type { ComponentType, SVGProps } from "react"
import type { EnabledFeatures } from "~/utils/features"

export type DestinationKey =
	| "home"
	| "watchNext"
	| "discover"
	| "taste"
	| "explorer"
	| "movies"
	| "shows"
	// A member's pages with REC_TRACKING (#385). They take Watch next's tile in the hub.
	| "myShows"
	| "myMovies"
	| "myLibrary"

export interface Destination {
	key: DestinationKey
	/** The name on tiles and in the Browse button. */
	label: string
	/** The shorter name under the hub key. */
	short: string
	href: string
	icon: ComponentType<SVGProps<SVGSVGElement>>
	/** False while the page's own feature is off for the viewer; the tile shows but doesn't link. */
	available: boolean
}

/**
 * Where a search for a query goes: Discover's search mode while the new filter bar is on for the viewer (`/search`
 * redirects there too), else the search page.
 */
export function searchHref(q: string, features: EnabledFeatures): string {
	const text = q.trim()
	const path = features.filterBar ? "/discover" : "/search"
	return text ? `${path}?q=${encodeURIComponent(text)}` : path
}

/** The query of the search on screen (Discover's search mode or the search page), for prefilling a search field. */
export function currentSearchQuery(pathname: string, search: string): string {
	return pathname === "/search" || pathname.startsWith("/discover")
		? (new URLSearchParams(search).get("q") ?? "")
		: ""
}

export function getDestinations(
	features: EnabledFeatures,
): Record<DestinationKey, Destination> {
	return {
		home: {
			key: "home",
			label: "Living room",
			short: "Home",
			href: "/",
			icon: HomeIcon,
			available: true,
		},
		watchNext: {
			key: "watchNext",
			label: "Watch next",
			short: "Watch",
			// Until Watch next is on for the viewer, the Wishlist page is where their Wishlist lives.
			href: features.watchNext ? "/watch-next" : "/wishlist",
			icon: PlayIcon,
			available: true,
		},
		discover: {
			key: "discover",
			label: "Discover",
			short: "Discover",
			href: "/discover",
			icon: MagnifyingGlassIcon,
			available: true,
		},
		taste: {
			key: "taste",
			label: "Taste",
			short: "Taste",
			href: "/taste",
			icon: FingerPrintIcon,
			available: true,
		},
		explorer: {
			key: "explorer",
			label: "Explorer",
			short: "Explorer",
			href: "/explorer",
			icon: MapIcon,
			available: features.explorer,
		},
		movies: {
			key: "movies",
			label: "Movies",
			short: "Movies",
			href: "/movies",
			icon: FilmIcon,
			available: true,
		},
		shows: {
			key: "shows",
			label: "Shows",
			short: "Shows",
			href: "/shows",
			icon: TvIcon,
			available: true,
		},
		myShows: {
			key: "myShows",
			label: "My shows",
			short: "My shows",
			href: "/my-shows",
			icon: TvIcon,
			available: features.tracking,
		},
		myMovies: {
			key: "myMovies",
			label: "My movies",
			short: "My movies",
			href: "/my-movies",
			icon: FilmIcon,
			available: features.tracking,
		},
		myLibrary: {
			key: "myLibrary",
			label: "My library",
			short: "Library",
			href: "/my-library",
			icon: BookmarkIcon,
			available: features.tracking,
		},
	}
}

const PREFIXES: [string, DestinationKey][] = [
	["/my-shows", "myShows"],
	["/my-movies", "myMovies"],
	["/my-library", "myLibrary"],
	["/watch-next", "watchNext"],
	["/wishlist", "watchNext"],
	["/discover", "discover"],
	["/search", "discover"],
	["/taste", "taste"],
	["/explorer", "explorer"],
	["/movies", "movies"],
	["/shows", "shows"],
]

/** The destination the page at `pathname` belongs to; null for pages outside them (title pages, settings, …). */
export function currentDestination(pathname: string): DestinationKey | null {
	if (pathname === "/") return "home"
	for (const [prefix, key] of PREFIXES)
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return key
	return null
}
