import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
	redirect,
} from "@remix-run/node"
import {
	useLoaderData,
	useNavigate,
	useNavigation,
	useRouteError,
} from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import React from "react"
import { useUpdateUrlParams } from "~/hooks/updateUrlParams"
import {
	AVAILABLE_CATEGORIES,
	type ExploreParams,
	type ExploreResult,
	getExploreResults,
} from "~/server/explore.server"
import { AVAILABLE_TYPES, type FilterMediaType } from "~/server/search.server"
import { filterMediaTypes } from "~/server/utils/query-db"
import { MovieTvCard } from "~/ui/MovieTvCard"
import MediaTypeTabs from "~/ui/tabs/MediaTypeTabs"
import type { Tab } from "~/ui/tabs/Tabs"
import { getLocaleFromRequest } from "~/utils/locale"

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
				onClick={() => navigate("/explore/all")}
			>
				Go Back
			</button>
		</div>
	)
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
	const type = (params.type || "movies") as ExploreParams["type"]
	const category = (params.category || "dna") as ExploreParams["category"]
	const text = params.text as ExploreParams["text"]
	// TODO guess country
	const country = (url.searchParams.get("country") ||
		"US") as ExploreParams["country"]

	return redirect(`/${type === "movies" ? "movies" : "tv-shows"}`)

	const exploreParams = {
		type,
		category,
		text,
		country,
	}
	if (!type || !filterMediaTypes.includes(type)) {
		return json<LoaderData>({
			params: exploreParams,
			results: [],
			error: "Invalid type",
		})
	}
	if (!text || !AVAILABLE_CATEGORIES.includes(category)) {
		return json<LoaderData>({
			params: exploreParams,
			results: [],
			error: "Invalid text or category",
		})
	}

	const { results } = await getExploreResults(exploreParams)

	return json<LoaderData>({
		params: exploreParams,
		results,
	})
}

export default function Explore() {
	const { params, results, error } = useLoaderData<LoaderData>()
	const navigation = useNavigation()
	const navigate = useNavigate()

	const { currentParams, constructUrl, updateParams } = useUpdateUrlParams({
		params,
	})

	const handleTypeChange = (tab: Tab<FilterMediaType>) => {
		navigate(
			`/explore/${tab.key}/${currentParams.category}/${currentParams.text}`,
		)
	}

	if (error) {
		return (
			<div className="max-w-7xl mx-auto px-4 flex flex-col gap-5 sm:gap-6">
				<div>{error}</div>
			</div>
		)
	}

	return (
		<div className="max-w-7xl mx-auto px-4 flex flex-col gap-5 sm:gap-6">
			<div className="w-full flex flex-col gap-6 text-white">
				<div className="px-4 flex items-center justify-start gap-3">
					<div className="text-4xl font-bold">{currentParams.text}</div>
					<div className="opacity-20 text-gray-400 text-8xl font-extrabold">
						{currentParams.category.charAt(0).toUpperCase() +
							currentParams.category.slice(1).replace(/_/g, " ")}
					</div>
				</div>
				{/*<div className="px-4 flex items-center justify-start gap-3">*/}
				{/*	<div className="text-lg text-gray-300">Other places:</div>*/}
				{/*	<DNATag*/}
				{/*		type={currentParams.type}*/}
				{/*		category={currentParams.category}*/}
				{/*		label={"London"}*/}
				{/*	/>*/}
				{/*</div>*/}
			</div>

			<div>
				<MediaTypeTabs
					selected={currentParams.type}
					onSelect={handleTypeChange}
				/>
			</div>

			<div
				className={
					"relative mt-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 grid-flow-dense auto-rows-min gap-2"
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
						results.map((result, index) => {
							const isSmall =
								result.aggregated_overall_score_normalized_percent < 75
							const cardClass = isSmall
								? "row-span-2 col-span-2 xs:row-span-1 xs:col-span-1"
								: "row-span-2 col-span-2"

							return (
								<div
									key={result.tmdb_id}
									className={`transform transition-transform duration-500 ${cardClass}`}
								>
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
										<MovieTvCard
											details={result as ExploreResult}
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
	)
}
