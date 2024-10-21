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
				<div className="flex items-center flex-wrap gap-2 text-sm sm:text-base md:text-lg">
					<span className="font-extrabold text-sm">Add Filter:</span>
					{unusedFilters.map(([filterType, discoverFilter]) => (
						<FilterBarSection
							key={filterType}
							isCompact={true}
							isActive={false}
							color={discoverFilter.color}
							onToggle={() => onSelect(filterType as DiscoverFilterType)}
						>
							<span className="px-1.5 py-0.5 font-semibold">
								{discoverFilter.label}
							</span>
						</FilterBarSection>
					))}
				</div>
			</Appear>
		</div>
	)
}
