import { statusPage } from "~/domain/my-library"
import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	redirect,
} from "@remix-run/node"
import { getUserIdFromRequest } from "~/utils/auth"

// The old Wishlist sorts, as Watch next names them.
const WATCH_NEXT_SORT: Partial<Record<string, string>> = {
	most_recently_added: "added",
	least_recently_added: "waiting",
	highest_score: "top",
	most_popular: "popular",
}

/** Where /wishlist sends a viewer to Watch next, keeping the sort and streaming choice. */
function watchNextUrl(url: URL) {
	const params = new URLSearchParams()
	const sort = WATCH_NEXT_SORT[url.searchParams.get("sortBy") ?? ""]
	if (sort) params.set("sort", sort)
	const streaming = url.searchParams.get("filterByStreaming")
	if (streaming && streaming !== "mine") params.set("services", "all")
	const query = params.toString()
	return query ? `/watch-next?${query}` : "/watch-next"
}

// The Wishlist page is Watch next now. Its address moves on.
export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const userId = await getUserIdFromRequest({ request })
	// A member's Wishlist is My library's Want to see (#385, its own page since #700). Guests keep what they have.
	if (userId)
		return redirect(statusPage({ status: "want" }), {
			headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
		})
	return redirect(watchNextUrl(url), {
		status: 301,
		// Where it goes depends on who asks: browsers must not keep the redirect.
		headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
	})
}
