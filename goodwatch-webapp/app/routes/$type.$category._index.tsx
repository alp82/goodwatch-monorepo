import { ArrowRightCircleIcon } from "@heroicons/react/24/solid"
import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	redirect,
} from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import React from "react"
import type { GetDiscoverResult } from "~/routes/api.discover"
import {
	type DiscoverParams,
	getDiscoverResults,
} from "~/server/discover.server"
import MovieTvList from "~/ui/explore/MovieTvList"
import {
	type NavType,
	type PageData,
	defaultDiscoverParams,
	navLabel,
	validUrlParams,
} from "~/ui/explore/config"
import { mainHierarchy, mainNavigation } from "~/ui/explore/main-nav"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import { buildDiscoverParams } from "~/utils/discover"
import { type PageItem, type PageMeta, buildMeta } from "~/utils/meta"
import { convertHyphensToWords } from "~/utils/string"

export const meta: MetaFunction = ({ data, params }) => {
	const type = params.type || ""
	const category = params.category || ""

	const typeLabel = navLabel?.[type]
	const mainData = mainNavigation?.[category]

	const pageMeta: PageMeta = {
		title: `${convertHyphensToWords(category)} | Best ${typeLabel} to Watch Online | GoodWatch`,
		description: `Discover the best ${mainData.label} ${typeLabel} to watch right now. ${mainData.subtitle}: ${mainData.description}`,
		url: `https://goodwatch.app/${type}/${category}`,
		image: `https://goodwatch.app/images/hero-${type}.png`,
		alt: "Find your next binge by genre, mood, or streaming service on GoodWatch",
	}

	const items: PageItem[] = [
		{ name: "Home", description: "GoodWatch Home", url: "/" },
		{
			name: typeLabel,
			description: `Best ${typeLabel} to Watch`,
			url: `/${type}`,
		},
		{
			name: convertHyphensToWords(category),
			description: `Discover the best ${mainData.label} ${typeLabel} to watch`,
			url: `/${type}/${category}`,
		},
	]

	return buildMeta(pageMeta, items)
}

interface PageResult {
	path: string
	label: string
	discoverParams: DiscoverParams
	results: GetDiscoverResult
}

interface LoaderData {
	type: NavType
	category: keyof typeof mainHierarchy
	path: string
	pageResults: PageResult[]
}

export const loader: LoaderFunction = async ({
	params,
	request,
}: LoaderFunctionArgs) => {
	// url input validation
	const type = params.type || ""
	const category = params.category || ""
	const path = `/${type}/${category}`

	if (!validUrlParams.type.includes(type)) return redirect("/")
	if (!validUrlParams.category.includes(category)) return redirect(`/${type}`)

	// discover call
	const requestParams = await buildDiscoverParams(request)
	const discoverType = type === "tv-shows" ? "tv" : type

	const pageItems = Object.values<PageData>(mainHierarchy[category]).filter(
		(pageData) => {
			return ["all", type].includes(pageData.type)
		},
	)

	const pageResults: PageResult[] = await Promise.all(
		pageItems.map(async (pageData) => {
			const discoverParams: DiscoverParams = {
				...requestParams,
				...defaultDiscoverParams,
				type: discoverType,
				...pageData.discoverParams,
			}
			const results = await getDiscoverResults(discoverParams)
			return { ...pageData, discoverParams, results }
		}),
	)

	return {
		type,
		category,
		path,
		pageResults,
	}
}

export default function MoviesCategory_index() {
	const { type, category, path, pageResults } = useLoaderData<LoaderData>()
	const discoverType = type === "tv-shows" ? "tv" : type

	// const pageItems = Object.values(mainHierarchy[category]).filter(
	// 	(pageData) => {
	// 		return ["all", type].includes(pageData.type)
	// 	},
	// )

	return (
		<>
			<Breadcrumbs path={path} />

			<div className="max-w-7xl mx-auto p-4 flex flex-col gap-12">
				<h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-medium text-gray-100">
					The best{" "}
					<span className="font-extrabold accent">
						{mainNavigation[category].label}
					</span>{" "}
					{type === "movies" ? "Movies" : "TV Shows"}
				</h2>

				{pageResults.map((pageResult) => (
					<div key={pageResult.path} className="flex flex-col gap-4">
						<Link
							to={pageResult.path}
							className="flex flex-col md:flex-row gap-1 md:gap-4 items-start md:items-end py-2 px-4 rounded-lg bg-gray-950/50 hover:bg-gray-950/70 transition-all group"
						>
							<span className="text-4xl md:text-6xl font-extrabold opacity-60 text-gray-400 group-hover:opacity-80 group-hover:text-amber-400">
								{pageResult.label}
							</span>
							<span className="flex gap-1.5 text-base font-semibold text-indigo-500 group-hover:text-indigo-400 ">
								Show all
								<ArrowRightCircleIcon className="w-5" />
							</span>
						</Link>
						<MovieTvList discoverResults={pageResult.results} />
					</div>
				))}
			</div>
		</>
	)
}
