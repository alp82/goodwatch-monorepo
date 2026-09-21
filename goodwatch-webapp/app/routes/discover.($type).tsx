import { ClockIcon, FireIcon, StarIcon } from "@heroicons/react/20/solid"
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import {
	useLoaderData,
	useLocation,
	useNavigate,
	useRouteError,
} from "@remix-run/react"
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import React, { useState } from "react"
import { queryKeyCast } from "~/routes/api.cast"
import { queryKeyCountries } from "~/routes/api.countries"
import { queryKeyCrew } from "~/routes/api.crew"
import { queryKeyGenres } from "~/routes/api.genres.all"
import { queryKeyStreamingProviders } from "~/routes/api.streaming-providers"
import { getCast } from "~/server/cast.server"
import { getCountries } from "~/server/countries.server"
import { getCrew } from "~/server/crew.server"
import { getGenresUnique } from "~/server/genres.server"
import { getStreamingProviders } from "~/server/streaming-providers.server"
import { prefetchUserSettings } from "~/server/user-settings.server"
import {
	type DiscoverParams,
	type DiscoverResults,
	type DiscoverSortBy,
	getDiscoverResults,
} from "~/server/discover.server"
import type { DiscoverFilterType } from "~/server/types/discover-types"
import type { FilterMediaType } from "~/server/utils/query-db"
import MovieTvGrid from "~/ui/explore/MovieTvGrid"
import FilterBar from "~/ui/filter/FilterBar"
import type { TitleType } from "~/ui/filter/sections/SectionType"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"
import { type PageItem, type PageMeta, buildMeta } from "~/utils/meta"
import { useNav } from "~/utils/navigation"
import { buildDiscoverParams } from "~/utils/discover"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const mediaType = data?.mediaType || "all"
	const typePath = mediaType === "all" ? "" : `/${mediaType}`
	const pageMeta: PageMeta = {
		title: "Discover | GoodWatch",
		description:
			"Discover the best movies and tv shows to watch right now. From award-winning Netflix exclusives to classic films on Prime Video, Disney+ and HBO. Find movies and TV shows by genre, mood, or streaming service. Get personalized recommendations based on ratings from IMDb, Rotten Tomatoes, and Metacritic. Updated daily with new releases and trending titles.",
		url: `https://goodwatch.app/discover${typePath}`,
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Find your next binge by genre, mood, or streaming service on GoodWatch",
	}

	const items: PageItem[] = []

	return buildMeta({ pageMeta, items })
}

interface LoaderData {
	initialResults: { pages: DiscoverResults[]; pageParams: [number] }
	initialParams: Omit<DiscoverParams, "page">
	mediaType: FilterMediaType
	dehydratedState: DehydratedState
}

export const loader = async ({
	request,
	params: routeParams,
}: LoaderFunctionArgs) => {
	// Extract page from URL parameters
	const url = new URL(request.url)
	const urlParams = new URLSearchParams(url.search)
	const requestedPage = Number.parseInt(urlParams.get("page") || "1", 10)

	// Determine how many pages to load initially
	const pagesToLoad = Math.min(requestedPage, 5) // Load up to 5 pages at once

	const baseParams = await buildDiscoverParams(request)

	// Ensure the type parameter is one of the valid values
	const routeType = routeParams.type as string
	const mediaType = ["all", "movies", "show"].includes(routeType)
		? routeType
		: "all"

	const initialParams: Omit<DiscoverParams, "page"> = {
		...baseParams,
		type: mediaType as FilterMediaType,
	}

	// Load multiple pages in parallel for better performance
	const pagePromises = []
	for (let page = 1; page <= pagesToLoad; page++) {
		const discoverParamsWithPage: DiscoverParams = {
			...baseParams,
			type: mediaType as FilterMediaType,
			page,
		}
		pagePromises.push(getDiscoverResults(discoverParamsWithPage))
	}

	// Prefetch what the active filter chips display, so they render via SSR
	const queryClient = new QueryClient()
	const withCast = urlParams.get("withCast") || ""
	const withoutCast = urlParams.get("withoutCast") || ""
	const withCrew = urlParams.get("withCrew") || ""
	const withoutCrew = urlParams.get("withoutCrew") || ""
	const hasStreaming =
		urlParams.has("streamingPreset") || urlParams.has("withStreamingProviders")
	const chipPromises = [
		hasStreaming && prefetchUserSettings({ queryClient, request }),
		(urlParams.has("withGenres") || urlParams.has("withoutGenres")) &&
			queryClient.prefetchQuery({
				queryKey: queryKeyGenres,
				queryFn: () => getGenresUnique(),
			}),
		(withCast || withoutCast) &&
			queryClient.prefetchQuery({
				queryKey: [...queryKeyCast, "", withCast, withoutCast],
				queryFn: () => getCast({ text: "", withCast, withoutCast }),
			}),
		(withCrew || withoutCrew) &&
			queryClient.prefetchQuery({
				queryKey: [...queryKeyCrew, "", withCrew, withoutCrew],
				queryFn: () => getCrew({ text: "", withCrew, withoutCrew }),
			}),
		hasStreaming &&
			queryClient.prefetchQuery({
				queryKey: queryKeyStreamingProviders,
				queryFn: () => getStreamingProviders({ country: baseParams.country }),
			}),
		hasStreaming &&
			queryClient.prefetchQuery({
				queryKey: queryKeyCountries,
				queryFn: () => getCountries({}),
			}),
	]

	// Wait for all pages to load
	const [results] = await Promise.all([
		Promise.all(pagePromises),
		Promise.all(chipPromises),
	])

	// Format initial data with all loaded pages
	const initialResults = {
		pages: results,
		pageParams: Array.from({ length: pagesToLoad }, (_, i) => i + 1),
	}

	return {
		initialResults,
		initialParams,
		mediaType,
		dehydratedState: dehydrate(queryClient),
	}
}

