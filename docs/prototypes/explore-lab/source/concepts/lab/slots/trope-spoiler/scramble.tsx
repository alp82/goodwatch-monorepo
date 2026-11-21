// PROTOTYPE - throwaway (prototype/explore-r11). Trope spoilers, variant "scramble" (drawn in ../trope/spoil.tsx).
import type { SlotVariant } from "../../contract"
import { Spoiled, type SpoilerProps } from "../trope/spoil"

const View = (p: SpoilerProps) => <Spoiled {...p} look="scramble" />

export const variant: SlotVariant<never, SpoilerProps> = {
	id: "scramble",
	name: "Scramble",
	what: "The hidden words' line filled with characters that keep changing, in the text's own font; they fade as the real words come in. A second click scrambles them again.",
	order: 3,
	View,
}
