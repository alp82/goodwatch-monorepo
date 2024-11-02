import { PlusIcon, UserIcon } from "@heroicons/react/24/solid"
import React from "react"
import type { DiscoverFilters, DiscoverParams } from "~/server/discover.server"
import type { DiscoverFilterType } from "~/server/types/discover-types"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import OneOrMoreItems from "~/ui/filter/OneOrMoreItems"
import SectionCast from "~/ui/filter/sections/SectionCast"
import SectionGenre from "~/ui/filter/sections/SectionGenre"
import SectionRelease from "~/ui/filter/sections/SectionRelease"
import SectionScore from "~/ui/filter/sections/SectionScore"
import SectionStreaming from "~/ui/filter/sections/SectionStreaming"
import SectionWatch from "~/ui/filter/sections/SectionWatch"

interface FilterBarParams {
	params: DiscoverParams
	filterToEdit: DiscoverFilterType | null
	isAddingFilter: boolean
	onAddToggle: () => void
	onEditToggle: (filterType: DiscoverFilterType | null) => void
}

export default function FilterBar({
	params,
	filterToEdit,
	isAddingFilter,
	onAddToggle,
	onEditToggle,
}: FilterBarParams) {
	const handleClose = () => {
		onEditToggle(null)
	}

	return (
		<div className="m-auto max-w-7xl w-full px-4 flex flex-col flex-wrap gap-1 text-sm border-gray-900 rounded-lg">
			<div className="flex flex-wrap items-stretch gap-1">
				<SectionWatch
					params={params}
					editing={filterToEdit === "watch"}
					onEdit={() => onEditToggle("watch")}
					onClose={handleClose}
				/>

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

				<SectionRelease
					params={params}
					editing={filterToEdit === "release"}
					onEdit={() => onEditToggle("release")}
					onClose={handleClose}
				/>

				<SectionCast
					params={params}
					editing={filterToEdit === "cast"}
					onEdit={() => onEditToggle("cast")}
					onClose={handleClose}
				/>

				{/*<FilterBarSection*/}
				{/*	isCompact={true}*/}
				{/*	color="stone"*/}
				{/*	isActive={isAddingFilter}*/}
				{/*	onClick={onAddToggle}*/}
				{/*>*/}
				{/*	<PlusIcon className="h-16" />*/}
				{/*</FilterBarSection>*/}
			</div>
		</div>
	)
}
