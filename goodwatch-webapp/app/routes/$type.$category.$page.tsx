import { HERO_TIMING, START_AFTER_PAINT } from "~/utils/start-after-paint"
import { imageLoadingProps } from "~/utils/tmdb-image"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { requireCategoryPage } from "~/server/category-page.server"
import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
} from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import React from "react"
import type { GetDiscoverResult } from "~/routes/api.discover"
import {
	type DiscoverParams,
	getDiscoverResults,
} from "~/server/discover.server"
import FAQ from "~/ui/explore/FAQ"
import MovieTvGrid from "~/ui/explore/MovieTvGrid"
import { exploreAddressExists, notFound } from "~/ui/explore/address"
import {
	type NavType,
	type PageData,
	defaultDiscoverParams,
	navLabel,
} from "~/ui/explore/config"
import { mainHierarchy, mainNavigation } from "~/ui/explore/main-nav"
import { explorePageCopy } from "~/ui/explore/page-copy"
import { DidntWatchCheckbox } from "~/ui/filter/explore/DidntWatchCheckbox"
import { MyStreamingCheckbox } from "~/ui/filter/explore/MyStreamingCheckbox"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import { categoryCrumbs } from "~/ui/nav/breadcrumb-trail"
import { buildDiscoverParams } from "~/utils/discover"
import {
	type PageItem,
	type PageMeta,
	buildMeta,
	pagedUrl,
	plainPageMeta,
} from "~/utils/meta"
import { useNav } from "~/utils/navigation"
import { convertHyphensToWords } from "~/utils/string"
import { jsonToUrlString } from "~/utils/url"
import { cachedClientLoader } from "~/navigation/instant-navigation"

export const meta: MetaFunction = ({ params, location }) => {
	const type = params.type || ""
	const category = params.category || ""
	const page = params.page || ""

	const typeLabel = navLabel?.[type]
	const mainData = mainNavigation?.[category]
	const pageData = mainHierarchy?.[category]?.[page]
	if (!typeLabel || !pageData) return [{ title: "Page Not Found | GoodWatch" }]

	const pageMeta: PageMeta = {
		title: `${convertHyphensToWords(page)} ${typeLabel}: Where to Stream Them | ${convertHyphensToWords(category)} | GoodWatch`,
		description: `Discover the best ${pageData.label} ${typeLabel} to watch right now. ${pageData.subtitle}: ${pageData.description}`,
		// A later page lists other titles, so it is its own address and not a copy of the first.
		url: pagedUrl(
			`https://goodwatch.app/${type}/${category}/${page}`,
			location.search,
		),
		image: `https://goodwatch.app/images/heroes/hero-${type}.png`,
		alt: `${convertHyphensToWords(page)} ${typeLabel} on GoodWatch`,
	}

	// Movies › Moods › Mind-Bending: the hub, the list, and this page.
	return buildMeta({
		pageMeta: plainPageMeta(pageMeta),
		breadcrumbs: categoryCrumbs(`/${type}/${category}/${page}`, pageData.label),
	})
}

interface LoaderData {
	type: NavType
	category: string
	page: string
	path: string
	pageData: PageData
	results: GetDiscoverResult
	discoverParams: DiscoverParams
}

const canonicalLoader: LoaderFunction = async ({
	params,
	request,
}: LoaderFunctionArgs) => {
	// url input validation
	const type = params.type || ""
	const category = params.category || ""
	const page = params.page || ""
	const path = `/${type}/${category}/${page}`

	if (!exploreAddressExists({ type, category, page })) throw notFound()
	const pageData = mainHierarchy[category][page]

	const url = new URL(request.url)
	const watchedType = url.searchParams.get("watchedType") || ""

	// discover call
	const requestParams = await buildDiscoverParams(request)
	const discoverType = type === "tv-shows" ? "show" : type
	const discoverParamsFull: DiscoverParams = {
		...requestParams,
		...defaultDiscoverParams,
		type: discoverType,
		...pageData.discoverParams,
		watchedType,
	}
	const results = await getDiscoverResults(discoverParamsFull)
	requireCategoryPage(discoverParamsFull.page, results, discoverParamsFull.userId)

	const discoverParams = Object.fromEntries(
		Object.entries(discoverParamsFull).filter(
			([key, v]) => key !== "userId" && v != null && v !== "",
		),
	)

	return {
		type,
		category,
		page,
		path,
		pageData,
		discoverParams,
		results,
	}
}

