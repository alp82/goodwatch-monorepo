// Under the awards row of the Filters list: won or nominated, and which awards, without a trip into Watch > Awards.
import type { AwardOutcome } from "~/domain/award-filter"
import type { FilterState } from "~/domain/filter-state"
import { Segmented } from "~/ui/filter-bar/SheetControls"
import { AwardBodyChips, setAwardOutcome } from "./watch/AwardsTab"

export function AwardsRowPicker({
	state,
	update,
}: {
	state: FilterState
	update: (change: (state: FilterState) => FilterState) => void
}) {
	if (!state.awards) return null
	return (
		<div className="mb-2 ml-5 flex flex-col gap-2 border-l border-white/10 pl-3">
			<Segmented<AwardOutcome>
				small
				label="Award result in Filters"
				value={state.awards.outcome}
				onChange={(next) => update((s) => setAwardOutcome(s, next))}
				options={[
					{ id: "won", label: "Won" },
					{ id: "nominated", label: "Nominated or won" },
				]}
			/>
			<AwardBodyChips state={state} update={update} limit={4} />
		</div>
	)
}
