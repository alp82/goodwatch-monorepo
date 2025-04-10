import { AnimatePresence, motion } from "framer-motion"
import React, { useEffect, useMemo } from "react"
import { useInView } from "react-intersection-observer"
import { type GetDiscoverResult, useDiscover } from "~/routes/api.discover"
import type { DiscoverParams, DiscoverResult } from "~/server/discover.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { Spinner } from "~/ui/wait/Spinner"
import { seededRandom } from "~/utils/random"
import { Link, useLocation, useNavigate } from "@remix-run/react"

export interface MovieTvGridParams {
	initialData: { pages: GetDiscoverResult[]; pageParams: number[] }
	initialParams: Omit<DiscoverParams, "page">
}

export default function MovieTvGrid({
	initialData,
	initialParams,
}: MovieTvGridParams) {
	const discoverEnabled = !initialData
	const discover = useDiscover({
		initialData,
		params: initialParams,
		enabled: discoverEnabled,
	})
	// const loading = discoverEnabled && discover.isLoading
	const results = useMemo(
		() => discover.data?.pages.flat() ?? [],
		[discover.data],
	)

	const { ref: loadMoreRef, inView } = useInView({
		threshold: 0,
		rootMargin: "400px 0px",
	})

	useEffect(() => {
		if (inView && discover.hasNextPage && !discover.isFetchingNextPage) {
			discover.fetchNextPage()
		}
	}, [
		inView,
		discover.hasNextPage,
		discover.isFetchingNextPage,
		discover.fetchNextPage,
	])

	const navigate = useNavigate()
	const location = useLocation()
	useEffect(() => {
		// Update URL only when new pages have been loaded successfully
		if (discover.data && discover.data.pageParams.length > 1) {
			// Only update if more than the initial page exists
			const lastLoadedPage =
				discover.data.pageParams[discover.data.pageParams.length - 1]
			const currentSearchParams = new URLSearchParams(location.search)

			// Update only if the URL doesn't already reflect the last loaded page
			if (currentSearchParams.get("page") !== String(lastLoadedPage)) {
				currentSearchParams.set("page", String(lastLoadedPage))
				navigate(`${location.pathname}?${currentSearchParams.toString()}`, {
					replace: true,
					preventScrollReset: true,
				})
			}
		}
		// Only run when pageParams array changes reference (new page added)
	}, [discover.data?.pageParams, navigate, location.pathname, location.search])

	const nextPageUrl = useMemo(() => {
		if (!discover.hasNextPage || !discover.data) return null
		const lastPageParam =
			discover.data.pageParams[discover.data.pageParams.length - 1] || 0
		const nextPage = lastPageParam + 1
		const searchParams = new URLSearchParams(location.search)
		searchParams.set("page", String(nextPage))
		return `${location.pathname}?${searchParams.toString()}`
	}, [discover.hasNextPage, discover.data, location.pathname, location.search])

	if (discover.isPending) {
		return (
			<div className="h-60 col-span-full flex justify-center items-center">
				<Spinner size="large" /> Loading initial results...
			</div>
		)
	}

	if (discover.isError) {
		return (
			<div className="my-6 text-lg italic text-red-500 col-span-full">
				Error: {discover.error.message}
			</div>
		)
	}

	return (
		<>
			<div
				className={
					"relative mt-4 grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5"
				}
			>
				{!results.length && (
					<div className="my-6 text-lg italic">
						No results. Try to change your search filters.
					</div>
				)}
				<AnimatePresence>
					{results.map((result: DiscoverResult, index) => {
						const offset = Math.floor(seededRandom(index + 1) * 12) + 6
						return (
							<div key={`${result.media_type}-${result.tmdb_id}`}>
								<motion.div
									initial={{
										y: `-${offset}%`,
										opacity: 0,
									}}
									animate={{ y: "0", opacity: 1 }}
									exit={{
										y: `${offset}%`,
										opacity: 0,
									}}
									transition={{ duration: 0.3, type: "tween" }}
								>
									<MovieTvCard
										details={result as DiscoverResult}
										mediaType={result.media_type}
										prefetch={false}
									/>
								</motion.div>
							</div>
						)
					})}
				</AnimatePresence>
			</div>

			{/* Sentinel Element & Loading Indicator for NEXT page */}
			<div
				ref={loadMoreRef}
				className="h-20 col-span-full flex justify-center items-center"
			>
				{discover.isFetchingNextPage && <Spinner size="large" />}
			</div>

			{/* SEO Link - Conditionally rendered or hidden */}
			{nextPageUrl && (
				<div className="h-0 overflow-hidden">
					{" "}
					{/* Hide visually but keep in DOM */}
					<Link
						to={nextPageUrl}
						prefetch="intent"
						aria-hidden="true"
						tabIndex={-1}
					>
						Next Page
					</Link>
				</div>
			)}

			{/* End of results message */}
			{!discover.hasNextPage &&
				!discover.isFetchingNextPage &&
				results.length > 0 && (
					<div className="my-6 text-center italic col-span-full">
						You've reached the end of results
					</div>
				)}
		</>
	)
}
