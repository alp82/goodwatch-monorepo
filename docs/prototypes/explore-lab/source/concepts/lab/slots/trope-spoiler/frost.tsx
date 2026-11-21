// PROTOTYPE - throwaway (prototype/explore-r11). Trope spoilers, variant "frost" (drawn in ../trope/spoil.tsx).
import type { SlotVariant } from "../../contract"
import { Spoiled, type SpoilerProps } from "../trope/spoil"

const View = (p: SpoilerProps) => <Spoiled {...p} look="frost" />

export const variant: SlotVariant<never, SpoilerProps> = {
	id: "frost",
	name: "Frost",
	what: "The hidden words' own shapes, blurred to a soft glow with fine grain; on a click the blur sharpens into the words. A second click blurs them again.",
	order: 2,
	View,
}
