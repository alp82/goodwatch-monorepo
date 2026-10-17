// PROTOTYPE - throwaway. Round 8 intro clips, group "r8track": chapter 9 (keeps track for you) and chapter 10 (bring
// your ratings), refined from round 7's tracking-feed-r7 and imports-flow-r7 by the owner's round 8 notes.
import type { Clip } from "../clip"
import { FEED_MS, TrackingFeedR8 } from "./r8track/feed"
import { IMPORTS_R8_MS, IMPORTS_R8_RING_MS, ImportsR8, ImportsR8Ring } from "./r8track/imports"
import "./r7track.css"
import "./r8track.css"

export const CLIPS: Clip[] = [
	{
		id: "tracking-feed-r8",
		section: "tracking",
		name: "One feed, the moments rush in faster and faster",
		ms: FEED_MS,
		note: "Round 7's feed with a sharper acceleration: the first moment holds big for 1.5 s, each next gap is 0.7 of the one before, then the feed eases to a stop.",
		C: TrackingFeedR8,
	},
	{
		id: "imports-r8",
		section: "imports",
		name: "Sources send posters, scores and bookmarks into the G, one by one",
		ms: IMPORTS_R8_MS,
		note: "Round 7's layout (sources left, picks right). Each source sends a mix of posters, rating chips and bookmarks that start big and shrink into the G, then goes small and grey. Plex on a light tile.",
		C: ImportsR8,
	},
	{
		id: "imports-r8-ring",
		section: "imports",
		name: "Sources in a ring around the G, then the picks fan out",
		ms: IMPORTS_R8_RING_MS,
		note: "The same sending, from a ring of sources around the G. When all are spent the ring fades, the G steps left and the picks fan out on the right like a hand of cards.",
		C: ImportsR8Ring,
	},
]
