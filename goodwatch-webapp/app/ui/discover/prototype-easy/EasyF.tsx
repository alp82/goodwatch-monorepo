// PROTOTYPE (discover-easy) F "In the field": the reading sits inside the search box on a second line under the
// typed text, in both modes; the text line stays where it is.
import { FilterList, FingerprintList, LockedUnseen, qualitiesOf } from "./reading"
import type { Easy } from "./types"

export const name = "In the field"

export function EasyFInside({ e }: { e: Easy }) {
	const filters = e.chips.filter((c) => c.kind !== "query")
	if (!qualitiesOf(e.reading).length && !filters.length) return null
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.07] pt-2.5">
			<FingerprintList reading={e.reading} />
			{qualitiesOf(e.reading).length > 0 && filters.length > 0 && <span className="hidden h-3.5 w-px bg-white/10 lg:block" />}
			<FilterList chips={e.chips} onOpen={e.open} onRemove={e.remove} />
			{!e.member && e.filters.state.onMyServices && <LockedUnseen />}
		</div>
	)
}
