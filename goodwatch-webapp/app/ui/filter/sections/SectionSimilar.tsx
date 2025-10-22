import { CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { FilmIcon } from "@heroicons/react/24/solid"
import React from "react"
import Highlighter from "react-highlight-words"
import { useSimilarMedia } from "~/routes/api.similar-media"
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

interface SimilarTitle {
	tmdbId: string
	mediaType: "movie" | "show"
	title: string
}

interface SectionSimilarParams {
	params: DiscoverParams
	editing: boolean
	onEdit: () => void
	onClose: () => void
}

export default function SectionSimilar({
	params,
	editing,
	onEdit,
	onClose,
}: SectionSimilarParams) {
	const [searchText, setSearchText] = React.useState("")
	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearchText(event.target.value)
	}
	const debouncedSearchText = useDebounce(searchText, 200)

	// Parse similarTitles: "tmdbId:mediaType,tmdbId:mediaType"
	const { similarTitles = "" } = params
	const selectedTitles: SimilarTitle[] = similarTitles
		.split(",")
		.filter(Boolean)
		.map((item) => {
			const [tmdbId, mediaType] = item.split(":")
			return { tmdbId, mediaType: mediaType as "movie" | "show", title: "" }
		})
		.filter((item) => item.tmdbId && item.mediaType)
	const search = useSimilarMedia({
		searchTerm: debouncedSearchText,
		withSimilar: selectedTitles.map(t => ({ tmdbId: t.tmdbId, mediaType: t.mediaType, categories: [] })),
	})
	const searchResults = (search?.data?.movies?.concat(search?.data?.shows) || []).filter(Boolean)

	// Enrich selected titles with actual title from search results
	const enrichedSelectedTitles = selectedTitles.map((selected) => {
		const match = searchResults.find(
			(result) =>
				result.tmdb_id.toString() === selected.tmdbId &&
				result.media_type === selected.mediaType
		)
		return {
			...selected,
			title: match?.title || `ID ${selected.tmdbId}`,
		}
	})

	// Autocomplete data
	const autocompleteItems = searchResults
		.filter((searchResult) => searchResult && searchResult.tmdb_id)
		.map((searchResult) => ({
			key: `${searchResult.tmdb_id}:${searchResult.media_type}`,
			label: `${searchResult.title} (${searchResult.release_year})`,
			img: searchResult.poster_path,
		}))

	const autocompleteRenderItem = ({
		item,
	}: RenderItemParams<AutocompleteItem & { img: string }>) => {
		const [tmdbId, mediaType] = item.key.split(":")
		const isSelected = selectedTitles.some(
			(selected) => selected.tmdbId === tmdbId && selected.mediaType === mediaType
		)
		return (
			<div
				className={`w-full flex items-center justify-between gap-4 ${isSelected ? "text-green-400" : ""}`}
			>
				<span className="flex items-center gap-4">
					<img
						className="w-auto h-12 rounded-sm"
						src={`https://www.themoviedb.org/t/p/original/${item.img}`}
						alt={`${item.label} poster`}
					/>
					<div className="text-sm font-medium truncate">
						<Highlighter
							highlightClassName="font-bold bg-yellow-500 text-gray-900"
							searchWords={[searchText]}
							autoEscape={true}
							textToHighlight={item.label}
						/>
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

	// Update handlers
	const { updateQueryParams } = useNav<Pick<DiscoverParams, "similarTitles">>()

	const handleSelect = (item: (typeof autocompleteItems)[number]) => {
		const [tmdbId, mediaType] = item.key.split(":")
		const isAlreadySelected = selectedTitles.some(
			(selected) => selected.tmdbId === tmdbId && selected.mediaType === mediaType
		)

		let updatedTitles: SimilarTitle[]
		if (isAlreadySelected) {
			// Remove if already selected
			updatedTitles = selectedTitles.filter(
				(selected) => !(selected.tmdbId === tmdbId && selected.mediaType === mediaType)
			)
		} else {
			// Add if not selected
			updatedTitles = [...selectedTitles, { tmdbId, mediaType: mediaType as "movie" | "show", title: "" }]
		}

		const updatedSimilarTitles = updatedTitles.map((t) => `${t.tmdbId}:${t.mediaType}`).join(",")
		updateQueryParams({ similarTitles: updatedSimilarTitles })
	}

	const handleRemove = (tmdbId: string, mediaType: string) => {
		const updatedTitles = selectedTitles.filter(
			(selected) => !(selected.tmdbId === tmdbId && selected.mediaType === mediaType)
		)
		const updatedSimilarTitles = updatedTitles.map((t) => `${t.tmdbId}:${t.mediaType}`).join(",")
		updateQueryParams({ similarTitles: updatedSimilarTitles })
	}

	const handleRemoveAll = () => {
		updateQueryParams({ similarTitles: "" })
		onClose()
	}

	// Rendering
	return (
		<EditableSection
			label={discoverFilters.similar.label}
			color={discoverFilters.similar.color}
			visible={selectedTitles.length > 0}
			editing={editing}
			active={true}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
		>
			{(isEditing) => (
				<div className="flex flex-col flex-wrap gap-2">
					{isEditing && (
						<div className="mt-2 w-[18rem] xs:w-[20rem] sm:w-[22rem] md:w-[24rem] lg:w-[26rem] xl:w-[28rem]">
							<Autocomplete<typeof autocompleteItems[number]>
								name="query"
								placeholder="Search for similar titles"
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
						</div>
					)}
					<div className="flex flex-wrap items-center gap-2">
						{enrichedSelectedTitles.length > 0 ? (
							enrichedSelectedTitles.map((title, index) => (
								<OneOrMoreItems
									key={`${title.tmdbId}:${title.mediaType}`}
									index={index}
									amount={enrichedSelectedTitles.length}
									mode="any"
								>
									<div className="flex flex-wrap items-center gap-2">
										<span>Similar to</span>
										<Tag
											icon={FilmIcon}
											onRemove={isEditing ? () => handleRemove(title.tmdbId, title.mediaType) : undefined}
										>
											{title.title}
										</Tag>
									</div>
								</OneOrMoreItems>
							))
						) : search.isLoading && searchResults.length === 0 ? (
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
