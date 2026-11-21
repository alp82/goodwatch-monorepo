// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "best": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "best",
	label: "Best",
	order: 12,
	group: "page",
	applies: (address) => pageSlotOf(address) === "best",
	fallback: "posters",
}
