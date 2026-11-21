// PROTOTYPE - throwaway (prototype/explore-r9). Under a trope's examples, variant "Full rows": how it grew as a tall
// row of decades with their posters, the blends it fits as cards, and the people behind it.
import type { SlotVariant } from "../../contract"
import { type BelowProps, People, Timeline, Ways } from "../trope/below"

function Rows(p: BelowProps) {
	return (
		<div className="space-y-14">
			<Timeline {...p} />
			<Ways {...p} />
			<People d={p.d} />
		</div>
	)
}

export const variant: SlotVariant<never, BelowProps> = {
	id: "rows",
	name: "Full rows",
	what: "How it grew as a tall row (each decade's share and its best-known three), the moods, genres, decades and countries it blends well with as cards, then the people behind it.",
	order: 1,
	View: Rows,
}
