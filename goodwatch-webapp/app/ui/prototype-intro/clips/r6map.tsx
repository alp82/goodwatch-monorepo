// PROTOTYPE - throwaway. Round 6 intro clips, group "r6map": chapter 7 (Explorer, from explorer-combine) and chapter 8
// (Streaming, from streaming-passport), refined as the owner asked on 2026-10-17.
import type { Clip } from "../clip"
import { ExplorerClickThree, ExplorerClickTwo } from "./r6map/explorer"
import { StreamingTravelCards, StreamingTravelRows } from "./r6map/streaming"
import "./r6map.css"

export const CLIPS: Clip[] = [
	{
		id: "explorer-click2",
		section: "explorer",
		name: "Click two far apart: a mood and a style",
		ms: 8600,
		note: "Faster mood map with moods, themes and styles side by side. The tutorial's pointer clicks Magical (a mood), then Spectacle (a style) across the map; the tally drops 910 → 472; they merge; the famous titles they share deal in.",
		C: ExplorerClickTwo,
	},
	{
		id: "explorer-click3",
		section: "explorer",
		name: "Click three, one of each kind",
		ms: 9700,
		note: "Three picks across the whole map: a mood, a style and a theme. The tally falls with each click (2,178 → 1,107 → 289); the three merge into one island and their famous shared titles deal in.",
		C: ExplorerClickThree,
	},
	{
		id: "streaming-rows",
		section: "streaming",
		name: "Wall keeps growing, rows travel up",
		ms: 15000,
		note: "No pause after the brands: the wall grows on until it leaves. The count is huge on a solid panel. Then the title's countries move up like a carousel, the previous and next rows peeking in, dimmed, landing on yours. Then the alert.",
		C: StreamingTravelRows,
	},
	{
		id: "streaming-cards",
		section: "streaming",
		name: "Wall keeps growing, country cards slide",
		ms: 15100,
		note: "The same growing wall and big count; then the countries as big cards sliding left, the neighbours peeking in at the edges, until yours is in the middle. Then the alert.",
		C: StreamingTravelCards,
	},
]
