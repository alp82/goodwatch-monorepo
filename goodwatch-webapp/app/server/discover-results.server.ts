import { DISCOVER_DEFAULTS } from "~/domain/discover-search"
import { inlineTaste } from "~/server/taste/inline.server"
// Discover's results: in browse mode the catalog, in search mode the search's ranked list, filtered and sorted in
// memory by the filter bar's state, taste applied (the taste match filter, Best match, For you), and one page of title
// cards. Serves the Discover route's first
// view and /api/discover/results for every page after. Plain guests share browse filter results in process memory.
import type { FilterState, SortKey } from "~/domain/filter-state"
import type { Preference } from "~/domain/search-preferences"
import { preferenceList } from "~/server/discover-preference-order.server"
import { availabilityLoadedAt } from "~/server/availability-index.server"
import {
	discoverFilterCache,
	discoverFilterKey,
} from "~/server/discover-filter-cache.server"
import { type FingerprintKey, loadTaste } from "~/server/taste/index.server"
import { recordListExposure } from "~/server/list-exposure.server"
import { type TitleCard, getTitleCards } from "~/server/title-cards.server"
import {
	type FilterResult,
	filterTitles,
} from "~/server/title-filter/index.server"
import {
	UNKNOWN_SCORE,
	getTitleSnapshot,
} from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import { DISCOVER_MAX_PAGE } from "~/utils/constants"
import type { TitleKey } from "~/utils/title-key"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import type { TasteGroups } from "~/server/watch-next-taste-picker.server"

export { SnapshotNotLoaded } from "~/server/title-filter/index.server"

export const DISCOVER_PAGE_SIZE = 40
const LEANINGS = 3
// For you works for guests from this many guest ratings (owner, #193); the match itself needs 5 liked titles.
export const GUEST_FOR_YOU_RATINGS = 5

/**
 * Whether For you can change the order for this viewer:
 * - ready: it can (the viewer has taste).
 * - needsTaste: a member, or a guest with enough ratings, without 5 liked titles yet; the switch shows disabled.
 * - signUp: a guest with fewer than GUEST_FOR_YOU_RATINGS ratings; the sign-up prompt takes the switch's place.
 */
export type ForYouStatus = "ready" | "needsTaste" | "signUp"

export interface DiscoverResults
	extends Omit<FilterResult, "keys" | "moved" | "personalOrder">,
		Pick<FilterBarCounts, "tasteGroups"> {
	/** Exposure record for this member's page; null for guests or a dropped write. */
	listId: string | null
	page: number
	pageSize: number
	/** The sort as requested; `sortUsed` is the one the titles are in (Best match falls back without taste). */
	sort: SortKey
	state: FilterState
	/** This page's titles, in order. */
	keys: TitleKey[]
	/** This page's cards, in the order of `keys` (titles missing from the catalog are left out). */
	cards: TitleCard[]
	/** Taste match per title of `keys`; null without a fingerprint or taste. */
	matches: (number | null)[]
	/** For you movement of this page's titles against the plain order. */
	moved: { key: TitleKey; by: number }[]
	forYou: {
		/** The switch as the request set it. */
		on: boolean
		/** Whether it changed the order: on, the viewer has taste, and the sort isn't Best match. */
		applied: boolean
		status: ForYouStatus
		/** The viewer's ratings, member or guest. */
		ratings: number
	}
	/** The taste explanation chips while For you applies in browse mode; null while searching (Read as replaces it). */
	explanation: { leanings: FingerprintKey[]; ratings: number } | null
	/** Whether these are a search's results (the ranked list), not the catalog's. */
	searching: boolean
	searchEstimate?: boolean
	/**
	 * A search's scope, when asked on its first page: the catalog's titles that pass every filter (`eligible`) and how
	 * many of them the search's results don't hold (`outside`). Exact, unlike the counts the search streams.
	 */
	scope?: { eligible: number; outside: number }
}

