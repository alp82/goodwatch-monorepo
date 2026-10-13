// What the search page and Discover's search show of a search that isn't complete yet: which reading of the request,
// how many results the partial list holds, and whether its empty list may say nothing was found. Apart from the two controllers (SearchJourney.tsx and
// useDiscoverSearch.ts), so that a test can run it without React.
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

/**
 * Whether an empty title list may say that nothing was found. Not while the search runs, and not while a partial list
 * shows people above the titles: a search that could not finish did find them. `partialPeople` is the people of the
 * partial list on screen, 0 for a completed answer, whose empty list reads as before.
 */
export function showsNoResults(
	titles: number,
	loading: boolean,
	partialPeople: number,
): boolean {
	return !titles && !loading && !partialPeople
}

const counted = (n: number, one: string, many: string) =>
	`${n} ${n === 1 ? one : many}`

/**
 * How many results a partial list holds, for the status line: its titles, and the people it names above them. Without
 * people it reads as before ("0 results").
 */
export function foundSoFar(titles: number, people: number): string {
	if (!people) return `${titles} results`
	const named = counted(people, "person", "people")
	return titles ? `${counted(titles, "title", "titles")} and ${named}` : named
}
