// Watch > Awards: won or nominated, then which awards (any by default). Writes `awards` (domain/award-filter.ts).
// The Filters list shows the same choices under its awards row (AwardsRowPicker).
import {
	AWARD_BODIES,
	type AwardOutcome,
	awardChipLimit,
	toggleAwardBody,
} from "~/domain/award-filter"
import type { FilterState } from "~/domain/filter-state"
import { ChipList, Segmented } from "~/ui/filter-bar/SheetControls"
import type { SubTabView } from "../DiscoverControls"
import { BlockHead, ClearLink, tabPad } from "./parts"

type Update = (change: (state: FilterState) => FilterState) => void
type Choice = "any" | AwardOutcome

export function setAwardOutcome(
	state: FilterState,
	choice: Choice,
): FilterState {
	if (choice === "any") return { ...state, awards: undefined }
	return {
		...state,
		awards: { outcome: choice, bodies: state.awards?.bodies ?? [] },
	}
}

/** "Any award" and the award bodies as chips; every one shows unless there are more than 30. */
export function AwardBodyChips({
	state,
	update,
	limit,
}: {
	state: FilterState
	update: Update
	/** How many show before "+N more", once there are more than 30. */
	limit: number
}) {
	const picked = state.awards?.bodies ?? []
	const options = [
		{
			id: "any",
			label: "Any award",
			active: Boolean(state.awards) && picked.length === 0,
			count: null,
			toggle: () =>
				update((s) => ({
					...s,
					awards: { outcome: s.awards?.outcome ?? "won", bodies: [] },
				})),
		},
		...AWARD_BODIES.map((body) => ({
			id: body.id,
			label: body.name,
			active: picked.includes(body.id),
			count: null,
			toggle: () =>
				update((s) => ({ ...s, awards: toggleAwardBody(s.awards, body.id) })),
		})),
	]
	return (
		<ChipList options={options} limit={awardChipLimit(options.length, limit)} />
	)
}

export function AwardsTab({ view }: { view: SubTabView }) {
	const { phone } = view
	const { state, update } = view.filters
	const choice: Choice = state.awards?.outcome ?? "any"
	return (
		<div className={`${tabPad(phone)} flex flex-col gap-6`}>
			<section
				aria-label="Award result"
				className={phone ? "" : "max-w-[460px]"}
			>
				<BlockHead
					right={
						<ClearLink
							show={Boolean(state.awards)}
							onClick={() => update((s) => ({ ...s, awards: undefined }))}
						/>
					}
				>
					Awards
				</BlockHead>
				<Segmented<Choice>
					label="Award result"
					value={choice}
					onChange={(next) => update((s) => setAwardOutcome(s, next))}
					options={[
						{ id: "any", label: "Any title" },
						{ id: "won", label: "Won" },
						{ id: "nominated", label: "Nominated or won" },
					]}
				/>
			</section>
			<section aria-label="Which awards">
				<BlockHead note={state.awards?.bodies.length ? undefined : "any"}>
					Which awards
				</BlockHead>
				<AwardBodyChips state={state} update={update} limit={phone ? 5 : 7} />
			</section>
		</div>
	)
}
