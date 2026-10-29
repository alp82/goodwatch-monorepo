// The Discover bar's tab model: the four main tabs (Search, Mood, Watch, You), their sub-tabs, which filter groups
// each counts, when a sub-tab shows, each tab's value line and badge, and what Clear all counts. Pure, no React.
//
// Every filter group has one place (GROUP_PLACES): its sub-tab and its spot in the tab's value line. A step that adds
// a filter group adds it there (the compiler asks for it) and to `activeChips`; the badges, value lines, status chips
// and Clear all then follow.
import type { ViewerLadder } from "~/domain/age-content"
import type { FindSubTab } from "~/domain/discover-find"
import {
	type FilterName,
	type FilterState,
	clearSecondaryFilters,
	stateAsApplied,
} from "~/domain/filter-state"
import type { MoodKey } from "~/domain/moods"
import {
	type ActiveChip,
	type FilterNames,
	activeChips,
} from "~/ui/filter-bar/labels"

export type MainTab = "search" | "mood" | "watch" | "you"

/** The main tabs in the bar's order. */
export const MAIN_TABS: readonly MainTab[] = ["search", "mood", "watch", "you"]

export const MAIN_TAB_LABELS: Record<MainTab, string> = {
	search: "Search",
	mood: "Mood",
	watch: "Watch",
	you: "You",
}

/** Desktop widths as flex shares; You is a narrow end cap. */
export const MAIN_TAB_FLEX: Record<MainTab, number> = {
	search: 2.5,
	mood: 1.2,
	watch: 1.2,
	you: 0.85,
}

export type SubTabId =
	| "titles"
	| "people"
	| "combos"
	| "everything"
	| "services"
	| "scores"
	| "popularity"
	| "shows"
	| "madeIn"
	| "released"
	| "length"
	| "budget"
	| "age"
	| "taste"

export interface SubTab {
	id: SubTabId
	tab: MainTab
	label: string
	/** Shows only while the list holds this kind, or while one of its choices is set. */
	kind?: "movie" | "show"
	/** Shows only when the results carry a rating ladder. */
	needsLadder?: boolean
	/** A view whose picks count on another sub-tab (Combos: the picks count on Everything). */
	countsOn?: SubTabId
}

/** Every sub-tab, in tab order. */
export const SUB_TABS: readonly SubTab[] = [
	{ id: "titles", tab: "search", label: "Titles" },
	{ id: "people", tab: "search", label: "Cast and crew" },
	{ id: "combos", tab: "mood", label: "Combos", countsOn: "everything" },
	{ id: "everything", tab: "mood", label: "Everything" },
	{ id: "services", tab: "watch", label: "Services" },
	{ id: "scores", tab: "watch", label: "Scores" },
	{ id: "popularity", tab: "watch", label: "Popularity" },
	{ id: "shows", tab: "watch", label: "Shows", kind: "show" },
	{ id: "madeIn", tab: "watch", label: "Made in" },
	{ id: "released", tab: "watch", label: "Released" },
	{ id: "length", tab: "watch", label: "Length" },
	{ id: "budget", tab: "watch", label: "Budget", kind: "movie" },
	{ id: "age", tab: "watch", label: "Age and content", needsLadder: true },
	{ id: "taste", tab: "you", label: "Taste and lists" },
]

const SUB_TAB_BY_ID = Object.fromEntries(
	SUB_TABS.map((sub) => [sub.id, sub]),
) as Record<SubTabId, SubTab>

export const subTabById = (id: SubTabId): SubTab => SUB_TAB_BY_ID[id]

// Find's readings land in these sub-tabs; the check keeps the two id lists in step.
const FIND_SUB_TABS: Record<FindSubTab, SubTabId> = {
	released: "released",
	length: "length",
	scores: "scores",
	shows: "shows",
	budget: "budget",
	age: "age",
}
export const subTabOfFind = (id: FindSubTab): SubTabId => FIND_SUB_TABS[id]

/**
 * Where a filter group lives: its sub-tab (null: in no tab; its chips still show and Clear all still clears them),
 * and its part of the tab's value line. Groups with the same `line` share one part ("A, B +N"); lower comes first.
 */
export const GROUP_PLACES: Record<
	FilterName,
	{ subTab: SubTabId | null; line: number }
