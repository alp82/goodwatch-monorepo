// PROTOTYPE - throwaway (prototype/explore-r9). Under a trope's examples, variant "Lean": the blends as one row of chips and
// the people behind it; the header keeps its small decade chart. Less to scroll past.
import type { SlotVariant } from "../../contract"
import { type BelowProps, People, Ways } from "../trope/below"

function Lean(p: BelowProps) {
	return (
		<div className="space-y-12">
			<Ways {...p} compact />
			<People d={p.d} />
		</div>
	)
}

export const variant: SlotVariant<never, BelowProps> = {
	id: "lean",
	name: "Lean",
	what: "The blends it fits as one row of chips, then the people behind it; the header keeps its small decade chart. Less to scroll past.",
	order: 2,
	View: Lean,
}
