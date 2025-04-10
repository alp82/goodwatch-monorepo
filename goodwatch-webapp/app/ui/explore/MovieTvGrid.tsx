import { AnimatePresence, motion } from "framer-motion"
import React, { useEffect, useMemo, useRef } from "react"
import { useInView } from "react-intersection-observer"
import { type GetDiscoverResult, useDiscover } from "~/routes/api.discover"
import type { DiscoverParams, DiscoverResult } from "~/server/discover.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { Spinner } from "~/ui/wait/Spinner"
import { seededRandom } from "~/utils/random"
import { useLocation } from "@remix-run/react"
import { usePageTracking } from "~/hooks/usePageTracking"
import {
	GridLoadingIndicator,
	GridError,
	EmptyResultsMessage,
	EndOfResultsMessage,
	LoadMoreIndicator,
	NextPageLink,
} from "~/ui/explore/GridUtils"

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
	
	const results = useMemo(
		() => discover.data?.pages.flat() ?? [],
		[discover.data],
	)

	// Set up infinite scroll with intersection observer
	const { ref: loadMoreRef, inView } = useInView({
		threshold: 0,
		rootMargin: "400px 0px",
	})
	
	// Grid reference for scroll position calculations
	const gridRef = useRef<HTMLDivElement>(null)
	
	// Set up page tracking system
	usePageTracking({
		data: discover.data,
		isFetching: discover.isFetching,
		gridRef,
	})
	
	// Load more data when scrolling to the bottom
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
	
	// Calculate URL for next page (for SEO)
	const location = useLocation()
	const nextPageUrl = useMemo(() => {
		if (!discover.hasNextPage || !discover.data) return null
		const lastPageParam =
			discover.data.pageParams[discover.data.pageParams.length - 1] || 0
		const nextPage = lastPageParam + 1
		const searchParams = new URLSearchParams(location.search)
		searchParams.set("page", String(nextPage))
		return `${location.pathname}?${searchParams.toString()}`
	}, [discover.hasNextPage, discover.data, location.pathname, location.search])

	// Handle loading and error states
	if (discover.isPending) {
		return <GridLoadingIndicator />
	}

	if (discover.isError) {
		return <GridError message={discover.error.message} />
	}

	return (
		<>
			<div
				ref={gridRef}
				className={
					"relative mt-4 grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5"
				}
			>
				{!results.length && <EmptyResultsMessage />}
				
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
			<LoadMoreIndicator ref={loadMoreRef}>
				{discover.isFetchingNextPage && <Spinner size="large" />}
			</LoadMoreIndicator>

			{/* SEO Link - Conditionally rendered or hidden */}
			<NextPageLink url={nextPageUrl} />

			{/* End of results message */}
			{!discover.hasNextPage &&
				!discover.isFetchingNextPage &&
				results.length > 0 && <EndOfResultsMessage />}
		</>
	)
}
