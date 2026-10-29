import {
	BUDGET_PRESETS,
	BUDGET_STEPS,
	BOX_OFFICE_STEPS,
	HOURS_STEPS,
	HOURS_PRESETS,
	scoreStepLabel,
} from "~/domain/title-scales"
import { productionCountryName } from "~/domain/production-country"
// What the filter bar says: sort options, option labels, chip labels, and the recovery wording. Every label is a
// proper, capitalized label ("Top rated", "Crime & mystery", "Philosophical").
import {
	CONTENT_KINDS,
	type ContentKind,
	changedContent,
	withoutContentChoice,
} from "~/domain/age-content"
import {
	SOURCE_KEYS,
	type FilterName,
	type FilterRange,
	type FilterState,
	type LegacyParam,
	type MinMatch,
	type MinScore,
	type Released,
	type SortKey,
	dropFilter,
} from "~/domain/filter-state"
import { MOOD_BY_KEY } from "~/domain/moods"
import { STYLE_BY_KEY, THEME_BY_KEY } from "~/domain/themes-styles"
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

/** Where "Rate titles" goes: the rating flow, which leaves out every title the person answered before. */
export const RATE_TITLES_PATH = "/taste/quiz"

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
	60: "60% and up",
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
/**
 * Each filter group's color: the dot on its chip and the bar on its sheet section. Amber is what taste decides, so it
 * is the Taste match group's; genres are fuchsia.
 */
export const FILTER_ACCENTS: Record<FilterName, { dot: string; bar: string }> =
	{
		years: { dot: "bg-cyan-400", bar: "bg-cyan-500" },
		runtime: { dot: "bg-sky-400", bar: "bg-sky-500" },
		sourceScores: { dot: "bg-yellow-400", bar: "bg-yellow-500" },
		budget: { dot: "bg-emerald-400", bar: "bg-emerald-500" },
		shows: { dot: "bg-violet-400", bar: "bg-violet-500" },
		popularity: { dot: "bg-cyan-400", bar: "bg-cyan-500" },
		scoreGap: { dot: "bg-rose-400", bar: "bg-rose-500" },
		services: { dot: "bg-emerald-400", bar: "bg-emerald-500" },
		tasteGroups: { dot: "bg-amber-400", bar: "bg-amber-500" },
		wishlist: { dot: "bg-blue-400", bar: "bg-blue-500" },
		notSeenYet: { dot: "bg-blue-400", bar: "bg-blue-500" },
		type: { dot: "bg-teal-400", bar: "bg-teal-500" },
		anime: { dot: "bg-pink-400", bar: "bg-pink-500" },
		moods: { dot: "bg-indigo-400", bar: "bg-indigo-500" },
		themes: { dot: "bg-orange-400", bar: "bg-orange-500" },
		styles: { dot: "bg-green-400", bar: "bg-green-500" },
		genres: { dot: "bg-fuchsia-400", bar: "bg-fuchsia-500" },
		minScore: { dot: "bg-lime-400", bar: "bg-lime-500" },
		minMatch: { dot: "bg-amber-400", bar: "bg-amber-500" },
		released: { dot: "bg-cyan-400", bar: "bg-cyan-500" },
		similarTo: { dot: "bg-rose-400", bar: "bg-rose-500" },
		loved: { dot: "bg-emerald-300", bar: "bg-emerald-500" },
		disliked: { dot: "bg-red-400", bar: "bg-red-500" },
		productionCountries: { dot: "bg-yellow-400", bar: "bg-yellow-500" },
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
	years: "bg-cyan-600",
	runtime: "bg-sky-600",
	sourceScores: "bg-yellow-600",
	budget: "bg-emerald-600",
	shows: "bg-violet-600",
	popularity: "bg-cyan-600",
	scoreGap: "bg-rose-600",
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
			return state.seenBefore ? `${n} you haven't seen` : `${n} you've seen`
		case "tasteGroups":
			return `${n} outside ${state.tasteGroups?.length === 1 ? "this taste group" : "these taste groups"}`
		case "wishlist":
			return `${n} outside your wishlist`
		case "type":
			return state.type === "movie"
				? plural(titles, "show", "shows")
				: plural(titles, "movie", "movies")
		case "anime":
			return hidesAnime ? `${n} anime` : `${n} that aren't anime`
		case "moods":
			return state.allOf?.includes("moods")
				? `${n} without every mood`
				: `${n} in other moods`
		case "themes":
			return state.allOf?.includes("themes")
				? `${n} without every theme`
				: `${n} in other themes`
		case "styles":
			return state.allOf?.includes("styles")
				? `${n} without every style`
				: `${n} in other styles`
		case "genres":
			return state.allOf?.includes("genres")
				? `${n} without every genre`
				: `${n} in other genres`
		case "minScore":
			return `${n} below ${state.minScore}`
		case "minMatch":
			return state.outsideUsual
				? `${n} with other taste matches`
				: `${n} below ${state.minMatch}% match`
		case "years":
		case "released":
			return `${n} from other years`
		case "budget":
			return `${n} outside your budget choices`
		case "shows":
			return `${n} outside your show choices`
		case "popularity":
			return `${n} of other popularity`
		case "runtime":
			return `${n} of other lengths`
		case "sourceScores":
			return `${n} with lower source scores`
		case "scoreGap":
			return `${n} without critics vs audiences`
		case "similarTo":
			return `${n} less similar`
		case "loved":
		case "disliked":
			return `${n} hidden by taste preferences`
		case "productionCountries":
			return `${n} from other production countries`
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
	tasteGroup?: (key: string) => string | undefined
	service?: (id: number) => string | undefined
	serviceLogo?: (id: number) => string | null | undefined
	title?: (key: number) => string | undefined
	poster?: (key: number) => string | null | undefined
	person?: (id: number) => string | undefined
	ageStep?: (age: number) => string | undefined
}

