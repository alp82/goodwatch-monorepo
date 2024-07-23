import {
	ClockIcon,
	FilmIcon,
	FireIcon,
	StarIcon,
	TvIcon,
} from "@heroicons/react/20/solid"
import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import {
	PrefetchPageLinks,
	useLoaderData,
	useNavigation,
} from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import React, { useEffect, useState } from "react"
import { useUpdateUrlParams } from "~/hooks/updateUrlParams"
import {
	type DiscoverParams,
	type DiscoverResult,
	type DiscoverResults,
	type DiscoverSortBy,
	getDiscoverResults,
} from "~/server/discover.server"
import type { MediaType } from "~/server/search.server"
import { MovieCard } from "~/ui/MovieCard"
import { TvCard } from "~/ui/TvCard"
import FilterSelection from "~/ui/filter/FilterSelection"
import FilterSummary from "~/ui/filter/FilterSummary"
import MediaTypeTabs from "~/ui/tabs/MediaTypeTabs"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"
import useLocale, { getLocaleFromRequest } from "~/utils/locale"

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = () => {
	return [
		{ title: "Discover | GoodWatch" },
		{
			description:
				"All movie and tv show ratings and streaming providers on the same page",
		},
	]
}

export type LoaderData = {
	params: DiscoverParams
	results: DiscoverResults
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const { locale } = getLocaleFromRequest(request)

	const url = new URL(request.url)
	const type = (url.searchParams.get("type") || "movie") as MediaType
	const mode = (url.searchParams.get("mode") || "advanced") as "advanced"
	const country = url.searchParams.get("country") || ""
	const language = url.searchParams.get("language") || locale.language
	const minAgeRating = url.searchParams.get("minAgeRating") || ""
	const maxAgeRating = url.searchParams.get("maxAgeRating") || ""
	const minYear = url.searchParams.get("minYear") || ""
	// const maxYear = url.searchParams.get('maxYear') || new Date().getFullYear().toString()
	const maxYear = url.searchParams.get("maxYear") || ""
	const minScore = url.searchParams.get("minScore") || ""
	const withCast = url.searchParams.get("withCast") || ""
	const withCrew = url.searchParams.get("withCrew") || ""
	const withKeywords = url.searchParams.get("withKeywords") || ""
	const withoutKeywords = url.searchParams.get("withoutKeywords") || ""
	const withGenres = url.searchParams.get("withGenres") || ""
	const withoutGenres = url.searchParams.get("withoutGenres") || ""
	const withStreamingProviders =
		url.searchParams.get("withStreamingProviders") || ""
	const sortBy = (url.searchParams.get("sortBy") ||
		"popularity") as DiscoverSortBy
	const sortDirection = (url.searchParams.get("sortDirection") || "desc") as
		| "asc"
		| "desc"
	const params = {
		type,
		mode,
		country,
		language,
		minAgeRating,
		maxAgeRating,
		minYear,
		maxYear,
		minScore,
		withCast,
		withCrew,
		withKeywords,
		withoutKeywords,
		withGenres,
		withoutGenres,
		withStreamingProviders,
		sortBy,
		sortDirection,
	}

	const results = await getDiscoverResults(params)

	return json<LoaderData>({
		params,
		results,
	})
}

export default function Discover() {
	const {
		params,
		results: { results, filters },
	} = useLoaderData<LoaderData>()
	const navigation = useNavigation()
	const { locale } = useLocale()

	const { currentParams, constructUrl, updateParams } = useUpdateUrlParams({
		params,
	})

	useEffect(() => {
		if (params.country === "" || params.withStreamingProviders === "") {
			let country = locale.country
			if (params.country === "" || params.withStreamingProviders === "") {
				country = localStorage.getItem("country") || country
			}

			let withStreamingProviders = "8,9,337"
			if (params.withStreamingProviders === "") {
				withStreamingProviders =
					localStorage.getItem("withStreamingProviders") ||
					withStreamingProviders
			}

			const newParams = {
				...currentParams,
				country,
				withStreamingProviders,
			}
			updateParams(newParams, true)
		}
	}, [])

	const sortByTabs: Tab<DiscoverSortBy>[] = [
		{
			key: "popularity",
			label: "Most popular",
			icon: FireIcon,
			current: currentParams.sortBy === "popularity",
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

	const [filtersOpen, setFiltersOpen] = useState(false)
	const toggleFilters = () => {
		setFiltersOpen((isOpen) => !isOpen)
	}

	const handleTabSelect = (tab: Tab<MediaType>) => {
		const newParams = {
			...currentParams,
			type: tab.key,
		}
		updateParams(newParams)
	}

	const handleSortBySelect = (tab: Tab<DiscoverSortBy>) => {
		const newParams = {
			...currentParams,
			sortBy: tab.key,
		}
		updateParams(newParams)
	}

	return (
		<div className="max-w-7xl mx-auto px-4 flex flex-col gap-5 sm:gap-6">
			<div>
				<MediaTypeTabs
					selected={currentParams.type}
					onSelect={handleTabSelect}
				/>
				<PrefetchPageLinks
					key="discover-type"
					page={constructUrl({
						...currentParams,
						type: params.type === "movie" ? "tv" : "movie",
					})}
				/>
			</div>
			<FilterSummary
				params={currentParams}
				filters={filters}
				onToggle={toggleFilters}
			/>
			<FilterSelection
				show={filtersOpen}
				params={currentParams}
				updateParams={updateParams}
				onClose={() => setFiltersOpen(false)}
			/>
			<div className="mt-2">
				<Tabs tabs={sortByTabs} pills={true} onSelect={handleSortBySelect} />
				{sortByTabs
					.filter((tab) => !tab.current)
					.map((tab) => (
						<PrefetchPageLinks
							key={tab.key}
							page={constructUrl({
								...currentParams,
								sortBy: tab.key as DiscoverParams["sortBy"],
							})}
						/>
					))}
			</div>
			<div
				className={
					"relative mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
				}
			>
				<AnimatePresence initial={false}>
					{navigation.state === "loading" && (
						<span className="absolute top-2 left-6 animate-ping inline-flex h-8 w-8 rounded-full bg-sky-300 opacity-75" />
					)}
					{!results.length && navigation.state === "idle" && (
						<div className="my-6 text-lg italic">
							No results. Try to change your search filters.
						</div>
					)}
					{results.length > 0 &&
						navigation.state === "idle" &&
						results.map((result: DiscoverResult, index) => {
							return (
								<div key={result.tmdb_id}>
									<motion.div
										key={currentParams.sortBy}
										initial={{
											y: `-${Math.floor(Math.random() * 10) + 5}%`,
											opacity: 0,
										}}
										animate={{ y: "0", opacity: 1 }}
										exit={{
											y: `${Math.floor(Math.random() * 10) + 5}%`,
											opacity: 0,
										}}
										transition={{ duration: 0.5, type: "tween" }}
									>
										{currentParams.type === "movie" && (
											<MovieCard
												movie={result as DiscoverResult}
												prefetch={index < 6}
											/>
										)}
										{currentParams.type === "tv" && (
											<TvCard
												tv={result as DiscoverResult}
												prefetch={index < 6}
											/>
										)}
									</motion.div>
								</div>
							)
						})}
				</AnimatePresence>
			</div>
		</div>
	)
}
