import { isbot } from "isbot"

/** Whether the request comes from a crawler, going by its User-Agent. */
export const isCrawler = (request: Request) =>
	isbot(request.headers.get("user-agent"))

// A crawler that doesn't name itself and ignores nofollow can still walk the filtered views of a page. Only this many
// load at once; the rest are told to come back, which costs next to nothing. People rarely filter at the same moment.
const FILTERED_VIEWS_AT_ONCE = 4
let filteredViewsLoading = 0

/** Runs `load` for a filtered view of a page, or answers 503 when too many are already loading. */
export async function limitFilteredViews<T>(load: () => Promise<T>): Promise<T> {
	if (filteredViewsLoading >= FILTERED_VIEWS_AT_ONCE)
		throw new Response("Busy, try again shortly", {
			status: 503,
			headers: { "Retry-After": "30" },
		})
	filteredViewsLoading++
	try {
		return await load()
	} finally {
		filteredViewsLoading--
	}
}
