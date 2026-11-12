import type { SearchOrigin, SearchTrigger } from "~/domain/search-attribution"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
// Discover's search: the combined search's ranked list for the query and the ranking's eligibility, read from its
// newline-delimited stream. The "Read as" chips arrive first, then the batch. The results endpoint filters the ranked
// list in memory, so a change of Not seen yet, moods, the sort, or For you never searches again; only the query and the
// eligibility (type, one genre, Released, services) do. The last list stays while the next one loads.
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { ReadCount } from "~/server/combined-search/search.server"
import {
	type SearchFilters,
	searchFiltersKey,
} from "~/server/combined-search/search-filters"
import { selectReading } from "~/ui/search/search-partial"
import { type DiscoverSearchResult, readsAgainOnAction, runDiscoverSearch } from "./discover-search-request"

export type { DiscoverSearchResult } from "./discover-search-request"

export function useDiscoverSearch({
	q,
	filters,
	allTitles,
	enabled,
	preferences,
	attribution = { surface: "discover", trigger: "navigation" },
}: {
	attribution?: SearchOrigin
	/** Read preferences: the original reading's single genre and the read filters to count (search-preferences.ts). */
	preferences?: { originalGenres?: string[]; counted?: string[]; named?: string }
	/** The query, or null while browsing. */
	q: string | null
	filters: SearchFilters
	allTitles: boolean
	enabled: boolean
}) {
	// The reading of the search in flight, shown before its results.
	const [streamed, setStreamed] = useState<{
		key: string
		chips: ReadingChip[]
	} | null>(null)
	const [provisional, setProvisional] = useState<{ key: string; result: DiscoverSearchResult } | null>(null)
	const nextTrigger = useRef<SearchTrigger | null>(null)
	const generation = useRef(0)
	const liveKey = useRef("")
	const { locale } = useLocale()
	const key = `${locale.language}:${q ?? ""}|${searchFiltersKey(filters)}|${allTitles ? 1 : 0}|${preferences?.originalGenres?.join(",") ?? ""}|${preferences?.counted?.join(",") ?? ""}|${preferences?.named ?? ""}`
	// What the read filters keep out, for this search only: they arrive after its results.
	const [counts, setCounts] = useState<{ key: string; counts: ReadCount[] } | null>(null)
	liveKey.current = enabled && q !== null ? key : ""
	const result = useQuery({
		queryKey: ["discover-search", key],
		queryFn: async ({ signal }) => {
			// The label is the page's (history state, set only by the person's own action, filter changes included) or a
			// retry's. Nothing is inferred from the key: back/forward to another filter entry and changes the page makes by
			// itself stay "navigation", which buys a guest no reading.
			const trigger = nextTrigger.current ?? attribution.trigger
			nextTrigger.current = null
			const attempt = ++generation.current
			// Another search's partial list goes; this search's own stays through a retry, until its next packet or its
			// completed answer.
			setProvisional((old) => (old?.key === key ? old : null))
			const current = () => !signal.aborted && liveKey.current === key && generation.current === attempt
			const answer = await runDiscoverSearch(q ?? "", filters, allTitles, signal, (chips) => {
				if (current()) setStreamed({ key, chips })
			}, (answer) => {
				if (current()) setProvisional({ key, result: answer })
			}, locale.language, preferences, (found) => {
				if (current()) setCounts({ key, counts: found })
			}, { ...attribution, trigger })
			// The completed answer replaces its partial list for good.
			if (generation.current === attempt)
				setProvisional((old) => (old?.key === key ? null : old))
			// The label goes into the cache with the answer, so a later mount of this key knows how it was asked.
			return { ...answer, askedAs: trigger }
		},
		enabled: enabled && q !== null,
		placeholderData: keepPreviousData,
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	})
	const partial = provisional?.key === key ? provisional.result : null
	const completed = q !== null && !result.isPlaceholderData ? (result.data ?? null) : null
	// A guest who opened a link got the basic results; an action on the same words (Enter, the search button, a sort
	// or filter that keeps the key, a title tag's link to a cached search) runs the same search again, which may read.
	// Editing the words or a filter searches anew anyway. The cached answer carries the label it was asked with, so this
	// holds across remounts and returns to a key the cache still has; the answer to the action is cached as asked by an
	// action, so an answer that is withheld again is kept.
	const readAgain = readsAgainOnAction(completed, completed?.askedAs, attribution.trigger) && !result.isFetching
	const readAgainFor = useRef<string | null>(null)
	const refetch = result.refetch
	useEffect(() => {
		if (!readAgain || readAgainFor.current === key) return
		readAgainFor.current = key
		nextTrigger.current = attribution.trigger
		refetch()
	}, [readAgain, key, attribution.trigger, refetch])
	// A completed answer always wins, so a kept partial list can never cover it.
	const current =
		completed ?? (partial && (result.isFetching || result.isError) ? partial : null)
	const shown = partial && current === partial ? partial : null
	// What the partial list still waits for. A list sent ahead of the ranking has no reading of its own.
	const pendingTitleLookup = Boolean(shown?.pendingTitleLookup)
	const pendingRanking = Boolean(shown?.pendingRanking)
	// Nothing to retry while the search is running.
	const failed = q !== null && result.isError && !result.isFetching
	return {
		/** This query's answer; null while it loads (or while browsing). */
		current: current ?? null,
		/** The last answer, this query's or the previous one's, so the grid stays while the next list loads. */
		last: q !== null ? (current ?? result.data ?? null) : null,
		/** The shown list is a partial one, which the completed answer replaces. */
		partial: Boolean(shown),
		pendingTitleLookup,
		pendingRanking,
		/**
		 * This search's reading: from its batch, or streamed ahead of it; null until known. `current` is this key's: the
		 * partial list was matched on its key above, and a completed answer that isn't placeholder data is the query
		 * key's own.
		 */
		reading: selectReading(
			key,
			current ? { key, reading: current.reading, pendingRanking } : null,
			streamed,
		),
		loading:
			q !== null && enabled && (result.isFetching || result.isPlaceholderData),
		/** What to show next to Retry once the search has failed; null while it runs. */
		error: failed
			? pendingRanking
				? "The search could not finish. Showing the results found so far."
				: shown
					? "Title matches could not finish. Showing the results found so far."
					: (result.error?.message ?? null)
			: null,
		retry: () => { nextTrigger.current = "retry"; return result.refetch() },
		/** The read filters' hides for this search; null until they arrive (or when none were asked for). */
		counts: counts?.key === key ? counts.counts : null,
	}
}
