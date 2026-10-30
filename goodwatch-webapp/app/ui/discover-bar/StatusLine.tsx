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
import { CountTip } from "./prototype-essentials/CountTip"
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
	lead,
	beforeSort,
	meter = false,
	hideSort = false,
	noCount = false,
	rowRef,
	state,
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
	/** PROTOTYPE essentials: after the count, and before the sort. */
	lead?: ReactNode
	beforeSort?: ReactNode
	/** PROTOTYPE: the count with the hidden meter under it, as in the panel footer. */
	meter?: boolean
	/** PROTOTYPE: the sort lives elsewhere (the heading row). */
	hideSort?: boolean
	/** PROTOTYPE: the count lives in the heading row. */
	noCount?: boolean
	rowRef?: React.Ref<HTMLDivElement>
	state?: FilterState
	className?: string
}) {
	return (
		<div
			ref={rowRef}
			className={`flex items-center gap-3 ${className}`}
			style={{ height: STATUS_HEIGHT }}
		>
			<span className={`shrink-0 ${noCount ? "hidden" : ""}`}>
				{meter && state ? (
					<CountTip counts={counts} searching={searching} state={state} />
				) : (
					<CountText counts={counts} searching={searching} />
				)}
			</span>
			{lead}
			<BarChips
				chips={chips}
				reading={reading}
				onOpen={onOpen}
				onChange={onChange}
				onClearSearch={onClearSearch}
				className={`-mr-1 h-10 lg:mr-0 ${meter ? "max-lg:pr-1" : ""}`}
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
			{beforeSort}
			<div className={`${hideSort ? "hidden" : ""} shrink-0 max-lg:[&_[data-sort-button]>span.text-gray-400]:hidden`}>
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
