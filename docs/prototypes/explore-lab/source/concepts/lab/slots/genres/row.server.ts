// PROTOTYPE - throwaway (prototype/explore-r9). Genres index, variant "Chip row": every genre with its kinds. Read-only.
import type { SlotLoader } from "../../contract"
import { type AtlasData, loadAtlas } from "./atlas.server"

export const load: SlotLoader<AtlasData> = ({ kit }) => loadAtlas(kit, 4, 6)
