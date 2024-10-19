import React from "react"
import type { DiscoverParams } from "~/server/discover.server"
import {
	type DiscoverFilterType,
	discoverFilters,
} from "~/server/types/discover-types"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import Appear from "~/ui/fx/Appear"

interface AddFilterBarParams {
	params: DiscoverParams
	isVisible: boolean
	onSelect: (filterType: DiscoverFilterType) => void
}

export default function AddFilterBar({
	params,
	isVisible,
	onSelect,
}: AddFilterBarParams) {
	const unusedFilters = Object.entries(discoverFilters).filter(
		([_, discoverFilter]) => {
			return (
				discoverFilter.associatedParams.filter((associatedParam) => {
					return params[associatedParam]
				}).length === 0
			)
		},
	)

	return (
		<div className="m-auto max-w-7xl w-full px-4 flex flex-col flex-wrap gap-1 text-sm border-gray-900 rounded-lg">
			<Appear isVisible={Boolean(isVisible)}>
				<FilterBarSection label="Add Filter" isActive={true} color="stone">
					<div className="my-4 flex items-center flex-wrap gap-4 text-sm sm:text-base md:text-lg">
						{unusedFilters.map(([filterType, discoverFilter]) => (
							<button
								key={filterType}
								type="button"
								className="rounded-md bg-gray-700 px-2.5 py-1.5 font-semibold text-white shadow-sm hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700 cursor-pointer"
								onClick={() => onSelect(filterType as DiscoverFilterType)}
							>
								{discoverFilter.label}
							</button>
						))}
					</div>
				</FilterBarSection>
			</Appear>
		</div>
	)
}
