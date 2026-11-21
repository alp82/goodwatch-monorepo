// PROTOTYPE - throwaway (prototype/explore-r9). Sub-slot of the trope page: the examples body between the header and
// the sidebar. Round 8's Casebook won ("the best out of the three"); its variants keep the cases and make browsing
// quick. Variants take `BodyProps` (../trope/body.ts): `<Part slot="trope-body" d={data} cases={cases} ... />`.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "trope-body",
	label: "Examples",
	order: 21,
	group: "part",
	applies: (address) => pageSlotOf(address) === "trope",
	fallback: "cases",
}
