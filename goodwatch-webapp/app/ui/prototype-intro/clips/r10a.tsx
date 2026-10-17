// PROTOTYPE - throwaway. Round 10 intro clips, group "r10a": the bottom-anchored chat (chapter 1) and the streaming
// chapter with quicker hand-overs around the country screen (chapter 3 in the owner's new order). round10-rules.md in
// the session scratchpad has the owner's notes.
import type { Clip } from "../clip"
import { OPENER_R10_MS, OpenerBubblesR10 } from "./r10a/opener"
import { STREAMING_NETFLIX_R10_MS, StreamingNetflixR10 } from "./r10a/streaming"
import "./r5map.css"
import "./r6map.css"
import "./r7map.css"
import "./r8map.css"
import "./r7open.css"
import "./r9c.css"

export const CLIPS: Clip[] = [
	{
		id: "opener-bubbles-r10",
		section: "opener",
		name: "The chat starts at the bottom, then the wall",
		ms: OPENER_R10_MS,
		note: "Round 9's opener with the thread anchored at the bottom, as a real chat: the first message sits just above the chapter bar and each suggestion pushes the earlier rows up, making room for itself and its answer.",
		C: OpenerBubblesR10,
	},
	{
		id: "streaming-netflix-r10",
		section: "streaming",
		name: "Wall, rows to Netflix, alert: quick hand-overs",
		ms: STREAMING_NETFLIX_R10_MS,
		note: "Into the country screen: the poster, headline and first lit row arrive while the wall leaves (300 ms, was 1 s). Out of it: the rows leave in 380 ms, the next headline rises as they go and the alert lands 200 ms later. 1.5 s shorter.",
		C: StreamingNetflixR10,
	},
]
