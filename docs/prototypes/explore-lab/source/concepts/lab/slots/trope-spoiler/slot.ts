// PROTOTYPE - throwaway (prototype/explore-r9). Sub-slot of the trope page: how a write-up holds its spoilers back.
// Variants draw ../trope/spoil.tsx: `<Part slot="trope-spoiler" e={example} tint={color} />`. Round 11: four styles
// (specks, frost, scramble, ink); every one keeps the text's space, re-hides on a second click and works with the page
// switch, which is always shown over the examples.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "trope-spoiler",
	label: "Spoilers",
	order: 22,
	group: "part",
	applies: (address) => pageSlotOf(address) === "trope",
	fallback: "shimmer",
}
