// Discover's search: the combined search's ranked list for the query and the ranking's eligibility, read from its
// newline-delimited stream. The "Read as" chips arrive first, then the batch. The results endpoint filters the ranked
// list in memory, so a change of Not seen yet, moods, the sort, or For you never searches again; only the query and the
// eligibility (type, one genre, Released, services) do. The last list stays while the next one loads.
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import {
	type SearchFilters,
	searchFiltersKey,
} from "~/server/combined-search/search-filters"
import { runDiscoverSearch } from "./discover-search-request"

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
	const key = `${q ?? ""}|${searchFiltersKey(filters)}|${allTitles ? 1 : 0}`
	const result = useQuery({
		queryKey: ["discover-search", key],
		queryFn: ({ signal }) =>
			runDiscoverSearch(q ?? "", filters, allTitles, signal, (chips) =>
				setStreamed({ key, chips }),
			),
		enabled: enabled && q !== null,
		placeholderData: keepPreviousData,
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	})
	const current = q !== null && !result.isPlaceholderData ? result.data : null
	return {
		/** This query's answer; null while it loads (or while browsing). */
		current: current ?? null,
		/** The last answer, this query's or the previous one's, so the grid stays while the next list loads. */
		last: q !== null ? (result.data ?? null) : null,
		/** This query's reading: from its batch, or streamed ahead of it; null until known. */
		reading:
			current?.reading ?? (streamed?.key === key ? streamed.chips : null),
		loading:
			q !== null && enabled && (result.isFetching || result.isPlaceholderData),
		error: q !== null && result.isError ? result.error.message : null,
		retry: result.refetch,
	}
}
