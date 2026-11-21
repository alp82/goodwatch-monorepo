// PROTOTYPE - throwaway (prototype/explore-r11). Trope spoilers, variant "shimmer" (drawn in ../trope/spoil.tsx).
import type { SlotVariant } from "../../contract"
import { Spoiled, type SpoilerProps } from "../trope/spoil"

const View = (p: SpoilerProps) => <Spoiled {...p} look="specks" />

export const variant: SlotVariant<never, SpoilerProps> = {
	id: "shimmer",
	name: "Specks",
	what: "Drifting light specks over the hidden words, each one placed at random so nothing repeats; they scatter as the words come in. A shown spoiler keeps a faint dotted mark, and a second click hides it again.",
	order: 1,
	View,
}
