import {
	CheckIcon,
	MagnifyingGlassIcon,
	TagIcon,
} from "@heroicons/react/20/solid"
import { UserIcon } from "@heroicons/react/24/solid"
import React from "react"
import Highlighter from "react-highlight-words"
import { useCrew } from "~/routes/api.crew"
import type { CrewMember } from "~/server/crew.server"
import type { DiscoverParams } from "~/server/discover.server"
import { discoverFilters } from "~/server/types/discover-types"
import OneOrMoreItems from "~/ui/filter/OneOrMoreItems"
import EditableSection from "~/ui/filter/sections/EditableSection"
import Autocomplete, {
	type AutocompleteItem,
	type RenderItemParams,
} from "~/ui/form/Autocomplete"
import { Tag } from "~/ui/tags/Tag"
import { Ping } from "~/ui/wait/Ping"
import { useNav } from "~/utils/navigation"
import { useDebounce } from "~/utils/timing"

interface SectionCrewParams {
	params: DiscoverParams
	editing: boolean
	onEdit: () => void
	onClose: () => void
}

export default function SectionCrew({
	params,
	editing,
	onEdit,
	onClose,
}: SectionCrewParams) {
	const [searchText, setSearchText] = React.useState("")
	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearchText(event.target.value)
	}
	const debouncedSearchText = useDebounce(searchText, 200)

	// data retrieval
	const { withCrew = "", withoutCrew = "" } = params
	const crewResult = useCrew({
		text: debouncedSearchText,
		withCrew,
		withoutCrew,
	})
	const crew = crewResult?.data?.crewMembers || []

	const crewIds = (withCrew || "")
		.split(",")
		.filter((crewId) => Boolean(crewId))
	const selectedCrew = (crew || [])
		.filter((crew) => crewIds.includes(crew.id.toString()))
		.map((crew) => crew.name)
	const crewToInclude = crew.filter((crew) =>
		crewIds.includes(crew.id.toString()),
	)

	// autocomplete data

	const autocompleteItems = crew.map((crew: CrewMember) => {
		return {
			key: crew.id.toString(),
			label: crew.name,
			img: crew.profile_path,
			department: crew.known_for_department,
		}
	})
	const autocompleteRenderItem = ({
		item,
	}: RenderItemParams<
		AutocompleteItem & { img: string; department: string }
	>) => {
		const isSelected = crewIds.includes(item.key)
		return (
			<div
				className={`w-full flex items-center justify-between gap-4 ${isSelected ? "text-green-400" : ""}`}
			>
				<span className="flex items-center gap-4">
					<img
						className="w-7 h-10 rounded-sm"
						src={`https://www.themoviedb.org/t/p/original/${item.img}`}
						alt={`${item.label} profile`}
					/>
					<div className="flex flex-col gap-1 text-sm font-medium truncate">
						<Highlighter
							highlightClassName="font-bold bg-yellow-500 text-gray-900"
							searchWords={[searchText]}
							autoEscape={true}
							textToHighlight={item.label}
						/>
						<span className="text-xs text-gray-500">
							Known for: <strong>{item.department}</strong>
						</span>
					</div>
				</span>
				{isSelected && (
					<CheckIcon
						className="h-6 w-6 p-1 text-green-100 bg-green-700 rounded-full"
						aria-hidden="true"
					/>
				)}
			</div>
		)
	}

	// update handlers

	const { updateQueryParams } =
		useNav<Pick<DiscoverParams, "withCrew" | "withoutCrew">>()
	const updateCrew = (
		crewToInclude: CrewMember[],
		crewToExclude: CrewMember[],
	) => {
		updateQueryParams({
			withCrew: crewToInclude.map((crew) => crew.id).join(","),
			// withoutCrew: crewToExclude.map((crew) => crew.id).join(","),
		})
	}

	const handleSelect = (selectedItem: AutocompleteItem) => {
		const updatedCrewToInclude: CrewMember[] = crewIds.includes(
			selectedItem.key,
		)
			? crewToInclude.filter(
					(crew) => crew.id !== Number.parseInt(selectedItem.key),
				)
			: [
					...crewToInclude,
					{
						id: Number.parseInt(selectedItem.key),
						name: selectedItem.label,
					},
				]
		updateCrew(updatedCrewToInclude, [])
	}

	const handleDelete = (crewToDelete: CrewMember) => {
		const updatedCrewToInclude: CrewMember[] = crewToInclude.filter(
			(crew) => crew.id !== crewToDelete.id,
		)
		updateCrew(updatedCrewToInclude, [])
	}

	const handleRemoveAll = () => {
		updateCrew([], [])
		onClose()
	}

	// rendering

	return (
		<EditableSection
			label={discoverFilters.crew.label}
			color={discoverFilters.crew.color}
			visible={crewIds.length > 0}
			editing={editing}
			active={true}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
		>
			{(isEditing) => (
				<div className="flex flex-col flex-wrap gap-2">
					{isEditing && (
						<Autocomplete<AutocompleteItem>
							name="query"
							placeholder="Search Crew"
							icon={
								<MagnifyingGlassIcon
									className="h-4 w-4 text-gray-400"
									aria-hidden="true"
								/>
							}
							autocompleteItems={autocompleteItems}
							renderItem={autocompleteRenderItem}
							onChange={handleChange}
							onSelect={handleSelect}
						/>
					)}
					<div className="flex flex-wrap items-center gap-2">
						{crewToInclude.length > 0 ? (
							crewToInclude.map((crew, index) => (
								<OneOrMoreItems
									key={crew.id}
									index={index}
									amount={selectedCrew.length}
									mode="any"
								>
									<Tag
										icon={UserIcon}
										onRemove={isEditing ? () => handleDelete(crew) : undefined}
									>
										{crew.name}
									</Tag>
								</OneOrMoreItems>
							))
						) : crewResult.isLoading && crew.length === 0 ? (
							<div className="relative h-8">
								<Ping size="small" />
							</div>
						) : null}
					</div>
				</div>
			)}
		</EditableSection>
	)
}
