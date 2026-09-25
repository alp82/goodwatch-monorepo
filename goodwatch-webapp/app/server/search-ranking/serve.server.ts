// SEARCH_RANKING_MODE=on: the new ranking serves the search. The current ranking still serves when the new one can't:
// a lesser-known search (the index holds only titles above the eligibility line), a basic search (no reading), the
// index or the query models not loaded yet, a full encoder queue, or a ranking that fails or misses its deadline.
// combinedSearch records the reason on the search_history row (ranker_fallback).
import type {
	Eligibility,
	ReadingFields,
} from "../combined-search/reading-retrieval.server.ts"
import { queryEncoderState } from "./query-encoder.server.ts"
import {
	type RankedSearch,
	type SearchRequest,
	rankSearch,
} from "./rank-search.server.ts"
import { loadedSearchIndexBuild } from "./search-index.server.ts"

// The ranking stage's deadline. The ranker's p95 on the webapp host was 469 ms one at a time and 585 ms two at a
// time, so this leaves room for load spikes while the fallback still answers within a few seconds.
// SEARCH_RANKING_DEADLINE_MS overrides it.
const SERVE_DEADLINE_MS = 1500

export function servingDeadlineMs(): number {
	const ms = Number(process.env.SEARCH_RANKING_DEADLINE_MS)
	return Number.isFinite(ms) && ms > 0 ? ms : SERVE_DEADLINE_MS
}

export type ServingFallback =
	| "lesser known"
	| "basic search"
	| "index not loaded"
	| "encoder not ready"
	| "encoder queue full"
	| "timeout"
	| "error"

/** Why the current ranking must serve this search before the new one is tried, or null when the new one can. */
export function servingFallback(search: {
	hasReading: boolean
	eligibility: Eligibility
}): ServingFallback | null {
	if (search.eligibility.lesserKnown) return "lesser known"
	if (!search.hasReading) return "basic search"
	if (!loadedSearchIndexBuild()) return "index not loaded"
	const encoder = queryEncoderState()
	if (!encoder.ready) return "encoder not ready"
	if (encoder.pending >= encoder.maxPending) return "encoder queue full"
	return null
}

export class RankingDeadlineError extends Error {
	constructor(ms: number) {
		super(`Search ranking missed its ${ms} ms deadline`)
		this.name = "RankingDeadlineError"
	}
}

/**
 * rankSearch with a deadline. On a miss it rejects with RankingDeadlineError; the ranking itself can't be cancelled,
 * so it finishes in the background and its result is dropped.
 */
export function rankForServing(
	reading: ReadingFields,
	request: SearchRequest,
	eligibility: Eligibility,
	deadlineMs = servingDeadlineMs(),
): Promise<RankedSearch> {
	const ranking = rankSearch(reading, request, eligibility)
	let timer: NodeJS.Timeout | undefined
	let missed = false
	const deadline = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			missed = true
			reject(new RankingDeadlineError(deadlineMs))
		}, deadlineMs)
	})
	// After a miss nobody waits for the ranking, so its failure is only logged here.
	ranking.catch((error) => {
		if (missed) console.error("Search ranking failed after its deadline", error)
	})
	return Promise.race([ranking, deadline]).finally(() => clearTimeout(timer))
}
