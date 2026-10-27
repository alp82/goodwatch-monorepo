import useLocale from "~/utils/locale"
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
	/** More titles already answered (a member's account): left out of the queue like `interactions`. */
	answeredKeys?: ReadonlySet<string>
	/** Fetches more titles; `queued` are the keys of every title this queue has held, oldest first. */
	fetchMoreTitles: (queued: readonly string[]) => Promise<ScoringMedia[]>
	prefetchThreshold?: number
	batchSize?: number
}

interface TitleQueueState {
	remainingTitles: ScoringMedia[]
	current: ScoringMedia | null
	next: ScoringMedia | null
	advance: () => void
	isLoading: boolean
	/** The last fetch for more titles failed (not: there are none left). `retry` asks again. */
	failed: boolean
	retry: () => void
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
	answeredKeys,
	fetchMoreTitles,
	prefetchThreshold = DEFAULT_PREFETCH_THRESHOLD,
	batchSize = DEFAULT_BATCH_SIZE,
}: UseTitleQueueParams): TitleQueueState {
	const { locale } = useLocale()
	const activeLanguage = useRef(locale.language)
	// Stable queue that only grows, never shrinks or reorders
	const [queue, setQueue] = useState<ScoringMedia[]>([])
	const [currentIndex, setCurrentIndex] = useState(0)
	const [isPrefetching, setIsPrefetching] = useState(false)
	// True once a fetch came back with nothing new. Until then an empty queue is still loading: the server
	// render and the first client render have no queue yet, and must not read as "every title seen".
	const [exhausted, setExhausted] = useState(false)
	// The last fetch failed: not the same as having none left, and it can be asked again.
	const [failed, setFailed] = useState(false)
	// A new fetcher (e.g. the Living room TV enabling its quiz) may find titles again.
	useEffect(() => {
		setExhausted(false)
		setFailed(false)
	}, [fetchMoreTitles])

	// Track which items have been seen to avoid duplicates
	const seenIds = useRef(new Set<string>())

	// Track if we've initialized from initial titles
	const hasInitialized = useRef(false)

	// Track ongoing fetch to prevent duplicate requests
	const fetchInProgress = useRef(false)

	// Get IDs of items user has already interacted with
	const interactedIds = useMemo(() => {
		const ids = new Set(answeredKeys)
		for (const i of interactions) ids.add(`${i.media_type}-${i.tmdb_id}`)
		return ids
	}, [interactions, answeredKeys])

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

	useEffect(() => {
		if (activeLanguage.current === locale.language) return
		activeLanguage.current = locale.language
		setQueue([]); setCurrentIndex(0); seenIds.current.clear(); hasInitialized.current = false
	}, [locale.language])

	// Initialize queue from initial titles (only once)
	useEffect(() => {
		if (hasInitialized.current || initialTitles.length === 0) return

		const saved = resume ? readExploration(locale.language).ratingQueue : undefined
		const filtered = saved?.length ? saved : filterNewTitles(initialTitles.filter(title => (title.presentation?.language ?? "en") === locale.language))
		if (filtered.length > 0) {
			// Mark all as seen
			filtered.forEach((t) => seenIds.current.add(makeKey(t)))
			setQueue(filtered)
			hasInitialized.current = true
		}
	}, [initialTitles, filterNewTitles, makeKey, resume, locale.language])

	// Prefetch more titles when queue is running low
	const prefetchMore = useCallback(async () => {
		if (fetchInProgress.current || isPrefetching) return

		fetchInProgress.current = true
		setIsPrefetching(true)
		setExhausted(false)
		setFailed(false)

		try {
			const language = locale.language
			const newTitles = await fetchMoreTitles([...seenIds.current])
			if (language !== activeLanguage.current) return
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
			setFailed(true)
		} finally {
			setIsPrefetching(false)
			fetchInProgress.current = false
		}
	}, [fetchMoreTitles, filterNewTitles, makeKey, isPrefetching, locale.language])

	// Check if we need to prefetch. Not again on its own after a fetch that failed (`retry` asks again) or found
	// nothing new: the next answer asks again, since the answers change what the server leaves out.
	useEffect(() => {
		const remainingInQueue = queue.length - currentIndex
		if (
			remainingInQueue <= prefetchThreshold &&
			!fetchInProgress.current &&
			!failed &&
			!exhausted
		) {
			prefetchMore()
		}
	}, [currentIndex, queue.length, prefetchThreshold, prefetchMore, failed, exhausted])
	// biome-ignore lint/correctness/useExhaustiveDependencies: each step on may find titles again
	useEffect(() => {
		if (currentIndex > 0) setExhausted(false)
	}, [currentIndex])

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
	const showLoading = current === null && !exhausted && !failed
	const retry = useCallback(() => {
		void prefetchMore()
	}, [prefetchMore])

	return {
		remainingTitles: queue.slice(currentIndex),
		current,
		next,
		advance,
		isLoading: showLoading,
		failed: failed && current === null,
		retry,
		isPrefetching,
		queueLength: queue.length - currentIndex,
		reset,
	}
}
