import { MagnifyingGlassIcon, TagIcon } from "@heroicons/react/20/solid"
import React from "react"
import { useGenres } from "~/routes/api.genres.all"
import type { DiscoverParams } from "~/server/discover.server"
import type { Genre } from "~/server/genres.server"
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

	const { withGenres, withoutGenres } = params
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

	// editing logic

	const autocompleteItems = genres.map((genre: Genre) => {
		return {
			key: genre.id.toString(),
			label: genre.name,
		}
	})
	const autocompleteRenderItem = ({
		item,
	}: RenderItemParams<AutocompleteItem>) => {
		return (
			<div className="flex items-center gap-2">
				<TagIcon className="h-4 w-4 text-gray-200" aria-hidden="true" />
				<div className="text-sm truncate">{item.label}</div>
			</div>
		)
	}

	// update handlers

	const { updateQueryParams } = useNav()
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
	}

	// rendering

	return (
		<EditableSection
			label="Genre"
			color="amber"
			enabled={genreIds.length > 0}
			editing={editing}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
			renderEditing={() => (
				<div className="flex flex-col flex-wrap gap-2">
					<Autocomplete<AutocompleteItem>
						name="query"
						placeholder="Genre Search"
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
					<div className="flex gap-2">
						{genresToInclude.map((genre: Genre) => {
							return (
								<Tag
									key={genre.id}
									icon={TagIcon}
									onRemove={() => handleDelete(genre)}
								>
									{genre.name}
								</Tag>
							)
						})}
					</div>
				</div>
			)}
		>
			<div className="flex flex-wrap items-center gap-2">
				{selectedGenres.length > 0 ? (
					selectedGenres.map((genre, index) => (
						<OneOrMoreItems
							key={genre}
							index={index}
							amount={selectedGenres.length}
						>
							<Tag icon={TagIcon}>{genre}</Tag>
						</OneOrMoreItems>
					))
				) : (
					<div className="relative h-8">
						<Ping size="small" />
					</div>
				)}
			</div>
		</EditableSection>
	)
}
