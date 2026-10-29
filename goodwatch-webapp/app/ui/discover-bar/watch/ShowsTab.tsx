// Watch > Shows. Seasons with Status under it on the left, Time to finish on the right, so the two rows of tiles line
// up. Writes `seasons`, `showStatus` and `hours`. These are show facts: the block dims while the list holds only movies.
//
// Counts come with `counts=shows` (optionCounts.shows) and show only when the response has them; without the facts the
// choices don't narrow and the tiles show no counts.
import { SHOW_STATUS_LABELS } from "~/domain/title-scales"
import { compactCount } from "~/ui/filter-bar/labels"
import type { SubTabView } from "../DiscoverControls"
import { appliedStateOf } from "../tabs"
import { MarkChip, SteppedBlock, fieldCounts } from "./glyph-tiles"
import { BlockHead, ClearLink, tabPad } from "./parts"
import { knownCount } from "./stepped-choices"

const STATUSES = ["running", "ended", "canceled"] as const

export function ShowsTab({ view }: { view: SubTabView }) {
	const { phone } = view
	const { state, update } = view.filters
	const applied = appliedStateOf(state, view.data.context)
	const shows = view.counts?.optionCounts.shows ?? null
	const off = state.type === "movie"
	const total = (field: "seasons" | "hours") => {
		const n = knownCount(field, fieldCounts(view, field))
		return n === null ? null : compactCount(n)
	}
	const block = `flex min-w-0 flex-col transition-opacity ${off ? "opacity-45" : ""}`
	return (
		<div
			className={`${tabPad(phone)} ${phone ? "flex flex-col gap-7" : "grid grid-cols-2 gap-10"}`}
		>
			<section aria-label="Seasons and status" className={block}>
				<SteppedBlock
					view={view}
					field="seasons"
					title="Seasons"
					note={total("seasons")}
					cols={["grid-cols-2", "grid-cols-2"]}
				/>
				<div className="mt-5">
					<BlockHead
						right={
							<ClearLink
								show={applied.showStatus !== undefined}
								onClick={() =>
									update((st) => ({ ...st, showStatus: undefined }))
								}
							>
								Any
							</ClearLink>
						}
					>
						Status
					</BlockHead>
					<div className="flex flex-wrap gap-1.5">
						{STATUSES.map((status) => {
							const active = applied.showStatus === status
							return (
								<MarkChip
									key={status}
									status={status}
									label={SHOW_STATUS_LABELS[status]}
									count={shows ? (shows[`status:${status}`] ?? 0) : null}
									active={active}
									onClick={() =>
										update((st) => ({
											...st,
											showStatus: st.showStatus === status ? undefined : status,
										}))
									}
								/>
							)
						})}
					</div>
				</div>
			</section>
			<section aria-label="Time to finish" className={block}>
				<SteppedBlock
					view={view}
					field="hours"
					title="Time to finish"
					note={total("hours")}
					cols={["grid-cols-2", "grid-cols-2"]}
				/>
			</section>
		</div>
	)
}
