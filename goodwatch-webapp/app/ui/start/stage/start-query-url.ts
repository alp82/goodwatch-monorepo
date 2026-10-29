// The start page's query in the URL: the searched text in `q`, the picks in Discover's `moods`, `themes` and `styles`,
// so a reload or a shared link opens the same query (useStartQuery keeps the two in step).
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { WORD_BY_ID, pickIds, picksOf } from "~/domain/taste-picker"
import type { StartQuery } from "./start-query"

/** The URL parameters a query lives in: Discover's names. */
export const QUERY_PARAMS = ["q", "moods", "themes", "styles"] as const

const PICK_PREFIX = { moods: "m", themes: "t", styles: "s" } as const

/** The query a URL holds; unknown words and anything past the third pick are left out. */
export function queryFromParams(params: URLSearchParams): StartQuery {
	const text = (params.get("q") ?? "").trim().slice(0, SEARCH_MAX_CHARS)
	const ids = Object.entries(PICK_PREFIX).flatMap(([name, prefix]) =>
		(params.get(name) ?? "")
			.split(",")
			.filter(Boolean)
			.map((key) => `${prefix}:${key.trim()}`)
			.filter((id) => id in WORD_BY_ID),
	)
	return { draft: text, text, picks: pickIds(picksOf(ids)) }
}

/** `params` with the query's own parameters set to this query (the rest are kept). */
export function queryParams(
	query: Pick<StartQuery, "text" | "picks">,
	params: URLSearchParams,
): URLSearchParams {
	const next = new URLSearchParams(params)
	for (const name of QUERY_PARAMS) next.delete(name)
	if (query.text) next.set("q", query.text)
	const picks = picksOf(query.picks)
	for (const name of ["moods", "themes", "styles"] as const)
		if (picks[name].length) next.set(name, picks[name].join(","))
	return next
}
