import {
	browserSearchOrigin,
	type SearchOrigin,
	type SearchSurface,
	type SearchTrigger,
} from "~/domain/search-attribution"
import { searchText } from "~/domain/discover-search"

// History state survives reload; the page lifetime marker prevents relabelling it as the old Enter/click.
const page = typeof performance === "undefined" ? 0 : performance.timeOrigin
export function searchNavigationState(
	query: string,
	surface: SearchSurface,
	trigger: SearchTrigger,
) {
	return {
		searchInvocation: {
			query: query.trim(),
			page,
			...browserSearchOrigin({ surface, trigger }),
		},
	}
}
export function navigationSearchOrigin(
	query: string | null,
	state: unknown,
	navigationType: string,
): SearchOrigin {
	const entry =
		state && typeof state === "object"
			? (state as { searchInvocation?: Record<string, unknown> })
					.searchInvocation
			: undefined
	return navigationType !== "POP" &&
		entry?.page === page &&
		entry?.query === query?.trim()
		? browserSearchOrigin(entry)
		: { surface: "discover", trigger: "navigation" }
}

/**
 * The history state for a filter the person changed on Discover's search: the search that follows is a "filter_change".
 * Only the filter controls' own handlers pass it; back/forward to that entry (POP), a reload, or a URL change the page
 * makes by itself stay "navigation". Undefined without a search in the URL.
 */
export function filterChangeState(params: URLSearchParams) {
	const query = searchText(params.get("asked") ?? params.get("q"))
	return query === null ? undefined : searchNavigationState(query, "discover", "filter_change")
}
