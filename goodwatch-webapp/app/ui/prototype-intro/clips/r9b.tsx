// PROTOTYPE - throwaway. Round 9 intro clips, group "r9b": chapter 6 (filters) and chapter 7 (Explorer), retimed for
// rhythm as the owner asked on 2026-10-17 (no pauses, overlapping actions, filters without the two floors).
import type { Clip } from "../clip"
import { EXPLORER_FLY_R9_MS, ExplorerFlyR9 } from "./r9b/explorer"
import { FilterPanelR9 } from "./r9b/filters"
import "./r5map.css"
import "./r6map.css"
import "./r7map.css"
import "./r8map.css"
import "./r8filter.css"
import "./r9b.css"

export const CLIPS: Clip[] = [
	{
		id: "filters-r9",
		section: "filters",
		name: "From the whole catalog to tonight, accelerating",
		// lengthOf(filterData(data)) for the snapshot: the last result at 6,070 ms plus the 2,600 ms hold.
		ms: 8700,
		note: "Round 8's panel without the two floors: every title in the catalog (1,497,602), on Netflix and Prime Video across the catalog (43,775), Not seen yet, then Discover's Feel-good, age and score. Each step comes faster than the last; the score ticks 60/70/80 fastest; a short hold with a slow push-in.",
		C: FilterPanelR9,
	},
	{
		id: "explorer-fly-r9",
		section: "explorer",
		name: "Fly onto the map, point as the first island lands, fly into the merge",
		ms: EXPLORER_FLY_R9_MS,
		note: "Round 8's camera flight, retimed: the pointer sets off for Magical as soon as it has landed while the other islands still sweep in, the second click follows promptly, the shared titles hold with a slow push-in, then the camera flies into the merge.",
		C: ExplorerFlyR9,
	},
]
