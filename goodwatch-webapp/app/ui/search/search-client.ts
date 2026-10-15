// What Discover's free-text search and the TV's search keep close at hand for a search: the words of the busy answer
// and of the limit answer, and a `requestSearch` that loads the code for the request itself (search-request.ts) with
// the first search, so the request and its stream reading stay out of the pages' first view.
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

/**
 * The words of the server's busy answer (SEARCH_BUSY_MESSAGE in server/search-runtime/admission.server.ts, which the
 * browser can't import). A test compares the two.
 */
export const SEARCH_BUSY_MESSAGE =
	"Search is busy right now. Try again in a moment."

/**
 * The words of the server's answer to a visitor over the search limit (SEARCH_LIMITED_MESSAGE in
 * server/search-runtime/rate-limit.server.ts). A test compares the two.
 */
export const SEARCH_LIMITED_MESSAGE =
	"Too many searches right now. Try again in a moment."

type SearchRequest = typeof import("./search-request")

const importSearchRequest = () => import("./search-request")
const loadSearchRequest = reloadOnStaleChunk(importSearchRequest)

/** Fetches the code for the request ahead of the first search, where a search is about to follow. */
export const preloadSearchRequest = () => {
	void importSearchRequest().catch(() => {})
}

/**
 * One search (see search-request.ts). Rejects with an Error whose message the page shows next to Retry. When the code
 * for the request can't be loaded, that's the busy message, as for a request that got no answer.
 */
export const requestSearch: SearchRequest["requestSearch"] = async (
	options,
) => {
	let request: SearchRequest
	try {
		request = await loadSearchRequest()
	} catch {
		throw new Error(SEARCH_BUSY_MESSAGE)
	}
	return request.requestSearch(options)
}
