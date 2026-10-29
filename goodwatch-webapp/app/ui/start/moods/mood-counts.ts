// The start page mood picker's counts: one Discover results answer for the current picks (and the search's titles
// while a search is on) gives every mood's, theme's and style's count and the total for the chip row. While a query is
// on, that answer is the results request the search already makes (StartResults.optionCounts), so a pick change asks
// once; only with nothing asked yet does the open picker send its own request, the same request with no picks. Pure,
// so the request and the wording are tested without a browser (start-picker.test.ts); useMoodCounts.ts sends it.
//
// The services scope is the results' (start-search.ts, resultsScope): `any` (any streaming offer in the country)
// without saved services, `mine` once the viewer has some, and the counts say which ("N titles", "N on your
// services").
import { WORDS, type WordKind } from "~/domain/taste-picker"
import type { DiscoverResults } from "~/server/discover-results.server"
import type { TitleKey } from "~/utils/title-key"
import { type ResultsScope, resultsPath } from "../search/start-search"
import {
	type StartQuery,
	type StartResults,
	querySignature,
} from "../stage/start-query"

export type CountScope = ResultsScope

/**
 * "N titles", or "N on your services" with scope `mine`: the mood picker's counts and the member's results line, so
 * both say the same scope.
 */
export function countText(n: number, scope: CountScope): string {
	const count = n.toLocaleString("en-US")
	if (scope === "mine") return `${count} on your services`
	return `${count} ${n === 1 ? "title" : "titles"}`
}

const PARAM: Record<WordKind, "moods" | "themes" | "styles"> = {
	mood: "moods",
	theme: "themes",
	style: "styles",
}

/**
 * The counts request's query for the picks (word ids), the scope, and a search's ranked list (null: no search): the
 * results request's own query, so both count the same titles.
 */
export function countsQuery(
	picks: readonly string[],
	scope: CountScope,
	ranked: readonly TitleKey[] | null,
): string {
	const path = resultsPath({ picks, scope, ranked })
	return path.slice(path.indexOf("?") + 1)
}

/** What the picker reads from one answer: each word's count (by word id) and the total. */
export interface MoodCounts {
	/** What the counts answer: the countsQuery, or the results' query signature. */
	query: string
	byWord: Record<string, number>
	total: number
}

export function readCounts(
	query: string,
	response: {
		optionCounts: Partial<
			Pick<DiscoverResults["optionCounts"], "moods" | "themes" | "styles">
		> | null
		total: number
	},
): MoodCounts {
	const byWord: Record<string, number> = {}
	for (const word of WORDS) {
		const n = response.optionCounts?.[PARAM[word.kind]]?.[word.key]
		if (typeof n === "number") byWord[word.id] = n
	}
	return { query, byWord, total: response.total }
}

/** The counts the results of this query carry, or null while they are another query's or haven't arrived. */
export function countsOfResults(
	query: Pick<StartQuery, "text" | "picks">,
	results: Pick<
		StartResults,
		"signature" | "status" | "optionCounts" | "total"
	>,
): MoodCounts | null {
	if (
		results.status !== "ready" ||
		results.signature !== querySignature(query) ||
		!results.optionCounts
	)
		return null
	return readCounts(results.signature, {
		optionCounts: results.optionCounts,
		total: results.total ?? 0,
	})
}