> = {
	// Search: one list, Like this, people, More like, Less like, type.
	similarTo: { subTab: "titles", line: 0 },
	people: { subTab: "people", line: 0 },
	loved: { subTab: "titles", line: 0 },
	disliked: { subTab: "titles", line: 0 },
	type: { subTab: "titles", line: 0 },
	anime: { subTab: "titles", line: 0 },
	// Mood: the moods, About and Style, then Genre.
	moods: { subTab: "everything", line: 0 },
	themes: { subTab: "everything", line: 1 },
	styles: { subTab: "everything", line: 1 },
	genres: { subTab: "everything", line: 2 },
	// Watch: services lead, then Made in, length, score, sources and gap, popularity, years, age, shows, budget.
	services: { subTab: "services", line: 0 },
	popularity: { subTab: "popularity", line: 5 },
	shows: { subTab: "shows", line: 8 },
	budget: { subTab: "budget", line: 9 },
	productionCountries: { subTab: "madeIn", line: 1 },
	runtime: { subTab: "length", line: 2 },
	minScore: { subTab: "scores", line: 3 },
	sourceScores: { subTab: "scores", line: 4 },
	scoreGap: { subTab: "scores", line: 4 },
	years: { subTab: "released", line: 6 },
	released: { subTab: "released", line: 6 },
	ageLimit: { subTab: "age", line: 7 },
	content: { subTab: "age", line: 7 },
	// You: the match step leads (line 0), then the other choices.
	minMatch: { subTab: "taste", line: 0 },
	tasteGroups: { subTab: "taste", line: 1 },
	notSeenYet: { subTab: "taste", line: 1 },
	wishlist: { subTab: "taste", line: 1 },
	// Old URLs' filters: a chip, in no tab.
	legacy: { subTab: null, line: 0 },
}

/** The filter groups a sub-tab counts, in GROUP_PLACES order. */
export const groupsOf = (id: SubTabId): FilterName[] =>
	(Object.keys(GROUP_PLACES) as FilterName[]).filter(
		(group) => GROUP_PLACES[group].subTab === id,
	)

/** The sub-tab a chip of this group opens. */
export const subTabOfGroup = (group: FilterName): SubTabId | null =>
	GROUP_PLACES[group].subTab

export const tabOfSubTab = (id: SubTabId): MainTab => SUB_TAB_BY_ID[id].tab

/** What the tab model needs besides the filter state. */
export interface TabContext {
	/** Members can use You; guests see it locked. */
	member: boolean
	/** Viewer country used to recognize a redundant rating-country override. */
	viewerCountry?: string
	/** The results' rating ladder; null or undefined without one (Age and content hides, its choices don't count). */
	ladder: ViewerLadder | null | undefined
	/** The last response's facts availability; false keeps Budget and Shows choices unapplied. */
	facts?: boolean
	/** The Discover search (`q`), or null. It counts on Titles and Clear all clears it first. */
	query: string | null
	/**
	 * The picked taste groups' names. A pick counts in the badges and in Clear all once its name resolves; a reference
	 * to a group the member doesn't have stays absent, as its chip does.
	 */
	tasteGroup?: FilterNames["tasteGroup"]
}

const hasQuery = (context: TabContext) => Boolean(context.query?.trim())

/** The URL choices that actually narrow the last response's results. */
export const appliedStateOf = (state: FilterState, context: TabContext) =>
	stateAsApplied(
		state,
		context.ladder,
		context.member,
		context.viewerCountry,
		context.facts,
	)

/** The chips that count: activeChips of the state as it applies. */
const chipsOf = (
	state: FilterState,
	context: TabContext,
	names?: FilterNames,
) =>
	activeChips(appliedStateOf(state, context), {
		tasteGroup: context.tasteGroup,
		...names,
	})

/**
 * How many choices a filter group has active: its chips, plus Not seen yet, which has no chip in activeChips. On my
 * services counts nowhere: it is the member's default, like For you and the sort.
 */
function groupCount(
	group: FilterName,
	state: FilterState,
	chips: readonly ActiveChip[],
): number {
	const own = chips.filter((chip) => chip.group === group).length
	return group === "notSeenYet" && state.notSeenYet ? own + 1 : own
}

function subTabCount(
	sub: SubTab,
	state: FilterState,
	context: TabContext,
	chips: readonly ActiveChip[],
): number {
	if (sub.countsOn) return 0
	// Badges count every tag pick: an all-of group is one combined chip, so count its picks from the any-of chips.
	const picks = state.allOf?.length
		? chipsOf({ ...state, allOf: undefined }, context)
		: chips
	return (
		groupsOf(sub.id).reduce(
			(n, group) => n + groupCount(group, state, picks),
			0,
		) + (sub.id === "titles" && hasQuery(context) ? 1 : 0)
	)
}

