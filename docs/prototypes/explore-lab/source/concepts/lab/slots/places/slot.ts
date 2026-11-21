// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "places": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "places",
	label: "Places",
	order: 8,
	group: "page",
	applies: (address) => pageSlotOf(address) === "places",
	fallback: "tuned",
}
