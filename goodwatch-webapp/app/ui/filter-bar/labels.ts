// What the filter bar says: sort options, option labels, chip labels, and the recovery wording. Every label is a
// proper, capitalized label ("Top rated", "Crime & mystery", "Philosophical").
import type {
	FilterName,
	FilterState,
	LegacyParam,
	MinMatch,
	MinScore,
	Released,
	SortKey,
} from "~/domain/filter-state"
import { MOOD_BY_KEY } from "~/domain/moods"
import {
	ANIME_NAMES,
	ANIME_STATE_NAMES,
	type AnimeChoice,
} from "~/domain/title-type"

export interface SortOption<K extends string = string> {
	key: K
	label: string
	hint: string
	/** Taste decides this sort (Best match): the sort control marks it amber. */
	taste?: boolean
	/** Shown but not pickable; `hint` says why. */
	disabled?: boolean
}

/**
 * Whether the viewer has taste, for everything that needs it (Best match, the Taste match filter), or why not:
 * rateMore for fewer than 5 liked titles, signUp for a guest with too few guest ratings.
 */
export type TasteState = "ready" | "rateMore" | "signUp"

/** The taste state from a results answer; ready until the first answer says otherwise. */
export const tasteStateOf = (
	results:
		| {
				hasTaste: boolean
				forYou: { status: "ready" | "needsTaste" | "signUp" }
		  }
		| null
		| undefined,
): TasteState =>
	!results
		? "ready"
		: results.forYou.status === "signUp"
			? "signUp"
			: results.hasTaste
				? "ready"
				: "rateMore"

/** Where "Rate titles" goes: the taste quiz, picking up where the person left off. */
export const RATE_TITLES_PATH = "/taste/quiz?resume=1"

/** Best match's line while the person has too few liked titles. */
export const RATE_MORE =
	"Rate a few more titles you love and Best match learns your taste."

export const DISCOVER_SORTS: Record<SortKey, SortOption<SortKey>> = {
	relevance: {
		key: "relevance",
		label: "Relevance",
		hint: "Closest to your search",
	},
	match: {
		key: "match",
		label: "Best match",
		hint: "Closest to your taste",
		taste: true,
	},
	popular: { key: "popular", label: "Popular", hint: "What people watch now" },
	top: { key: "top", label: "Top rated", hint: "Highest GoodWatch score" },
	newest: { key: "newest", label: "Newest", hint: "Latest releases first" },
}

/**
 * Discover's sorts: Best match, Popular, Top rated, Newest, and Relevance only while searching. Without taste Best
 * match shows but can't be picked; while the person has too few liked titles its line says so (a guest who needs to
 * sign up gets the sign-up prompt under the list instead).
 */
export const discoverSorts = (
	searching: boolean,
	taste: TasteState = "ready",
): SortOption<SortKey>[] =>
	(["match", "relevance", "popular", "top", "newest"] as const)
		.filter((key) => searching || key !== "relevance")
		.map((key) =>
			key === "match" && taste !== "ready"
				? {
						...DISCOVER_SORTS.match,
						disabled: true,
						...(taste === "rateMore" ? { hint: RATE_MORE } : {}),
					}
				: DISCOVER_SORTS[key],
		)

/**
 * The sort the sort control shows. Best match needs taste: without it the results are in Popular (Relevance while
 * searching), as the server's `sortUsed` says, and so is the control, whatever the URL asked for.
 */
export const sortShown = (
	sort: SortKey,
	searching: boolean,
	taste: TasteState,
): SortKey =>
	sort === "match" && taste !== "ready"
		? searching
			? "relevance"
			: "popular"
		: sort

/** "953", "1.2k", "12k": a count short enough for a fixed slot. Say the full number where there's room. */
export function compactCount(n: number): string {
	if (n < 1000) return String(n)
	if (n < 9950) return `${(n / 1000).toFixed(1)}k`
	if (n < 999_500) return `${Math.round(n / 1000)}k`
	return `${(n / 1_000_000).toFixed(1)}M`
}

