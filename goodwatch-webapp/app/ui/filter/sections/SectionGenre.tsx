import {
	CheckIcon,
	MagnifyingGlassIcon,
	TagIcon,
} from "@heroicons/react/20/solid"
import React from "react"
import { useGenres } from "~/routes/api.genres.all"
import type { DiscoverParams } from "~/server/discover.server"
import type { Genre } from "~/server/genres.server"
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

interface SectionGenreParams {
	params: DiscoverParams
	editing: boolean
	onEdit: () => void
	onClose: () => void
}

export default function SectionGenre({
	params,
	editing,
	onEdit,
	onClose,
}: SectionGenreParams) {
	// data retrieval

	const genresResult = useGenres()
	const genres = genresResult?.data || []

	const { withGenres = "", withoutGenres = "" } = params
	const genreIds = (withGenres || "")
		.split(",")
		.filter((genre) => Boolean(genre))
	const selectedGenres = (genres || [])
		.filter((genre) => genreIds.includes(genre.id.toString()))
		.map((genre) => genre.name)

	const genresToInclude = genres.filter((genre) =>
		withGenres.includes(genre.id.toString()),
	)
	const genresToExclude = genres.filter((genre) =>
		withoutGenres.includes(genre.id.toString()),
	)

	// autocomplete data

	const autocompleteItems = genres.map((genre: Genre) => {
		return {
			key: genre.id.toString(),
			label: genre.name,
		}
	})
	const autocompleteRenderItem = ({
		item,
	}: RenderItemParams<AutocompleteItem>) => {
		const isSelected =
			genreIds.filter((genreId) => genreId === item.key).length > 0
		return (
			<div
				className={`w-full flex items-center justify-between gap-4 ${isSelected ? "text-green-400" : ""}`}
			>
				<div className="flex items-center gap-2">
					<TagIcon className="h-4 w-4 text-gray-200" aria-hidden="true" />
					<div className="text-sm truncate">{item.label}</div>
				</div>
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
		useNav<Pick<DiscoverParams, "withGenres" | "withoutGenres">>()
	const updateGenres = (genresToInclude: Genre[], genresToExclude: Genre[]) => {
		updateQueryParams({
			withGenres: genresToInclude.map((genre) => genre.id).join(","),
			// withoutGenres: genresToExclude.map((genre) => genre.id).join(","),
		})
	}

	const handleSelect = (selectedItem: AutocompleteItem) => {
		const updatedGenresToInclude: Genre[] = [
			...genresToInclude,
			{
				id: Number.parseInt(selectedItem.key),
				name: selectedItem.label,
			},
		]
		updateGenres(updatedGenresToInclude, genresToExclude)
	}

	const handleDelete = (genreToDelete: Genre) => {
		const updatedGenresToInclude: Genre[] = genresToInclude.filter(
			(genre) => genre.id !== genreToDelete.id,
		)
		updateGenres(updatedGenresToInclude, genresToExclude)
	}

	const handleRemoveAll = () => {
		updateGenres([], [])
		onClose()
	}

	// rendering

	return (
		<EditableSection
			label={discoverFilters.genre.label}
			color={discoverFilters.genre.color}
			visible={genreIds.length > 0}
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
							placeholder="Search Genre"
							icon={
								<MagnifyingGlassIcon
									className="h-4 w-4 text-gray-400"
									aria-hidden="true"
								/>
							}
							autocompleteItems={autocompleteItems}
							renderItem={autocompleteRenderItem}
							onSelect={handleSelect}
						/>
					)}
					<div className="flex flex-wrap items-center gap-2">
						{genresToInclude.length > 0 ? (
							genresToInclude.map((genre, index) => (
								<OneOrMoreItems
									key={genre.id}
									index={index}
									amount={selectedGenres.length}
								>
									<Tag
										icon={TagIcon}
										onRemove={isEditing ? () => handleDelete(genre) : undefined}
									>
										{genre.name}
									</Tag>
								</OneOrMoreItems>
							))
						) : genres.length === 0 ? (
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
