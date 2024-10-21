import { ClockIcon, FireIcon, StarIcon } from "@heroicons/react/20/solid"
import type { MetaFunction } from "@remix-run/node"
import { useNavigate, useRouteError } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import React, { useState } from "react"
import { useDiscover } from "~/routes/api.discover"
import type {
	DiscoverParams,
	DiscoverResult,
	DiscoverResults,
	DiscoverSortBy,
} from "~/server/discover.server"
import type { DiscoverFilterType } from "~/server/types/discover-types"
import type { FilterMediaType } from "~/server/utils/query-db"
import { MovieTvCard } from "~/ui/MovieTvCard"
import AddFilterBar from "~/ui/filter/AddFilterBar"
import FilterBar from "~/ui/filter/FilterBar"
import Appear from "~/ui/fx/Appear"
import MediaTypeTabs from "~/ui/tabs/MediaTypeTabs"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"
import { Spinner } from "~/ui/wait/Spinner"
import { useNav } from "~/utils/navigation"

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction = () => {
	return [
		{ title: "Discover | GoodWatch" },
		{
			description:
				"All movie and tv show ratings and streaming providers on the same page",
		},
	]
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

export type LoaderData = {
	params: DiscoverParams
	results: DiscoverResults
}

export default function Discover() {
	const { currentParams, updateQueryParams } = useNav<DiscoverParams>()
	const discover = useDiscover({ params: currentParams })
	const results = discover.data?.results || []
	const filters = discover.data?.filters || {
		castMembers: [],
		crewMembers: [],
	}

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
			<div className="sticky top-16 w-full py-2 flex flex-col gap-2 flex-center justify-center bg-gray-950 z-40">
				<FilterBar
					params={currentParams}
					filters={filters}
					filterToEdit={filterToEdit}
					isAddingFilter={isAddingFilter}
					onAddToggle={toggleIsAddingFilter}
					onEditToggle={setSelectedFilter}
				/>
				<AddFilterBar
					params={currentParams}
					isVisible={isAddingFilter}
					onSelect={setSelectedFilter}
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
				<Appear isVisible={results.length > 1}>
					<div className="mt-2">
						{/*TODO prefetch tab links*/}
						<Tabs
							tabs={sortByTabs}
							pills={true}
							onSelect={handleSortBySelect}
						/>
					</div>
				</Appear>
				<div
					className={
						"relative mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
					}
				>
					<AnimatePresence>
						{discover.isLoading && <Spinner size="medium" />}
						{!results.length && discover.isSuccess && (
							<div className="my-6 text-lg italic">
								No results. Try to change your search filters.
							</div>
						)}
						{results.length > 0 &&
							discover.isSuccess &&
							results.map((result: DiscoverResult, index) => {
								return (
									<div key={result.tmdb_id}>
										<motion.div
											key={currentParams.sortBy}
											initial={{
												y: `-${Math.floor(Math.random() * 12) + 6}%`,
												opacity: 0,
											}}
											animate={{ y: "0", opacity: 1 }}
											exit={{
												y: `${Math.floor(Math.random() * 12) + 6}%`,
												opacity: 0,
											}}
											transition={{ duration: 0.3, type: "tween" }}
										>
											<MovieTvCard
												details={result as DiscoverResult}
												mediaType={result.media_type}
												prefetch={index < 6}
											/>
										</motion.div>
									</div>
								)
							})}
					</AnimatePresence>
				</div>
			</div>
		</>
	)
}
