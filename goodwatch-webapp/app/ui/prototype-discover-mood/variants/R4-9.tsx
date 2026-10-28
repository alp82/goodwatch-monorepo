// PROTOTYPE - throwaway. Round 4 variant 9, "More as a chip index": V's segmented bar and morphing panel (round 4's
// Search segment), with a More panel that shows every niche filter as a chip under four group labels on one screen;
// a chip opens its control in a focused area beside the index (below on phones), and set filters show their value.
import type { ProtoDiscover } from "../kit"
import { BaseVariant } from "./R4-9-base"
import { MoreChipIndex } from "./R4-9-more"

export const NAME = "More as a chip index"

export function VariantR4_9({ d }: { d: ProtoDiscover }) {
	return <BaseVariant d={d} More={MoreChipIndex} />
}
