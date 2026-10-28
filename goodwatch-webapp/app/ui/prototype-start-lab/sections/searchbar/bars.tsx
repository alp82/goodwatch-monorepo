// PROTOTYPE (start page lab, round 12): the search bar variants by key, for stage j's top (jk-shared). "a" is the
// round 11 field with the presets row under it, drawn by jk-shared itself.
import type { ComponentType } from "react"
import type { StageFlow } from "../stage/ab-shared"
import { SearchBarB } from "./b"
import { SearchBarC } from "./c"
import { SearchBarD } from "./d"

export const SEARCH_BARS: Record<string, ComponentType<{ f: StageFlow }>> = { b: SearchBarB, c: SearchBarC, d: SearchBarD }

export { JK_REVEAL, useSearchbarKey } from "./shared"
