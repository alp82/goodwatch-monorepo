// PROTOTYPE - throwaway. Round 10 intro clips, group "r10b": search → how it feels → for you, now consecutive.
// Search ends on Interstellar in the hero frame, still pushing in; "How it feels" cuts in on it and flies through;
// "For you" lands on another title (Avatar, the real guest pick for Interstellar + Inception lovers).
import type { Clip } from "../clip"
import "./r5score.css"
import "./r6score.css"
import "./r6feel.css"
import "./r7feel.css"
import "./r9a.css"
import "./r10b.css"
import { FeelingsZoomR9, ZOOM_R9_MS } from "./r9a/feelings"
import { PICK_DIVE_R10_MS, PickDiveR10 } from "./r10b/pick"
import { SearchNativeR10 } from "./r10b/search"

export const CLIPS: Clip[] = [
	{
		id: "search-native-r10",
		section: "search",
		name: "Huge phrase, then the field, into Interstellar's poster",
		// searchNativeR10Ms for "a mind-blowing space adventure": hero in at 5740, settles 550 ms, pushes 300 more.
		ms: 6590,
		note: "search-native-r9, then the hand-over: after the results read, the scene clears and the top match's poster settles into the hero frame, pushing in; 'How it feels' cuts in on it.",
		C: SearchNativeR10,
	},
	{
		id: "fingerprint-own-zoom-r10",
		section: "fingerprint",
		name: "Zoom through, from the search's poster",
		ms: ZOOM_R9_MS,
		enter: "cut",
		note: "fingerprint-own-zoom-r9 unchanged inside: it starts on the pushed-in hero poster, which the search now ends on, and flies through at once.",
		C: FeelingsZoomR9,
	},
	{
		id: "recommendations-wall-dive-r10",
		section: "recommendations",
		name: "Spotlight wall lands on another title",
		ms: PICK_DIVE_R10_MS,
		note: "The dive, landing on Avatar (real guest pick for Interstellar + Inception lovers, 81 %). Opens on the wall under the crossfade from the feelings; ends with the pick and its why on screen for the crossfade to the Explorer.",
		C: PickDiveR10,
	},
]
