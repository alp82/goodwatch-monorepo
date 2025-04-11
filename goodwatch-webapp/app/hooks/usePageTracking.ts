import { useState, useRef, useEffect, useCallback } from "react"
import { useNavigate, useLocation } from "@remix-run/react"
import { throttle } from "~/utils/performance"

interface PageTrackingOptions {
	// Data from the discover component
	data?: {
		pages?: any[]
		pageParams?: number[]
	}
	// Is data being fetched
	isFetching?: boolean
	// Reference to the grid element
	gridRef: React.RefObject<HTMLDivElement>
	// Approximate number of items per page
	itemsPerPage?: number
}

/**
 * Custom hook for tracking page position during scrolling and updating URL accordingly
 */
export function usePageTracking({
	data,
	isFetching,
	gridRef,
	itemsPerPage: defaultItemsPerPage = 20,
}: PageTrackingOptions) {
	const navigate = useNavigate()
	const location = useLocation()

	// Add this effect to mark the document as using custom scroll handling
	useEffect(() => {
		// When this hook is used, add a special data attribute to the document
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-custom-scroll', 'true');
		}
		
		return () => {
			// Clean up when the component unmounts
			if (typeof document !== 'undefined') {
				document.documentElement.removeAttribute('data-custom-scroll');
			}
		};
	}, []);

	// Get initial page from URL parameters
	const [currentPage, setCurrentPage] = useState(() => {
		const params = new URLSearchParams(location.search)
		return Number(params.get("page") || "1")
	})

	// Ref to avoid stale closures in throttled functions
	const currentPageRef = useRef(currentPage)
	useEffect(() => {
		currentPageRef.current = currentPage
	}, [currentPage])

	// Calculate approximate items per page based on data
	const itemsPerPage = data?.pages?.length
		? Math.ceil(
				data.pages.reduce((sum, page) => sum + page.length, 0) /
					(data.pageParams?.length || 1),
			)
		: defaultItemsPerPage

	// Available pages for tracking
	const availablePages = data?.pageParams || [1]

	// Flag to track if initial scroll has been applied
	const initialScrollApplied = useRef(false)

	// Scroll to the specified page position on initial load
	useEffect(() => {
		// Only run once when data is first available and we have a grid to measure
		if (
			!data ||
			!gridRef.current ||
			!data.pageParams ||
			initialScrollApplied.current
		)
			return

		const params = new URLSearchParams(location.search)
		const targetPage = Number(params.get("page") || "1")

		// Skip for page 1 or if target is higher than what we can fetch
		if (targetPage <= 1 || targetPage > 100) {
			initialScrollApplied.current = true
			return
		}

		// Check if we have loaded the requested page
		const hasTargetPage = data.pageParams.some((p) => p === targetPage)

		if (hasTargetPage) {
			// Calculate approximate scroll position
			const grid = gridRef.current
			const gridTop = grid.offsetTop
			const columnCount = Math.max(2, Math.floor(grid.clientWidth / 200))
			const approximateItemHeight = 250

			// Use cached page index lookup if possible
			const targetPageIndex = data.pageParams.indexOf(targetPage)

			// Only compute items for pages we actually need
			let itemsBeforePage = 0
			if (targetPageIndex > 0) {
				// Calculate the cumulative items without examining every page
				for (let i = 0; i < targetPageIndex; i++) {
					itemsBeforePage += data.pages[i]?.length || 0
				}
			}

			// Calculate rows and scroll position
			const approxRows = Math.ceil(itemsBeforePage / columnCount)
			const scrollTarget =
				gridTop + approxRows * approximateItemHeight - window.innerHeight / 3

			// Use single rAF to ensure DOM is ready
			requestAnimationFrame(() => {
				window.scrollTo({
					top: scrollTarget,
					behavior: "auto",
				})

				// Mark as done
				initialScrollApplied.current = true
			})
		}
	}, [data, location.search, gridRef])

	// Handle scroll events to determine current page with throttling
	const handleScroll = useCallback(
		throttle(() => {
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
			const visibleItems =
				Math.floor(scrollRelativeToGrid / itemHeight) * columnsPerRow

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
		}, 100),
		[availablePages, itemsPerPage, gridRef],
	)

	// Set up scroll event listener with cleanup
	useEffect(() => {
		// Skip attaching listeners if we don't have data yet
		if (!data) return

		const throttledScroll = handleScroll

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
	}, [handleScroll, data])

	// Debounced URL updates to prevent too many history entries
	useEffect(() => {
		// Skip URL updates during initial load or data fetching
		if (!data || isFetching) return

		const currentSearchParams = new URLSearchParams(location.search)

		if (currentSearchParams.get("page") !== String(currentPage)) {
			if (data) {
				const newParams = new URLSearchParams(location.search)
				newParams.set("page", String(currentPage))

				navigate(`${location.pathname}?${newParams.toString()}`, {
					replace: true,
					preventScrollReset: true,
				})
			}
		}

		// Empty cleanup when no timer was set
		return () => {}
	}, [
		currentPage,
		navigate,
		location.pathname,
		location.search,
		data,
		isFetching,
	])

	return { currentPage }
}
