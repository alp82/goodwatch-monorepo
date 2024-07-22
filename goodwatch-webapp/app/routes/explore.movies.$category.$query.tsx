import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData, useNavigation } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import React from "react"
import { useUpdateUrlParams } from "~/hooks/updateUrlParams"
import {
	AVAILABLE_CATEGORIES,
	type ExploreParams,
	type ExploreResult,
	getExploreResults,
} from "~/server/explore.server"
import { MovieCard } from "~/ui/MovieCard"
import { TvCard } from "~/ui/TvCard"
import useLocale, { getLocaleFromRequest } from "~/utils/locale"

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = () => {
	return [
		{ title: "Explore | GoodWatch" },
		{
			description:
				"All movie and tv show ratings and streaming providers on the same page",
		},
	]
}

export type LoaderData = {
	params: ExploreParams
	results: ExploreResult[]
	error?: string
}

export const loader: LoaderFunction = async ({
	params,
	request,
}: LoaderFunctionArgs) => {
	const { locale } = getLocaleFromRequest(request)

	const url = new URL(request.url)
	const type = "movies" as ExploreParams["type"]
	const category = (params.category || "dna") as ExploreParams["category"]
	const query = params.query as ExploreParams["query"]

	const exploreParams = {
		type,
		category,
		query,
	}
	if (!query || !AVAILABLE_CATEGORIES.includes(category)) {
		return json<LoaderData>({
			params: exploreParams,
			results: [],
			error: "Invalid query or category",
		})
	}

	const { results } = await getExploreResults(exploreParams)

	return json<LoaderData>({
		params: exploreParams,
		results,
	})
}

export default function ExploreMoviesCategoryQuery() {
	const { params, results, error } = useLoaderData<LoaderData>()
	console.log({ params, results })

	const navigation = useNavigation()
	const { locale } = useLocale()

	const { currentParams, constructUrl, updateParams } = useUpdateUrlParams({
		params,
	})

	if (error) {
		return (
			<div className="max-w-7xl mx-auto px-4 flex flex-col gap-5 sm:gap-6">
				<div>{error}</div>
			</div>
		)
	}

	return (
		<div className="max-w-7xl mx-auto px-4 flex flex-col gap-5 sm:gap-6">
			<div className="w-full h-28 relative text-white">
				<div className="absolute inset-0 pl-4 flex items-center justify-start gap-3">
					<div className="text-4xl font-bold">{currentParams.query}</div>
					<div className="text-2xl">
						{currentParams.type === "movies" ? "Movies" : "TV Shows"}
					</div>
				</div>
				<div className="absolute inset-0 px-8 flex items-center justify-end opacity-20 text-gray-400 text-8xl">
					{currentParams.category.charAt(0).toUpperCase() +
						currentParams.category.slice(1)}
				</div>
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
						results.map((result: ExploreResult, index) => {
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
										{currentParams.type === "movies" && (
											<MovieCard
												movie={result as ExploreResult}
												prefetch={index < 6}
											/>
										)}
										{currentParams.type === "tv" && (
											<TvCard
												tv={result as ExploreResult}
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
