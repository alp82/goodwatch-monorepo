// Where the site navigation goes, and which destination the current page belongs to. The hub sheet, the desktop
// Browse panel, the dock's hub key, and the Browse button all read from here.
import {
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

/** The search page for a query. Discover's search mode takes over this path with a redirect once it ships. */
export const searchHref = (q: string) =>
	q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search"

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
	}
}

const PREFIXES: [string, DestinationKey][] = [
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
