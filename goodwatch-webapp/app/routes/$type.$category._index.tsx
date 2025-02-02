import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	redirect,
} from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import React from "react"
import MovieTvList from "~/ui/explore/MovieTvList"
import {
	type NavType,
	defaultDiscoverParams,
	navLabel,
	validUrlParams,
} from "~/ui/explore/config"
import { mainHierarchy } from "~/ui/explore/main-nav"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import { type PageItem, type PageMeta, buildMeta } from "~/utils/meta"

export const meta: MetaFunction = ({ data, params }) => {
	const type = params.type || ""
	const category = params.category || ""

	const typeLabel = navLabel[type]

	const pageMeta: PageMeta = {
		title: `${category} | Best ${typeLabel} to Watch Online | GoodWatch`,
		description: `Discover the best ${typeLabel} to watch right now. From award-winning Netflix exclusives to classic films on Prime Video, Disney+ and HBO. Find ${typeLabel} by genre, mood, or streaming service. Get personalized recommendations based on ratings from IMDb, Rotten Tomatoes, and Metacritic. Updated daily with new releases and trending titles.`,
		url: `https://goodwatch.app/${type}`,
		image: "https://goodwatch.app/images/hero-movies.png",
		alt: "Find your next binge by genre, mood, or streaming service on GoodWatch",
	}

	// TODO
	const items: PageItem[] = []

	return buildMeta(pageMeta, items)
}

interface LoaderData {
	type: NavType
	category: keyof typeof mainHierarchy
	path: string
}

export const loader: LoaderFunction = async ({
	params,
}: LoaderFunctionArgs) => {
	const type = params.type || ""
	const category = params.category || ""
	const path = `/${type}/${category}`

	if (!validUrlParams.type.includes(type)) return redirect("/")
	if (!validUrlParams.category.includes(category)) return redirect(`/${type}`)

	return {
		type,
		category,
		path,
	}
}

export default function MoviesCategory_index() {
	const { type, category, path } = useLoaderData<LoaderData>()
	const discoverType = type === "tv-shows" ? "tv" : type

	const pageItems = Object.values(mainHierarchy[category]).filter(
		(pageData) => {
			return ["all", type].includes(pageData.type)
		},
	)

	return (
		<>
			<Breadcrumbs path={path} />

			<div className="max-w-7xl mx-auto p-4 flex flex-col gap-12">
				{pageItems.map((pageData) => (
					<div key={pageData.path} className="flex flex-col gap-4">
						<Link
							to={pageData.path}
							className="text-6xl font-extrabold opacity-40 text-gray-400 hover:opacity-60 hover:text-amber-400 transition-all"
						>
							{pageData.label}
						</Link>
						<MovieTvList
							discoverParams={{
								...defaultDiscoverParams,
								type: discoverType,
								...pageData.discoverParams,
							}}
						/>
						<Link to={pageData.path}>
							<div className="ml-4 text-lg font-semibold text-indigo-500 hover:text-indigo-400 transition-all">
								Show all {pageData.label}
							</div>
						</Link>
					</div>
				))}
			</div>
		</>
	)
}
