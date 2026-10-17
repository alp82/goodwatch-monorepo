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

// Round 4 clips the owner passed on (2026-10-17): "too complex, too nitty-gritty or not engaging enough".
const PASSED = new Set([
	"opener-apps", "opener-remote", "score-wall", "score-split", "streaming-ways",
	"fingerprint-dials", "fingerprint-pair", "fingerprint-match",
	"recommendations-because", "recommendations-resort", "recommendations-sides", "recommendations-tonight",
	"search-type", "search-person", "search-three", "filters-services", "filters-moods",
	"explorer-flyover", "explorer-placed", "tracking-alerts", "closer-wordmark", "closer-wall", "closer-free",
])

export const ALL_CLIPS: Clip[] = [...problem, ...scorestream, ...feel, ...searchfilter, ...explorertrack, ...r5open, ...r5score, ...r5feel, ...r5filter, ...r5map, ...r5track].map((c) =>
	PASSED.has(c.id) ? { ...c, archived: true } : c,
)
export const clipById = (id: string) => ALL_CLIPS.find((c) => c.id === id)
