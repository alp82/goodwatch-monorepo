// Discover's search with read preferences: the list getDiscoverResults filters, pages and counts
// (discover-preference-order.ts has the rules).
import type { FilterState, SortKey } from "~/domain/filter-state"
import type { Preference } from "~/domain/search-preferences"
import { SnapshotNotLoaded, filterTitles } from "~/server/title-filter/index.server"
import { compareRows } from "~/server/title-filter/order.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { TitleKey } from "~/utils/title-key"
import type { TasteGroupFilter } from "~/server/title-filter/passes.server"
import type { Taste } from "~/server/taste/index.server"
import {
	composeOrders,
	fitsComposition,
	foldIdentities,
	preferenceStrength,
	withPreferences,
} from "./discover-preference-order"

export interface PreferenceList {
	/** The list for the results to filter, page and count: the composed order, then the pools' other titles. */
	universe: TitleKey[]
	state: FilterState
	sort: SortKey
}

/** The hard rules the results apply, besides the filter state: the taste match floor and taste groups. */
export interface PreferenceEligibility {
	taste: Taste | null
	tasteGroups: TasteGroupFilter | null
}

/**
 * The search's list with its read preferences, for getDiscoverResults. Both pools pass every hard rule the results
 * apply (the filters, the taste match floor, taste groups, the search's Not interested rule) before anything is
 * composed, and a title the two pools hold under two keys is folded only when its original key passes. Under Relevance
 * and Top rated the composed order, served as "relevance" (kept as sent); another sort orders the same titles its own
 * way. The pools' titles that fail the filters follow, so the filter bar still counts what each filter keeps out. Past
 * SEARCH_RESULTS: the read preferences filter the original pool.
 */
export async function preferenceList(
	viewer: ViewerContext,
	input: {
		ranked: TitleKey[]
		original?: TitleKey[]
		/** `[ranked key, original key]`: one title under two keys (combined-search/preference-pools.server.ts). */
		identities?: readonly (readonly [TitleKey, TitleKey])[]
		preferences: readonly Preference[]
		state: FilterState
		sort: SortKey
	} & PreferenceEligibility,
): Promise<PreferenceList> {
	const original = input.original ?? input.ranked
	const strict = withPreferences(input.state, input.preferences)
	const keysOf = async (universe: TitleKey[], state: FilterState, sort: SortKey) =>
		(
			await filterTitles({
				universe,
				state,
				sort,
				taste: input.taste,
				tasteGroups: input.tasteGroups,
				forYou: null,
				viewer,
				includeNotInterested: true,
			})
		).keys
	// One snapshot for the pools, the fit and the rating order. filterTitles takes the snapshot when it's called, so
	// both pools start on the one read here; a refresh that lands while they run is read again once.
	for (let attempt = 0; ; attempt++) {
		const snapshot = getTitleSnapshot()
		if (!snapshot) throw new SnapshotNotLoaded()
		const [wider, admitted] = await Promise.all([
			keysOf(input.ranked, input.state, "relevance"),
			keysOf(original, strict, "top"),
		])
		if (getTitleSnapshot() !== snapshot) {
			if (attempt < 1) continue
			throw new SnapshotNotLoaded()
		}
		const folded = foldIdentities(wider, admitted, input.identities ?? [])
		const rating = compareRows(snapshot.columns, "top")
		const orders = composeOrders({
			wider: folded.wider,
			admitted,
			strength: (key) => preferenceStrength(snapshot, key, input.preferences),
			// filterTitles only returns titles the snapshot holds.
			byRating: (a, b) => rating(snapshot.rowOf(a), snapshot.rowOf(b)),
		})
		if (!fitsComposition(orders)) return { universe: original, state: strict, sort: input.sort }
		const composed = input.sort === "top" ? orders.top : orders.relevance
		// A folded key stays out of the rest too: its title is listed under the original key.
		const listed = new Set([...composed, ...folded.replaced])
		const rest = [...input.ranked, ...original].filter((key) => !listed.has(key) && (listed.add(key), true))
		return {
			universe: [...composed, ...rest],
			state: input.state,
			sort: input.sort === "top" || input.sort === "relevance" ? "relevance" : input.sort,
		}
	}
}
