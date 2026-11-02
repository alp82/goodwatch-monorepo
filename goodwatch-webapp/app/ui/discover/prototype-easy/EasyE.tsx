// PROTOTYPE (discover-easy) E "Strip": one fixed-height line under the search, in both modes, that never wraps:
// fingerprint, then filters, scrolling sideways when long.
import { FilterList, FingerprintList, qualitiesOf } from "./reading"
import type { Easy } from "./types"

export const name = "Strip"

export function EasyE({ e }: { e: Easy }) {
	const has = qualitiesOf(e.reading).length > 0 || e.chips.some((c) => c.kind !== "query")
	if (!has) return null
	return (
		<div
			className="mt-3 flex h-8 min-w-0 items-center gap-4 overflow-x-auto pl-1 [scrollbar-width:none] lg:pl-7"
			style={{ maskImage: "linear-gradient(to right, black 94%, transparent)" }}
		>
			<FingerprintList reading={e.reading} className="shrink-0 flex-nowrap!" />
			{qualitiesOf(e.reading).length > 0 && <span className="h-4 w-px shrink-0 bg-white/10" />}
			<FilterList chips={e.chips} onOpen={e.open} onRemove={e.remove} className="shrink-0 flex-nowrap!" />
			<button type="button" onClick={e.customize} className="shrink-0 cursor-pointer pr-8 text-[12px] font-semibold text-amber-400 hover:text-amber-300">
				More filters
			</button>
		</div>
	)
}
