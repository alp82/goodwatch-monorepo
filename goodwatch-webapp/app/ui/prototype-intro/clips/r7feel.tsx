// PROTOTYPE - throwaway. Round 7 intro clips, group "r7feel": chapter 4 (how it feels: round 6's three styles, now over
// Interstellar's own backdrops) and chapter 5 (search: huge phrase, then a native one-line field and one row of chips).
import type { Clip } from "../clip"
import { CAROUSEL_MS, FeelingsCarousel, FeelingsInPlace, FeelingsZoom, PLACE_MS, ZOOM_MS } from "./r7feel/feelings"
import { NATIVE_MS, SearchNative } from "./r7feel/search"
import "./r6feel.css"
import "./r7feel.css"

export const CLIPS: Clip[] = [
	{
		id: "fingerprint-own",
		section: "fingerprint",
		name: "One feeling at a time, over Interstellar's own pictures",
		ms: PLACE_MS,
		enter: "cut",
		note: "Round 6's fitting-picture version; every backdrop is now Interstellar's own (Gargantua, the water planet, an astronaut before the wormhole, the Ranger before the wave), picked by hand from TMDB's set.",
		C: FeelingsInPlace,
	},
	{
		id: "fingerprint-own-carousel",
		section: "fingerprint",
		name: "Feelings as panels, Interstellar's own pictures",
		ms: CAROUSEL_MS,
		enter: "cut",
		note: "Round 6's carousel with Interstellar's own backdrops; the owner liked all three styles, so all three stay.",
		C: FeelingsCarousel,
	},
	{
		id: "fingerprint-own-zoom",
		section: "fingerprint",
		name: "Zoom through, Interstellar's own pictures",
		ms: ZOOM_MS,
		enter: "cut",
		note: "Round 6's zoom-through with Interstellar's own backdrops.",
		C: FeelingsZoom,
	},
	{
		id: "search-native",
		section: "search",
		name: "Huge phrase, then a native one-line field",
		ms: NATIVE_MS,
		note: "The phrase types huge on one line with its chips in one row; it lifts into the header-style search field (one line); Interstellar takes the screen.",
		C: SearchNative,
	},
]
