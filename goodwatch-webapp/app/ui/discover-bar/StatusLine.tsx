// The status line under the bar (40 px; the open panel covers it): the count, every choice as a removable chip that
// opens its place in the panel (the query in amber with how the search read it), Clear all, and the sort on the
// right.
import type { ReactNode } from "react"
import type { FilterState } from "~/domain/filter-state"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { SortControl } from "~/ui/filter-bar/controls"
import type { SortOption } from "~/ui/filter-bar/labels"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import { BarChips } from "./BarChips"
import { CountText } from "./PanelFooter"
import type { BarChip } from "./chips"

export const STATUS_HEIGHT = 40

export interface SortChoice {
	options: SortOption[]
	value: string
	onChange: (sort: string) => void
	footnote?: string
	/** The way in to the sorts that need taste, for a viewer without an account. */
	signUp?: ReactNode
}

export function StatusLine({
	counts,
	searching,
	chips,
	reading,
	clearCount,
	sort,
	onOpen,
	onChange,
	onClearSearch,
	onClearAll,
	className = "",
}: {
	counts: FilterBarCounts | null
	searching: boolean
	chips: BarChip[]
	reading?: ReadingChip[]
	clearCount: number
	sort: SortChoice
	onOpen: (chip: BarChip) => void
	onChange: (change: (state: FilterState) => FilterState) => void
	onClearSearch: () => void
	onClearAll: () => void
	className?: string
}) {
	return (
		<div
			className={`flex items-center gap-3 ${className}`}
			style={{ height: STATUS_HEIGHT }}
		>
			<span className="shrink-0">
				<CountText counts={counts} searching={searching} />
			</span>
			<BarChips
				chips={chips}
				reading={reading}
				onOpen={onOpen}
				onChange={onChange}
				onClearSearch={onClearSearch}
				className="-mr-1 h-10 lg:mr-0"
				trail={
					clearCount > 0 && (
						<button
							type="button"
							onClick={onClearAll}
							className="shrink-0 rounded-md px-1.5 py-1 text-sm whitespace-nowrap text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							Clear all
						</button>
					)
				}
			/>
			<div className="shrink-0 max-lg:[&_[data-sort-button]>span.text-gray-400]:hidden">
				<SortControl
					options={sort.options}
					value={sort.value}
					onChange={sort.onChange}
					footnote={sort.footnote}
					signUp={sort.signUp}
					size="sm"
					align="right"
				/>
			</div>
		</div>
	)
}
