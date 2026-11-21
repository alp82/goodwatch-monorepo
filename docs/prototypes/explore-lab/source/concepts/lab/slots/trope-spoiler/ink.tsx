// PROTOTYPE - throwaway (prototype/explore-r11). Trope spoilers, variant "ink" (drawn in ../trope/spoil.tsx).
import type { SlotVariant } from "../../contract"
import { Spoiled, type SpoilerProps } from "../trope/spoil"

const View = (p: SpoilerProps) => <Spoiled {...p} look="ink" />

export const variant: SlotVariant<never, SpoilerProps> = {
	id: "ink",
	name: "Ink",
	what: "A ragged bar of ink in the trope's color over the hidden words; on a click it pulls back to the right. A second click inks them again.",
	order: 4,
	View,
}