/** Resolve URL references to current group keys, sharing the same rule across results and panels. */
export function resolveTasteGroups(
	groupsForTaste: TasteGroups | null,
	refs: readonly string[] = [],
) {
	const picked = refs.flatMap((ref) => {
		const number = groupsForTaste?.numberOf(ref)
		const group = number == null ? null : groupsForTaste?.groups[number - 1]
		return group ? [{ ref, group }] : []
	})
	const tasteGroups = groupsForTaste
		? {
				groups: groupsForTaste.groups.map(({ key, name }) => ({ key, name })),
				names: Object.fromEntries(
					picked.map(({ ref, group }) => [ref, group.name]),
				),
			}
		: null
	const tasteFilter = groupsForTaste
		? {
				options: groupsForTaste.groups.map((g) => g.key),
				picked: picked.map(({ group }) => group.key),
				sideOf: (key: TitleKey) => {
					const number = groupsForTaste.groupOf(key)
					return number === null
						? null
						: (groupsForTaste.groups[number - 1]?.key ?? null)
				},
			}
		: null
	return { tasteGroups, tasteFilter }
}

/**
 * One page of Discover's results for the viewer. `forYou` is the switch: the caller resolves the URL's `foryou`
 * against the member's saved setting. With `ranked`, the search's ranked list in its plain order (at most
 * SEARCH_RESULTS titles), the results are the search's: filtered in memory over that list, and For you moves a title
 * at most 5 places. Throws SnapshotNotLoaded until the title snapshot has loaded.
 */
