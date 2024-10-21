import { PlusIcon, UserIcon } from "@heroicons/react/24/solid"
import React from "react"
import type { DiscoverFilters, DiscoverParams } from "~/server/discover.server"
import type { DiscoverFilterType } from "~/server/types/discover-types"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import OneOrMoreItems from "~/ui/filter/OneOrMoreItems"
import SectionGenre from "~/ui/filter/sections/SectionGenre"
import SectionScore from "~/ui/filter/sections/SectionScore"
import SectionStreaming from "~/ui/filter/sections/SectionStreaming"

interface FilterBarParams {
	params: DiscoverParams
	filters: DiscoverFilters
	filterToEdit: DiscoverFilterType | null
	isAddingFilter: boolean
	onAddToggle: () => void
	onEditToggle: (filterType: DiscoverFilterType | null) => void
}

export default function FilterBar({
	params,
	filters,
	filterToEdit,
	isAddingFilter,
	onAddToggle,
	onEditToggle,
}: FilterBarParams) {
	const cast = filters.castMembers || []

	const handleClose = () => {
		onEditToggle(null)
	}

	return (
		<div className="m-auto max-w-7xl w-full px-4 flex flex-col flex-wrap gap-1 text-sm border-gray-900 rounded-lg">
			<div className="flex flex-wrap items-stretch gap-1">
				<SectionStreaming
					params={params}
					editing={filterToEdit === "streaming"}
					onEdit={() => onEditToggle("streaming")}
					onClose={handleClose}
				/>

				<SectionGenre
					params={params}
					editing={filterToEdit === "genre"}
					onEdit={() => onEditToggle("genre")}
					onClose={handleClose}
				/>

				<SectionScore
					params={params}
					editing={filterToEdit === "score"}
					onEdit={() => onEditToggle("score")}
					onClose={handleClose}
				/>

				{params.minYear && params.maxYear && (
					<FilterBarSection
						label="Release"
						color="cyan"
						isActive={filterToEdit === "release"}
						onToggle={() => onEditToggle("release")}
					>
						<span className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded">
							{params.minYear === params.maxYear ? (
								<>{params.maxYear}</>
							) : (
								<>
									{params.minYear} - {params.maxYear}
								</>
							)}
						</span>
					</FilterBarSection>
				)}

				{cast.length > 0 && (
					<FilterBarSection
						label="Cast"
						color="purple"
						isActive={filterToEdit === "cast"}
						onToggle={() => onEditToggle("cast")}
					>
						<div className="flex flex-wrap items-center gap-2">
							{cast.map((castMember, index) => (
								<OneOrMoreItems
									key={castMember}
									index={index}
									amount={cast.length}
								>
									<span className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded">
										<UserIcon className="h-5 w-5 flex-shrink-0" />
										{castMember}
									</span>
								</OneOrMoreItems>
							))}
						</div>
					</FilterBarSection>
				)}

				<FilterBarSection
					isCompact={true}
					color="stone"
					isActive={isAddingFilter}
					onToggle={onAddToggle}
				>
					<PlusIcon className="h-16" />
				</FilterBarSection>
			</div>
		</div>
	)
}