/** The small count on a sub-tab: its active choices (Titles also counts the search). */
export const subTabBadge = (
	id: SubTabId,
	state: FilterState,
	context: TabContext,
): number =>
	subTabCount(SUB_TAB_BY_ID[id], state, context, chipsOf(state, context))

/** Whether the list holds this kind of title. */
const listHolds = (state: FilterState, kind: "movie" | "show") =>
	state.type === "all" || state.type === kind

/**
 * Whether a sub-tab with these filter groups shows.
 * A kind's sub-tab shows while the list holds that kind or one of its choices is set; Age and content needs a ladder.
 */
export function subTabShown(
	sub: SubTab,
	groups: readonly FilterName[],
	state: FilterState,
	context: TabContext,
): boolean {
	if (!groups.length && !sub.countsOn) return false
	if (sub.needsLadder && !context.ladder) return false
	if (!sub.kind || listHolds(state, sub.kind)) return true
	const chips = chipsOf(state, context)
	return groups.some((group) => groupCount(group, state, chips) > 0)
}

/** Whether a sub-tab shows (subTabShown with its groups from GROUP_PLACES). */
export const isSubTabShown = (
	id: SubTabId,
	state: FilterState,
	context: TabContext,
): boolean => subTabShown(SUB_TAB_BY_ID[id], groupsOf(id), state, context)

/** The sub-tabs a main tab shows, in order. */
export const subTabsOf = (
	tab: MainTab,
	state: FilterState,
	context: TabContext,
): SubTab[] =>
	SUB_TABS.filter(
		(sub) => sub.tab === tab && isSubTabShown(sub.id, state, context),
	)

/** The sub-tab a main tab opens on: Titles; Everything once Mood has a pick, else Combos; Services; Taste and lists. */
export function defaultSubTab(tab: MainTab, state: FilterState): SubTabId {
	switch (tab) {
		case "search":
			return "titles"
		case "mood":
			return state.moods.length ||
				state.themes.length ||
				state.styles.length ||
				state.genres.length
				? "everything"
				: "combos"
		case "watch":
			return "services"
		case "you":
			return "taste"
	}
}

/** A main tab's badge: the sum of its shown sub-tabs' badges. */
export function tabBadge(
	tab: MainTab,
	state: FilterState,
	context: TabContext,
): number {
	const chips = chipsOf(state, context)
	return subTabsOf(tab, state, context).reduce(
		(n, sub) => n + subTabCount(sub, state, context, chips),
		0,
	)
}

/**
 * What Clear all counts: the search and every active chip. On my services and Not seen yet stay (they have no chip in
 * activeChips), and so do For you and the sort.
 */
export const clearAllCount = (
	state: FilterState,
	context: TabContext,
): number => chipsOf(state, context).length + (hasQuery(context) ? 1 : 0)

/**
 * Clear all's filters: every filter except On my services and Not seen yet, as with today's sheet. The caller clears
 * the search first, so the two URL writes don't overwrite each other.
 */
export const clearAll = (state: FilterState): FilterState =>
	clearSecondaryFilters(state)

// ---------------------------------------------------------------------------------------------------------------
// Value lines

export interface TabValue {
	tab: MainTab
	label: string
	/** The line under the label; null shows the placeholder. */
	value: string | null
	placeholder: string
	badge: number
	/** You for a guest: the locked look; it still opens. */
	locked: boolean
	/** Search: the running search, shown in large type while the panel is closed. */
	query?: string | null
	/** Mood: the picked moods, for the hue dots that lead. */
	moods?: MoodKey[]
	/** Watch: the services whose logos lead; "mine" for the viewer's saved services. */
	services?: "mine" | number[] | null
}

export const SEARCH_PLACEHOLDER = "A mood, a title, or like Severance"

