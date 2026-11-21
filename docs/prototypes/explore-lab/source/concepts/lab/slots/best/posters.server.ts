// PROTOTYPE - throwaway (prototype/explore-r6; round 7 drops the analysis sentences). Best as the site's own poster
// cards: see posters.tsx.
import type { SlotLoader } from "../../contract"
import { type BestData, loadBest } from "./shared.server"

export type PostersData = BestData

export const load: SlotLoader<PostersData> = (args) => loadBest(args)
