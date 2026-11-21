// PROTOTYPE - throwaway (prototype/explore-r6; functional pickers since r9). Page slot "genres": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "genres",
	label: "Genres",
	order: 4,
	group: "page",
	applies: (address) => pageSlotOf(address) === "genres",
	fallback: "tiles",
}
