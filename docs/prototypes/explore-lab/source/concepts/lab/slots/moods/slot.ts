// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "moods": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "moods",
	label: "Moods",
	order: 2,
	group: "page",
	applies: (address) => pageSlotOf(address) === "moods",
	fallback: "still-faint",
}
