import { ClockIcon, FireIcon, StarIcon } from "@heroicons/react/20/solid"
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	redirect,
} from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
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
import { searchText } from "~/domain/discover-search"
import {
	filterQuery,
	filterStateFromParams,
	rewriteLegacyDiscoverParams,
	sortFromParams,
} from "~/domain/filter-state"
import { queryKeyCast } from "~/routes/api.cast"
import { queryKeyCountries } from "~/routes/api.countries"
import { queryKeyCrew } from "~/routes/api.crew"
import { queryKeyGenres } from "~/routes/api.genres.all"
import { getQueryKeyStreamingProviders } from "~/routes/api.streaming-providers"
import { getCast } from "~/server/cast.server"
import { getCountries } from "~/server/countries.server"
import { getCrew } from "~/server/crew.server"
import { legacyDiscoverRedirect } from "~/server/discover-legacy-params.server"
import {
	type DiscoverResults as BrowseResults,
	SnapshotNotLoaded,
	discoverFilterDefaults,
	forYouFromParams,
	getDiscoverResults as getBrowseResults,
} from "~/server/discover-results.server"
import {
	type DiscoverParams,
	type DiscoverResults,
	type DiscoverSortBy,
	getDiscoverResults,
} from "~/server/discover.server"
import { getFeatureMode, isEnabled } from "~/server/features.server"
import { getGenresUnique } from "~/server/genres.server"
import { getPersonName } from "~/server/person.server"
import {
	getStreamingProviders,
	slimStreamingProviders,
} from "~/server/streaming-providers.server"
import type { DiscoverFilterType } from "~/server/types/discover-types"
import { prefetchUserSettings } from "~/server/user-settings.server"
import type { FilterMediaType } from "~/server/utils/query-db"
import { getViewerContext } from "~/server/viewer.server"
import { DiscoverPage } from "~/ui/discover/DiscoverPage"
import { type InitialBrowse, browseKey } from "~/ui/discover/useDiscoverBrowse"
import MovieTvGrid from "~/ui/explore/MovieTvGrid"
import FilterBar from "~/ui/filter/FilterBar"
import type { TitleType } from "~/ui/filter/sections/SectionType"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"
import { getUserIdFromRequest } from "~/utils/auth"
import { buildDiscoverParams } from "~/utils/discover"
import { personPath } from "~/utils/helpers"
import { type PageItem, type PageMeta, buildMeta } from "~/utils/meta"
import { useNav } from "~/utils/navigation"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
	// Discover's search mode: like the search page, not indexed.
	if (
		data &&
		"browse" in data &&
		searchText(new URLSearchParams(location.search).get("q"))
	)
		return [
			{ title: "Search movies and shows · GoodWatch" },
			{ name: "robots", content: "noindex, follow" },
		]
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

// Title pages used to link cast as /discover/all?withCast=3084, and search engines still
// know thousands of those URLs. A lookup of one person and nothing else is their page now.
const IGNORED_FOR_PERSON = new Set([
	"type",
	"page",
	"sortBy",
	"sortDirection",
	"withCastCombinationType",
	"withCrewCombinationType",
	"country",
	"language",
	"fbclid",
	"gclid",
])

