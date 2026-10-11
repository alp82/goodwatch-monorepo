// Discover's search: the combined search's ranked list for the query and the ranking's eligibility, read from its
// newline-delimited stream. The "Read as" chips arrive first, then the batch. The results endpoint filters the ranked
// list in memory, so a change of Not seen yet, moods, the sort, or For you never searches again; only the query and the
// eligibility (type, one genre, Released, services) do. The last list stays while the next one loads.
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useRef, useState } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import {
	type SearchFilters,
	searchFiltersKey,
} from "~/server/combined-search/search-filters"
import { type DiscoverSearchResult, runDiscoverSearch } from "./discover-search-request"

export type { DiscoverSearchResult } from "./discover-search-request"

export function useDiscoverSearch({
	q,
	filters,
	allTitles,
	enabled,
}: {
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
	const generation = useRef(0)
	const liveKey = useRef("")
	const key = `${q ?? ""}|${searchFiltersKey(filters)}|${allTitles ? 1 : 0}`
	liveKey.current = enabled && q !== null ? key : ""
	const result = useQuery({
		queryKey: ["discover-search", key],
		queryFn: async ({ signal }) => {
			const attempt = ++generation.current
			// Another search's partial list goes; this search's own stays through a retry, until its next packet or its
			// completed answer.
			setProvisional((old) => (old?.key === key ? old : null))
			const current = () => !signal.aborted && liveKey.current === key && generation.current === attempt
			const answer = await runDiscoverSearch(q ?? "", filters, allTitles, signal, (chips) => {
				if (current()) setStreamed({ key, chips })
			}, (answer) => {
				if (current()) setProvisional({ key, result: answer })
			})
			// The completed answer replaces its partial list for good.
			if (generation.current === attempt)
				setProvisional((old) => (old?.key === key ? null : old))
			return answer
		},
		enabled: enabled && q !== null,
		placeholderData: keepPreviousData,
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	})
	const partial = provisional?.key === key ? provisional.result : null
	const completed = q !== null && !result.isPlaceholderData ? (result.data ?? null) : null
	// A completed answer always wins, so a kept partial list can never cover it.
	const current =
		completed ?? (partial && (result.isFetching || result.isError) ? partial : null)
	const pendingTitleLookup = Boolean(partial && current === partial)
	// Nothing to retry while the search is running.
	const failed = q !== null && result.isError && !result.isFetching
	return {
		/** This query's answer; null while it loads (or while browsing). */
		current: current ?? null,
		/** The last answer, this query's or the previous one's, so the grid stays while the next list loads. */
		last: q !== null ? (current ?? result.data ?? null) : null,
		pendingTitleLookup,
		/** This query's reading: from its batch, or streamed ahead of it; null until known. */
		reading:
			current?.reading ?? (streamed?.key === key ? streamed.chips : null),
		loading:
			q !== null && enabled && (result.isFetching || result.isPlaceholderData),
		/** What to show next to Retry once the search has failed; null while it runs. */
		error: failed
			? pendingTitleLookup
				? "Title matches could not finish. Showing the results found so far."
				: (result.error?.message ?? null)
			: null,
		retry: result.refetch,
	}
}
