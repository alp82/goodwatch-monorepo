// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "era": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "era",
	label: "Era",
	order: 7,
	group: "page",
	applies: (address) => pageSlotOf(address) === "era",
	fallback: "years",
}
