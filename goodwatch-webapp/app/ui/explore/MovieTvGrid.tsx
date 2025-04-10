import { AnimatePresence, motion } from "framer-motion"
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react"
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
	const results = useMemo(
		() => discover.data?.pages.flat() ?? [],
		[discover.data],
	)

	const { ref: loadMoreRef, inView } = useInView({
		threshold: 0,
		rootMargin: "400px 0px",
	})
	
	const navigate = useNavigate()
	const location = useLocation()
	const gridRef = useRef<HTMLDivElement>(null)
	
	// State to track the current page
	const [currentPage, setCurrentPage] = useState(() => {
		const params = new URLSearchParams(location.search)
		return Number(params.get("page") || "1")
	})
	
	// Calculate approximate items per page
	const itemsPerPage = useMemo(() => {
		if (!discover.data?.pages.length) return 20 // Default assumption
		
		const totalItems = discover.data.pages.reduce((sum, page) => sum + page.length, 0)
		const pageCount = discover.data.pageParams.length
		
		return Math.ceil(totalItems / pageCount)
	}, [discover.data?.pages, discover.data?.pageParams.length])
	
	// Handle scroll events to determine current page
	const handleScroll = useCallback(() => {
		if (!gridRef.current || !discover.data?.pageParams.length) return
		
		const grid = gridRef.current
		const scrollPosition = window.scrollY + window.innerHeight / 2 // Middle of viewport
		const gridTop = grid.offsetTop
		const scrollRelativeToGrid = scrollPosition - gridTop
		
		// Estimate which page we're on based on scroll position
		if (scrollRelativeToGrid <= 0) {
			// Above the grid, set to page 1
			setCurrentPage(1)
			return
		}
		
		// Estimate how many items are visible based on scroll position
		// This is an approximation and might need adjustment based on your layout
		const itemHeight = 250 // Approximate height of each item in pixels
		const gridWidth = grid.clientWidth
		const columnsPerRow = Math.max(2, Math.floor(gridWidth / 200)) // Estimate columns based on grid width
		const visibleItems = Math.floor(scrollRelativeToGrid / itemHeight) * columnsPerRow
		
		// Calculate the page based on visible items and items per page
		const estimatedPage = Math.max(1, Math.ceil(visibleItems / itemsPerPage))
		
		// Find the closest actual page we have loaded
		const availablePages = discover.data.pageParams
		const closestPage = availablePages.reduce((prev, curr) => 
			Math.abs(curr - estimatedPage) < Math.abs(prev - estimatedPage) ? curr : prev
		, availablePages[0])
		
		setCurrentPage(closestPage)
	}, [discover.data?.pageParams, itemsPerPage])
	
	// Set up scroll event listener
	useEffect(() => {
		window.addEventListener("scroll", handleScroll, { passive: true })
		
		// Initial check
		handleScroll()
		
		return () => {
			window.removeEventListener("scroll", handleScroll)
		}
	}, [handleScroll])
	
	// Update URL when current page changes
	useEffect(() => {
		const currentSearchParams = new URLSearchParams(location.search)
		
		if (currentSearchParams.get("page") !== String(currentPage)) {
			currentSearchParams.set("page", String(currentPage))
			
			navigate(`${location.pathname}?${currentSearchParams.toString()}`, {
				replace: true,
				preventScrollReset: true,
			})
		}
	}, [currentPage, navigate, location.pathname, location.search])

	// Load more data when scrolling to the bottom
	useEffect(() => {
		if (inView && discover.hasNextPage && !discover.isFetchingNextPage && !discover.isLoading) {
			discover.fetchNextPage()
		}
	}, [
		inView,
		discover.hasNextPage,
		discover.isFetchingNextPage,
		discover.isLoading,
		discover.fetchNextPage,
	])

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
				ref={gridRef}
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