export const TYPE_LABELS: Record<FilterState["type"], string> = {
	all: "Movies & shows",
	movie: "Movies",
	show: "Shows",
}

/** The Anime group's options, in the words every page uses. */
export const ANIME_LABELS: Record<AnimeChoice, string> = ANIME_NAMES

export const SCORE_LABELS: Record<MinScore, string> = {
	0: "Any score",
	60: "60 and up",
	70: "70 and up",
	80: "80 and up",
}

export const MATCH_LABELS: Record<MinMatch, string> = {
	0: "Any match",
	70: "70% and up",
	80: "80% and up",
	90: "90% and up",
}

export const RELEASED_LABELS: Record<Released, string> = {
	any: "Any year",
	recent: "Last 3 years",
	"2010s": "2010s",
	"2000s": "2000s",
	before2000: "Before 2000",
}

/**
 * Each filter group's color: the dot on its chip and the bar on its sheet section. Amber is what taste decides, so it
 * is the Taste match group's; genres are fuchsia.
 */
export const FILTER_ACCENTS: Record<FilterName, { dot: string; bar: string }> =
	{
		services: { dot: "bg-emerald-400", bar: "bg-emerald-500" },
		notSeenYet: { dot: "bg-blue-400", bar: "bg-blue-500" },
		type: { dot: "bg-teal-400", bar: "bg-teal-500" },
		anime: { dot: "bg-pink-400", bar: "bg-pink-500" },
		moods: { dot: "bg-indigo-400", bar: "bg-indigo-500" },
		genres: { dot: "bg-fuchsia-400", bar: "bg-fuchsia-500" },
		minScore: { dot: "bg-lime-400", bar: "bg-lime-500" },
		minMatch: { dot: "bg-amber-400", bar: "bg-amber-500" },
		released: { dot: "bg-cyan-400", bar: "bg-cyan-500" },
		similarTo: { dot: "bg-rose-400", bar: "bg-rose-500" },
		people: { dot: "bg-purple-400", bar: "bg-purple-500" },
		legacy: { dot: "bg-gray-400", bar: "bg-gray-500" },
	}

/**
 * The hidden meter's segment color per recovery. The meter's first segment (what shows) is amber, so the Taste match
 * recovery keeps the neutral gray rather than a second amber.
 */
export const METER_COLORS: Partial<Record<FilterName, string>> = {
	services: "bg-emerald-600",
	notSeenYet: "bg-blue-600",
}

const plural = (n: number, one: string, many: string) =>
	`${n.toLocaleString("en")} ${n === 1 ? one : many}`

/**
 * What a one-tap recovery lets back in: "21 on other services", "8 you've seen". Recoveries never add up to the
 * hidden count (a title two filters hide counts in neither), so the wording names only what this one tap shows.
 */
export function recoveryLabel(
	filter: FilterName,
	titles: number,
	state: FilterState,
	/** The phone slab's short form: "151 other services", "12 more". */
	short = false,
): string {
	const n = titles.toLocaleString("en")
	if (short && filter === "services") return `${n} other services`
	const hidesAnime = filter === "anime" && state.anime === "none"
	if (short && filter !== "notSeenYet" && filter !== "type" && !hidesAnime)
		return `${n} more`
	switch (filter) {
		case "services":
			return `${n} on other services`
		case "notSeenYet":
			return `${n} you've seen`
		case "type":
			return state.type === "movie"
				? plural(titles, "show", "shows")
				: plural(titles, "movie", "movies")
		case "anime":
			return hidesAnime ? `${n} anime` : `${n} that aren't anime`
		case "moods":
			return `${n} in other moods`
		case "genres":
			return `${n} in other genres`
		case "minScore":
			return `${n} below ${state.minScore}`
		case "minMatch":
			return `${n} below ${state.minMatch}% match`
		case "released":
			return `${n} from other years`
		case "similarTo":
			return `${n} less similar`
		case "people":
			return `${n} without those people`
		case "legacy":
			return `${n} hidden by older filters`
	}
}

