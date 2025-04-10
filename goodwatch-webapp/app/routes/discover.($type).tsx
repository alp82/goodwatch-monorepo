import { ClockIcon, FireIcon, StarIcon } from "@heroicons/react/20/solid"
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData, useNavigate, useRouteError } from "@remix-run/react"
import React, { useState } from "react"
import {
	type DiscoverParams,
	type DiscoverResults,
	type DiscoverSortBy,
	getDiscoverResults,
} from "~/server/discover.server"
import type { DiscoverFilterType } from "~/server/types/discover-types"
import type { FilterMediaType } from "~/server/utils/query-db"
import MovieTvGrid from "~/ui/explore/MovieTvGrid"
import AddFilterBar from "~/ui/filter/AddFilterBar"
import FilterBar from "~/ui/filter/FilterBar"
import MediaTypeTabs from "~/ui/tabs/MediaTypeTabs"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"
import { type PageMeta, buildMeta } from "~/utils/meta"
import { useNav } from "~/utils/navigation"
import { buildDiscoverParams } from "~/utils/discover"

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Discover | GoodWatch",
		description:
			"Discover the best movies and tv shows to watch right now. From award-winning Netflix exclusives to classic films on Prime Video, Disney+ and HBO. Find movies and TV shows by genre, mood, or streaming service. Get personalized recommendations based on ratings from IMDb, Rotten Tomatoes, and Metacritic. Updated daily with new releases and trending titles.",
		url: "https://goodwatch.app/discover",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Find your next binge by genre, mood, or streaming service on GoodWatch",
	}

	// TODO
	const items: PageItem[] = []

	return buildMeta({ pageMeta, items })
}

interface LoaderData {
	initialResults: { pages: DiscoverResults[]; pageParams: [number] }
	initialParams: Omit<DiscoverParams, "page">
}

export const loader = async ({
	request,
	params: routeParams,
}: LoaderFunctionArgs) => {
	// Extract page from URL parameters
	const url = new URL(request.url)
	const urlParams = new URLSearchParams(url.search)
	const requestedPage = parseInt(urlParams.get("page") || "1", 10)
	
	// Determine how many pages to load initially
	const pagesToLoad = Math.min(requestedPage, 5) // Load up to 5 pages at once
	
	const baseParams = await buildDiscoverParams(request)
	const initialParams: Omit<DiscoverParams, "page"> = {
		...baseParams,
		type: (routeParams.type as FilterMediaType) || "all",
	}
	
	// Load multiple pages in parallel for better performance
	const pagePromises = []
	for (let page = 1; page <= pagesToLoad; page++) {
		const discoverParamsWithPage: DiscoverParams = {
			...baseParams,
			type: (routeParams.type as FilterMediaType) || "all",
			page,
		}
		pagePromises.push(getDiscoverResults(discoverParamsWithPage))
	}
	
	// Wait for all pages to load
	const results = await Promise.all(pagePromises)
	
	// Format initial data with all loaded pages
	const initialResults = {
		pages: results,
		pageParams: Array.from({ length: pagesToLoad }, (_, i) => i + 1),
	}
	
	return { initialResults, initialParams }
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
				className="w-40 px-4 py-2 bg-gray-800 text-gray-100 hover:bg-gray-700 rounded transition-colors"
				onClick={() => navigate("/discover")}
			>
				Go Back
			</button>
		</div>
	)
}

export default function Discover() {
	const { initialResults, initialParams } = useLoaderData<LoaderData>()
	const { currentParams, updateQueryParams } = useNav<DiscoverParams>()

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

	const handleTabSelect = (tab: Tab<FilterMediaType>) => {
		updateQueryParams({
			page: 1,
			type: tab.key,
		})
	}

	const handleSortBySelect = (tab: Tab<DiscoverSortBy>) => {
		updateQueryParams({
			sortBy: tab.key,
		})
	}

	const [isAddingFilter, setIsAddingFilter] = useState(false)
	const toggleIsAddingFilter = () => setIsAddingFilter((prev) => !prev)

	const [filterToEdit, setFilterToEdit] = useState<DiscoverFilterType | null>(
		null,
	)
	const setSelectedFilter = (filterType: DiscoverFilterType | null) => {
		setIsAddingFilter(false)
		setFilterToEdit(filterType)
	}
	return (
		<>
			<div className="relative xl-h:sticky xl-h:top-16 w-full py-2 flex flex-col gap-2 flex-center justify-center bg-gray-950 z-40">
				<AddFilterBar
					params={currentParams}
					isVisible={true}
					onSelect={setSelectedFilter}
				/>
				<FilterBar
					params={currentParams}
					filterToEdit={filterToEdit}
					isAddingFilter={isAddingFilter}
					onAddToggle={toggleIsAddingFilter}
					onEditToggle={setSelectedFilter}
				/>
			</div>
			<div className="w-full bg-gray-950/35 pb-4">
				<div className="max-w-7xl mx-auto px-4 flex flex-col gap-4">
					<MediaTypeTabs
						selected={currentParams.type || "all"}
						onSelect={handleTabSelect}
					/>
					{/*<PrefetchPageLinks*/}
					{/*	key="discover-type"*/}
					{/*	page={constructUrl({*/}
					{/*		...currentParams,*/}
					{/*		type: params.type === "movie" ? "tv" : "movie",*/}
					{/*	})}*/}
					{/*/>*/}
				</div>
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
