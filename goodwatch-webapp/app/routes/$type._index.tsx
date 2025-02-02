import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	redirect,
} from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import React from "react"
import { type NavType, navLabel, validUrlParams } from "~/ui/explore/config"
import { mainNavigation } from "~/ui/explore/main-nav"
import { type PageItem, type PageMeta, buildMeta } from "~/utils/meta"

export const meta: MetaFunction = ({ params }) => {
	const type = params.type || ""
	const typeLabel = navLabel[type]

	const pageMeta: PageMeta = {
		title: `Best ${typeLabel} to Watch Online | GoodWatch`,
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
}

export const loader: LoaderFunction = async ({
	params,
}: LoaderFunctionArgs) => {
	const type = params.type || ""

	if (!validUrlParams.type.includes(type)) return redirect("/")

	return {
		type,
	}
}

export default function Movies() {
	const { type } = useLoaderData<LoaderData>()

	return (
		<div className="max-w-7xl mx-auto p-4">
			<div className="mt-4 flex flex-col gap-10">
				{Object.values(mainNavigation).map((navItem) => {
					const items = Object.values(navItem.items).filter((pageData) => {
						return ["all", type].includes(pageData?.type)
					})

					return (
						<div key={navItem.path}>
							<Link to={`/${type}/${navItem.path}`} prefetch="viewport">
								<div className="text-6xl font-extrabold opacity-40 text-gray-400 hover:opacity-60 hover:text-amber-400 transition-all">
									{navItem.label}
								</div>
							</Link>
							<div className="my-2 text-2xl text-gray-400">
								<span className="font-semibold">{navItem.subtitle}</span>:{" "}
								<span className="text-xl">{navItem.description}</span>
							</div>
							<div className="my-6 grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
								{items.map((item) => {
									const imageUrl =
										navItem.path === "streaming"
											? item.backdrop_path
											: `https://image.tmdb.org/t/p/w1280/${item.backdrop_path}`
									return (
										<Link
											key={item.path}
											to={`/${type}/${navItem.path}/${item.path}`}
											prefetch="viewport"
											className="group relative block w-full aspect-2 overflow-hidden transition-transform duration-200 hover:scale-105"
										>
											<div
												className="absolute inset-0 bg-cover bg-center"
												style={{ backgroundImage: `url(${imageUrl})` }}
											>
												<div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors duration-300" />
											</div>

											<div className="relative h-full w-full border-2 border-gray-800 group-hover:border-gray-700 transition-colors duration-300">
												<div className="flex h-full items-center justify-center">
													<h2 className="w-full py-2 text-center text-2xl font-bold text-white bg-black/30">
														{item.label}
													</h2>
												</div>
											</div>
										</Link>
									)
								})}
							</div>

							<Link to={`/${type}/${navItem.path}`} prefetch="viewport">
								<div className="text-lg font-semibold text-indigo-500 hover:text-indigo-400 transition-all">
									Show all {navItem.label}
								</div>
							</Link>
						</div>
					)
				})}
			</div>
		</div>
	)
}
