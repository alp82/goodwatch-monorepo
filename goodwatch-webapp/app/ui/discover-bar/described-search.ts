// A described search: the words a person types in Discover's field. The interpreter (/api/discover/interpret) turns the
// words it understands into Discover's filters and leaves the rest as the search text, so both land in the URL and the
// filter bar shows them as its own. `asked` keeps the words as typed: a sentence that became filters only has no `q`
// left, and the field still shows it. Pure, so the rules are tested without React (described-search.test.ts).

/** The parameters of the interpretation that matter here. */
export interface Interpretation {
	/** Discover's parameters: the existing filters, what the words added, and `q` for the rest. */
	params: string
}

/** Not filters: left out of what the interpreter reads. */
const SEARCH_KEYS = [
	"q",
	"asked",
	"page",
	"allTitles",
	"sort",
	"layout",
	"side",
	"mode",
]
/** How the page shows its list: they outlast a search. */
export const VIEW_KEYS = ["mode", "layout", "side"]

/**
 * The filters a new search starts from: the current ones, without the ones the last described search added, so
 * "cozy anime" and then "funny horror" doesn't stay anime only.
 */
export function filtersToKeep(
	current: URLSearchParams,
	last: Interpretation | undefined,
	lastExisting = "",
): URLSearchParams {
	const out = new URLSearchParams(current)
	for (const key of SEARCH_KEYS) out.delete(key)
	if (!last) return out
	const before = new URLSearchParams(lastExisting)
	for (const key of new URLSearchParams(last.params).keys())
		if (!before.has(key)) out.delete(key)
	return out
}

/** The URL of a described search. Without an interpretation the words are searched as they are. */
export function describedParams(
	current: URLSearchParams,
	typed: string,
	kept: URLSearchParams,
	interpretation: Interpretation | null,
	entering: boolean,
): URLSearchParams {
	const out = new URLSearchParams(interpretation?.params ?? kept)
	if (!interpretation) out.set("q", typed)
	out.set("asked", typed)
	for (const key of VIEW_KEYS) {
		const value = current.get(key)
		if (value) out.set(key, value)
	}
	// Entering a search chooses Relevance; a search after a search keeps the chosen sort.
	const sort = current.get("sort")
	if (sort && !entering) out.set("sort", sort)
	return out
}