export async function getDiscoverResults(
	ctx: ViewerContext,
	input: {
		budgetCounts?: boolean
		showsCounts?: boolean
		popularityCounts?: boolean
		releasedCounts?: boolean
		lengthCounts?: boolean
		originCounts?: boolean
		scoresCounts?: boolean
		state: FilterState
		sort: SortKey
		forYou: boolean
		page: number
		ranked?: TitleKey[]
		/** Compute taste-group counts, sent while the You tab is open. Picks also request them. */
		tasteCounts?: boolean
		/** Whether a member's page is recorded as a Discover list exposure (default true); false for another surface's read. */
		exposure?: boolean
		/**
		 * A search's read preferences (domain/search-preferences.ts): they order the list instead of filtering it
		 * (discover-preference-order.server.ts). `original` is the original reading's pool when it differs from `ranked`.
		 */
		preferences?: {
			list: Preference[]
			original?: TitleKey[]
			/** `[ranked key, original key]`: one title under two keys. */
			identities?: readonly (readonly [TitleKey, TitleKey])[]
		}
		/** A search's first page: also count the titles outside its results that pass every filter (`scope`). */
		scope?: boolean
	},
): Promise<DiscoverResults> {
	const { state, sort, ranked } = input
	const searching = ranked !== undefined
	const page = Math.min(DISCOVER_MAX_PAGE, Math.max(1, Math.floor(input.page)))
	const savedTaste = await loadTaste(ctx.viewer)
	const snapshotForTaste = getTitleSnapshot()
	const taste =
		(snapshotForTaste
			? inlineTaste(savedTaste, state, snapshotForTaste)
			: savedTaste) ?? savedTaste
	const status: ForYouStatus =
		ctx.viewer.kind === "guest" &&
		taste.signal !== "some" &&
		taste.ratings < GUEST_FOR_YOU_RATINGS
			? "signUp"
			: taste.signal === "some"
				? "ready"
				: "needsTaste"

	const groupsForTaste =
		ctx.viewer.kind === "member" &&
		snapshotForTaste &&
		(input.tasteCounts || state.tasteGroups?.length)
			? await import("~/server/watch-next-taste-picker.server").then((m) =>
					m.tasteGroupsFor(ctx, savedTaste, snapshotForTaste),
				)
			: null
	const { tasteGroups, tasteFilter } = resolveTasteGroups(
		groupsForTaste,
		state.tasteGroups,
	)
	// A search's read preferences order its list (the composed order, served under "relevance") instead of filtering
	// it. The composition sees the same hard rules as the list below.
	const served =
		ranked && input.preferences?.list.length
			? await preferenceList(ctx, {
					ranked,
					original: input.preferences.original,
					identities: input.preferences.identities,
					preferences: input.preferences.list,
					state,
					sort,
					taste: savedTaste,
					tasteGroups: tasteFilter,
				})
			: { universe: ranked, state, sort }
	const compute = () =>
		filterTitles({
			budgetCounts: input.budgetCounts,
			showsCounts: input.showsCounts,
			popularityCounts: input.popularityCounts,
			releasedCounts: input.releasedCounts,
			lengthCounts: input.lengthCounts,
			originCounts: input.originCounts,
			scoresCounts: input.scoresCounts,
			universe: served.universe ?? "catalog",
			includeNotInterested: searching,
			state: served.state,
			sort: served.sort,
			taste: savedTaste,
			forYou: input.forYou ? (searching ? "search" : "browse") : null,
			viewer: ctx,
			tasteGroups: tasteFilter,
		})
	const snapshot = searching ? null : getTitleSnapshot()
	const key = snapshot
		? discoverFilterKey({
				budgetCounts: input.budgetCounts,
				showsCounts: input.showsCounts,
				popularityCounts: input.popularityCounts,
				releasedCounts: input.releasedCounts,
				lengthCounts: input.lengthCounts,
				originCounts: input.originCounts,
				scoresCounts: input.scoresCounts,
				viewer: ctx,
				taste,
				state,
				sort,
				snapshotVersion: snapshot.version,
				availabilityLoadedAt: availabilityLoadedAt(ctx.country),
				year: new Date().getUTCFullYear(),
			})
		: null
	const [computed, eligible] = await Promise.all([
		searching ? compute() : discoverFilterCache.run(key, () => compute()),
		// The scope: the catalog under every hard rule the list applies (no For you: it only orders).
		searching && input.scope && page === 1
			? filterTitles({
					universe: "catalog",
					includeNotInterested: true,
					state: served.state,
					sort: "popular",
					taste: savedTaste,
					tasteGroups: tasteFilter,
					forYou: null,
					viewer: ctx,
				}).then((r) => r.keys)
			: null,
	])
	// Top rated served as the composed order still reads as Top rated.
	const result =
		served.sort === sort ? computed : { ...computed, sortUsed: computed.sortUsed === "relevance" ? sort : computed.sortUsed }
	// With Best match the order is the taste match already: For you has nothing to blend.
	const applied = result.moved !== undefined
	const scope = eligible ? scopeOf(eligible, result.keys) : undefined
	const { keys: all, moved, personalOrder } = result
	const counts = countsOf(result)
	// Cards show rating badges only while an age limit is on, in the filter's resolved rating country.
	const ladder = state.ageLimit === undefined ? null : result.ladder
	const explanation =
		applied && !searching
			? { leanings: taste.leanings(LEANINGS), ratings: taste.ratings }
			: null

	const from = (page - 1) * DISCOVER_PAGE_SIZE
	const keys = all.slice(from, from + DISCOVER_PAGE_SIZE)
	const onPage = new Set(keys)
	const cards = await getTitleCards(keys, ctx, taste, ladder)
	const listId =
		input.exposure === false
			? null
			: recordListExposure(ctx, {
					surface: "discover",
					ordering: personalOrder?.todayFirst100
						? "personal-order"
						: "taste-v2",
					flags: {},
					personalOrder,
					sort: result.sortUsed,
					sortRequested: sort,
					forYou: input.forYou,
					forYouApplied: applied,
					filters: { ...state, searching },
					page,
					batch: "page",
					titles: cards,
				})
	return {
		...counts,
		searchEstimate: searching && ranked.length > 100,
		tasteGroups,
		listId,
		page,
		pageSize: DISCOVER_PAGE_SIZE,
		sort,
		state,
		keys,
		// The rating badge shows only while an age limit is on.
		cards,
		matches: taste.match(keys),
		moved: (moved ?? []).filter((m) => onPage.has(m.key)),
		forYou: { on: input.forYou, applied, status, ratings: taste.ratings },
		explanation,
		searching,
		...(scope ? { scope } : {}),
	}
}

