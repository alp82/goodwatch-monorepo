// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "service": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "service",
	label: "Service",
	order: 11,
	group: "page",
	applies: (address) => pageSlotOf(address) === "service",
	fallback: "r4",
}
