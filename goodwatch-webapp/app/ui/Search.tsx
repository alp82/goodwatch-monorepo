import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { Link, useFetcher } from "@remix-run/react"
import React from "react"
import placeholder from "~/img/placeholder-poster.png"
import type { MediaType, SearchResult } from "~/server/search.server"
import type { AutocompleteItem } from "~/ui/form/Autocomplete"
import { classNames, titleToDashed } from "~/utils/helpers"
import useOutsideClick from "~/utils/pointer"

export interface SearchAutocompleteItem extends AutocompleteItem {
	mediaType: MediaType
	year: string
	imageUrl: string
}

export default function Search() {
	// TODO debounce
	const fetcher = useFetcher()
	const autocompleteItems: SearchAutocompleteItem[] = (
		fetcher.data?.searchResults || []
	).map((searchResult: SearchResult) => {
		const imageUrl = searchResult.poster_path
			? `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${searchResult.poster_path}`
			: placeholder
		return {
			key: searchResult.id,
			mediaType: searchResult.media_type,
			label: searchResult.title || searchResult.name,
			year: (
				searchResult.release_date ||
				searchResult.first_air_date ||
				""
			).split("-")[0],
			// TODO smaller image
			imageUrl,
		}
	})

	const [isFocused, setIsFocused] = React.useState(false)

	const renderItem = ({
		item,
		selected,
	}: { item: SearchAutocompleteItem; selected: boolean }) => {
		return (
			<div className="w-full flex items-center p-2 hover:bg-slate-800 cursor-pointer">
				<img src={item.imageUrl} alt="" className="h-16 w-12 flex-shrink-0" />
				<div>
					<div className={classNames("ml-3 text-lg truncate font-bold")}>
						{item.label}
					</div>
					<div
						className={classNames(
							"ml-3 truncate",
							selected ? "font-semibold" : "",
						)}
					>
						{item.mediaType} ({item.year})
					</div>
				</div>
			</div>
		)
	}

	const { ref } = useOutsideClick({
		onClickOutside: () => setIsFocused(false),
	})
	return (
		<div ref={ref} className="group focus-within">
			<fetcher.Form
				method="get"
				action="/api/search"
				className="flex justify-center"
			>
				<div
					className="flex items-center w-36 h-9 max-w-[calc(theme(maxWidth.7xl)-3em) py-2 px-4 group-focus-within:h-12
					rounded-md bg-gray-800 border-slate-700 border-2 text-gray-200 hover:border-slate-600 group-focus-within:bg-slate-700 group-focus-within:border-slate-600
					group-focus-within:absolute group-focus-within:top-2 group-focus-within:left-0 group-focus-within:w-full group-focus-within:z-10
					transition-all duration-150 ease-in-out transform"
				>
					{fetcher.state === "idle" ? (
						<MagnifyingGlassIcon
							className="h-7 w-auto text-gray-400"
							aria-hidden="true"
						/>
					) : (
						<ArrowPathIcon
							className="h-7 w-auto text-gray-400 animate-spin"
							aria-hidden="true"
						/>
					)}
					<input
						type="search"
						name="query"
						placeholder="Search..."
						autoComplete="off"
						className="w-full bg-transparent border-0 focus:ring-transparent group-focus-within:text-lg"
						onChange={(event) => fetcher.submit(event.target.form)}
						onClick={() => setIsFocused(true)}
						onFocus={() => setIsFocused(true)}
					/>
				</div>
				{isFocused && autocompleteItems.length && (
					<div className="absolute left-0 top-full mt-1 w-full bg-slate-950 text-white rounded-md shadow-lg">
						{autocompleteItems.map((item, index) => (
							<Link
								key={item.key}
								to={`/${item.mediaType}/${item.key}-${titleToDashed(item.label)}`}
								prefetch={index < 5 ? "render" : "intent"}
								onClick={() => setIsFocused(false)}
							>
								{renderItem({ item, selected: false })}
							</Link>
						))}
					</div>
				)}
			</fetcher.Form>
		</div>
	)
}
