import {
	CheckIcon,
	MagnifyingGlassIcon,
	TagIcon,
} from "@heroicons/react/20/solid"
import React from "react"
import Highlighter from "react-highlight-words"
import { useCast } from "~/routes/api.cast"
import type { CastMember } from "~/server/cast.server"
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

interface SectionCastParams {
	params: DiscoverParams
	editing: boolean
	onEdit: () => void
	onClose: () => void
}

export default function SectionCast({
	params,
	editing,
	onEdit,
	onClose,
}: SectionCastParams) {
	const [text, setText] = React.useState("")
	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setText(event.target.value)
	}

	// data retrieval
	const { withCast = "", withoutCast = "" } = params
	const castResult = useCast({ text, withCast, withoutCast })
	const cast = castResult?.data?.castMembers || []

	const castIds = (withCast || "")
		.split(",")
		.filter((castId) => Boolean(castId))
	const selectedCast = (cast || [])
		.filter((cast) => castIds.includes(cast.id.toString()))
		.map((cast) => cast.name)
	const castToInclude = cast.filter((cast) =>
		castIds.includes(cast.id.toString()),
	)

	// autocomplete data

	const autocompleteItems = cast.map((cast: CastMember) => {
		return {
			key: cast.id.toString(),
			label: cast.name,
			img: cast.profile_path,
		}
	})
	const autocompleteRenderItem = ({
		item,
	}: RenderItemParams<AutocompleteItem & { img: string }>) => {
		const isSelected = castIds.includes(item.key)
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
					<div className="text-sm font-medium truncate">
						<Highlighter
							highlightClassName="bg-yellow-400 text-gray-900"
							searchWords={[text]}
							autoEscape={true}
							textToHighlight={item.label}
						/>
					</div>
				</span>
				{isSelected && (
					<CheckIcon
						className="h-6 w-6 p-1 text-green-300 bg-green-700 rounded-full"
						aria-hidden="true"
					/>
				)}
			</div>
		)
	}

	// update handlers

	const { updateQueryParams } =
		useNav<Pick<DiscoverParams, "withCast" | "withoutCast">>()
	const updateCast = (
		castToInclude: CastMember[],
		castToExclude: CastMember[],
	) => {
		updateQueryParams({
			withCast: castToInclude.map((cast) => cast.id).join(","),
			// withoutCast: castToExclude.map((cast) => cast.id).join(","),
		})
	}

	const handleSelect = (selectedItem: AutocompleteItem) => {
		const updatedCastToInclude: CastMember[] = castIds.includes(
			selectedItem.key,
		)
			? castToInclude.filter(
					(cast) => cast.id !== Number.parseInt(selectedItem.key),
				)
			: [
					...castToInclude,
					{
						id: Number.parseInt(selectedItem.key),
						name: selectedItem.label,
					},
				]
		updateCast(updatedCastToInclude, [])
	}

	const handleDelete = (castToDelete: CastMember) => {
		const updatedCastToInclude: CastMember[] = castToInclude.filter(
			(cast) => cast.id !== castToDelete.id,
		)
		updateCast(updatedCastToInclude, [])
	}

	const handleRemoveAll = () => {
		updateCast([], [])
		onClose()
	}

	// rendering

	return (
		<EditableSection
			label={discoverFilters.cast.label}
			color={discoverFilters.cast.color}
			visible={castIds.length > 0}
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
							placeholder="Search Cast"
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
						{castToInclude.length > 0 ? (
							castToInclude.map((cast, index) => (
								<OneOrMoreItems
									key={cast.id}
									index={index}
									amount={selectedCast.length}
								>
									<Tag
										icon={TagIcon}
										onRemove={isEditing ? () => handleDelete(cast) : undefined}
									>
										{cast.name}
									</Tag>
								</OneOrMoreItems>
							))
						) : castResult.isLoading && cast.length === 0 ? (
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
