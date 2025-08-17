import { CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { FilmIcon } from "@heroicons/react/24/solid";
import React from "react";
import Highlighter from "react-highlight-words";
import { convertSimilarTitles } from "~/routes/api.discover";
import { useSimilarMedia } from "~/routes/api.similar-media";
import type { DiscoverParams } from "~/server/discover.server";
import { discoverFilters } from "~/server/types/discover-types";
import { sortedDNACategories } from "~/ui/dna/dna_utils";
import OneOrMoreItems from "~/ui/filter/OneOrMoreItems";
import EditableSection from "~/ui/filter/sections/EditableSection";
import Autocomplete, {
	type AutocompleteItem,
	type RenderItemParams,
} from "~/ui/form/Autocomplete";
import { Tag } from "~/ui/tags/Tag";
import { Ping } from "~/ui/wait/Ping";
import {
	SEPARATOR_SECONDARY,
	SEPARATOR_TERTIARY,
	useNav,
} from "~/utils/navigation";
import { useDebounce } from "~/utils/timing";

const presets: { label: string; categories: typeof sortedDNACategories }[] = [
	{
		label: "Story",
		categories: ["Sub-Genres", "Mood", "Themes", "Plot"],
	},
	{
		label: "Persona",
		categories: [
			"Cultural Impact",
			"Character Types",
			"Dialog",
			"Narrative",
			"Humor",
			"Target Audience",
		],
	},
	{
		label: "Aesthetics",
		categories: [
			"Pacing",
			"Cinematic Style",
			"Score and Sound",
			"Costume and Set",
			"Key Props",
			"Flag",
		],
	},
];

interface SectionSimilarParams {
	params: DiscoverParams;
	editing: boolean;
	onEdit: () => void;
	onClose: () => void;
}

export default function SectionSimilar({
	params,
	editing,
	onEdit,
	onClose,
}: SectionSimilarParams) {
	const [searchText, setSearchText] = React.useState("");
	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearchText(event.target.value);
	};
	const debouncedSearchText = useDebounce(searchText, 200);

	// data retrieval
	const { similarTitles = "" } = params;
	const withSimilar = convertSimilarTitles(similarTitles);
	const withSimilarCategories = withSimilar.flatMap(
		(similar) => similar.categories,
	);
	const categories =
		withSimilarCategories.length > 0
			? withSimilarCategories
			: presets[0].categories;
	const matchesPreset = presets.find((preset) => {
		return preset.categories.every((category) => {
			return categories.includes(category);
		});
	});

	const search = useSimilarMedia({
		searchTerm: debouncedSearchText,
		withSimilar,
	});
	const searchResults = (search?.data?.movies?.concat(search?.data?.shows) || []).filter(Boolean);

	const selectedSimilar = searchResults.filter((searchResult) => {
		if (!searchResult || !searchResult.tmdb_id) return false;
		return withSimilar.some((similar) => {
			return (
				similar.tmdbId === searchResult.tmdb_id.toString() &&
				similar.mediaType === searchResult.media_type
			);
		});
	});

	// autocomplete data

	const autocompleteItems = searchResults
		.filter((searchResult) => searchResult && searchResult.tmdb_id)
		.map((searchResult) => {
			return {
				key: `${searchResult.tmdb_id.toString()}${SEPARATOR_SECONDARY}${searchResult.media_type}`,
				label: `${searchResult.title} (${searchResult.release_year})`,
				img: searchResult.poster_path,
		};
	});
	const autocompleteRenderItem = ({
		item,
	}: RenderItemParams<AutocompleteItem & { img: string }>) => {
		const [tmdbId, mediaType] = item.key.split(SEPARATOR_SECONDARY);
		const isSelected =
			withSimilar.filter(
				(similar) =>
					similar.tmdbId === tmdbId && similar.mediaType === mediaType,
			).length > 0;
		return (
			<div
				className={`w-full flex items-center justify-between gap-4 ${isSelected ? "text-green-400" : ""}`}
			>
				<span className="flex items-center gap-4">
					<img
						className="w-auto h-12 rounded-sm"
						src={`https://www.themoviedb.org/t/p/original/${item.img}`}
						alt={`${item.label} profile`}
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
		);
	};

	// update handlers

	const { updateQueryParams } = useNav<Pick<DiscoverParams, "similarTitles">>();
	const handleSelect = (updatedSimilar: (typeof autocompleteItems)[number]) => {
		const updatedSimilarTitles = `${updatedSimilar.key}${SEPARATOR_SECONDARY}${categories.join(SEPARATOR_TERTIARY)}`;
		updateQueryParams({
			similarTitles: updatedSimilarTitles,
		});
	};

	const handleSelectPreset = (preset: (typeof presets)[number]) => {
		const [key, mediaType, _] = similarTitles.split(SEPARATOR_SECONDARY);
		const updatedSimilarTitles = `${key}${SEPARATOR_SECONDARY}${mediaType}${SEPARATOR_SECONDARY}${preset.categories.join(SEPARATOR_TERTIARY)}`;
		updateQueryParams({
			similarTitles: updatedSimilarTitles,
		});
	};

	const handleRemoveAll = () => {
		updateQueryParams({
			similarTitles: "",
		});
		onClose();
	};

	// rendering

	return (
		<EditableSection
			label={discoverFilters.similar.label}
			color={discoverFilters.similar.color}
			visible={withSimilar.length > 0}
			editing={editing}
			active={true}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
		>
			{(isEditing) => (
				<div className="flex flex-col flex-wrap gap-2">
					{isEditing && (
						<div className="flex flex-col flex-wrap gap-2">
							<div className="mt-2 w-[18rem] xs:w-[20rem] sm:w-[22rem] md:w-[24rem] lg:w-[26rem] xl:w-[28rem]">
								<Autocomplete<AutocompleteItem>
									name="query"
									placeholder="Search Similar"
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
							{selectedSimilar.length > 0 ? (
								<>
									<div className="flex flex-wrap gap-3 text-xs font-bold">
										{presets.map((preset) => {
											const isSelected = preset.categories.every((category) => {
												return categories.includes(category);
											});
											return (
												<button
													key={preset.label}
													type="button"
													className={`
												p-1 text-blue-500 cursor-pointer
												${isSelected ? "bg-black/30" : "hover:bg-black/20"}
											`}
													onClick={(e) => handleSelectPreset(preset)}
												>
													{preset.label}
												</button>
											);
										})}
									</div>
									{false && (
										<div className="grid grid-cols-6 gap-1 text-xs">
											{sortedDNACategories.map((category) => (
												<span
													key={category}
													className={`
											p-1 border-2 border-stone-400
											text-center cursor-pointer
											hover:bg-stone-800
											${categories.includes(category) ? "bg-stone-900" : ""}
										`}
												>
													{category}
												</span>
											))}
										</div>
									)}
								</>
							) : null}
						</div>
					)}
					<div className="flex flex-wrap items-center gap-2">
						{selectedSimilar.length > 0 ? (
							selectedSimilar.map((similar, index) => (
								<OneOrMoreItems
									key={`${similar.tmdb_id}:${similar.media_type}`}
									index={index}
									amount={withSimilar.length}
									mode="all"
								>
									<div className="flex flex-wrap items-center gap-2">
										{matchesPreset ? (
											<span className="font-bold">{matchesPreset.label}</span>
										) : (
											<>
												{categories.map((category) => (
													<span key={category} className="font-bold">
														{category}
													</span>
												))}
											</>
										)}
										like
										<Tag icon={FilmIcon}>{similar.title}</Tag>
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
	);
}
