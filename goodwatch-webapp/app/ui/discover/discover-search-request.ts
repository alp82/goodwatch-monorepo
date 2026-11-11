// One search for Discover: the combined search's ranked list for the query, as title keys. Apart from the hook
// (useDiscoverSearch.ts), so that a test can run it without React.
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { SearchFilters } from "~/server/combined-search/search-filters"
import type { ReadCount, SearchBatch } from "~/server/combined-search/search.server"
import type { SearchOrigin } from "~/domain/search-attribution"
import { requestSearch } from "~/ui/search/search-client"
import { type TitleKey, titleKey } from "~/utils/title-key"

const UNAVAILABLE = "Search is unavailable right now. Try again in a moment."

export interface DiscoverSearchResult {
	q: string
	/** The ranked list in the ranking's order. */
	ranked: TitleKey[]
	/** For a topic search: what each of the search's own filters keeps out of the topic. */
	filterHides?: SearchBatch["filterHides"]
	/** Shared server snapshot; absent when the shared cache is unavailable. */
	searchSet?: string
	/** With read preferences: the original reading's pool, when a read single genre widened the search. */
	originalSet?: string
	/** With originalSet: the two pools' keys that are one title (server/combined-search/preference-pools.server.ts). */
	identitySet?: string
	/** The query is a title's name: only the person's own filters apply. */
	namedTitle?: boolean
	reading: ReadingChip[]
	people: SearchBatch["people"]
	creditScope: SearchBatch["creditScope"]
	/** Non-empty when the basic search served, or a part of the search failed. */
	errors: string[]
	pendingTitleLookup?: boolean
	/** Set on a partial list of title and people matches sent ahead of the reading and the ranking. */
	pendingRanking?: boolean
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

const resultFor = (q: string, batch: SearchBatch): DiscoverSearchResult => ({
	q,
	ranked: batch.searchKeys
		? (batch.searchKeys as TitleKey[])
		: rankedKeys(batch),
	...(batch.searchSet ? { searchSet: batch.searchSet } : {}),
	...(batch.originalSet ? { originalSet: batch.originalSet } : {}),
	...(batch.identitySet ? { identitySet: batch.identitySet } : {}),
	...(batch.namedTitle ? { namedTitle: true } : {}),
	...(batch.filterHides ? { filterHides: batch.filterHides } : {}),
	reading: batch.reading ?? [],
	people: batch.people ?? [],
	creditScope: batch.creditScope ?? null,
	errors: batch.errors ?? [],
	pendingTitleLookup: batch.pendingTitleLookup,
	...(batch.pendingRanking ? { pendingRanking: true } : {}),
})

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
	onProgress?: (result: DiscoverSearchResult) => void,
	language?: string,
	// Read preferences (domain/search-preferences.ts): the original reading's single genre, and which read filters
	// to count; the counts come after the results.
	preferences?: { originalGenres?: string[]; counted?: string[]; named?: string },
	onCounts?: (counts: ReadCount[]) => void,
	attribution?: SearchOrigin,
): Promise<DiscoverSearchResult> {
	const batch = await requestSearch({
		language,
		attribution,
		// discover: the frozen ranked candidate set, which the results endpoint filters and counts.
		body: {
			q,
			filters,
			allTitles,
			discover: true,
			...(preferences?.originalGenres?.length ? { originalGenres: preferences.originalGenres } : {}),
			...(preferences?.counted?.length ? { counted: preferences.counted } : {}),
			...(preferences?.named ? { named: preferences.named } : {}),
		},
		signal,
		onReading,
		onProgress: (batch) => onProgress?.(resultFor(q, batch)),
		onCounts,
		unavailable: UNAVAILABLE,
	})
	return resultFor(q, batch)
}
