// PROTOTYPE - throwaway. Round 4 variant 4, "More with side groups": V's segmented bar and morphing panel; More has a
// short group list on the left (with what's set in each) and every filter of the chosen group on the right at once,
// as a grid of their real controls. The list ends with Find a filter, which swaps the right side for matches.
import type { ProtoDiscover } from "../kit"
import { MoreSideGroups } from "./R4-4-more"
import { Shell } from "./R4-4-shell"

export const NAME = "More with side groups"

export function VariantR4_4({ d }: { d: ProtoDiscover }) {
	return <Shell d={d} More={MoreSideGroups} />
}
