// PROTOTYPE - throwaway. Round 14, builder A (owner, 2026-10-17): how it feels without its summary screen, a lighter
// and quicker streaming wall ("In your country." instead of "Where you live."), and a tracking card whose Want to See
// button fits inside it.
import type { Clip } from "../../clip"
import "../r5map.css"
import "../r6map.css"
import "../r7map.css"
import "../r8map.css"
import "../r9c.css"
import "../r5score.css"
import "../r6score.css"
import "../r6feel.css"
import "../r7feel.css"
import "../r9a.css"
import "../r10b.css"
import "../r7track.css"
import "../r8track.css"
import "./a.css"
import { FeelingsAvatarR14, feelingsR14Ms } from "./a/feelings"
import { STREAMING_R14_MS, StreamingR14 } from "./a/streaming"
import { TrackingFeedR14 } from "./a/feed"

export const CLIPS: Clip[] = [
	{
		id: "fingerprint-avatar-r14",
		section: "fingerprint",
		name: "How Avatar feels, ending on the last feeling",
		ms: feelingsR14Ms(4),
		enter: "cut",
		note: "Round 11's zoom-through without the summary screen: the last feeling stays, pushing in, its backdrop drifting, under the crossfade into search.",
		C: FeelingsAvatarR14,
	},
	{
		id: "streaming-r14",
		section: "streaming",
		name: "Lighter wall, quicker into the countries, In your country",
		ms: STREAMING_R14_MS,
		note: "128 logos instead of 240, no tile shadows, four fading ring groups, one camera layer from a smaller start scale. The wall leaves 800 ms sooner and quicker. 'In your country.'",
		C: StreamingR14,
	},
	{
		id: "tracking-r14",
		section: "tracking",
		name: "One feed, the Want to See button inside its card",
		// Round 12's length: the next chapter starts as the last card lands.
		ms: 6100,
		note: "tracking-feed-r12 with the Want to See button beside the title at the card's end, so it fits at every size.",
		C: TrackingFeedR14,
	},
]