export default function MoviesCategoryPage() {
	const { type, category, page, path, pageData, discoverParams, results } =
		useLoaderData<LoaderData>()

	const discoverType = type === "movies" ? "movies" : "shows"
	const copy = explorePageCopy(
		type,
		category as keyof typeof mainHierarchy,
		pageData,
	)

	const { currentParams, updateQueryParams } =
		useNav<
			Pick<
				DiscoverParams,
				| "watchedType"
				| "streamingPreset"
				| "withStreamingProviders"
				| "withStreamingTypes"
				| "country"
			>
		>()
	const handleFilterByDidntWatch = (filterByDidntWatch: boolean) => {
		updateQueryParams({
			watchedType: filterByDidntWatch ? "didnt-watch" : undefined,
		})
	}
	const handleFilterByMyStreaming = (filterByMyStreaming: boolean) => {
		updateQueryParams({
			streamingPreset: filterByMyStreaming ? "mine" : undefined,
			// withStreamingTypes: "",
			// country: ""
		})
	}

	return (
		<>
			<Breadcrumbs path={path} label={pageData.label} />

			<div className="max-w-7xl mx-auto p-4 flex flex-col gap-4">
				<div
					className="relative py-8 px-4 rounded-lg before:z-10 before:bg-black/70 before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0"
				>
					<img
						src={`https://image.tmdb.org/t/p/w1280/${pageData.backdrop_path}?gw-cors=1`}
						alt=""
						crossOrigin="anonymous"
						{...imageLoadingProps("high")}
						{...HERO_TIMING}
						className="absolute inset-0 w-full h-full object-cover object-top rounded-lg"
					/>
					<div className="relative m-auto ow-full max-w-7xl z-20">
						<h1 className="mb-4 text-4xl md:text-6xl font-extrabold text-gray-300">
							{copy.heading}
						</h1>
						<div className="text-2xl md:text-3xl font-bold text-gray-100">
							{pageData.subtitle}
						</div>
						<p className="text-lg text-gray-300">{copy.intro}</p>
						<div className="mt-8 flex items-center justify-between gap-8 flex-wrap">
							<div className="flex gap-2 flex-wrap">
								<MyStreamingCheckbox
									initialEnabled={currentParams.streamingPreset === "mine"}
									onChange={handleFilterByMyStreaming}
								/>
								<DidntWatchCheckbox
									initialEnabled={currentParams.watchedType === "didnt-watch"}
									onChange={handleFilterByDidntWatch}
								/>
							</div>
							<Link
								to={`/discover/${discoverType}?${jsonToUrlString(discoverParams)}`}
								prefetch="viewport"
								className="px-2 py-1 rounded-sm border-2 border-gray-700 bg-indigo-950 hover:bg-indigo-900"
							>
								Advanced Filters
							</Link>
						</div>
					</div>
				</div>
				<MovieTvGrid
					posterPriority="lazy"
					initialData={{
						pages: [results],
						pageParams: [discoverParams.page],
					}}
					initialParams={{
						...discoverParams,
						page: undefined,
					}}
				/>
			</div>
			<div>
				<FAQ faq={pageData.faq} />
			</div>
		</>
	)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/$type.$category.$page")

// The complete server document paints before route modules compete for bandwidth.
export const handle = START_AFTER_PAINT

// TMDB keeps credentialed and anonymous image connections separate.
export const links = () => [{ rel: "preconnect", href: "https://image.tmdb.org", crossOrigin: "anonymous" as const }]
