// PROTOTYPE - throwaway. Round 9 intro clips, group "r9a": the rhythm pass for chapters 2-5 (score, picked for you,
// how it feels, search). Same clips as the round 8 cut, retimed: no stretch without motion, actions overlap, and the
// hero hand-over between chapters 3 and 4 keeps moving (the poster pushes in across the cut).
import type { Clip } from "../clip"
import "./r5score.css"
import "./r6score.css"
import "./r7open.css"
import "./r6feel.css"
import "./r7feel.css"
import { FeelingsZoomR9, ZOOM_R9_MS } from "./r9a/feelings"
import { PICK_DIVE_R9_MS, PickDiveR9 } from "./r9a/pick"
import { SCORE_HAND_R9_MS, ScoreHandR9 } from "./r9a/score"
import { SearchNativeR9 } from "./r9a/search"
import "./r9a.css"

export const CLIPS: Clip[] = [
	{
		id: "score-hand-r9",
		section: "score",
		name: "A hand of brand cards flies into the ring (retimed)",
		ms: SCORE_HAND_R9_MS,
		note: "score-hand without the 0.9 s pause after 'Five opinions.': the hand rises as soon as it has fanned out, the flights start while the ring pops up, the ring centres as its arc finishes. 9.0 s → 5.9 s.",
		C: ScoreHandR9,
	},
	{
		id: "recommendations-wall-dive-r9",
		section: "recommendations",
		name: "Spotlight wall, camera dives in (retimed)",
		ms: PICK_DIVE_R9_MS,
		enter: "cut",
		note: "recommendations-wall-dive with a 1.6 s read instead of a 1.7 s freeze; from the dive's arrival the poster keeps pushing in, so the hand-over into chapter 4 never stands still. 6.8 s → 5.8 s.",
		C: PickDiveR9,
	},
	{
		id: "fingerprint-own-zoom-r9",
		section: "fingerprint",
		name: "Zoom through, Interstellar's own pictures (retimed)",
		ms: ZOOM_R9_MS,
		enter: "cut",
		note: "fingerprint-own-zoom starting on the pushed-in poster and flying through at once; 1.55 s per feeling; ends 1.1 s after 'That's Interstellar.' lands, with every animation inside the clip. 10.4 s → 9.9 s.",
		C: FeelingsZoomR9,
	},
	{
		id: "search-native-r9",
		section: "search",
		name: "Huge phrase, then a native one-line field (retimed)",
		// The phrase's length decides the typing time: 5.94 s for "a mind-blowing space adventure" (searchNativeR9Ms).
		ms: 5940,
		note: "search-native typing from 250 ms, the finished phrase creeping toward the viewer while it reads, the field and top match arriving sooner, the backdrop drifting to the end. 8.6 s → 5.9 s.",
		C: SearchNativeR9,
	},
]
