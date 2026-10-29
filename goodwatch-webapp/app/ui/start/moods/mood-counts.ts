// The start page mood picker's counts: one Discover results request with the current picks (and the search's ranked
// list while a search is on) gives every mood's, theme's and style's count and the total for the chip row. Pure, so
// the request and the wording are tested without a browser (mood-counts.test.ts); useMoodCounts.ts sends it.
//
// The services scope follows the guest: `any` (any streaming offer in the country) without saved services, `mine`
// once they have some, and the counts say which ("N titles", "N on your services"). A member's request leaves the
// scope to their Discover defaults.
import { WORDS, type WordKind } from "~/domain/taste-picker"
import type { DiscoverResults } from "~/server/discover-results.server"
import { titleCount } from "~/ui/watch-next/labels"
import type { TitleKey } from "~/utils/title-key"

export type CountScope = "any" | "mine" | null

/** The scope for a viewer: null for a member (their own defaults), else by the guest's saved services. */
export function countScopeOf(
	guest: { services: string | null } | null,
): CountScope {
	if (!guest) return null
	return guest.services?.trim() ? "mine" : "any"
}

/** "N titles", or "N on your services" with scope `mine`. */
export const countText = (n: number, scope: CountScope) =>
	scope === "mine" ? `${n} on your services` : titleCount(n)

const PARAM: Record<WordKind, "moods" | "themes" | "styles"> = {
	mood: "moods",
	theme: "themes",
	style: "styles",
}

/** The results request's query for the picks (word ids), the scope, and a search's ranked list (null: no search). */
export function countsQuery(
	picks: readonly string[],
	scope: CountScope,
	ranked: readonly TitleKey[] | null,
): string {
	const params = new URLSearchParams()
	for (const kind of ["mood", "theme", "style"] as const) {
		const keys = WORDS.filter(
			(w) => w.kind === kind && picks.includes(w.id),
		).map((w) => w.key)
		if (keys.length) params.set(PARAM[kind], keys.join(","))
	}
	if (scope) params.set("services", scope)
	if (ranked) params.set("ranked", ranked.join(","))
	params.set("page", "1")
	return params.toString()
}

/** What the picker reads from one answer: each word's count (by word id) and the total. */
export interface MoodCounts {
	/** The countsQuery the counts answer. */
	query: string
	byWord: Record<string, number>
	total: number
}

export function readCounts(
	query: string,
	response: Pick<DiscoverResults, "optionCounts" | "total">,
): MoodCounts {
	const byWord: Record<string, number> = {}
	for (const word of WORDS) {
		const n = response.optionCounts?.[PARAM[word.kind]]?.[word.key]
		if (typeof n === "number") byWord[word.id] = n
	}
	return { query, byWord, total: response.total }
}
