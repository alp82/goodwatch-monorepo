import WatchableList from "~/ui/discovery/WatchableList"
import { useQuery } from "@tanstack/react-query"
import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
	redirect,
} from "@remix-run/node"
import { useLoaderData, useNavigation } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import React from "react"
import { seededRandomSin } from "~/utils/random"
import { useUserData } from "~/routes/api.user-data"
import type { DiscoverResult } from "~/server/discover.server"
import { isEnabled } from "~/server/features.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { MovieTvCard } from "~/ui/MovieTvCard"
import WishlistFilter, {
	type FilterByStreaming,
	type SortBy,
} from "~/ui/filter/WishlistFilter"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Wishlist | GoodWatch",
		description: "Your personal watchlist of movies and TV shows to watch next",
		url: "https://goodwatch.app/wishlist",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Your GoodWatch Wishlist",
	}

	return buildMeta({ pageMeta, items: [] })
}

export type LoaderData = {
	currentParams: {
		sortBy: SortBy
		filterByStreaming: FilterByStreaming
	}
}

// The old Wishlist sorts, as Watch next names them.
const WATCH_NEXT_SORT: Partial<Record<string, string>> = {
	most_recently_added: "added",
	least_recently_added: "waiting",
	highest_score: "top",
	most_popular: "popular",
}

/** Where /wishlist sends a viewer who sees Watch next, keeping the sort and streaming choice. */
function watchNextUrl(url: URL) {
	const params = new URLSearchParams()
	const sort = WATCH_NEXT_SORT[url.searchParams.get("sortBy") ?? ""]
	if (sort) params.set("sort", sort)
	const streaming = url.searchParams.get("filterByStreaming")
	if (streaming && streaming !== "mine") params.set("services", "all")
	const query = params.toString()
	return query ? `/watch-next?${query}` : "/watch-next"
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	// Watch next replaces the Wishlist page for viewers who see it (members in preview, everyone once on).
	const userId = await getUserIdFromRequest({ request })
	// With REC_TRACKING a member's Wishlist is the first choice of My library (#385). Guests keep what they have.
	if (userId && isEnabled("tracking", { userId }))
		return redirect("/my-library", {
			headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
		})
	if (isEnabled("watchNext", { userId }))
		return redirect(watchNextUrl(url), {
			status: 301,
			// Personal while in preview, and a flag can switch back: browsers must not keep the redirect.
			headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
		})
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
	const { data: userData } = useUserData()
	const { sortBy, filterByStreaming } = currentParams
	const keys = Object.keys(userData?.wishlist || {}).sort()
	const {
		data: titles = [],
		isLoading,
		isError,
		refetch,
	} = useQuery<DiscoverResult[]>({
		queryKey: ["wishlist-titles", keys],
		enabled: keys.length > 0,
		queryFn: async () => {
			const chunks = Array.from(
				{ length: Math.ceil(keys.length / 100) },
				(_, i) => keys.slice(i * 100, i * 100 + 100),
			)
			const results = await Promise.all(
				chunks.map(async (chunk) => {
					const response = await fetch(
						`/api/wishlist-titles?keys=${encodeURIComponent(chunk.join(","))}`,
					)
					if (!response.ok) throw new Error("Could not load Wishlist titles")
					return (await response.json()).titles as DiscoverResult[]
				}),
			)
			return results.flat()
		},
	})
	const handleFilterChange = () => {}
	const wishlistToShow = [...titles].sort((a, b) => {
		const date = (item: DiscoverResult) =>
			new Date(
				userData?.wishlist[`${item.media_type}-${item.tmdb_id}`]?.updatedAt ||
					0,
			).getTime()
		if (sortBy === "highest_score")
			return (
				(b.goodwatch_overall_score_normalized_percent || 0) -
				(a.goodwatch_overall_score_normalized_percent || 0)
			)
		return sortBy === "least_recently_added"
			? date(a) - date(b)
			: date(b) - date(a)
	})

	const navigation = useNavigation()

	return (
		<div className="max-w-7xl mx-auto px-4 flex flex-col gap-5 sm:gap-6">
			<div className="mt-6 text-lg md:text-xl lg:text-2xl font-semibold">
				My Wishlist
			</div>

			{isError && (
				<p role="alert">
					Could not load your Wishlist.{" "}
					<button type="button" className="underline" onClick={() => refetch()}>
						Try again
					</button>
				</p>
			)}

			<WishlistFilter
				sortBy={sortBy}
				filterByStreaming={filterByStreaming}
				onChange={handleFilterChange}
			/>

			<WatchableList titles={wishlistToShow}>
				{(visibleTitles) => (
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
							!isError &&
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
							{visibleTitles.length > 0 &&
								navigation.state === "idle" &&
								visibleTitles.map((result, index) => {
									return (
										<div key={`${result.media_type}-${result.tmdb_id}`}>
											<motion.div
												key={currentParams.sortBy}
												initial={{
													y: `-${Math.floor(seededRandomSin(index + 1) * 10) + 5}%`,
													opacity: 0,
												}}
												animate={{ y: "0", opacity: 1 }}
												exit={{
													y: `${Math.floor(seededRandomSin(index + 1) * 10) + 5}%`,
													opacity: 0,
												}}
												transition={{ duration: 0.5, type: "tween" }}
											>
												{result.media_type === "movie" && (
													<MovieTvCard
														details={result as DiscoverResult}
														mediaType="movie"
														prefetch={index < 6}
													/>
												)}
												{result.media_type === "show" && (
													<MovieTvCard
														details={result as DiscoverResult}
														mediaType="show"
														prefetch={index < 6}
													/>
												)}
											</motion.div>
										</div>
									)
								})}
						</AnimatePresence>
					</div>
				)}
			</WatchableList>
		</div>
	)
}
