// PROTOTYPE - throwaway (prototype/explore-r7, slot "grid-out"). See slot.ts; the kit draws it, this view draws nothing.
import type { SlotVariant } from "../../contract"

export const variant: SlotVariant<never, object> = {
	id: "match",
	name: "Like the mood page",
	what: "The mood grid's treatment: a quiet underlined More filters in Discover beside the sort, the same link in the footer, an amber Keep going in Discover on the last page.",
	order: 0,
	View: () => null,
}
