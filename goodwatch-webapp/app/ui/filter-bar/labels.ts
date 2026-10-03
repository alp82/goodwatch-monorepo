// What the filter bar says: sort options, option labels, chip labels, and the recovery wording. Every label is a
// proper, capitalized label ("Top rated", "Crime & mystery", "Philosophical").
import {
	CONTENT_KINDS,
	type ContentKind,
	type LadderStep,
	changedContent,
	hiddenKinds,
	withoutContentChoice,
	ladderStepFor,
} from "~/domain/age-content"
import {
	type FilterName,
	type FilterState,
	type LegacyParam,
	type MinMatch,
	type MinScore,
	type Released,
	type SortKey,
	dropFilter,
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
 * The kinds of content in words: `full` in the checklist, `short` inside a sentence ("no violence", "drugs OK"), and
 * `words` the filter search also finds the kind by.
 */
export const CONTENT_LABELS: Record<
	ContentKind,
	{ full: string; short: string; words: string }
> = {
	violence: {
		full: "Graphic violence",
		short: "violence",
		words: "violent blood gore",
	},
	sex: { full: "Sex & nudity", short: "sex & nudity", words: "sexual nude" },
	disturbing: {
		full: "Disturbing scenes",
		short: "disturbing scenes",
		words: "scary frightening suicide",
	},
	language: {
		full: "Strong language",
		short: "strong language",
		words: "swearing profanity cursing",
	},
	drugs: {
		full: "Drugs & alcohol",
		short: "drugs",
		words: "smoking drinking",
	},
}

/** Further words the filter search finds the Age & content group by. */
export const AGE_CONTENT_WORDS =
	"age limit rating rated ratings content kids children family parental"

const capitalized = (text: string) => text[0].toUpperCase() + text.slice(1)

/** What the closed Age & content control says. */
export interface AgeContentSummary {
	/** The age limit's step ("FSK 12"); null while the limit is off. */
	badge: string | null
	/**
	 * With a limit, what the person changed from what it sets: "no disturbing scenes", "violence OK", "2 changes". With
	 * the limit off, the first hidden kind: "no violence". Null when there is nothing to say.
	 */
	text: string | null
	/** With the limit off, how many kinds are hidden besides the one `text` names: the "+1" pill. */
	more: number
	/** Every hidden kind, for the tooltip: "Hiding violence, sex & nudity". Null when nothing is hidden. */
	hiding: string | null
}

export function ageContentSummary(
	state: Pick<FilterState, "ageLimit" | "content">,
	steps: readonly LadderStep[],
): AgeContentSummary {
	const hidden = hiddenKinds(state.ageLimit, state.content)
	const hiding = hidden.length
		? `Hiding ${hidden.map((kind) => CONTENT_LABELS[kind].short).join(", ")}`
		: null
	const no = (kind: ContentKind) => `no ${CONTENT_LABELS[kind].short}`
	if (state.ageLimit === undefined)
		return {
			badge: null,
			text: hidden.length ? no(hidden[0]) : null,
			more: Math.max(0, hidden.length - 1),
			hiding,
		}
	const changed = changedContent(state.ageLimit, state.content) ?? {}
	const kinds = CONTENT_KINDS.filter((kind) => changed[kind])
	return {
		badge: ladderStepFor(steps, state.ageLimit).label,
		text:
			kinds.length === 0
				? null
				: kinds.length > 1
					? `${kinds.length} changes`
					: changed[kinds[0]] === "hide"
						? no(kinds[0])
						: `${CONTENT_LABELS[kinds[0]].short} OK`,
		more: 0,
		hiding,
	}
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
		ageLimit: { dot: "bg-violet-400", bar: "bg-violet-500" },
		content: { dot: "bg-sky-400", bar: "bg-sky-500" },
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
		case "ageLimit":
			return `${n} above the age limit`
		case "content":
			return `${n} with hidden content`
	}
}

/**
 * Names the bar can't know from the filter state alone: services, titles, and people by id, and the age limit's step
 * on the viewer's ladder ("FSK 12").
 */
export interface FilterNames {
	service?: (id: number) => string | undefined
	title?: (key: number) => string | undefined
	person?: (id: number) => string | undefined
	ageStep?: (age: number) => string | undefined
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

/**
 * One removable chip per active secondary filter, legacy filters from old URLs included. The age limit is one chip
 * ("Age limit FSK 12"), and so is every kind the person changed from what the limit sets ("No disturbing scenes",
 * "Violence OK").
 */
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
	if (state.ageLimit !== undefined)
		chips.push({
			key: "age",
			group: "ageLimit",
			label: `Age limit ${names.ageStep?.(state.ageLimit) ?? state.ageLimit}`,
			remove: (s) => dropFilter(s, "ageLimit"),
		})
	const changed = changedContent(state.ageLimit, state.content) ?? {}
	for (const kind of CONTENT_KINDS) {
		const choice = changed[kind]
		if (!choice) continue
		const { short } = CONTENT_LABELS[kind]
		chips.push({
			key: `content-${kind}`,
			group: "content",
			label: choice === "hide" ? `No ${short}` : `${capitalized(short)} OK`,
			remove: (s) => ({ ...s, content: withoutContentChoice(s.content, kind) }),
		})
	}
	return chips
}
