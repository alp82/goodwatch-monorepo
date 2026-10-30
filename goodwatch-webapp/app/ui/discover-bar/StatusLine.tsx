// The status line under the bar (40 px; the open panel covers it): `lead` (Ready to watch on desktop), every other
// choice as a removable 40 px chip that opens its place in the panel (the query in amber with how the search read it),
// Clear all, and `end` (For you + Sort) on the right. The count lives at the page's top right (FilterMix).
import type { ReactNode, Ref } from "react"
import type { FilterState } from "~/domain/filter-state"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { SortOption } from "~/ui/filter-bar/labels"
import { BarChips } from "./BarChips"
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
	chips,
	reading,
	clearCount,
	onOpen,
	onChange,
	onClearSearch,
	onClearAll,
	lead,
	end,
	rowRef,
	className = "",
}: {
	chips: BarChip[]
	reading?: ReadingChip[]
	clearCount: number
	onOpen: (chip: BarChip) => void
	onChange: (change: (state: FilterState) => FilterState) => void
	onClearSearch: () => void
	onClearAll: () => void
	lead?: ReactNode
	end?: ReactNode
	/** The row, for measuring how much room the chips take (useControlSize). */
	rowRef?: Ref<HTMLDivElement>
	className?: string
}) {
	return (
		<div
			ref={rowRef}
			className={`flex items-center gap-3 ${className}`}
			style={{ height: STATUS_HEIGHT }}
		>
			{lead}
			<BarChips
				chips={chips}
				reading={reading}
				onOpen={onOpen}
				onChange={onChange}
				onClearSearch={onClearSearch}
				size="lg"
				className="-mr-1 h-10 max-lg:pr-1 lg:mr-0"
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
			{end && <div className="-mr-1 ml-auto shrink-0 lg:mr-0">{end}</div>}
		</div>
	)
}
