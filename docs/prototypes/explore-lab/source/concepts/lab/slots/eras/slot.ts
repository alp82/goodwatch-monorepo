// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "eras": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "eras",
	label: "Eras",
	order: 6,
	group: "page",
	applies: (address) => pageSlotOf(address) === "eras",
	fallback: "scrub",
}
