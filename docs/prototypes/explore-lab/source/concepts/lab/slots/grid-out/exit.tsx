// PROTOTYPE - throwaway (prototype/explore-r7, slot "grid-out"). See slot.ts; the kit draws it, this view draws nothing.
import type { SlotVariant } from "../../contract"

export const variant: SlotVariant<never, object> = {
	id: "exit",
	name: "Amber exit",
	what: "After the sort, past a thin divider: an amber Open in Discover link with an arrow up and out, no pill. The footer carries it too, and the end of the list is a large card.",
	order: 1,
	View: () => null,
}
