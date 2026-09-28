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
import type { SearchBatch } from "~/server/combined-search/search.server"
import { type TitleKey, titleKey } from "~/utils/title-key"

const UNAVAILABLE = "Search is unavailable right now. Try again in a moment."

export interface DiscoverSearchResult {
	q: string
	/** The ranked list in the ranking's order. */
	ranked: TitleKey[]
	reading: ReadingChip[]
	people: SearchBatch["people"]
	creditScope: SearchBatch["creditScope"]
	/** Non-empty when the basic search served, or a part of the search failed. */
	errors: string[]
}

const rankedKeys = (batch: SearchBatch): TitleKey[] => {
	const keys: TitleKey[] = []
	for (const row of batch.rows) {
		const [type, id] = row.key.split(":")
		const tmdbId = Number(id)
		if ((type === "movie" || type === "show") && Number.isSafeInteger(tmdbId))
			keys.push(titleKey(type, tmdbId))
	}
	return [...new Set(keys)]
}

async function runSearch(
	q: string,
	filters: SearchFilters,
	allTitles: boolean,
	signal: AbortSignal,
	onReading: (chips: ReadingChip[]) => void,
): Promise<DiscoverSearchResult> {
	const response = await fetch("/api/combined-search", {
		method: "POST",
		signal,
		headers: { "Content-Type": "application/json" },
		// discover: the whole ranked list (up to 100 titles), which the results endpoint filters and counts.
		body: JSON.stringify({ q, filters, allTitles, discover: true }),
	})
	if (!response.ok) {
		const body = await response.json().catch(() => ({}))
		throw new Error(body.error ?? UNAVAILABLE)
	}
	const reader = response.body?.getReader()
	if (!reader) throw new Error(UNAVAILABLE)
	const decoder = new TextDecoder()
	let buffered = ""
	let batch: SearchBatch | undefined
	const handle = (line: string) => {
		if (!line.trim()) return
		const message = JSON.parse(line)
		if (message.kind === "reading") onReading(message.reading)
		else if (message.kind === "batch") batch = message.batch
		else if (message.kind === "error")
			throw new Error(message.error ?? UNAVAILABLE)
	}
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		buffered += decoder.decode(value, { stream: true })
		const lines = buffered.split("\n")
		buffered = lines.pop() ?? ""
		for (const line of lines) handle(line)
	}
	handle(buffered + decoder.decode())
	if (!batch) throw new Error(UNAVAILABLE)
	return {
		q,
		ranked: rankedKeys(batch),
		reading: batch.reading ?? [],
		people: batch.people ?? [],
		creditScope: batch.creditScope ?? null,
		errors: batch.errors ?? [],
	}
}

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
			runSearch(q ?? "", filters, allTitles, signal, (chips) =>
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
