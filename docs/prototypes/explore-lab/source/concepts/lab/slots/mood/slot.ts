// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "mood": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "mood",
	label: "Mood",
	order: 3,
	group: "page",
	applies: (address) => pageSlotOf(address) === "mood",
	fallback: "grid-first",
}
