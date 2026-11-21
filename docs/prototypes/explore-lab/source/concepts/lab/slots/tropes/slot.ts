// PROTOTYPE - throwaway (prototype/explore-r6). Page slot "tropes": the tropes index (/movies/tropes). Tropes are
// TV Tropes' named storytelling devices, read from the per-title trope rows (kit/tropes.ts, kit/tropes.server.ts).
// Its variants share the loader in model.server.ts; the trope page is the slot "trope".
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "tropes",
	label: "Tropes",
	order: 15,
	group: "page",
	applies: (address) => pageSlotOf(address) === "tropes",
	fallback: "cards",
}
