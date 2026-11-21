// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "genre": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "genre",
	label: "Genre",
	order: 5,
	group: "page",
	applies: (address) => pageSlotOf(address) === "genre",
	fallback: "grid-first",
}
