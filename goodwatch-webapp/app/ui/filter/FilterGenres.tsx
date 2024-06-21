import React, { useEffect } from "react";
import {
	BookmarkIcon,
	HashtagIcon,
	XCircleIcon,
} from "@heroicons/react/20/solid";
import { useFetcher } from "@remix-run/react";
import Autocomplete, {
	type AutocompleteItem,
	type RenderItemParams,
} from "~/ui/form/Autocomplete";
import type { Genre } from "~/server/genres.server";

export interface FilterGenresProps {
	type: "movie" | "tv";
	withGenres?: string;
	withoutGenres?: string;
	onChange: (genresToInclude: Genre[], genresToExclude: Genre[]) => void;
}

export default function FilterGenres({
	type,
	withGenres = "",
	withoutGenres = "",
	onChange,
}: FilterGenresProps) {
	const genresFetcher = useFetcher();
	useEffect(() => {
		genresFetcher.submit(
			{},
			{
				method: "get",
				action: `/api/genres/${type}`,
			},
		);
	}, [type]);
	const genres: Genre[] = genresFetcher.data?.genres?.genres || [];

	// TODO filter autocomplete items by input value
	const autocompleteItems = genres.map((genre: Genre) => {
		return {
			key: genre.id.toString(),
			label: genre.name,
		};
	});

	const genresToInclude = genres.filter((genre) =>
		withGenres.includes(genre.name.toString()),
	);
	const genresToExclude = genres.filter((genre) =>
		withoutGenres.includes(genre.name.toString()),
	);

	const handleSelect = (selectedItem: AutocompleteItem) => {
		const updatedGenresToInclude: Genre[] = [
			...genresToInclude,
			{
				id: Number.parseInt(selectedItem.key),
				name: selectedItem.label,
			},
		];
		onChange(updatedGenresToInclude, genresToExclude);
	};

	const handleDelete = (genreToDelete: Genre) => {
		const updatedGenresToInclude: Genre[] = genresToInclude.filter(
			(genre) => genre.id !== genreToDelete.id,
		);
		onChange(updatedGenresToInclude, genresToExclude);
	};

	const renderItem = ({ item }: RenderItemParams<AutocompleteItem>) => {
		return (
			<div className="flex gap-2">
				<HashtagIcon className="h-4 w-4 text-gray-800" aria-hidden="true" />
				<div className="text-sm truncate">{item.label}</div>
			</div>
		);
	};

	// TODO debounce
	return (
		<div className="flex flex-wrap gap-4">
			<Autocomplete<AutocompleteItem>
				name="query"
				placeholder="Genre Search"
				icon={
					<BookmarkIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
				}
				autocompleteItems={autocompleteItems}
				renderItem={renderItem}
				onSelect={handleSelect}
			/>
			<div className="flex gap-2">
				{genresToInclude.map((genre: Genre) => {
					return (
						<span
							key={genre.id}
							className="inline-flex items-center rounded bg-sky-800 px-2 py-0.5 text-xs font-medium text-sky-100"
						>
							<HashtagIcon
								className="h-4 w-4 text-sky-100"
								aria-hidden="true"
							/>
							{genre.name}
							<XCircleIcon
								className="ml-2 h-5 w-5 cursor-pointer text-red-400 hover:text-red-500"
								onClick={() => handleDelete(genre)}
							/>
						</span>
					);
				})}
			</div>
		</div>
	);
}
