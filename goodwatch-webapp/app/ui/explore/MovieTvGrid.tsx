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

// Throttle function to limit how often a function can be called
function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle = false
	return function(this: any, ...args: Parameters<T>) {
		if (!inThrottle) {
			func.apply(this, args)
			inThrottle = true
			setTimeout(() => {
				inThrottle = false
			}, limit)
		}
	}
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
	
	// Grab current values as refs to use in throttled functions without stale closures
	const currentPageRef = useRef(currentPage)
	useEffect(() => {
		currentPageRef.current = currentPage
	}, [currentPage])
	
	// Calculate approximate items per page - highly memoized
	const itemsPerPage = useMemo(() => {
		if (!discover.data?.pages.length) return 20 // Default assumption
		
		const totalItems = discover.data.pages.reduce((sum, page) => sum + page.length, 0)
		const pageCount = discover.data.pageParams.length
		
		return Math.ceil(totalItems / pageCount)
	}, [discover.data?.pages, discover.data?.pageParams.length])
	
	// Memoize available pages to prevent recalculation
	const availablePages = useMemo(() => 
		discover.data?.pageParams || [1], 
	[discover.data?.pageParams])
	
	// Flag to track if initial scroll has been applied
	const initialScrollApplied = useRef(false)
	
	// Jump to the specified page position on initial load - only run once
	useEffect(() => {
		// Only run once when data is first available and we have a grid to measure
		if (
			!discover.data || 
			!gridRef.current || 
			!discover.data.pageParams || 
			initialScrollApplied.current
		) return
		
		const params = new URLSearchParams(location.search)
		const targetPage = Number(params.get("page") || "1")
		
		// Skip for page 1 or if target is higher than what we can fetch
		if (targetPage <= 1 || targetPage > 100) {
			initialScrollApplied.current = true
			return
		}
			
		// Check if we have loaded the requested page
		const hasTargetPage = discover.data.pageParams.some(p => p === targetPage)
		
		if (hasTargetPage) {
			// Calculate approximate scroll position
			const grid = gridRef.current
			const gridTop = grid.offsetTop
			const columnCount = Math.max(2, Math.floor(grid.clientWidth / 200))
			const approximateItemHeight = 250
			
			// Use cached page index lookup if possible
			const targetPageIndex = discover.data.pageParams.indexOf(targetPage)
			
			// Only compute items for pages we actually need
			let itemsBeforePage = 0
			if (targetPageIndex > 0) {
				// Calculate the cumulative items without examining every page
				for (let i = 0; i < targetPageIndex; i++) {
					itemsBeforePage += discover.data.pages[i]?.length || 0
				}
			}
			
			// Calculate rows and scroll position
			const approxRows = Math.ceil(itemsBeforePage / columnCount)
			const scrollTarget = gridTop + (approxRows * approximateItemHeight) - (window.innerHeight / 3)
			
			// Use single rAF to ensure DOM is ready
			requestAnimationFrame(() => {
				window.scrollTo({
					top: scrollTarget,
					behavior: "auto"
				})
				
				// Mark as done
				initialScrollApplied.current = true
			})
		} else if (discover.hasNextPage && !discover.isFetchingNextPage) {
			// Only fetch once and let the data update trigger this effect again
			discover.fetchNextPage()
		}
	}, [discover.data, discover.hasNextPage, discover.isFetchingNextPage, location.search])
	
	// Handle scroll events to determine current page with throttling
	const handleScroll = useCallback(throttle(() => {
		if (!gridRef.current || !availablePages.length) return
		
		const grid = gridRef.current
		const scrollPosition = window.scrollY + window.innerHeight / 2
		const gridTop = grid.offsetTop
		const scrollRelativeToGrid = scrollPosition - gridTop
		
		// Fast path - if we're above the grid, always page 1
		if (scrollRelativeToGrid <= 0) {
			if (currentPageRef.current !== 1) {
				setCurrentPage(1)
			}
			return
		}
		
		// Efficient calculation with fewer operations
		const itemHeight = 250
		const gridWidth = grid.clientWidth
		const columnsPerRow = Math.max(2, Math.floor(gridWidth / 200))
		const visibleItems = Math.floor(scrollRelativeToGrid / itemHeight) * columnsPerRow
		
		// Fast integer division
		const estimatedPage = Math.max(1, Math.ceil(visibleItems / itemsPerPage))
		
		// Find closest page with minimal iteration
		let closestPage = availablePages[0]
		let minDiff = Math.abs(estimatedPage - closestPage)
		
		for (let i = 1; i < availablePages.length; i++) {
			const diff = Math.abs(availablePages[i] - estimatedPage)
			if (diff < minDiff) {
				minDiff = diff
				closestPage = availablePages[i]
			}
		}
		
		// Only update if the page has changed
		if (closestPage !== currentPageRef.current) {
			setCurrentPage(closestPage)
		}
	}, 100), [availablePages, itemsPerPage]) // Limit dependencies to reduce recreation
	
	// Set up scroll event listener with cleanup
	useEffect(() => {
		// Skip attaching listeners if we don't have data yet
		if (!discover.data) return
		
		const throttledScroll = handleScroll
		
		// Use a simple cleanup function that doesn't depend on refs
		const addScrollListener = () => {
			window.addEventListener("scroll", throttledScroll, { passive: true })
		}
		
		const removeScrollListener = () => {
			window.removeEventListener("scroll", throttledScroll)
		}
		
		// Add listener and do initial calculation
		addScrollListener()
		throttledScroll()
		
		// Simple cleanup that doesn't access potentially nullified refs
		return removeScrollListener
	}, [handleScroll, discover.data])
	
	// Debounced URL updates to prevent too many history entries
	useEffect(() => {
		// Skip URL updates during initial load or data fetching
		if (!discover.data || discover.isFetching) return
		
		const currentSearchParams = new URLSearchParams(location.search)
		
		if (currentSearchParams.get("page") !== String(currentPage)) {
			// Store timer ID in a variable
			let timerId: ReturnType<typeof setTimeout> | undefined = undefined
			
			// Create the timeout
			timerId = setTimeout(() => {
				// Only proceed if we're still mounted and have data
				if (discover.data) {
					const newParams = new URLSearchParams(location.search)
					newParams.set("page", String(currentPage))
					
					navigate(`${location.pathname}?${newParams.toString()}`, {
						replace: true,
						preventScrollReset: true,
					})
				}
			}, 300) // Debounce URL updates by 300ms
			
			// Clear timeout on cleanup
			return () => {
				if (timerId) clearTimeout(timerId)
			}
		}
		
		// Empty cleanup when no timer was set
		return () => {}
	}, [currentPage, navigate, location.pathname, location.search, discover.data, discover.isFetching])
	
	// Load more data when scrolling to the bottom - keep this simple
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
