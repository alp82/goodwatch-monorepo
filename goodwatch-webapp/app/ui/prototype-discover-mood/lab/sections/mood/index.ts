// PROTOTYPE (Discover lab): the "mood" section. Round 20 locked k (every pick ANDed; the grid and Show N titles show
// the AND list, Find a filter sits on the recipe row); the others live in git history.
import type { SectionVariant } from "../../types"
import { useAndResults } from "./and"
import { MoodK } from "./k"

export const VARIANTS: SectionVariant[] = [{ key: "k", name: "Mixes, then choose", View: MoodK, ownFind: true, useResults: useAndResults }]
