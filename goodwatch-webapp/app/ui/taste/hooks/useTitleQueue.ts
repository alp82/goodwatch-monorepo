import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { ScoringMedia } from "~/ui/scoring/types"
import type { TasteInteraction } from "../types"
import { queryKeySmartTitles } from "~/routes/api.smart-titles"

interface UseTitleQueueParams {
	initialTitles: ScoringMedia[]
	isAuthenticated: boolean
	interactions: TasteInteraction[]
	fetchMoreTitles: () => Promise<ScoringMedia[]>
	prefetchThreshold?: number
	batchSize?: number
}

interface TitleQueueState {
	current: ScoringMedia | null
	next: ScoringMedia | null
	advance: () => void
	isLoading: boolean
	isPrefetching: boolean
	queueLength: number
	reset: () => void
}

const DEFAULT_PREFETCH_THRESHOLD = 5
const DEFAULT_BATCH_SIZE = 20

export function useTitleQueue({
	initialTitles,
	isAuthenticated,
	interactions,
	fetchMoreTitles,
	prefetchThreshold = DEFAULT_PREFETCH_THRESHOLD,
	batchSize = DEFAULT_BATCH_SIZE,
}: UseTitleQueueParams): TitleQueueState {
	// Stable queue that only grows, never shrinks or reorders
	const [queue, setQueue] = useState<ScoringMedia[]>([])
	const [currentIndex, setCurrentIndex] = useState(0)
	const [isPrefetching, setIsPrefetching] = useState(false)
	
	// Track which items have been seen to avoid duplicates
	const seenIds = useRef(new Set<string>())
	
	// Track if we've initialized from initial titles
	const hasInitialized = useRef(false)
	
	// Track ongoing fetch to prevent duplicate requests
	const fetchInProgress = useRef(false)

	// Get IDs of items user has already interacted with
	const interactedIds = useMemo(() => {
		return new Set(interactions.map(i => `${i.media_type}-${i.tmdb_id}`))
	}, [interactions])

	// Helper to create unique key for a media item
	const makeKey = useCallback((item: ScoringMedia) => {
		return `${item.media_type}-${item.tmdb_id}`
	}, [])

	// Filter out already-interacted items and duplicates
	const filterNewTitles = useCallback((titles: ScoringMedia[]): ScoringMedia[] => {
		return titles.filter(title => {
			const key = makeKey(title)
			// Skip if already in queue or already interacted with
			if (seenIds.current.has(key) || interactedIds.has(key)) {
				return false
			}
			return true
		})
	}, [makeKey, interactedIds])

	// Initialize queue from initial titles (only once)
	useEffect(() => {
		if (hasInitialized.current || initialTitles.length === 0) return
		
		const filtered = filterNewTitles(initialTitles)
		if (filtered.length > 0) {
			// Mark all as seen
			filtered.forEach(t => seenIds.current.add(makeKey(t)))
			setQueue(filtered)
			hasInitialized.current = true
		}
	}, [initialTitles, filterNewTitles, makeKey])

	// Prefetch more titles when queue is running low
	const prefetchMore = useCallback(async () => {
		if (fetchInProgress.current || isPrefetching) return
		
		fetchInProgress.current = true
		setIsPrefetching(true)
		
		try {
			const newTitles = await fetchMoreTitles()
			const filtered = filterNewTitles(newTitles)
			
			if (filtered.length > 0) {
				// Mark new titles as seen
				filtered.forEach(t => seenIds.current.add(makeKey(t)))
				// Append to queue without affecting current position
				setQueue(prev => [...prev, ...filtered])
			}
		} catch (error) {
			console.error("[TitleQueue] Failed to prefetch:", error)
		} finally {
			setIsPrefetching(false)
			fetchInProgress.current = false
		}
	}, [fetchMoreTitles, filterNewTitles, makeKey, isPrefetching])

	// Check if we need to prefetch
	useEffect(() => {
		const remainingInQueue = queue.length - currentIndex
		if (remainingInQueue <= prefetchThreshold && !fetchInProgress.current) {
			prefetchMore()
		}
	}, [currentIndex, queue.length, prefetchThreshold, prefetchMore])

	// Advance to next title
	const advance = useCallback(() => {
		setCurrentIndex(prev => prev + 1)
	}, [])

	// Reset queue (for start over functionality)
	const reset = useCallback(() => {
		setCurrentIndex(0)
		setQueue([])
		seenIds.current.clear()
		hasInitialized.current = false
	}, [])

	// Current and next titles
	const current = queue[currentIndex] ?? null
	const next = queue[currentIndex + 1] ?? null

	// Show loading if queue is empty and we haven't initialized
	const showLoading = !hasInitialized.current && initialTitles.length === 0

	return {
		current,
		next,
		advance,
		isLoading: showLoading,
		isPrefetching,
		queueLength: queue.length - currentIndex,
		reset,
	}
}