/** Names the bar can't know from the filter state alone: services, titles, and people by id. */
export interface FilterNames {
	service?: (id: number) => string | undefined
	title?: (key: number) => string | undefined
	person?: (id: number) => string | undefined
}

export interface ActiveChip {
	key: string
	group: FilterName
	label: string
	remove: (state: FilterState) => FilterState
}

const LEGACY_LABELS: Record<LegacyParam, (value: string) => string> = {
	minYear: (value) => `From ${value}`,
	maxYear: (value) => `Until ${value}`,
	maxScore: (value) => `Score up to ${value}`,
	fingerprintConditions: () => "Fingerprint conditions",
	fingerprintPillars: () => "Fingerprint pillars",
	fingerprintPillarMinTier: (value) => `Fingerprint tier ${value}`,
}

const without = <T>(list: T[] | undefined, value: T) => {
	const next = (list ?? []).filter((item) => item !== value)
	return next.length ? next : undefined
}

/** One removable chip per active secondary filter, legacy filters from old URLs included. */
export function activeChips(
	state: FilterState,
	names: FilterNames = {},
): ActiveChip[] {
	const chips: ActiveChip[] = []
	if (state.type !== "all")
		chips.push({
			key: "type",
			group: "type",
			label: TYPE_LABELS[state.type],
			remove: (s) => ({ ...s, type: "all" }),
		})
	if (state.anime !== "any")
		chips.push({
			key: "anime",
			group: "anime",
			label: ANIME_STATE_NAMES[state.anime],
			remove: (s) => ({ ...s, anime: "any" }),
		})
	for (const mood of state.moods)
		chips.push({
			key: `mood-${mood}`,
			group: "moods",
			label: MOOD_BY_KEY[mood]?.name ?? mood,
			remove: (s) => ({ ...s, moods: s.moods.filter((m) => m !== mood) }),
		})
	for (const genre of state.genres)
		chips.push({
			key: `genre-${genre}`,
			group: "genres",
			label: genre,
			remove: (s) => ({ ...s, genres: s.genres.filter((g) => g !== genre) }),
		})
	if (state.minScore)
		chips.push({
			key: "score",
			group: "minScore",
			label: `Score ${state.minScore}+`,
			remove: (s) => ({ ...s, minScore: 0 }),
		})
	if (state.minMatch)
		chips.push({
			key: "match",
			group: "minMatch",
			label: `Match ${state.minMatch}%+`,
			remove: (s) => ({ ...s, minMatch: 0 }),
		})
	if (state.released !== "any")
		chips.push({
			key: "released",
			group: "released",
			label: RELEASED_LABELS[state.released],
			remove: (s) => ({ ...s, released: "any" }),
		})
	if (!state.onMyServices && state.services?.length) {
		const serviceNames = state.services
			.map((id) => names.service?.(id))
			.filter(Boolean)
		chips.push({
			key: "services",
			group: "services",
			label:
				serviceNames.length === state.services.length &&
				serviceNames.length <= 2
					? serviceNames.join(" or ")
					: plural(state.services.length, "service", "services"),
			remove: (s) => ({ ...s, services: undefined }),
		})
	}
	for (const key of state.similarTo ?? [])
		chips.push({
			key: `similar-${key}`,
			group: "similarTo",
			label: `Like ${names.title?.(key) ?? "a title"}`,
			remove: (s) => ({ ...s, similarTo: without(s.similarTo, key) }),
		})
	for (const id of state.people ?? [])
		chips.push({
			key: `person-${id}`,
			group: "people",
			label: names.person?.(id) ?? "Cast or crew",
			remove: (s) => ({ ...s, people: without(s.people, id) }),
		})
	for (const [param, value] of Object.entries(state.legacy ?? {}) as [
		LegacyParam,
		string,
	][])
		chips.push({
			key: `legacy-${param}`,
			group: "legacy",
			label: LEGACY_LABELS[param](value),
			remove: (s) => {
				const legacy = { ...s.legacy }
				delete legacy[param]
				return {
					...s,
					legacy: Object.keys(legacy).length ? legacy : undefined,
				}
			},
		})
	return chips
}
