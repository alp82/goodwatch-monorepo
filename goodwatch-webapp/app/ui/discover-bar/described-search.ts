// A described search: the words a person types in Discover's field. The URL keeps the words as typed (`q`); what the
// interpreter reads from them is read again on every change and never written as the person's own filters
// (ui/discover/search-reading). Older links kept the words in `asked` and what they read as Discover's filters.
// Pure, so the rules are tested without React (described-search.test.ts).

/** The parameters of the interpretation that matter here. */
export interface Interpretation {
	/** Discover's parameters: the existing filters, what the words added, and `q` for the rest. */
	params: string
}

/** Not filters: left out of what the interpreter reads. */
const SEARCH_KEYS = [
	"q",
	"asked",
	"off",
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
