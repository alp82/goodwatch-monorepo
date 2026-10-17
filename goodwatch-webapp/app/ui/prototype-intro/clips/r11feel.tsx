// PROTOTYPE - throwaway. Round 11 "r11feel" (owner: "switch for you and how it feels"): search → for you → how it
// feels → Explorer. The pick lands on Avatar and ends on its hand-over poster; "How Avatar feels" cuts in on it, over
// Avatar's own backdrops. The approved Interstellar zoom-through is kept as an alternative for this position.
import type { Clip } from "../clip"
import "./r5score.css"
import "./r6score.css"
import "./r6feel.css"
import "./r7feel.css"
import "./r9a.css"
import "./r10b.css"
import { FeelingsAvatarR11, FeelingsInterstellarR11, LEAD, zoomMs } from "./r11feel/feelings"
import { PICK_R11_MS, PickDiveR11 } from "./r11feel/pick"

export const CLIPS: Clip[] = [
	{
		id: "recommendations-wall-dive-r11",
		section: "recommendations",
		name: "Spotlight wall lands on Avatar, ends on its poster",
		ms: PICK_R11_MS,
		note: "Round 10's dive onto Avatar (81 %, because you loved Interstellar and Inception); the why reads and leaves, and Avatar's poster stays alone in the hand-over frame, pushing in, for 'How Avatar feels'.",
		C: PickDiveR11,
	},
	{
		id: "fingerprint-avatar-r11",
		section: "fingerprint",
		name: "How Avatar feels: zoom through Avatar's own pictures",
		// Avatar's four plain feelings: Spectacular, Immersive, Wondrous, Fantastical.
		ms: zoomMs(4, 0),
		enter: "cut",
		note: "The approved zoom-through, for the pick: starts on Avatar's pushed-in poster and flies through; Avatar's real attributes over backdrops hand-picked from its TMDB set; ends 'That's Avatar.'",
		C: FeelingsAvatarR11,
	},
	{
		id: "fingerprint-interstellar-r11",
		section: "fingerprint",
		name: "How Interstellar feels, arriving after another title",
		ms: zoomMs(4, LEAD),
		note: "fingerprint-own-zoom-r10 for comparison: no cut; Interstellar's poster pushes in under the crossfade for 0.55 s, then flies through as before.",
		C: FeelingsInterstellarR11,
	},
]
