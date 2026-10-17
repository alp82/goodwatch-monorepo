// PROTOTYPE - throwaway. Round 14, builder B: one title per franchise in the search results and the Explorer's
// shared titles (franchise = TMDB collection from r14b.server.ts, else the title's name).
import type { Clip } from "../../clip"
import { EXPLORER_FLY_R9_MS, ExplorerR14 } from "./b/explorer"
import { SearchR14 } from "./b/search"

export const CLIPS: Clip[] = [
	{
		id: "search-r14",
		section: "search",
		name: "Huge phrase, native field, top match; one result per franchise",
		ms: 5940,
		note: "search-native-r9 with the result row deduplicated by franchise: one Star Wars instead of three.",
		C: SearchR14,
	},
	{
		id: "explorer-r14",
		section: "explorer",
		name: "Fly onto the map, two clicks, merge; one shared title per franchise",
		ms: EXPLORER_FLY_R9_MS,
		note: "explorer-fly-r9 with the shared titles deduplicated by franchise: one Lord of the Rings, one Avengers.",
		C: ExplorerR14,
	},
]
