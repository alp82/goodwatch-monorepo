// PROTOTYPE - throwaway. Every intro clip, by group.
import type { Clip } from "../clip"
import { CLIPS as explorertrack } from "./explorertrack"
import { CLIPS as feel } from "./feel"
import { CLIPS as problem } from "./problem"
import { CLIPS as scorestream } from "./scorestream"
import { CLIPS as searchfilter } from "./searchfilter"
import { CLIPS as r5open } from "./r5open"
import { CLIPS as r5score } from "./r5score"
import { CLIPS as r5feel } from "./r5feel"
import { CLIPS as r5filter } from "./r5filter"
import { CLIPS as r5map } from "./r5map"
import { CLIPS as r5track } from "./r5track"
import { CLIPS as r6open } from "./r6open"
import { CLIPS as r6score } from "./r6score"
import { CLIPS as r6feel } from "./r6feel"
import { CLIPS as r6filter } from "./r6filter"
import { CLIPS as r6map } from "./r6map"
import { CLIPS as r6track } from "./r6track"
import { CLIPS as r7open } from "./r7open"
import { CLIPS as r7feel } from "./r7feel"
import { CLIPS as r7filter } from "./r7filter"
import { CLIPS as r7map } from "./r7map"
import { CLIPS as r7track } from "./r7track"
import { CLIPS as r8filter } from "./r8filter"
import { CLIPS as r8map } from "./r8map"
import { CLIPS as r8track } from "./r8track"

// Round 6 (2026-10-17): the lab shows only the bases the owner picked and the new round 6 clips. Everything else
// is behind "Show older clips".
const BASES = new Set([
	// Round 8 (2026-10-17): approved clips, and the round 7 clips the r8 groups refine.
	"opener-bubbles", "score-hand", "recommendations-wall-dive", "fingerprint-own-zoom", "search-native", "closer-ripples-r7",
	"filters-r7-panel", "explorer-few", "streaming-natural", "tracking-feed-r7", "imports-flow-r7",
])
/** The current round's groups: everything in them stays visible. */
const ROUND6 = /^r8/
/** The owner moved "Bring your ratings" into a chapter of its own. */
const MOVED: Record<string, Clip["section"]> = { "tracking-import": "imports" }

const groups: [string, Clip[]][] = [
	["problem", problem], ["scorestream", scorestream], ["feel", feel], ["searchfilter", searchfilter],
	["explorertrack", explorertrack], ["r5open", r5open], ["r5score", r5score], ["r5feel", r5feel],
	["r5filter", r5filter], ["r5map", r5map], ["r5track", r5track],
	["r6open", r6open], ["r6score", r6score], ["r6feel", r6feel], ["r6filter", r6filter], ["r6map", r6map], ["r6track", r6track],
	["r7open", r7open], ["r7feel", r7feel], ["r7filter", r7filter], ["r7map", r7map], ["r7track", r7track], ["r8filter", r8filter], ["r8map", r8map], ["r8track", r8track],
]

export const ALL_CLIPS: Clip[] = groups.flatMap(([group, clips]) =>
	clips.map((c) => ({
		...c,
		section: MOVED[c.id] ?? c.section,
		archived: !(ROUND6.test(group) || BASES.has(c.id)),
	})),
)
export const clipById = (id: string) => ALL_CLIPS.find((c) => c.id === id)
