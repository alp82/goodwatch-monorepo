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
import FAQ from "~/ui/explore/FAQ"
import MovieTvGrid from "~/ui/explore/MovieTvGrid"
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
import { jsonToUrlString } from "~/utils/url"

export const meta: MetaFunction = ({ params }) => {
	const type = params.type || ""
	const category = params.category || ""
	const page = params.page || ""

	const typeLabel = navLabel?.[type]
	const mainData = mainNavigation?.[category]
	const pageData = mainHierarchy?.[category]?.[page]

	const pageMeta: PageMeta = {
		title: `${convertHyphensToWords(page)} | ${convertHyphensToWords(category)} | Best ${typeLabel} to Watch Online | GoodWatch`,
		description: `Discover the best ${pageData.label} ${typeLabel} to watch right now. ${pageData.subtitle}: ${pageData.description}`,
		url: `https://goodwatch.app/${type}/${category}/${page}`,
		image: `https://goodwatch.app/images/hero-${type}.png`,
		alt: "Find your next binge by genre, mood, or streaming service on GoodWatch",
	}

	// TODO
	const items: PageItem[] = []

	return buildMeta(pageMeta, items)
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

export const loader: LoaderFunction = async ({
	params,
	request,
}: LoaderFunctionArgs) => {
	// url input validation
	const type = params.type || ""
	const category = params.category || ""
	const page = params.page || ""
	const path = `/${type}/${category}/${page}`

	if (!validUrlParams.type.includes(type)) return redirect("/")
	if (!validUrlParams.category.includes(category)) return redirect(`/${type}`)
	// TODO check page

	// discover call
	const pageData = mainHierarchy?.[category]?.[page]
	const requestParams = await buildDiscoverParams(request)
	const discoverType = type === "tv-shows" ? "tv" : type
	const discoverParams: DiscoverParams = {
		...defaultDiscoverParams,
		...requestParams,
		type: discoverType,
		...pageData.discoverParams,
	}
	const results = await getDiscoverResults(discoverParams)

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

	return (
		<>
			<Breadcrumbs path={path} />

			<div className="max-w-7xl mx-auto p-4 flex flex-col gap-4">
				<div className="text-6xl font-extrabold text-gray-300">
					{pageData.label}{" "}
					<span className="text-4xl text-gray-600">
						{convertHyphensToWords(type)}
					</span>
				</div>
				<div className="text-3xl font-bold text-gray-100">
					{pageData.subtitle}
				</div>
				<div className="text-lg text-gray-300">{pageData.description}</div>
				<div>
					<Link
						to={`/discover?${jsonToUrlString(discoverParams)}`}
						prefetch="viewport"
						className="px-2 py-1 rounded border-2 border-gray-700 bg-indigo-950 hover:bg-indigo-900"
					>
						Advanced Search
					</Link>
				</div>
				<MovieTvGrid discoverResults={results} />
			</div>
			<div>
				<FAQ faq={pageData.faq} />
			</div>
		</>
	)
}
