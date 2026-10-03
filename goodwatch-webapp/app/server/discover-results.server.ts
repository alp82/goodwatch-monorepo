// Discover's results: in browse mode the catalog, in search mode the search's ranked list, filtered and sorted in
// memory by the filter bar's state, taste applied (the taste match filter, Best match, For you), and one page of title
// cards. Serves the Discover route's first
// view and /api/discover/results for every page after.
import type { FilterState, SortKey } from "~/domain/filter-state"
import { type FingerprintKey, loadTaste } from "~/server/taste/index.server"
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
import type { TitleKey } from "~/utils/title-key"

export { SnapshotNotLoaded } from "~/server/title-filter/index.server"

export const DISCOVER_PAGE_SIZE = 40
export const DISCOVER_MAX_PAGE = 250
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

export interface DiscoverResults extends Omit<FilterResult, "keys" | "moved"> {
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
		state: FilterState
		sort: SortKey
		forYou: boolean
		page: number
		ranked?: TitleKey[]
	},
): Promise<DiscoverResults> {
	const { state, sort, ranked } = input
	const searching = ranked !== undefined
	const page = Math.min(DISCOVER_MAX_PAGE, Math.max(1, Math.floor(input.page)))
	const taste = await loadTaste(ctx.viewer)
	const status: ForYouStatus =
		ctx.viewer.kind === "guest" && taste.ratings < GUEST_FOR_YOU_RATINGS
			? "signUp"
			: taste.signal === "some"
				? "ready"
				: "needsTaste"

	const result = await filterTitles({
		universe: searching ? ranked : "catalog",
		state,
		sort,
		taste,
		forYou: input.forYou ? (searching ? "search" : "browse") : null,
		viewer: ctx,
	})
	// With Best match the order is the taste match already: For you has nothing to blend.
	const applied = result.moved !== undefined

	const from = (page - 1) * DISCOVER_PAGE_SIZE
	const keys = result.keys.slice(from, from + DISCOVER_PAGE_SIZE)
	const onPage = new Set(keys)
	const { keys: _all, moved, ...counts } = result
	return {
		...counts,
		page,
		pageSize: DISCOVER_PAGE_SIZE,
		sort,
		state,
		keys,
		cards: await getTitleCards(keys, ctx, taste),
		matches: taste.match(keys),
		moved: (moved ?? []).filter((m) => onPage.has(m.key)),
		forYou: { on: input.forYou, applied, status, ratings: taste.ratings },
		explanation:
			applied && !searching
				? { leanings: taste.leanings(LEANINGS), ratings: taste.ratings }
				: null,
		searching,
	}
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

/** The filter bar's defaults for the viewer: On my services with saved (or chosen) services; Not seen yet for members and guests with progress. */
export function discoverFilterDefaults(ctx: ViewerContext) {
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
