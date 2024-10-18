import React from "react"
import {
	DISCOVER_FILTER_TYPES,
	type DiscoverFilterType,
} from "~/server/types/discover-types"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import Appear from "~/ui/fx/Appear"

interface AddFilterBarParams {
	isVisible: boolean
	onSelect: (filterType: DiscoverFilterType) => void
}

export default function AddFilterBar({
	isVisible,
	onSelect,
}: AddFilterBarParams) {
	return (
		<div className="m-auto max-w-7xl w-full px-4 flex flex-col flex-wrap gap-1 text-sm border-gray-900 rounded-lg">
			<Appear isVisible={Boolean(isVisible)}>
				<FilterBarSection label="Add Filter" isActive={true} color="stone">
					<div className="my-4 flex items-center flex-wrap gap-4 text-sm sm:text-base md:text-lg">
						{DISCOVER_FILTER_TYPES.map((filterType) => (
							<button
								key={filterType}
								type="button"
								className="rounded-md bg-gray-700 px-2.5 py-1.5 font-semibold text-white shadow-sm hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700 cursor-pointer"
								onClick={() => onSelect(filterType)}
							>
								{filterType}
							</button>
						))}
					</div>
				</FilterBarSection>
			</Appear>
		</div>
	)
}
