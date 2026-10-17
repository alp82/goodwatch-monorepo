// PROTOTYPE - throwaway. Round 7 intro clips, group "r7map": chapter 7 (Explorer, from explorer-click2) and chapter 8
// (Streaming, from streaming-rows), refined as the owner asked on 2026-10-17.
import type { Clip } from "../clip"
import { ExplorerFew } from "./r7map/explorer"
import { STREAMING_NATURAL_MS, StreamingNatural } from "./r7map/streaming"
import "./r5map.css"
import "./r6map.css"
import "./r7map.css"

export const CLIPS: Clip[] = [
	{
		id: "explorer-few",
		section: "explorer",
		name: "Click two on a calm map: five islands per kind",
		ms: 8600,
		note: "Less is more: five well-known islands each for moods, themes and styles, bigger and readable. The pointer clicks Magical (a mood), then Spectacle (a style); the tally drops 910 → 472; they merge into a larger island with room around its name; the famous shared titles deal in.",
		C: ExplorerFew,
	},
	{
		id: "streaming-natural",
		section: "streaming",
		name: "One smooth pull-back, the count over a vignette, rows slide up",
		ms: STREAMING_NATURAL_MS,
		note: "The brands, then one continuous ease-in-out pull-back while the wall grows in soft overlapping rings (seven layers, not a pop per logo). The wall dims and the huge count reads over a dark vignette, no panel. Then the countries slide up, neighbours peeking in, landing on yours, and the example alert.",
		C: StreamingNatural,
	},
]