/** The person id when the URL only asks for one cast or crew member, else null. */
function singlePersonLookup(params: URLSearchParams): number | null {
	let personId: number | null = null
	for (const [key, value] of params) {
		if (!value || IGNORED_FOR_PERSON.has(key) || key.startsWith("utm_"))
			continue
		const isPerson = key === "withCast" || key === "withCrew"
		if (isPerson && personId === null && /^\d{1,10}$/.test(value)) {
			personId = Number(value)
			continue
		}
		return null
	}
	return personId
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

	const personId = singlePersonLookup(urlParams)
	if (personId) {
		const name = await getPersonName(personId)
		if (name) return redirect(personPath(personId, name), 301)
	}

	// With the new filter bar, Discover's browse mode: old links move to the new parameter names first.
	if (getFeatureMode("filterBar") !== "off") {
		const userId = (await getUserIdFromRequest({ request })) ?? null
		if (isEnabled("filterBar", { userId })) {
			const moved = await legacyDiscoverRedirect(request)
			if (moved) {
				moved.headers.set("Cache-Control", "private, no-store")
				return moved
			}
			// The type is a filter now: /discover/movies is /discover?type=movie. Temporary, while the flag can roll back.
			if (routeParams.type) {
				const type = (
					{ movies: "movie", show: "show" } as Record<string, string>
				)[routeParams.type]
				if (type && !urlParams.has("type")) urlParams.set("type", type)
				const search = urlParams.toString()
				return redirect(`/discover${search ? `?${search}` : ""}`, {
					status: 302,
					headers: { "Cache-Control": "private, no-store" },
				})
			}
			return browseLoader(request, userId)
		}
	}

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
	const selectedProviderIds = (baseParams.withStreamingProviders || "")
		.split(",")
		.filter(Boolean)
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
				// Same key and list as SectionStreaming requests for this country
				queryKey: getQueryKeyStreamingProviders({
					country: baseParams.country,
					include: selectedProviderIds,
				}),
				queryFn: async () =>
					slimStreamingProviders(
						await getStreamingProviders({ country: baseParams.country }),
						baseParams.country,
						selectedProviderIds.map(Number),
					),
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

// Pages the first view loads for ?page=N, like today's Discover.
const MAX_INITIAL_PAGES = 5

export interface BrowseLoaderData {
	browse: {
		initial: InitialBrowse | null
		member: boolean
		hasServices: boolean
		savedForYou: boolean
		searchScope: { country: string; services: number[] }
	}
	mediaType: "all"
}

async function browseLoader(
	request: Request,
	userId: string | null,
): Promise<BrowseLoaderData> {
	const params = new URL(request.url).searchParams
	// A guest's progress lives in their browser: the first view is the plain guest's, and the browser asks again with it.
	const ctx = await getViewerContext(request, undefined, userId)
	const defaults = discoverFilterDefaults(ctx)
	const state = filterStateFromParams(params, defaults)
	const sort = sortFromParams(params, false)
	const forYou = forYouFromParams(params, ctx)
	const requested = Number.parseInt(params.get("page") ?? "1", 10) || 1
	const count = Math.min(Math.max(1, requested), MAX_INITIAL_PAGES)
	// Search mode: the browser runs the search (its reading streams in), so the first view has no results yet.
	const searching = searchText(params.get("q")) !== null
	let pages: BrowseResults[] | null = null
	try {
		if (!searching)
			pages = await Promise.all(
				Array.from({ length: count }, (_, i) =>
					getBrowseResults(ctx, { state, sort, forYou, page: i + 1 }),
				),
			)
	} catch (error) {
		// Right after a restart: the browser asks /api/discover/results once the snapshot has loaded.
		if (!(error instanceof SnapshotNotLoaded)) throw error
	}
	return {
		browse: {
			initial: pages
				? { key: browseKey(filterQuery(state, sort, defaults), forYou), pages }
				: null,
			member: ctx.viewer.kind === "member",
			hasServices: ctx.services.length > 0,
			savedForYou: ctx.forYou,
			searchScope: { country: ctx.country, services: ctx.services },
		},
		mediaType: "all",
	}
}

// Set while the new Discover renders: its filters, sort, For you, and search query change only the URL's parameters,
// and the results come from /api/discover/results and the search, so the loader doesn't run again for them. Today's
// Discover keeps revalidating.
let browsing = false

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) => {
	if (
		!browsing ||
		formMethod ||
		currentUrl.pathname !== nextUrl.pathname ||
		// An old link followed from this page still goes through the loader's redirect.
		rewriteLegacyDiscoverParams(nextUrl.searchParams, () => undefined)
	)
		return defaultShouldRevalidate
	return false
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

export default function DiscoverRoute() {
	const data = useLoaderData<LoaderData | BrowseLoaderData>()
	browsing = "browse" in data
	if ("browse" in data) return <DiscoverPage {...data.browse} />
	return <Discover />
}

function Discover() {
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
		const typePath =
			type === "movie" ? "/movies" : type === "show" ? "/show" : ""
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
