import { hasGoodwatchScore } from "../../../utils/ratings.ts"
import { presentationLanguage } from "../../../utils/media-presentation.ts"
// What the TV's search says, and the search it asks for. Pure.
//
// The search is the one the Discover page behind the Expand key runs for the same person (`/discover?q=`), so the
// TV and the page show the same titles in the same order: the same text rule, the same eligibility for the
// ranking (a person's own services, when they have some), and the same request body. The page's own functions for
// these are in its chunk and in domain/discover-search.ts; they are written out here and not imported, because a
// second importer would move them out of the Discover page's files and add one to its first view. tv-search.test.ts
// holds each to the page's.
import type { SearchFilters } from "~/server/combined-search/search-filters"
import type { SearchBatch } from "~/server/combined-search/search.server"
import type { TitleCard } from "~/server/title-cards.server"
import type { DiscoverSearchResult } from "~/ui/discover/discover-search-request"
import { type TitleKey, titleKey } from "../../../utils/title-key.ts"
import { LIST_TITLES, MIN_QUERY_LENGTH } from "./tv-machine.ts"
import { titleKicker, whereLine } from "./tv-title.ts"

// ---------------------------------------------------------------------------------------------------------
// The words.

/** What the line asks while nothing is typed. */
export const SEARCH_QUESTION = "What are you looking for?"

/** The longest query the line takes (`SEARCH_MAX_CHARS`, domain/discover-search.ts). */
export const SEARCH_MAX_LENGTH = 512

/** Whether what is typed is long enough to search for. */
export const searchable = (draft: string) =>
	draft.trim().length >= MIN_QUERY_LENGTH

/**
 * The line under the question. A phone has no keys until the line has the browser's focus, which a tap gives
 * it.
 */
export function searchLine(draft: string, phone: boolean): string {
	if (!draft.trim())
		return phone
			? "Tap the line to type, or pick one."
			: "Type on the keyboard, or pick one."
	return searchable(draft) ? "OK searches for it." : "Two letters or more."
}

/** The key that searches for what is typed. */
export const goLabel = (draft: string) => `Search “${draft.trim()}”`

/** Under the screen's name on the results: the query. */
export const searchCrumb = (query: string) => `“${query}”`

/**
 * What the results say in the titles' place: while the search runs, when it failed (the search's own words, as
 * the Discover page shows them), and when it found nothing.
 */
export function searchEmptyLine({
	waiting,
	failed,
}: { waiting: boolean; failed: string | null }): string {
	if (waiting) return "Searching…"
	return failed ?? "Nothing found."
}

/**
 * A found title's line of facts under its name, as mini Discover's list writes it: "2001 · Movie · 1h 56m · 82
 * score · 91% match · On Netflix". A fact nobody knows is left out.
 */
export function searchFacts(
	card: Pick<
		TitleCard,
		| "media_type"
		| "release_year"
		| "runtime"
		| "goodwatch_overall_score_normalized_percent"
		| "match"
		| "services"
	>,
): string {
	const score = card.goodwatch_overall_score_normalized_percent
	return [
		titleKicker(card),
		hasGoodwatchScore(score) ? `${Math.round(score)} score` : null,
		card.match == null ? null : `${card.match}% match`,
		whereLine(card, []),
	]
		.filter(Boolean)
		.join(" · ")
}

// ---------------------------------------------------------------------------------------------------------
// The search.

/** What the search says when it failed and the server did not say why, as on the Discover page. */
export const SEARCH_UNAVAILABLE =
	"Search is unavailable right now. Try again in a moment."

/** The query as the search reads it, or null when it is too short to search (`searchText`, the page's). */
export function tvSearchText(q: string | null | undefined): string | null {
	const text = (q ?? "").trim().slice(0, SEARCH_MAX_LENGTH)
	return text.length >= MIN_QUERY_LENGTH ? text : null
}

/** Where On my services looks: the person's country and their services. */
export type TvSearchScope = { country: string | null; services: number[] }

/** The ids in a browser's saved services, "8,337", as the Discover page reads them. */
const serviceIds = (saved: string | null | undefined) =>
	(saved ?? "")
		.split(",")
		.map(Number)
		.filter((id) => Number.isSafeInteger(id) && id > 0)

/** A guest's scope: the country and the services their browser holds. */
export const guestSearchScope = (guest: {
	country?: string | null
	services?: string | null
}): TvSearchScope => ({
	country: guest.country || null,
	services: serviceIds(guest.services),
})

/**
 * The ranking's eligibility for a search with the filter bar untouched, which is how the Expand key opens the
 * page: On my services is on for a person with services, and narrows the ranking to them. Nothing else narrows it.
 *
 * A guest's country is the one their browser holds. A guest with services and no country there gets the page's
 * guess of their country on the page, which the TV does not know: the ranking is then not narrowed, and the
 * results are still narrowed to their services in memory, by the same endpoint.
 */
export function tvSearchFilters(scope: TvSearchScope | null): SearchFilters {
	if (!scope?.services.length || !/^[A-Z]{2}$/.test(scope.country ?? ""))
		return {}
	return {
		streaming: {
			country: scope.country as string,
			providerIds: [...new Set(scope.services)].slice(0, 50),
		},
	}
}

/** The search request's body, the Discover page's: the whole ranked list, never "search all titles". */
export const tvSearchBody = (q: string, filters: SearchFilters) => ({
	q,
	filters,
	allTitles: false,
	discover: true,
})

/**
 * The key the Discover page keeps a search's answer under (`useDiscoverSearch`). The TV keeps its answer under the
 * same one, so the page behind the Expand key draws from it and does not search a second time.
 */
export function tvSearchKey(q: string, filters: SearchFilters, language?: string): string[] {
	const streaming = filters.streaming
	const key = streaming?.providerIds.length
		? `s=${streaming.country}:${[...streaming.providerIds].sort((a, b) => a - b).join(",")}`
		: ""
	return ["discover-search", `${language ? `${presentationLanguage(language)}:` : ""}${q}|${key}|0`]
}

/** A search's answer as the Discover page keeps it: the ranked list as title keys, in the ranking's order. */
export function tvSearchResult(
	q: string,
	batch: SearchBatch,
): DiscoverSearchResult {
	const keys: TitleKey[] = []
	for (const row of batch.rows) {
		const [type, id] = row.key.split(":")
		const tmdbId = Number(id)
		if ((type === "movie" || type === "show") && Number.isSafeInteger(tmdbId))
			keys.push(titleKey(type, tmdbId))
	}
	return {
		q,
		ranked: [...new Set(keys)],
		reading: batch.reading ?? [],
		people: batch.people ?? [],
		creditScope: batch.creditScope ?? null,
		errors: batch.errors ?? [],
		pendingTitleLookup: batch.pendingTitleLookup,
		...(batch.pendingRanking ? { pendingRanking: true } : {}),
	}
}

/**
 * The results endpoint's query for a search's ranked list. Nothing else: the page's defaults (On my services, Not
 * seen yet, Relevance, For you) are the server's for the same person.
 */
export const tvResultsQuery = (ranked: readonly TitleKey[]) =>
	`ranked=${ranked.join(",")}`

/** The titles the results show: the first four. */
export const searchCards = (cards: readonly TitleCard[]) =>
	cards.slice(0, LIST_TITLES)
