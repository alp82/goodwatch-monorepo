// Which reading of the request Discover's search shows while the search isn't complete yet. Apart from its controller
// (useDiscoverSearch.ts), so that a test can run it without React.
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"

/** The reading a batch came with, under the key of the request that answered it. */
export interface BatchReading {
	/** The whole request: the query, the filters, and allTitles. */
	key: string
	/** Missing on a batch saved before readings existed. */
	reading: ReadingChip[] | undefined
	/** Set on a partial list sent ahead of the reading and the ranking: it has no reading of its own. */
	pendingRanking?: boolean
}

/** The reading streamed ahead of a batch, under the key of the request it was streamed for. */
export interface StreamedReading {
	key: string
	chips: ReadingChip[]
}

/**
 * The reading of the request `key`; null until one is known. Only what was answered or streamed for this very request
 * counts, so the same query with other filters or another allTitles never shows a reading that isn't its own. The
 * batch's reading wins, also when it is empty (a basic search read nothing). A list sent ahead of the ranking leaves
 * the streamed reading in place.
 */
export function selectReading(
	key: string,
	batch: BatchReading | null,
	streamed: StreamedReading | null,
): ReadingChip[] | null {
	if (batch?.key === key && !batch.pendingRanking) return batch.reading ?? []
	return streamed?.key === key ? streamed.chips : null
}
