// PROTOTYPE - throwaway (prototype/explore-r7). Tropes index, variant "Trope cards".
import type { SlotLoader } from "../../contract"
import type { TropesIndexData } from "./model"
import { loadIndex } from "./model.server"

export const load: SlotLoader<TropesIndexData> = ({ kit }) => loadIndex(kit)
