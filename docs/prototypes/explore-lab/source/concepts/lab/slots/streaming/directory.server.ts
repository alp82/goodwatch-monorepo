// PROTOTYPE - throwaway (prototype/explore-r7, slot "streaming"). Variant "Directory".
import type { SlotLoader } from "../../contract"
import { type StreamDir, streamDir } from "./shared.server"

export const load: SlotLoader<StreamDir> = ({ kit }) => streamDir(kit)
