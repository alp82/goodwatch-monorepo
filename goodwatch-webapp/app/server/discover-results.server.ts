import { inlineTaste } from "~/server/taste/inline.server"
// Discover's results: in browse mode the catalog, in search mode the search's ranked list, filtered and sorted in
// memory by the filter bar's state, taste applied (the taste match filter, Best match, For you), and one page of title
// cards. Serves the Discover route's first
// view and /api/discover/results for every page after. Plain guests share browse filter results in process memory.
// While For you is on (Best match counts as on), a member with Sides of you gets a row per side instead of the first
// page, when the page asks for rows (discover-sides.server.ts).
import type { FilterState, SortKey } from "~/domain/filter-state"
import { groupInListOrder, groupsByTaste } from "~/domain/side-rows"
import { availabilityLoadedAt } from "~/server/availability-index.server"
import {
	discoverFilterCache,
	discoverFilterKey,
} from "~/server/discover-filter-cache.server"
import type { DiscoverSide } from "~/server/discover-sides.server"
import { type FingerprintKey, loadTaste } from "~/server/taste/index.server"
import { recordListExposure } from "~/server/list-exposure.server"
import {
	MAX_KEYS,
	type TitleCard,
	getTitleCards,
} from "~/server/title-cards.server"
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

export interface DiscoverResults
	extends Omit<FilterResult, "keys" | "moved" | "personalOrder"> {
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
	/**
	 * Sides of you: `rows` on the first page, a row per side (and the titles that fit no side) in place of the page's
	 * titles, which are then empty; `side` when the list is narrowed to one side's titles. Null otherwise.
	 */
	sides: DiscoverSides | null
}

export type DiscoverSides =
	| { layout: "rows"; rows: DiscoverSideRow[] }
	| { layout: "side"; side: DiscoverSide }

/** A side's row: its first titles, in the list's order. */
export interface DiscoverSideRow extends DiscoverSide {
	cards: TitleCard[]
	/** This row's exposure record; null for a dropped write. */
	listId: string | null
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
		/**
		 * Sides of you, for a member while For you is on: `rows` asks for a row per side on the first page (Discover's web
		 * page; the TV and dev pages keep the grid), `side` narrows the list to one side ("none": no side).
		 */
		sides?: { rows: boolean; side: string | null }
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

	const compute = (keep?: (key: TitleKey) => boolean) =>
		filterTitles({
			universe: searching ? ranked : "catalog",
			includeNotInterested: searching,
			state,
			sort,
			taste: savedTaste,
			forYou: input.forYou ? (searching ? "search" : "browse") : null,
			viewer: ctx,
			keep,
		})
	const snapshot = searching ? null : getTitleSnapshot()
	const key = snapshot
		? discoverFilterKey({
				viewer: ctx,
				taste,
				state,
				sort,
				snapshotVersion: snapshot.version,
				availabilityLoadedAt: availabilityLoadedAt(ctx.country),
				year: new Date().getUTCFullYear(),
			})
		: null
	const result = await (searching
		? compute()
		: discoverFilterCache.run(key, () => compute()))
	// With Best match the order is the taste match already: For you has nothing to blend.
	const applied = result.moved !== undefined
	const { keys: all, moved, personalOrder } = result
	let counts = countsOf(result)
	const ladder = state.ageLimit === undefined ? null : result.ladder
	const record = (
		titles: readonly { key: TitleKey; match: number | null }[],
		filters: object,
	) =>
		recordListExposure(ctx, {
			surface: "discover",
			ordering: personalOrder?.todayFirst100 ? "personal-order" : "taste-v2",
			flags: {},
			personalOrder,
			sort: result.sortUsed,
			sortRequested: sort,
			forYou: input.forYou,
			forYouApplied: applied,
			filters,
			page,
			batch: "page",
			titles,
		})

