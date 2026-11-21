// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "hub": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "hub",
	label: "Hub",
	order: 1,
	group: "page",
	applies: (address) => pageSlotOf(address) === "hub",
	fallback: "miniatures",
}
