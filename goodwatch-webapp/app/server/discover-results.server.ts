// Discover's browse mode: the catalog filtered and sorted in memory by the filter bar's state, For you applied, and
// one page of title cards. Serves the Discover route's first view and /api/discover/results for every page after.
import type { FilterState, SortKey } from "~/domain/filter-state"
import { type FingerprintKey, loadTaste } from "~/server/taste/index.server"
import { type TitleCard, getTitleCards } from "~/server/title-cards.server"
import {
	type FilterResult,
	filterTitles,
} from "~/server/title-filter/index.server"
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
		/** Whether it changed the order: on, and the viewer has taste. */
		applied: boolean
		status: ForYouStatus
		/** The viewer's ratings, member or guest. */
		ratings: number
	}
	/** The taste explanation chips while For you applies. */
	explanation: { leanings: FingerprintKey[]; ratings: number } | null
}

/**
 * One page of Discover's browse results for the viewer. `forYou` is the switch: the caller resolves the URL's
 * `foryou` against the member's saved setting. Throws SnapshotNotLoaded until the title snapshot has loaded.
 */
export async function getDiscoverResults(
	ctx: ViewerContext,
	input: { state: FilterState; sort: SortKey; forYou: boolean; page: number },
): Promise<DiscoverResults> {
	const { state, sort } = input
	const page = Math.min(DISCOVER_MAX_PAGE, Math.max(1, Math.floor(input.page)))
	const taste = await loadTaste(ctx.viewer)
	const status: ForYouStatus =
		ctx.viewer.kind === "guest" && taste.ratings < GUEST_FOR_YOU_RATINGS
			? "signUp"
			: taste.signal === "some"
				? "ready"
				: "needsTaste"
	const applied = input.forYou && status === "ready"

	const result = await filterTitles({
		universe: "catalog",
		state,
		sort,
		forYou: applied ? { taste, surface: "browse" } : null,
		viewer: ctx,
	})

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
		explanation: applied
			? { leanings: taste.leanings(LEANINGS), ratings: taste.ratings }
			: null,
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
