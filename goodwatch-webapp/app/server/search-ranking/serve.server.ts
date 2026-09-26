// Serving the search ranking: loading it at server start, the checks before a search is ranked, and the deadline.
// When a search can't be ranked (see servingFallback, or a ranking that fails or misses its deadline), the basic
// search serves it, and combinedSearch records the reason on the search_history row (ranker_fallback).
import type {
	Eligibility,
	ReadingFields,
} from "../combined-search/reading-retrieval.server.ts"
import { queryEncoderState, startQueryEncoder } from "./query-encoder.server.ts"
import {
	type RankedSearch,
	type SearchRequest,
	rankSearch,
} from "./rank-search.server.ts"
import {
	loadedSearchIndexBuild,
	startSearchIndex,
} from "./search-index.server.ts"

// The ranking stage's deadline. The ranker's p95 on the webapp host was 469 ms one at a time and 585 ms two at a
// time, so this leaves room for load spikes while the fallback still answers within a few seconds.
// SEARCH_RANKING_DEADLINE_MS overrides it.
const SERVE_DEADLINE_MS = 1500

let started = false

/** At server start: loads the index and the query models in the background, so the first searches don't wait. */
export function startSearchRanking(): void {
	if (started) return
	started = true
	startSearchIndex()
	startQueryEncoder().then(
		(startup) =>
			console.info(
				`Search ranking: query models ready in ${Math.round(startup.totalMs)} ms`,
			),
		() => {
			// Logged by the encoder; it retries on a later search.
		},
	)
}

export function servingDeadlineMs(): number {
	const ms = Number(process.env.SEARCH_RANKING_DEADLINE_MS)
	return Number.isFinite(ms) && ms > 0 ? ms : SERVE_DEADLINE_MS
}

export type ServingFallback =
	| "basic search"
	| "index not loaded"
	| "encoder not ready"
	| "encoder queue full"
	| "timeout"
	| "error"

/** Why the basic search must serve this search before the ranking is tried, or null when the ranking can. */
export function servingFallback(search: {
	hasReading: boolean
}): ServingFallback | null {
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