function scopeOf(eligible: readonly TitleKey[], results: readonly TitleKey[]) {
	const found = new Set(results)
	let outside = 0
	for (const key of eligible) if (!found.has(key)) outside++
	return { eligible: eligible.length, outside }
}

/**
 * What For you's browse rule reads, for tuning it (the dev page /dev/for-you): every passing title in the plain order
 * of the sort, as parallel arrays, so the browser can rank the whole list again with other numbers and show the match
 * under another scale.
 */
export interface ForYouPreview {
	/** The plain sort the titles are in. Best match has no plain order to blend into, so it reads as Popular. */
	sortUsed: SortKey
	hasTaste: boolean
	/** Every passing title, in the plain order. */
	keys: TitleKey[]
	/**
	 * Where each title of `keys` falls in the viewer's range (Taste.percentile, 0 to 100, to 4 decimals); -1 without a
	 * taste match. For you ranks by it, and the page works out the match shown from it.
	 */
	percentiles: number[]
	/** The liked titles the viewer's taste is built from: what sets the ceiling of the match shown. */
	liked: number
	/** GoodWatch score (0 to 100) per title of `keys`; -1 when unknown. */
	scores: number[]
}

/** The plain order of the catalog for the viewer's filters and sort, with each title's percentile and score. */
export async function getForYouPreview(
	ctx: ViewerContext,
	input: { state: FilterState; sort: SortKey },
): Promise<ForYouPreview> {
	const taste = await loadTaste(ctx.viewer)
	const result = await filterTitles({
		universe: "catalog",
		state: input.state,
		sort: input.sort === "match" ? "popular" : input.sort,
		taste,
		forYou: null,
		viewer: ctx,
	})
	// filterTitles throws SnapshotNotLoaded without one.
	const snapshot = getTitleSnapshot()
	const scores = result.keys.map((key) => {
		const row = snapshot?.rowOf(key) ?? -1
		const score = row < 0 ? UNKNOWN_SCORE : snapshot?.columns.scores[row]
		return score === undefined || score === UNKNOWN_SCORE ? -1 : score
	})
	return {
		sortUsed: result.sortUsed,
		hasTaste: result.hasTaste,
		keys: result.keys,
		percentiles: taste
			.percentile(result.keys)
			.map((percentile) =>
				percentile === null ? -1 : Math.round(percentile * 1e4) / 1e4,
			),
		liked: taste.liked,
		scores,
	}
}

/**
 * Discover's filter defaults: everything, on any service, seen or not. Ready to watch (On my services and Not seen yet)
 * is one tap away, and a URL says it when it's on. The viewer isn't read; the parameter stays for the callers.
 */
export function discoverFilterDefaults(_ctx: ViewerContext) {
	return DISCOVER_DEFAULTS
}

/** Lists picked for the viewer (the start page's For you row): on their services, not seen yet. */
export function readyToWatchDefaults(ctx: ViewerContext) {
	return {
		onMyServices: ctx.services.length > 0,
		notSeenYet:
			ctx.viewer.kind === "member" ||
			ctx.viewer.progress.interactions.length > 0,
	}
}

/** The switch for a request: the URL's `foryou` (0 or 1) wins, else the viewer's saved setting (on for guests). */
export function forYouFromParams(
	params: URLSearchParams,
	ctx: ViewerContext,
): boolean {
	const value = params.get("foryou")
	return value === "0" || value === "1" ? value === "1" : ctx.forYou
}

/** A filter result without its titles: the counts and what the filter bar reads. */
function countsOf({
	keys: _keys,
	moved: _moved,
	personalOrder: _personalOrder,
	...counts
}: FilterResult) {
	return counts
}
