// PROTOTYPE - throwaway (prototype/explore-r8). Part slot "blend-room": which rooms the row lights on a blend. The
// owner came to "Graphic movies from the 1990s" from an era and saw Genres lit: "confusing to show genres always as
// active for blend pages". The lab's frame reads the pick and hands it to the rooms row (`concepts/rooms/bar.tsx`).
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "blend-room",
	label: "Row on a blend",
	order: 22,
	group: "part",
	applies: (address) => pageSlotOf(address) === "blend",
	fallback: "all",
}
