// PROTOTYPE - throwaway (prototype/explore-r4). Small shared constants of the UI kit.
import { tmdbImageUrl } from "~/utils/tmdb-image"

/** The page width every section sits in. */
export const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
/** The quiet card surface (DESIGN.md: translucent white panel on the navy page). */
export const PANEL = "rounded-2xl bg-white/[0.04] ring-1 ring-white/10"

export const poster = (path: string | null | undefined, size = "w342") =>
	path ? tmdbImageUrl(path, size) : ""

/** A hue washed into the page's navy, for a mood's header or card (never laid over a poster). */
export const wash = (hue: string, share = 22) => `color-mix(in oklab, ${hue} ${share}%, #131926)`
