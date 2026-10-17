// PROTOTYPE - throwaway. Round 9 intro clips, group "r9c": the rhythm pass for chapters 1, 8, 9 and 10. The owner on
// round 8: "timing and rhythm is still weird. there are often weird pauses between scene transitions". Each clip is its
// round 7/8 base with the still stretches taken out: actions overlap, reading holds keep a slow push-in, and every
// clip ends right after its last line has been read (round9-rules.md in the session scratchpad).
import type { Clip } from "../clip"
import { FEED_MS, TrackingFeedR9 } from "./r9c/feed"
import { IMPORTS_R9_MS, IMPORTS_RING_R9_MS, ImportsR9, ImportsRingR9 } from "./r9c/imports"
import { OPENER_R9_MS, OpenerBubblesR9 } from "./r9c/opener"
import { STREAMING_NETFLIX_R9_MS, StreamingNetflixR9 } from "./r9c/streaming"
import "./r5map.css"
import "./r6map.css"
import "./r7map.css"
import "./r8map.css"
import "./r7open.css"
import "./r7track.css"
import "./r8track.css"
import "./r9c.css"

export const CLIPS: Clip[] = [
	{
		id: "opener-bubbles-r9",
		section: "opener",
		name: "Just the bubbles, then the wall (no still end)",
		ms: OPENER_R9_MS,
		note: "Round 7's opener unchanged in time; the frame pushes in slowly from the tagline on, so the last 0.85 s before the hand-over isn't frozen.",
		C: OpenerBubblesR9,
	},
	{
		id: "streaming-netflix-r9",
		section: "streaming",
		name: "Wall, rows to Netflix, alert: no pauses",
		ms: STREAMING_NETFLIX_R9_MS,
		note: "The 'You' row reads 0.9 s while the rows push in (was 1.1 s still); the next headline starts as the rows leave and the alert follows 0.55 s later (was 1.2 s); the alert pushes in until the hand-over. 0.6 s shorter.",
		C: StreamingNetflixR9,
	},
	{
		id: "tracking-feed-r9",
		section: "tracking",
		name: "One feed, accelerating, the line arrives with the rush",
		ms: FEED_MS,
		note: "The closing line rises while the last moments still rush in (was after them); the feed drifts to a stop more slowly and the scene pushes in during the read. 1.2 s shorter, no still tail.",
		C: TrackingFeedR9,
	},
	{
		id: "imports-r9",
		section: "imports",
		name: "Sources into the G, picks out, straight into your turn",
		ms: IMPORTS_R9_MS,
		note: "The closing line rises with the picks (was after them, then 2.4 s still); the scene pushes in while it is read and hands over to the quiz right after. 1.3 s shorter.",
		C: ImportsR9,
	},
	{
		id: "imports-ring-r9",
		section: "imports",
		name: "Ring of sources, the picks fan out, straight into your turn",
		ms: IMPORTS_RING_R9_MS,
		note: "The ring variation with the same retiming: the line rises with the fan, a slow push-in while it is read, no still tail. 1.3 s shorter.",
		C: ImportsRingR9,
	},
]
