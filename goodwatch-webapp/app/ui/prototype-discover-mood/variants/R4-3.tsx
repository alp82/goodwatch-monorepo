// PROTOTYPE - throwaway. Round 4 variant 3, "More as quiet tiers": V's segmented bar and morphing panel; More shows
// every niche filter as a calm card in a 3-column grid (icon, name, value or "Any", amber once set). A tap opens one
// at full panel width in place while the others fold into a compact row above and below. Find a filter on top.
import type { ProtoDiscover } from "../kit"
import { MoreTiers } from "./R4-3-more"
import { Shell } from "./R4-3-shell"

export const NAME = "More as quiet tiers"

export function VariantR4_3({ d }: { d: ProtoDiscover }) {
	return <Shell d={d} More={MoreTiers} />
}