export function ErrorBoundary() {
	const error = useRouteError()
	const navigate = useNavigate()

	return (
		<div className="max-w-7xl mt-8 mx-auto px-4 flex flex-col gap-5 items-center">
			<h1 className="text-3xl font-bold">Oh no!</h1>
			<p className="py-1 px-3 text-2xl text-gray-300 bg-red-900">
				{error.message}
			</p>
			<button
				type="button"
				className="w-40 px-4 py-2 bg-gray-800 text-gray-100 hover:bg-gray-700 rounded-sm transition-colors"
				onClick={() => navigate("/discover")}
			>
				Go Back
			</button>
		</div>
	)
}

export default function Discover() {
	const { initialResults, initialParams, mediaType } =
		useLoaderData<LoaderData>()
	const { currentParams, updateQueryParams } = useNav<DiscoverParams>()
	const navigate = useNavigate()
	const location = useLocation()

	const sortByTabs: Tab<DiscoverSortBy>[] = [
		{
			key: "popularity",
			label: "Most popular",
			icon: FireIcon,
			current: !currentParams.sortBy || currentParams.sortBy === "popularity",
		},
		{
			key: "aggregated_score",
			label: "Highest rating",
			icon: StarIcon,
			current: currentParams.sortBy === "aggregated_score",
		},
		{
			key: "release_date",
			label: "Most recent",
			icon: ClockIcon,
			current: currentParams.sortBy === "release_date",
		},
	]

	const handleTypeChange = (type: TitleType | undefined) => {
		// Navigate to the correct route path instead of just updating query params
		const newParams = new URLSearchParams(location.search)
		// Remove the type from query params as it will be in the path
		newParams.delete("type")
		// Reset to page 1 when changing media type
		newParams.set("page", "1")

		const queryString = newParams.toString() ? `?${newParams.toString()}` : ""
		// Use the actual URL path for media type selection
		const typePath = type === "movie" ? "/movies" : type === "show" ? "/show" : ""
		navigate(`/discover${typePath}${queryString}`)
	}

	const handleSortBySelect = (tab: Tab<DiscoverSortBy>) => {
		updateQueryParams({
			sortBy: tab.key,
		})
	}

	const [filterToEdit, setFilterToEdit] = useState<DiscoverFilterType | null>(
		null,
	)
	const setSelectedFilter = (filterType: DiscoverFilterType | null) => {
		setFilterToEdit(filterType)
	}
	return (
		<>
			<div className="relative xl-h:sticky xl-h:top-16 w-full py-2 flex flex-col gap-2 flex-center justify-center bg-gray-950 z-40">
				<FilterBar
					params={{ ...currentParams, type: mediaType }}
					onTypeChange={handleTypeChange}
					filterToEdit={filterToEdit}
					onEditToggle={setSelectedFilter}
				/>
			</div>
			<div className="max-w-7xl mx-auto px-4 flex flex-col gap-4">
				<div className="mt-2">
					{/*TODO prefetch tab links*/}
					<Tabs tabs={sortByTabs} pills={true} onSelect={handleSortBySelect} />
				</div>
				<MovieTvGrid
					initialData={initialResults}
					initialParams={initialParams}
					discoverParams={currentParams}
				/>
			</div>
		</>
	)
}
