// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "blend": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "blend",
	label: "Blend",
	order: 13,
	group: "page",
	applies: (address) => pageSlotOf(address) === "blend",
	fallback: "grid",
}
