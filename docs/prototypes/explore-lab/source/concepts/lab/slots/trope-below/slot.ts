// PROTOTYPE - throwaway (prototype/explore-r9). Sub-slot of the trope page: the sections under the examples, as the
// mood, country and era pages have. Variants take ../trope/below.tsx `BelowProps`.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "trope-below",
	label: "Below",
	order: 23,
	group: "part",
	applies: (address) => pageSlotOf(address) === "trope",
	fallback: "rows",
}
