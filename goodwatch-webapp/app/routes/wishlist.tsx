import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData, useNavigation } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import React from "react"
import { type GetUserDataResult, useUserData } from "~/routes/api.user-data"
import type { StreamingLink } from "~/server/details.server"
import type { DiscoverResult } from "~/server/discover.server"
import { MovieCard } from "~/ui/MovieCard"
import { TvCard } from "~/ui/TvCard"
import WishlistFilter, {
	type FilterByStreaming,
	type SortBy,
} from "~/ui/filter/WishlistFilter"
import { type UserDataItem, getSortedUserData } from "~/utils/user-data"

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = () => {
	return [
		{ title: "Wishlist | GoodWatch" },
		{
			description:
				"All movie and tv show ratings and streaming providers on the same page",
		},
	]
}

export type LoaderData = {
	currentParams: {
		sortBy: SortBy
		filterByStreaming: FilterByStreaming
	}
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const sortBy = (url.searchParams.get("sortBy") ||
		"most_recently_added") as SortBy
	const filterByStreaming = (url.searchParams.get("filterByStreaming") ||
		"all") as FilterByStreaming

	return json<LoaderData>({
		currentParams: {
			sortBy,
			filterByStreaming,
		},
	})
}

export default function Wishlist() {
	const { currentParams } = useLoaderData<LoaderData>()
	const { data: userData, isLoading } = useUserData()
	const { sortBy, filterByStreaming } = currentParams

	const handleFilterChange = (filters) => {
		console.log({ filters })
	}

	const sortedWishlist = getSortedUserData(userData as GetUserDataResult, [
		"onWishListSince",
	])

	for (const result of sortedWishlist) {
		const streamingLinks = result.streaming_links || []
		const includedProviders: number[] = []
		result.streaming_links = streamingLinks.reduce((links, link) => {
			if (
				includedProviders.includes(link.provider_id) ||
				(filterByStreaming === "free" &&
					!["free", "flatrate"].includes(link.stream_type)) ||
				(filterByStreaming === "mine" &&
					!["free", "flatrate"].includes(link.stream_type))
			) {
				return links
			}

			includedProviders.push(link.provider_id)
			links.push(link)
			return links
		}, [] as StreamingLink[])
	}
	const wishlistToShow = sortedWishlist.filter((item) => true)

	const navigation = useNavigation()

	return (
		<div className="max-w-7xl mx-auto px-4 flex flex-col gap-5 sm:gap-6">
			<div className="mt-6 text-lg md:text-xl lg:text-2xl font-semibold">
				My Wishlist
			</div>

			<WishlistFilter
				sortBy={sortBy}
				filterByStreaming={filterByStreaming}
				onChange={handleFilterChange}
			/>

			<div
				className={
					"relative mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
				}
			>
				<AnimatePresence initial={false}>
					{(navigation.state === "loading" || isLoading) && (
						<span className="absolute top-2 left-6 animate-ping inline-flex h-8 w-8 rounded-full bg-sky-300 opacity-75" />
					)}
					{!wishlistToShow.length &&
					!isLoading &&
					navigation.state === "idle" ? (
						<div className="my-6 text-lg italic">
							You don't have any titles in your Wishlist.
						</div>
						// ) : !wishlistToShow.length && navigation.state === "idle" ? (
						// 	<div className="my-6 text-lg italic">
						// 		No matches with your current filter settings.
						// 	</div>
					) : (
						<></>
					)}
					{wishlistToShow.length > 0 &&
						navigation.state === "idle" &&
						wishlistToShow.map((result, index) => {
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
										{result.media_type === "movie" && (
											<MovieCard
												movie={result as DiscoverResult}
												prefetch={index < 6}
											/>
										)}
										{result.media_type === "tv" && (
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
