import {
	browserSearchOrigin,
	type SearchOrigin,
	type SearchSurface,
	type SearchTrigger,
} from "~/domain/search-attribution"

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
