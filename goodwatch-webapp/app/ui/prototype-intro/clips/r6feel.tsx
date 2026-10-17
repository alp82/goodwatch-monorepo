// PROTOTYPE - throwaway. Round 6 intro clips, group "r6feel": chapter 4 (how it feels: one feeling at a time, huge,
// over a backdrop that fits it) and chapter 5 (search by feeling: the phrase types huge, then the top match takes the
// screen).
import type { Clip } from "../clip"
import { CAROUSEL_MS, FeelingsCarousel, FeelingsInPlace, FeelingsZoom, PLACE_MS, ZOOM_MS } from "./r6feel/feelings"
import { GROW_MS, MORPH_MS, SearchGrow, SearchMorph, SearchTakeover, TAKEOVER_MS } from "./r6feel/search"
import "./r6feel.css"

export const CLIPS: Clip[] = [
	{
		id: "fingerprint-fit",
		section: "fingerprint",
		name: "One feeling at a time, each over a fitting picture",
		ms: PLACE_MS,
		enter: "cut",
		note: "The poster tucks into the corner; each feeling lands huge over the backdrop of the famous title strongest in it (\"like The Dark Knight\"), with its strength bar. Ends on Interstellar with all four chips.",
		C: FeelingsInPlace,
	},
	{
		id: "fingerprint-carousel",
		section: "fingerprint",
		name: "Feelings as panels that push each other on",
		ms: CAROUSEL_MS,
		enter: "cut",
		note: "Each feeling is a full panel (fitting backdrop, huge word) sliding in over the last; the final panel is Interstellar with its poster and all four chips.",
		C: FeelingsCarousel,
	},
	{
		id: "fingerprint-zoom",
		section: "fingerprint",
		name: "Zoom through the poster into each feeling",
		ms: ZOOM_MS,
		enter: "cut",
		note: "The camera flies through the poster; each feeling comes from deep in its fitting picture and flies past; it lands back on Interstellar.",
		C: FeelingsZoom,
	},
	{
		id: "search-takeover",
		section: "search",
		name: "Huge phrase, then the field, then the top match",
		ms: TAKEOVER_MS,
		note: "\"a mind-blowing space adventure\" types huge with its chips appearing as words land; it leaves upward as the search field arrives; Interstellar takes the screen.",
		C: SearchTakeover,
	},
	{
		id: "search-morph",
		section: "search",
		name: "Huge phrase shrinks into the field",
		ms: MORPH_MS,
		note: "The same phrase stays on screen: it shrinks to the top while a field's outline grows around it, then the top match takes the screen.",
		C: SearchMorph,
	},
	{
		id: "search-grow",
		section: "search",
		name: "Six answers, the first grows to fill the screen",
		ms: GROW_MS,
		note: "\"an epic fantasy adventure\" types huge with chips; six famous answers deal in; the first grows into its backdrop and takes the screen.",
		C: SearchGrow,
	},
]
