// PROTOTYPE - throwaway. Round 4 variant 5, "More starts with a search": V's segmented bar and morphing panel (round
// 4's Search segment), with a More panel that leads with a large "Find a filter" field, a row of often used presets,
// and the niche groups as tiles; a tile opens its group with every filter at full size.
import type { ProtoDiscover } from "../kit"
import { BaseVariant } from "./R4-5-base"
import { MoreSearchFirst } from "./R4-5-more"

export const NAME = "More starts with a search"

export function VariantR4_5({ d }: { d: ProtoDiscover }) {
	return <BaseVariant d={d} More={MoreSearchFirst} />
}
