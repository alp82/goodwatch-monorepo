// PROTOTYPE - throwaway (prototype/explore-r7). Part slot "grid-out": where the way out to Discover shows over a room
// page's grid (era, country, service). The owner: "make the more filters styled differently to make sure it's going
// somewhere else. lets try different things", and the grid's footer "can have that link, and it can be more
// prominent". Both keep the link in the controls row and the footer; they differ in how it looks. The kit reads the pick
// through `GridOut` (kit/ui/ListControls.tsx), provided in concepts/lab/index.tsx; the views draw nothing themselves.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "grid-out",
	label: "Way to Discover",
	order: 22,
	group: "part",
	applies: (address) => ["era", "country", "service"].includes(pageSlotOf(address) ?? ""),
	fallback: "match",
}