export interface ActiveChip {
	key: string
	group: FilterName
	label: string
	preview?: { title: string; poster?: string | null; logo?: boolean }[]
	remove: (state: FilterState) => FilterState
}

const LEGACY_LABELS: Record<LegacyParam, (value: string) => string> = {
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
	for (const key of state.tasteGroups ?? []) {
		const name = names.tasteGroup?.(key)
		if (!name) continue
		chips.push({
			key: `taste-${key}`,
			group: "tasteGroups",
			label: name,
			remove: (s) => ({ ...s, tasteGroups: without(s.tasteGroups, key) }),
		})
	}
	if (state.seenBefore)
		chips.push({
			key: "seen",
			group: "notSeenYet",
			label: "Seen before",
			remove: (s) => ({ ...s, seenBefore: undefined }),
		})
	if (state.onWishlist)
		chips.push({
			key: "wishlist",
			group: "wishlist",
			label: "On your wishlist",
			remove: (s) => dropFilter(s, "wishlist"),
		})
	if (state.outsideUsual)
		chips.push({
			key: "outside",
			group: "minMatch",
			label: "Outside your usual",
			remove: (s) => dropFilter(s, "minMatch"),
		})
	for (const field of ["budget", "boxOffice", "seasons", "hours"] as const) {
		const range = state[field]
		if (!range || (range.min === undefined && range.max === undefined)) continue
		const money = field === "budget" || field === "boxOffice"
		const fmt = (n: number) =>
			money
				? n >= 1000
					? `$${n / 1000}B`
					: `$${n}M`
				: n.toLocaleString("en", { maximumFractionDigits: 2 })
		const stops =
			field === "budget"
				? BUDGET_STEPS
				: field === "boxOffice"
					? BOX_OFFICE_STEPS
					: field === "hours"
						? HOURS_STEPS
						: []
		const displayMax =
			range.max === undefined
				? undefined
				: (stops.find(
						(stop) =>
							Math.abs(range.max! - (stop - (money ? 0.001 : 1 / 60))) < 1e-9,
					) ?? range.max)
		const span =
			range.min === range.max
				? fmt(range.min!)
				: range.max === undefined
					? `${fmt(range.min ?? 0)}+`
					: range.min === undefined
						? `Up to ${fmt(displayMax!)}`
						: `${fmt(range.min)} to ${fmt(displayMax!)}`
		const sameRange = (preset: { range: FilterRange }) =>
			preset.range.min === range.min && preset.range.max === range.max
		const budgetPreset =
			field === "budget" ? BUDGET_PRESETS.find(sameRange) : undefined
		const hoursPreset =
			field === "hours" ? HOURS_PRESETS.find(sameRange) : undefined
		chips.push({
			key: field,
			group: money ? "budget" : "shows",
			label:
				field === "budget"
					? budgetPreset
						? budgetPreset.key === "midBudget"
							? "Mid budget"
							: `${budgetPreset.label} budget`
						: `Budget ${span}`
					: field === "boxOffice"
						? `Box office ${span}`
						: hoursPreset
							? `${hoursPreset.label} to finish`
							: `${span} ${
									field === "hours"
										? "h to finish"
										: range.min === 1 && range.max === 1
											? "season"
											: "seasons"
								}`,
			remove: (s) => ({ ...s, [field]: undefined }),
		})
	}
	if (state.returns)
		chips.push({
			key: "returns",
			group: "budget",
			label: state.returns === "hit" ? "Box office hit" : "Box office flop",
			remove: (s) => ({ ...s, returns: undefined }),
		})
	if (state.showStatus)
		chips.push({
			key: "showStatus",
			group: "shows",
			label: { running: "Still running", ended: "Ended", canceled: "Canceled" }[
				state.showStatus
			],
			remove: (s) => ({ ...s, showStatus: undefined }),
		})
	for (const field of ["votes", "popularityRank"] as const) {
		const range = state[field]
		if (!range || (range.min === undefined && range.max === undefined)) continue
		const { min, max } = range
		const k = (n: number) =>
			n >= 1000000 && n % 1000000 === 0
				? `${n / 1000000}M`
				: n >= 1000 && n % 1000 === 0
					? `${n / 1000}K`
					: n.toLocaleString("en-US")
		const label =
			field === "votes"
				? max === 9999 && (min === undefined || min === 0)
					? "Under 10K ratings"
					: max === undefined
						? `${k(min ?? 0)}+ ratings`
						: min === undefined
							? `Up to ${k(max)} ratings`
							: `${min.toLocaleString("en-US")} to ${max.toLocaleString(
									"en-US",
								)} ratings`
				: (min === undefined || min <= 1) && max !== undefined
					? `Top ${max.toLocaleString("en-US")}`
					: max === undefined
						? min !== undefined && min > 1
							? `Past #${(min - 1).toLocaleString("en-US")}`
							: "#1+"
						: `#${(min ?? 1).toLocaleString("en-US")} to #${max.toLocaleString(
								"en-US",
							)}`
		chips.push({
			key: field,
			group: "popularity",
			label,
			remove: (s) => ({ ...s, [field]: undefined }),
		})
	}
	for (const group of ["years", "runtime", "episodeRuntime"] as const) {
		const range = state[group]
		if (!range || (range.min === undefined && range.max === undefined)) continue
		const { min, max } = range
		const minutes = (n: number) =>
			n >= 60
				? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60}` : ""}`
				: `${n} min`
		const kind = group === "episodeRuntime" ? "Episodes" : "Movies"
		const label =
			group !== "years" &&
			(group === "episodeRuntime" || state.episodeRuntime !== undefined)
				? max === undefined
					? `${kind} ${minutes(min!)} or more`
					: min === undefined || min === 0
						? `${kind} under ${minutes(max)}`
						: `${kind} ${minutes(min)} to ${minutes(max)}`
				: group === "years"
					? min === undefined
						? `Until ${max}`
						: max === undefined
							? `From ${min}`
							: `${min}–${max}`
					: max === undefined
						? `At least ${min} min`
						: min === undefined || min === 0
							? `Up to ${max} min`
							: `${min}–${max} min`
		chips.push({
			key: group,
			group: group === "episodeRuntime" ? "runtime" : group,
			label,
			remove: (s) =>
				group === "episodeRuntime"
					? { ...s, episodeRuntime: null }
					: group === "runtime"
						? { ...s, runtime: undefined }
						: dropFilter(s, group),
		})
	}
	for (const source of SOURCE_KEYS) {
		const score = state.sourceScores?.[source]
		if (score === undefined) continue
		const sourceName = {
			imdb: "IMDb",
			rtCritics: "Rotten Tomatoes",
			rtAudience: "RT audience",
			metacritic: "Metacritic",
			metacriticUsers: "Metacritic users",
		}[source]
		const label = `${sourceName} ${scoreStepLabel(source, score)}`
		chips.push({
			key: `source-${source}`,
			group: "sourceScores",
			label,
			remove: (s) => {
				const sourceScores = { ...s.sourceScores }
				delete sourceScores[source]
				return {
					...s,
					sourceScores: Object.keys(sourceScores).length
						? sourceScores
						: undefined,
				}
			},
		})
	}
	if (state.scoreGap)
		chips.push({
			key: "scoreGap",
			group: "scoreGap",
			label: {
				agree: "Critics and audiences agree",
				critics: "Critics liked it more",
				audience: "Audiences liked it more",
			}[state.scoreGap],
			remove: (s) => dropFilter(s, "scoreGap"),
		})
	if (state.anyService)
		chips.push({
			key: "anyService",
			group: "services",
			label: state.streamingCountry
				? `Streaming in ${productionCountryName(state.streamingCountry)}`
				: "On any service",
			remove: (s) => dropFilter(s, "services"),
		})
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
	const allGroups = new Set(
		state.allOf?.filter((group) => state[group].length >= 2),
	)
	for (const group of allGroups) {
		const labels =
			group === "moods"
				? state.moods.map((key) => MOOD_BY_KEY[key]?.name ?? key)
				: group === "themes"
					? state.themes.map((key) => THEME_BY_KEY[key]?.name ?? key)
					: group === "styles"
						? state.styles.map((key) => STYLE_BY_KEY[key]?.name ?? key)
						: state.genres
		chips.push({
			key: group,
			group,
			label: labels.join(" and "),
			remove: (s) => dropFilter(s, group),
		})
	}
	if (!allGroups.has("moods"))
		for (const mood of state.moods)
			chips.push({
				key: `mood-${mood}`,
				group: "moods",
				label: MOOD_BY_KEY[mood]?.name ?? mood,
				remove: (s) => ({ ...s, moods: s.moods.filter((m) => m !== mood) }),
			})
	if (!allGroups.has("themes"))
		for (const theme of state.themes)
			chips.push({
				key: `theme-${theme}`,
				group: "themes",
				label: THEME_BY_KEY[theme]?.name ?? theme,
				remove: (s) => ({ ...s, themes: s.themes.filter((t) => t !== theme) }),
			})
	if (!allGroups.has("styles"))
		for (const style of state.styles)
			chips.push({
				key: `style-${style}`,
				group: "styles",
				label: STYLE_BY_KEY[style]?.name ?? style,
				remove: (s) => ({ ...s, styles: s.styles.filter((t) => t !== style) }),
			})
	if (!allGroups.has("genres"))
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
	if (state.minMatch && !state.outsideUsual)
		chips.push({
			key: "match",
			group: "minMatch",
			label: `Match ${state.minMatch}%+`,
			remove: (s) => ({ ...s, minMatch: 0 }),
		})
	if (!state.years && state.released !== "any")
		chips.push({
			key: "released",
			group: "released",
			label: RELEASED_LABELS[state.released],
			remove: (s) => ({ ...s, released: "any" }),
		})
	if (!state.anyService && !state.onMyServices && state.services?.length) {
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
			preview: state.services.map((id) => ({
				title: names.service?.(id) ?? "Loading service…",
				poster: names.serviceLogo?.(id),
				logo: true,
			})),
			remove: (s) => ({ ...s, services: undefined }),
		})
	}
	for (const group of ["loved", "disliked"] as const) {
		const keys = state[group] ?? []
		const label = group === "loved" ? "Loved" : "Disliked"
		const preview = (chosen: number[]) =>
			chosen.map((key) => ({
				title: names.title?.(key) ?? "Loading title…",
				poster: names.poster?.(key),
			}))
		if (keys.length > 2)
			chips.push({
				key: group,
				group,
				label: `${label}: ${keys.length} titles`,
				preview: preview(keys),
				remove: (s) => ({ ...s, [group]: undefined }),
			})
		else
			for (const key of keys)
				chips.push({
					key: `${group}-${key}`,
					group,
					label: `${label}: ${names.title?.(key) ?? "a title"}`,
					preview: preview([key]),
					remove: (s) => ({ ...s, [group]: without(s[group], key) }),
				})
	}
	for (const key of state.similarTo ?? [])
		chips.push({
			key: `similar-${key}`,
			group: "similarTo",
			label: `Like ${names.title?.(key) ?? "a title"}`,
			remove: (s) => ({ ...s, similarTo: without(s.similarTo, key) }),
		})
	if (state.streamingCountry && !state.anyService)
		chips.push({
			key: "streaming-country",
			group: "services",
			label: `Streaming in ${productionCountryName(state.streamingCountry)}`,
			remove: (s) => ({ ...s, streamingCountry: undefined }),
		})
	if (state.restOfWorld)
		chips.push({
			key: "restOfWorld",
			group: "productionCountries",
			label: "Rest of the world",
			remove: (s) => ({ ...s, restOfWorld: undefined }),
		})
	for (const code of state.productionCountries ?? [])
		chips.push({
			key: `production-country-${code}`,
			group: "productionCountries",
			label: `Produced in ${productionCountryName(code)}`,
			remove: (s) => ({
				...s,
				productionCountries: without(s.productionCountries, code),
			}),
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
	if (state.ratingCountry)
		chips.push({
			key: "ratingCountry",
			group: "ageLimit",
			label: `Ratings in ${productionCountryName(state.ratingCountry)}`,
			remove: (s) => ({ ...s, ratingCountry: undefined }),
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