	// Sides of you: a member's browse list while For you is on (any sort; Best match counts as on), when they have
	// sides and the page asks for rows of a list with titles, or for one side. The snapshot is null while searching.
	const wantsSides =
		(input.sides?.rows === true && all.length > 0) || Boolean(input.sides?.side)
	const explanation =
		applied && !searching
			? { leanings: taste.leanings(LEANINGS), ratings: taste.ratings }
			: null
	const engine =
		wantsSides &&
		!state.loved?.length &&
		!state.disliked?.length &&
		groupsByTaste({ searching, forYou: input.forYou, sort: result.sortUsed }) &&
		snapshot
			? await loadSides()
			: null
	const member =
		engine && snapshot ? await engine.memberSides(ctx, taste, snapshot) : null
	const at = engine && member ? { engine, member } : null
	const narrowedTo = at
		? at.engine.requestedGroup(at.member, input.sides?.side)
		: undefined
	let list = all
	let sides: DiscoverSides | null = null
	if (at && narrowedTo !== undefined) {
		const inSide = (key: TitleKey) =>
			at.engine.sideOf(at.member, key) === narrowedTo
		// The titles: the whole list's, in its order. The filter bar's counts: the side's alone, the other sides' titles
		// out like hidden ones, so no recovery or option promises titles the side doesn't hold. No "moved" count: the
		// side ranked alone moves differently from the whole list's order it shows.
		list = all.filter(inSide)
		counts = { ...countsOf(await compute(inSide)), movedUp: undefined }
		sides = {
			layout: "side",
			side: at.engine.discoverSide(at.member, narrowedTo, list.length),
		}
	}
	const groups =
		at && !sides && input.sides?.rows && page === 1
			? groupInListOrder(
					all,
					(key) => at.engine.sideOf(at.member, key),
					at.engine.ROW_TITLES,
				)
			: []
	// A list whose titles all fall in one group shows as the grid: one row would group nothing.
	if (at && groups.length >= 2) {
		const rowKeys = groups.flatMap((group) => group.keys)
		const found = new Map<TitleKey, TitleCard>()
		for (let i = 0; i < rowKeys.length; i += MAX_KEYS)
			for (const card of await getTitleCards(
				rowKeys.slice(i, i + MAX_KEYS),
				ctx,
				taste,
				ladder,
			))
				found.set(card.key, card)
		// Each row is its own list in the exposure log, in display order, with the row's place among the rows.
		const rows = groups.map((group, i): DiscoverSideRow => {
			const side = at.engine.discoverSide(at.member, group.side, group.total)
			const cards = group.keys.flatMap((key) => found.get(key) ?? [])
			return {
				...side,
				cards,
				listId: record(cards, {
					...state,
					searching,
					layout: "side-rows",
					side: side.id,
					row: i + 1,
				}),
			}
		})
		return {
			...counts,
			listId: rows[0]?.listId ?? null,
			page,
			pageSize: DISCOVER_PAGE_SIZE,
			sort,
			state,
			keys: [],
			cards: [],
			matches: [],
			moved: [],
			forYou: { on: input.forYou, applied, status, ratings: taste.ratings },
			explanation,
			searching,
			sides: { layout: "rows", rows },
		}
	}

	const from = (page - 1) * DISCOVER_PAGE_SIZE
	const keys = list.slice(from, from + DISCOVER_PAGE_SIZE)
	const onPage = new Set(keys)
	const cards = await getTitleCards(keys, ctx, taste, ladder)
	const listId = record(
		cards,
		sides?.layout === "side"
			? { ...state, searching, side: sides.side.id }
			: { ...state, searching },
	)
	return {
		...counts,
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
		sides,
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

/** A filter result without its titles: the counts and what the filter bar reads. */
function countsOf({
	keys: _keys,
	moved: _moved,
	personalOrder: _personalOrder,
	...counts
}: FilterResult) {
	return counts
}

/** The sides module, loaded on the first request that asks for Sides of you: it reads the Taste portrait's engine. */
let sidesEngine: Promise<
	typeof import("~/server/discover-sides.server")
> | null = null
const loadSides = () => {
	sidesEngine ??= import("~/server/discover-sides.server")
	return sidesEngine
}
