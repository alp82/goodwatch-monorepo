// PROTOTYPE (discover-easy) round 4 E "Strip": one fixed-height row under the search that never wraps: fingerprint,
// then filters, scrolling sideways when long; Ready at its end. The page never moves when a search runs.
import { FilterList, FingerprintList, qualitiesOf } from "./reading"
import type { Easy } from "./bits"

export const name = "Strip"

export function EasyE({ e }: { e: Easy }) {
	const has = qualitiesOf(e.reading).length > 0 || e.chips.some((c) => c.kind !== "query")
	return (
		<div className="mt-3 flex flex-col gap-3 lg:h-11 lg:flex-row lg:items-center lg:gap-4">
			<div
				className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto pl-1 [scrollbar-width:none]"
				style={{ maskImage: "linear-gradient(to right, black 92%, transparent)" }}
			>
				{has && (
					<>
						<FingerprintList reading={e.reading} className="shrink-0 flex-nowrap!" />
						<span className="h-4 w-px shrink-0 bg-white/10" />
						<FilterList chips={e.chips} onOpen={e.open} onRemove={e.remove} className="shrink-0 flex-nowrap!" />
						<button type="button" onClick={e.customize} className="shrink-0 cursor-pointer pr-6 text-[12px] font-semibold text-amber-400 hover:text-amber-300">
							More filters
						</button>
					</>
				)}
			</div>
			<div className="shrink-0">{e.ready}</div>
		</div>
	)
}
