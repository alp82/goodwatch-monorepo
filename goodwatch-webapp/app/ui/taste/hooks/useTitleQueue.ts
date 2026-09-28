import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { queryKeySmartTitles } from "~/routes/api.smart-titles"
import type { ScoringMedia } from "~/ui/scoring/types"
import { readExploration, rememberExploration } from "../exploration"
import type { TasteInteraction } from "../types"

interface UseTitleQueueParams {
	resume?: boolean
	initialTitles: ScoringMedia[]
	isAuthenticated: boolean
	interactions: TasteInteraction[]
	fetchMoreTitles: () => Promise<ScoringMedia[]>
	prefetchThreshold?: number
	batchSize?: number
}

interface TitleQueueState {
	remainingTitles: ScoringMedia[]
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
	resume = false,
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
	// True once a fetch came back with nothing new. Until then an empty queue is still loading: the server
	// render and the first client render have no queue yet, and must not read as "every title seen".
	const [exhausted, setExhausted] = useState(false)
	// A new fetcher (e.g. the Living room TV enabling its quiz) may find titles again.
	useEffect(() => setExhausted(false), [fetchMoreTitles])

	// Track which items have been seen to avoid duplicates
	const seenIds = useRef(new Set<string>())

	// Track if we've initialized from initial titles
	const hasInitialized = useRef(false)

	// Track ongoing fetch to prevent duplicate requests
	const fetchInProgress = useRef(false)

	// Get IDs of items user has already interacted with
	const interactedIds = useMemo(() => {
		return new Set(interactions.map((i) => `${i.media_type}-${i.tmdb_id}`))
	}, [interactions])

	// Helper to create unique key for a media item
	const makeKey = useCallback((item: ScoringMedia) => {
		return `${item.media_type}-${item.tmdb_id}`
	}, [])

	// Filter out already-interacted items and duplicates
	const filterNewTitles = useCallback(
		(titles: ScoringMedia[]): ScoringMedia[] => {
			return titles.filter((title) => {
				const key = makeKey(title)
				// Skip if already in queue or already interacted with
				if (seenIds.current.has(key) || interactedIds.has(key)) {
					return false
				}
				return true
			})
		},
		[makeKey, interactedIds],
	)

	// Initialize queue from initial titles (only once)
	useEffect(() => {
		if (hasInitialized.current || initialTitles.length === 0) return

		const saved = resume ? readExploration().ratingQueue : undefined
		const filtered = saved?.length ? saved : filterNewTitles(initialTitles)
		if (filtered.length > 0) {
			// Mark all as seen
			filtered.forEach((t) => seenIds.current.add(makeKey(t)))
			setQueue(filtered)
			hasInitialized.current = true
		}
	}, [initialTitles, filterNewTitles, makeKey, resume])

	// Prefetch more titles when queue is running low
	const prefetchMore = useCallback(async () => {
		if (fetchInProgress.current || isPrefetching) return

		fetchInProgress.current = true
		setIsPrefetching(true)
		setExhausted(false)

		try {
			const newTitles = await fetchMoreTitles()
			const filtered = filterNewTitles(newTitles)

			if (filtered.length > 0) {
				// Mark new titles as seen
				filtered.forEach((t) => seenIds.current.add(makeKey(t)))
				// Append to queue without affecting current position
				setQueue((prev) => [...prev, ...filtered])
				setExhausted(false)
			} else setExhausted(true)
		} catch (error) {
			console.error("[TitleQueue] Failed to prefetch:", error)
			setExhausted(true)
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
		setCurrentIndex((prev) => prev + 1)
	}, [])

	// Reset queue (for start over functionality)
	const reset = useCallback(() => {
		rememberExploration({
			ratingQueue: [],
			selectedMedia: null,
			view: "rate",
			scrollY: 0,
		})
		setCurrentIndex(0)
		setQueue([])
		seenIds.current.clear()
		hasInitialized.current = false
	}, [])

	// Current and next titles
	const current = queue[currentIndex] ?? null
	const next = queue[currentIndex + 1] ?? null

	// Loading until there is a title, or a fetch has found nothing more.
	const showLoading = current === null && !exhausted

	return {
		remainingTitles: queue.slice(currentIndex),
		current,
		next,
		advance,
		isLoading: showLoading,
		isPrefetching,
		queueLength: queue.length - currentIndex,
		reset,
	}
}
