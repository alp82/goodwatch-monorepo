// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "other": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "other",
	label: "Other",
	order: 14,
	group: "page",
	applies: (address) => pageSlotOf(address) === "other",
	fallback: "grid-first",
}