/** "A", "A, B", "A, B +3". */
export function headPlus(labels: readonly string[]): string | null {
	if (!labels.length) return null
	if (labels.length <= 2) return labels.join(", ")
	return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`
}

/** The first label and "+N" for the rest: "Not seen yet +1". */
const firstPlus = (labels: readonly string[]) =>
	labels.length
		? `${labels[0]}${labels.length > 1 ? ` +${labels.length - 1}` : ""}`
		: null

const joinParts = (parts: (string | null)[]) =>
	parts.filter((part): part is string => Boolean(part)).join(" · ") || null

/** A tab's chip labels as value line parts, one per `line`, in order. */
function lineParts(
	tab: MainTab,
	state: FilterState,
	chips: readonly ActiveChip[],
	skip: readonly FilterName[] = [],
): Map<number, string[]> {
	const parts = new Map<number, string[]>()
	const groups = (Object.keys(GROUP_PLACES) as FilterName[])
		.filter((group) => {
			const { subTab } = GROUP_PLACES[group]
			return (
				subTab && SUB_TAB_BY_ID[subTab].tab === tab && !skip.includes(group)
			)
		})
		.sort((a, b) => GROUP_PLACES[a].line - GROUP_PLACES[b].line)
	for (const group of groups) {
		const labels = chips
			.filter((chip) => chip.group === group)
			.map((chip) => chip.label)
		if (group === "notSeenYet" && state.notSeenYet)
			labels.unshift("Not seen yet")
		if (!labels.length) continue
		const line = GROUP_PLACES[group].line
		parts.set(line, [...(parts.get(line) ?? []), ...labels])
	}
	return parts
}

function servicesPart(
	state: FilterState,
	chips: readonly ActiveChip[],
	names: FilterNames,
) {
	if (state.onMyServices) return "My services"
	if (state.anyService)
		return state.streamingCountry
			? (chips.find((chip) => chip.key === "anyService")?.label ??
					"Any service")
			: "Any service"
	if (state.services?.length) {
		const found = state.services.map((id) => names.service?.(id))
		return found.every(Boolean)
			? headPlus(found as string[])
			: `${state.services.length} ${state.services.length === 1 ? "service" : "services"}`
	}
	return null
}

/**
 * Each main tab's segment in the bar: label, value line, placeholder, badge and lead. `names` resolves services,
 * titles, people and the age step, as for activeChips.
 */
export function tabValues(
	state: FilterState,
	context: TabContext,
	names: FilterNames = {},
): Record<MainTab, TabValue> {
	const chips = chipsOf(state, context, names)
	const base = (tab: MainTab, placeholder: string) => ({
		tab,
		label: MAIN_TAB_LABELS[tab],
		placeholder,
		badge: tabBadge(tab, state, context),
		locked: false,
	})

	const search = lineParts("search", state, chips)
	const mood = lineParts("mood", state, chips)
	const watch = lineParts("watch", state, chips, ["services"])
	const streamingIn = chips.find((chip) => chip.key === "streaming-country")
	const you = lineParts("you", state, chips)
	const youMatch = you.get(GROUP_PLACES.minMatch.line)
	const youRest = [...you.entries()]
		.filter(([line]) => line !== GROUP_PLACES.minMatch.line)
		.flatMap(([, labels]) => labels)

	const partsOf = (parts: Map<number, string[]>) =>
		[...parts.entries()]
			.sort(([a], [b]) => a - b)
			.map(([, labels]) => headPlus(labels))

	return {
		search: {
			...base("search", SEARCH_PLACEHOLDER),
			value: joinParts(partsOf(search)),
			query: hasQuery(context) ? (context.query?.trim() ?? null) : null,
		},
		mood: {
			...base("mood", "Any mood, any genre"),
			value: joinParts(partsOf(mood)),
			moods: [...state.moods],
		},
		watch: {
			...base("watch", "Everywhere"),
			value: joinParts([
				servicesPart(state, chips, names),
				streamingIn?.label ?? null,
				...partsOf(watch),
			]),
			services: state.onMyServices
				? "mine"
				: !state.anyService && state.services?.length
					? [...state.services]
					: null,
		},
		you: {
			...base("you", context.member ? "Any match" : "Sign up"),
			value:
				youMatch || youRest.length
					? joinParts([youMatch?.[0] ?? "Any match", firstPlus(youRest)])
					: null,
			locked: !context.member,
		},
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Counts

/**
 * The opt-in `counts=` flag of the results request that each sub-tab needs for its option counts. Every other count
 * comes with every response, so the other sub-tabs ask for nothing extra.
 */
export const COUNTS_FLAGS: Partial<Record<SubTabId, string>> = {
	scores: "scores",
	popularity: "popularity",
	released: "released",
	length: "length",
	madeIn: "origin",
	budget: "budget",
	shows: "shows",
	taste: "taste",
}

/** The `counts=` flags for the open sub-tab only; none while the panel is closed. */
export const countsFlags = (open: SubTabId | null): string[] => {
	const flag = open ? COUNTS_FLAGS[open] : undefined
	return flag ? [flag] : []
}
