// The filter bar's state: what Discover, Watch next, and Explorer filter and sort by, and how it reads from and writes
// to URL parameters. Pure and shared by the server (the title filter) and the browser (the filter bar).
//
// URL parameters (defaults are omitted): services=mine|all|<ids>, unseen=0|1, type, moods=funny,scary, genres, score,
// released, similar, people, sort, foryou=0|1. The parameters of old Discover filters the sheet doesn't offer keep
// their old names and apply as legacy filters.
import { MAX_MOODS, MOOD_KEYS, type MoodKey } from "~/domain/moods"
import type { TitleKey } from "~/utils/title-key"

/** The filter groups, in the order of the bits of a title's fail mask. */
export const FILTER_NAMES = [
	"services",
	"notSeenYet",
	"type",
	"moods",
	"genres",
	"minScore",
	"released",
	"similarTo",
	"people",
	"legacy",
] as const
export type FilterName = (typeof FILTER_NAMES)[number]

export const SORT_KEYS = ["popular", "top", "newest", "relevance"] as const
/** Relevance is the order of a ranked list (a search); it's offered only while searching. */
export type SortKey = (typeof SORT_KEYS)[number]

export const MIN_SCORES = [0, 60, 70, 80] as const
export type MinScore = (typeof MIN_SCORES)[number]

export const RELEASED = [
	"any",
	"recent",
	"2010s",
	"2000s",
	"before2000",
] as const
export type Released = (typeof RELEASED)[number]

/**
 * Old Discover filters that the sheet doesn't offer and today's Discover SQL applies. They keep working from old URLs,
 * under their old names, and aren't written by new links. Old parameters today's SQL ignores (keywords, age rating,
 * language, suitability, context) stay ignored.
 */
export const LEGACY_PARAMS = [
	"fingerprintConditions",
	"fingerprintPillars",
	"fingerprintPillarMinTier",
	"minYear",
	"maxYear",
	"maxScore",
] as const
export type LegacyParam = (typeof LEGACY_PARAMS)[number]
export type LegacyFilters = Partial<Record<LegacyParam, string>>

export interface FilterState {
	type: "all" | "movie" | "show"
	/** False means everywhere, or the explicit `services`. */
	onMyServices: boolean
	/** Explicit services when onMyServices is false; empty means everywhere. */
	services?: number[]
	notSeenYet: boolean
	/** Up to MAX_MOODS; a title fits if it belongs to at least one. */
	moods: MoodKey[]
	/** A title fits if it has at least one. */
	genres: string[]
	minScore: MinScore
	released: Released
	/** Titles similar to any of these. */
	similarTo?: TitleKey[]
	/** Titles with any of these people (TMDB person ids) in the cast or crew. */
	people?: number[]
	legacy?: LegacyFilters
}

/** The defaults depend on the viewer: On my services for members with saved services, Not seen yet for members. */
export interface FilterDefaults {
	onMyServices: boolean
	notSeenYet: boolean
}

export const defaultFilterState = (defaults: FilterDefaults): FilterState => ({
	type: "all",
	onMyServices: defaults.onMyServices,
	notSeenYet: defaults.notSeenYet,
	moods: [],
	genres: [],
	minScore: 0,
	released: "any",
})

const MAX_LIST = 20
const list = (value: string | null) =>
	(value ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.slice(0, MAX_LIST)
const ids = (value: string | null, max = 3e12) =>
	[...new Set(list(value).map(Number))].filter(
		(id) => Number.isSafeInteger(id) && id > 0 && id < max,
	)
const oneOf = <T extends string | number>(
	options: readonly T[],
	value: unknown,
): T | undefined => options.find((option) => String(option) === value)

export function filterStateFromParams(
	params: URLSearchParams,
	defaults: FilterDefaults,
): FilterState {
	const state = defaultFilterState(defaults)
	const services = params.get("services")
	if (services === "mine") state.onMyServices = true
	else if (services === "all") state.onMyServices = false
	else if (services) {
		const chosen = ids(services, 1e9)
		state.onMyServices = false
		if (chosen.length) state.services = chosen
	}
	const unseen = params.get("unseen")
	if (unseen === "0" || unseen === "1") state.notSeenYet = unseen === "1"
	state.type = oneOf(["movie", "show"] as const, params.get("type")) ?? "all"
	state.moods = [
		...new Set(
			list(params.get("moods")).filter((key): key is MoodKey =>
				(MOOD_KEYS as readonly string[]).includes(key),
			),
		),
	].slice(0, MAX_MOODS)
	state.genres = [...new Set(list(params.get("genres")))]
	state.minScore = oneOf(MIN_SCORES, params.get("score")) ?? 0
	state.released = oneOf(RELEASED, params.get("released")) ?? "any"
	const similar = ids(params.get("similar"))
	if (similar.length) state.similarTo = similar
	const people = ids(params.get("people"), 1e9)
	if (people.length) state.people = people
	const legacy: LegacyFilters = {}
	for (const name of LEGACY_PARAMS) {
		const value = params.get(name)?.trim()
		if (value) legacy[name] = value
	}
	if (Object.keys(legacy).length) state.legacy = legacy
	return state
}

export function filterStateToParams(
	state: FilterState,
	defaults: FilterDefaults,
	params = new URLSearchParams(),
): URLSearchParams {
	const set = (name: string, value: string | null) => {
		if (value === null) params.delete(name)
		else params.set(name, value)
	}
	const services = state.onMyServices
		? "mine"
		: state.services?.length
			? state.services.join(",")
			: "all"
	set(
		"services",
		services === (defaults.onMyServices ? "mine" : "all") ? null : services,
	)
	set(
		"unseen",
		state.notSeenYet === defaults.notSeenYet
			? null
			: state.notSeenYet
				? "1"
				: "0",
	)
	set("type", state.type === "all" ? null : state.type)
	set("moods", state.moods.length ? state.moods.join(",") : null)
	set("genres", state.genres.length ? state.genres.join(",") : null)
	set("score", state.minScore ? String(state.minScore) : null)
	set("released", state.released === "any" ? null : state.released)
	set("similar", state.similarTo?.length ? state.similarTo.join(",") : null)
	set("people", state.people?.length ? state.people.join(",") : null)
	for (const name of LEGACY_PARAMS) set(name, state.legacy?.[name] ?? null)
	return params
}

/** The sort from `sort`; Relevance only while searching, where it's also the default. */
export function sortFromParams(
	params: URLSearchParams,
	searching: boolean,
): SortKey {
	const sort = oneOf(SORT_KEYS, params.get("sort"))
	if (sort === "relevance") return searching ? sort : "popular"
	return sort ?? (searching ? "relevance" : "popular")
}
