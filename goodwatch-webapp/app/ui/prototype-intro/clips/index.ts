// PROTOTYPE - throwaway. Every intro clip, by group.
import type { Clip } from "../clip"
import { CLIPS as explorertrack } from "./explorertrack"
import { CLIPS as feel } from "./feel"
import { CLIPS as problem } from "./problem"
import { CLIPS as scorestream } from "./scorestream"
import { CLIPS as searchfilter } from "./searchfilter"

export const ALL_CLIPS: Clip[] = [...problem, ...scorestream, ...feel, ...searchfilter, ...explorertrack]
export const clipById = (id: string) => ALL_CLIPS.find((c) => c.id === id)
