// Movies or shows with the anime switch under it, as the sheet's type card has them, with live counts on the options
// not chosen. The counts hide in place while they are stale, so no old count shows and nothing moves.
import { Segmented } from "~/ui/filter-bar/SheetControls"
import { ANIME_LABELS, TYPE_LABELS } from "~/ui/filter-bar/labels"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import type { FilterStateBinding } from "~/ui/filter-bar/useFilterState"

export function TypeBlock({
	filters,
	counts,
	fresh,
	className = "",
}: {
	filters: FilterStateBinding
	counts: FilterBarCounts | null
	/** False while the counts are the previous answer's. */
	fresh: boolean
	className?: string
}) {
	const { state } = filters
	const count = (group: "type" | "anime", option: string) =>
		counts?.optionCounts[group]?.[option] ?? null
	return (
		<div className={`flex flex-col gap-2 ${className}`}>
			<div className="flex">
				<Segmented
					label="Movies or shows"
					pending={!fresh}
					value={state.type}
					onChange={(type) => filters.set({ type })}
					options={(["all", "movie", "show"] as const).map((id) => ({
						id,
						label: id === "all" ? "Both" : TYPE_LABELS[id],
						count: count("type", id),
					}))}
				/>
			</div>
			<div className="flex">
				<Segmented
					label="Anime"
					small
					pending={!fresh}
					value={state.anime}
					onChange={(anime) => filters.set({ anime })}
					options={(["any", "only", "none"] as const).map((id) => ({
						id,
						label: id === "any" ? "With anime" : ANIME_LABELS[id],
						count: count("anime", id),
					}))}
				/>
			</div>
		</div>
	)
}
