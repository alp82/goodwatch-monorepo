// PROTOTYPE - throwaway (prototype/explore-r5, slot "blend-entry"). Nothing in the head: a blend starts further down
// the page, under "Goes well with" (the round 4 pages).
import type { SlotVariant } from "../../contract"
import type { EntryProps } from "./slot"

export const variant: SlotVariant<never, EntryProps> = {
	id: "none",
	name: "None",
	what: "Nothing next to the title. A blend starts further down the page, as in round 4.",
	order: 0,
	View: () => null,
}
