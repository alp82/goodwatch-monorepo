// PROTOTYPE - throwaway. Round 8 intro clips, group "r8map": chapter 7 (Explorer, from round 7's explorer-few) and
// chapter 8 (Streaming, from round 7's streaming-natural), refined as the owner asked on 2026-10-17.
import type { Clip } from "../clip"
import { EXPLORER_FLY_MS, ExplorerFly } from "./r8map/explorer"
import { STREAMING_NETFLIX_MS, StreamingNetflix } from "./r8map/streaming"
import "./r5map.css"
import "./r6map.css"
import "./r7map.css"
import "./r8map.css"

export const CLIPS: Clip[] = [
	{
		id: "explorer-fly",
		section: "explorer",
		name: "Fly down onto the map, click two, fly into the merge",
		ms: EXPLORER_FLY_MS,
		note: "Round 7's calm map with a camera: it descends onto the map as the islands sweep in past it and settle; the pointer clicks Magical and Spectacle, they merge, the shared titles deal in; then the camera flies on into the merge until only the sea is left.",
		C: ExplorerFly,
	},
	{
		id: "streaming-netflix",
		section: "streaming",
		name: "Same wall and rows, landing on Netflix where you live",
		ms: STREAMING_NETFLIX_MS,
		note: "Round 7's smooth wall and count. The title is the most famous one on Netflix where you live (real availability); every country's row leads with the big brands; your row and the alert say Netflix.",
		C: StreamingNetflix,
	},
]
