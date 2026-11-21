// PROTOTYPE - throwaway (prototype/explore-r5). Page slot "country": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "country",
	label: "Country",
	order: 9,
	group: "page",
	applies: (address) => pageSlotOf(address) === "country",
	fallback: "next-door",
}
