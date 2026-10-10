// One search for Discover: the combined search's ranked list for the query, as title keys. Apart from the hook
// (useDiscoverSearch.ts), so that a test can run it without React.
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { SearchFilters } from "~/server/combined-search/search-filters"
import type { SearchBatch } from "~/server/combined-search/search.server"
import { requestSearch } from "~/ui/search/search-client"
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

/**
 * Rejects with the message that Discover shows next to Retry: the server's own, or the busy message when the proxy
 * answered instead of a search role (see search-request.ts).
 */
export async function runDiscoverSearch(
	q: string,
	filters: SearchFilters,
	allTitles: boolean,
	signal: AbortSignal,
	onReading: (chips: ReadingChip[]) => void,
): Promise<DiscoverSearchResult> {
	const batch = await requestSearch({
		// discover: the whole ranked list (up to 100 titles), which the results endpoint filters and counts.
		body: { q, filters, allTitles, discover: true },
		signal,
		onReading,
		unavailable: UNAVAILABLE,
	})
	return {
		q,
		ranked: rankedKeys(batch),
		reading: batch.reading ?? [],
		people: batch.people ?? [],
		creditScope: batch.creditScope ?? null,
		errors: batch.errors ?? [],
	}
}
