// What the filters hide, where the list ends: when nothing matches, the empty state with the biggest ways back; after
// the last card, a closing cell with the same.
import type { FilterName, FilterState } from "~/domain/filter-state"
import { type FilterBarCounts, RecoveryList } from "~/ui/filter-bar"

export function HiddenTitles({
	counts,
	state,
	onDrop,
	onClear,
	canClear,
	searching = false,
}: {
	counts: FilterBarCounts
	state: FilterState
	onDrop: (filter: FilterName) => void
	onClear: () => void
	/** Whether any of the Filters sheet's filters are on. */
	canClear: boolean
	/** The results are a search's. */
	searching?: boolean
}) {
	const empty = counts.total === 0
	// A search that found nothing at all: no filter could bring anything back.
	const nothingFound = searching && empty && counts.hidden === 0
	if (!empty && !counts.recoveries.length) return null
	return (
		<div
			className={`flex flex-col justify-center gap-2 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 ${empty ? "col-span-full mx-auto w-full max-w-lg py-10" : "aspect-[2/3] scale-95"}`}
		>
			<p className="text-base font-bold text-white">
				{nothingFound
					? "No results for this search. Try other words."
					: empty
						? "Nothing matches all your filters"
						: `${counts.hidden.toLocaleString("en")} more hidden by your filters`}
			</p>
			{counts.recoveries.length > 0 && (
				<div className="-mx-3">
					<RecoveryList
						counts={counts}
						state={state}
						onDrop={onDrop}
						limit={3}
					/>
				</div>
			)}
			{empty && canClear && (
				<button
					type="button"
					onClick={onClear}
					className="mt-1 self-start rounded-md text-sm font-bold text-gray-300 underline-offset-2 hover:text-white hover:underline cursor-pointer"
				>
					Clear filters
				</button>
			)}
		</div>
	)
}
