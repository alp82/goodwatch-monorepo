// PROTOTYPE - throwaway (prototype/explore-r5; r7: directory and wall). Page slot "streaming": see pages.ts for the addresses it renders.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "streaming",
	label: "Streaming",
	order: 10,
	group: "page",
	applies: (address) => pageSlotOf(address) === "streaming",
	fallback: "directory",
}
