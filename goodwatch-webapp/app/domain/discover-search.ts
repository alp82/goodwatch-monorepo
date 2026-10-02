// Discover's search mode: which filter bar choices go into the search ranking as eligibility, and the query limits.
// Pure and shared by the server and the browser.
//
// Type, anime, one genre, Released, and the services narrow the ranking itself (SearchFilters), as the search chips
// did, so the ranked list is full of titles that fit. Everything else (Not seen yet, moods, the GoodWatch score,
// several genres, Similar to, cast and crew, legacy filters) runs in memory over the ranked list, with its counts and
// recoveries. The in-memory pass also checks the ranking's choices again, which changes nothing but keeps one code path.
import type { SearchFilters } from "~/server/combined-search/search-filters"
import type { FilterState, Released } from "./filter-state"

/** A query shorter than this isn't searched (the search endpoint's minimum). */
export const SEARCH_MIN_CHARS = 2
/** The longest query the field takes. */
export const SEARCH_MAX_CHARS = 512
/** The ranked list's length: counts and recoveries cover this many results (RESULT_LENGTH of the ranking). */
export const SEARCH_RESULTS = 100

/** Where "On my services" looks: the viewer's country and saved (or, for guests, chosen) services. */
export interface SearchScope {
	country: string
	services: number[]
}

function releasedYears(
	released: Released,
	now: Date,
): Pick<SearchFilters, "minYear" | "maxYear"> {
	switch (released) {
		case "recent":
			// The filter's "recent": the current year and the two before it.
			return { minYear: now.getUTCFullYear() - 2 }
		case "2010s":
			return { minYear: 2010, maxYear: 2019 }
		case "2000s":
			return { minYear: 2000, maxYear: 2009 }
		case "before2000":
			return { maxYear: 1999 }
		default:
			return {}
	}
}

/**
 * The search ranking's eligibility for the filter bar's state. The ranking requires all of its genres while the bar
 * keeps titles with any of them, so only a single genre goes into the ranking; several stay in memory.
 */
export function searchEligibility(
	state: FilterState,
	scope: SearchScope,
	now = new Date(),
): SearchFilters {
	const filters: SearchFilters = {}
	if (state.type !== "all") filters.type = state.type
	if (state.anime !== "any") filters.anime = state.anime
	if (state.genres.length === 1) filters.genres = [...state.genres]
	Object.assign(filters, releasedYears(state.released, now))
	const services = state.onMyServices ? scope.services : (state.services ?? [])
	if (services.length && /^[A-Z]{2}$/.test(scope.country))
		filters.streaming = {
			country: scope.country,
			providerIds: [...new Set(services)].slice(0, 50),
		}
	return filters
}

/** The query as the search reads it, or null when it's too short to search. */
export function searchText(q: string | null | undefined): string | null {
	const text = (q ?? "").trim().slice(0, SEARCH_MAX_CHARS)
	return text.length >= SEARCH_MIN_CHARS ? text : null
}

/**
 * Discover's search mode for an old /search URL: the query, and the filters the two pages share (type, genres, the
 * services, and "search all titles"). Old year ranges become a Released option when they match one exactly.
 */
export function discoverSearchPath(old: URLSearchParams): string {
	const next = new URLSearchParams()
	const q = old.get("q")?.trim()
	if (q) next.set("q", q.slice(0, SEARCH_MAX_CHARS))
	const type = old.get("type")
	if (type === "movie" || type === "show") next.set("type", type)
	const genres = (old.get("genre") ?? "")
		.split(",")
		.map((genre) => genre.trim())
		.filter(Boolean)
	if (genres.length) next.set("genres", genres.join(","))
	const years = `${old.get("minYear") ?? ""}-${old.get("maxYear") ?? ""}`
	const released = (
		{
			"2010-2019": "2010s",
			"2000-2009": "2000s",
			"-1999": "before2000",
		} as Record<string, string>
	)[years]
	if (released) next.set("released", released)
	const preset = old.get("streamingPreset")
	const services = old.get("services")
	if (preset === "mine") next.set("services", "mine")
	else if (preset && services && /^\d+(,\d+)*$/.test(services))
		next.set("services", services)
	if (old.get("allTitles") === "1") next.set("allTitles", "1")
	const search = next.toString()
	return `/discover${search ? `?${search}` : ""}`
}
