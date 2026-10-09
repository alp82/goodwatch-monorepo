// What the search page and Discover's free-text search keep in the app shell for a search: the words of the busy
// answer, the rule for the Retry link, and a `requestSearch` that loads the code for the request itself
// (search-request.ts) with the first search. The search page's controller is part of the app shell, which every
// landing page downloads, so the request and its stream reading stay out of it.
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

/**
 * The words of the server's busy answer (SEARCH_BUSY_MESSAGE in server/search-runtime/admission.server.ts, which the
 * browser can't import). A test compares the two.
 */
export const SEARCH_BUSY_MESSAGE =
	"Search is busy right now. Try again in a moment."

/** What the search page says when the search failed and the server didn't say why. */
export const SEARCH_PAGE_UNAVAILABLE =
	"Search is unavailable. Your previous results are kept."

/** Whether the search page's status line gets the Retry link: for the busy answer and for a failed search. */
export const offerRetry = (status: string) =>
	status.startsWith("Search is busy") ||
	status.startsWith("Search is unavailable")

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
