// The title filter: the in-memory engine behind the filter bar on Discover, Watch next, and Explorer. It filters and
// sorts a universe of titles by the filter state, counts what each filter hides and what each option would leave, and
// applies taste: the taste match filter, the Best match sort, and For you. Everything runs over the title snapshot and the availability index in webapp memory; only the
// filters that aren't snapshot facts (Similar to, cast and crew, legacy Discover filters) read Qdrant or Crate, once
// per parameter set per 30 minutes.
import type { ViewerLadder } from "~/domain/age-content"
import {
	type FilterName,
	type FilterState,
	RELEASED,
	type Released,
	type SortKey,
} from "~/domain/filter-state"
import {
	BROWSE_QUALITY_FLOOR,
	type ForYouSurface,
	rankForYou,
} from "~/domain/for-you"
import { MOOD_KEYS } from "~/domain/moods"
import {
	type CountryServices,
	countryServices,
} from "~/server/availability-index.server"
import type { Taste } from "~/server/taste/index.server"
import { isEnabled } from "~/server/features.server"
import {
	type TitleSnapshot,
	UNKNOWN_SCORE,
	getTitleSnapshot,
} from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import { duplicateProviderMapping } from "~/utils/streaming-links"
import type { TitleKey } from "~/utils/title-key"
import {
	legacyTitles,
	personTitles,
	similarTitles,
	titlesOnServicesByColumn,
} from "./id-sets.server"
import { universeTaste } from "./matches.server"
import {
	type PlainSort,
	byMatch,
	catalogRows,
	compareRows,
	sortToUse,
} from "./order.server"
import {
	type DayRange,
	type ServicesFilter,
	ladderFor,
	ratingsFilter,
	runPasses,
	titleSet,
} from "./passes.server"

export interface FilterResult {
	/** Passing titles in the order of `sortUsed` (For you applied). */
	keys: TitleKey[]
	/**
	 * The sort the titles are in. It differs from the requested sort for Best match without taste (then Popular, or
	 * Relevance for a ranked list), and for Relevance over the catalog (Popular).
	 */
	sortUsed: SortKey
	/**
	 * Whether the person has taste. Without it no title has a taste match: the taste match filter doesn't narrow
	 * (every minMatch option leaves the same), and Best match falls back.
	 */
	hasTaste: boolean
	total: number
	/** Universe size minus total. */
	hidden: number
	/**
	 * Titles that only that filter hides, largest first. A title hidden by two filters counts in neither, so these
	 * don't add up to `hidden`.
	 */
	recoveries: { filter: FilterName; titles: number }[]
	/**
	 * What each option would leave, the other filters unchanged. Keys: services `all`, `mine`, and service ids;
	 * notSeenYet `on`, `off`; type `all`, `movie`, `show`; anime `any`, `only`, `none`; moods by key; genres by name;
	 * minScore `0`, `60`, `70`, `80`; minMatch `0`, `70`, `80`, `90`; released by option; similarTo and people only for the chosen options (what
	 * removing each would leave); legacy `on`, `off`.
	 *
	 * ageLimit: `off` and each step of `ladder` by its age (`0`, `6`, `12`, ...). Choosing a step also changes what
	 * content hides, so each counts what that step would leave with the content it sets by itself plus the person's
	 * overrides. content: by kind (`violence`, `sex`, `disturbing`, `language`, `drugs`), the titles of that kind among those
	 * every other filter lets through, the age limit included: what hiding the kind hides (or already hides), not what
	 * it would leave. Both are empty without `ladder`.
	 */
	optionCounts: Record<FilterName, Record<string, number>>
	/**
	 * For you movement against the plain order: titles whose place changed, `by` > 0 moved up. Missing when For you
	 * didn't apply: it is off, the person has no taste, or the sort is Best match, which leaves it nothing to blend.
	 */
	moved?: { key: TitleKey; by: number }[]
	/** The "↑N moved" count. */
	movedUp?: number
	/**
	 * True while the viewer's country loads into the availability index: On my services then goes by the titles'
	 * streaming column, and per-service counts are missing.
	 */
	approximate: boolean
	/**
	 * What the age limit's control draws: the viewer's rating country and its ladder. Null when the snapshot has no
	 * ratings or REC_AGE_FILTER is off for the viewer; then the age limit and content don't narrow either.
	 */
	ladder: ViewerLadder | null
}

export interface FilterInput {
	/** "catalog" is every title Discover shows; a list is a ranked search, a Wishlist, or an Explorer pool. */
	universe: Iterable<TitleKey> | "catalog"
	/** Text search keeps hidden titles findable. */
	includeNotInterested?: boolean
	state: FilterState
	sort: SortKey
	/**
	 * The person's taste. The taste match filter and Best match go by it whether For you is on or not. Null counts as
	 * no taste.
	 */
	taste: Taste | null
	/** The For you switch: the surface whose rule applies, or null when it's off. */
	forYou: ForYouSurface | null
	viewer: ViewerContext
}

export class SnapshotNotLoaded extends Error {
	constructor() {
		super("The title snapshot hasn't loaded yet")
		this.name = "SnapshotNotLoaded"
	}
}

export async function filterTitles(input: FilterInput): Promise<FilterResult> {
	const snapshot = getTitleSnapshot()
	if (!snapshot) throw new SnapshotNotLoaded()
	const { state, viewer } = input

	const [similarTo, people, legacy, services] = await Promise.all([
		Promise.all(
			(state.similarTo ?? []).map(async (seed) => ({
				option: String(seed),
				keys: await similarTitles(seed),
			})),
		),
		Promise.all(
			(state.people ?? []).map(async (person) => ({
				option: String(person),
				keys: await personTitles(person),
			})),
		),
		state.legacy ? legacyTitles(state.legacy) : null,
		servicesFilterBase(state, viewer),
	])

	const taste = input.taste?.signal === "some" ? input.taste : null
	const sortUsed = sortToUse(
		input.sort,
		taste !== null,
		input.universe !== "catalog",
	)
	// Best match reorders the Top rated order, so titles with the same match go by GoodWatch score.
	let { rows, keys } = universeInOrder(
		snapshot,
		input.universe,
		sortUsed === "match" ? "top" : sortUsed,
	)
	// Remove pure hides before computing recoveries and counts: no filter can bring them back.
	if (!input.includeNotInterested && viewer.notInterested.size) {
		const kept = Array.from(keys, (_, i) => i).filter((i) => !viewer.notInterested.has(keys[i]))
		rows = Int32Array.from(kept, (i) => rows[i])
		keys = Float64Array.from(kept, (i) => keys[i])
	}
	const universe = taste && universeTaste(snapshot, taste, rows, keys)
	const matches = universe ? universe.matches : null
	const releasedOptions = releasedRanges(new Date())
	const genreBits = state.genres.reduce((bits, name) => {
		const b = snapshot.columns.genreNames.indexOf(name)
		return b < 0 ? bits : bits | (1 << b)
	}, 0)
	const seenOrSkipped = titleSet(
		new Set([...viewer.seen, ...viewer.skipped]),
		snapshot,
	)
	const ladder = viewerLadder(viewer)
	const sets = (list: { option: string; keys: Set<TitleKey> }[]) =>
		list.map(({ option, keys }) => ({ option, keys: titleSet(keys, snapshot) }))

	const { passing, recoveries, optionCounts } = runPasses({
		columns: snapshot.columns,
		rows,
		keys,
		services:
			services.kind === "index"
				? {
						...services,
						availabilityRows: availabilityRows(
							viewer.country,
							services.index,
							snapshot,
							rows,
							keys,
						),
					}
				: {
						...services,
						kept: services.kept && titleSet(services.kept, snapshot),
					},
		notSeen: state.notSeenYet ? seenOrSkipped : null,
		seenOrSkipped,
		type: state.type,
		anime: state.anime,
		moods: state.moods.reduce(
			(mask, mood) => mask | (1 << MOOD_KEYS.indexOf(mood)),
			0,
		),
		genres: genreBits,
		genresChosen: state.genres.length > 0,
		minScore: state.minScore,
		minMatch: state.minMatch,
		matches,
		released: releasedOptions[state.released],
		releasedOptions,
		similarTo: sets(similarTo),
		people: sets(people),
		legacy: legacy && titleSet(legacy, snapshot),
		ratings:
			ladder && snapshot.columns.ratings
				? ratingsFilter(snapshot.columns.ratings, ladder, state)
				: null,
	})

	const inOrder =
		sortUsed === "match" && universe
			? byMatch(passing, universe.percentiles)
			: passing
	const ordered = Array.from(inOrder, (i) => keys[i])
	let moved: FilterResult["moved"]
	let movedUp: number | undefined
	if (input.forYou && universe && sortUsed !== "match") {
		const { scores } = snapshot.columns
		// NO_RANK (-1) reads as no match in rankForYou.
		const percentileInOrder = new Float32Array(inOrder.length)
		// The quality floor of the browse rule.
		const liftable = new Uint8Array(inOrder.length)
		for (let j = 0; j < inOrder.length; j++) {
			const i = inOrder[j]
			const row = rows[i]
			percentileInOrder[j] = universe.percentiles[i]
			if (
				row >= 0 &&
				scores[row] !== UNKNOWN_SCORE &&
				scores[row] >= BROWSE_QUALITY_FLOOR
			)
				liftable[j] = 1
		}
		const ranking = rankForYou(
			ordered,
			percentileInOrder,
			input.forYou,
			liftable,
		)
		moved = []
		for (let j = 0; j < ranking.order.length; j++) {
			ordered[j] = ranking.order[j]
			if (ranking.moved[j] !== 0)
				moved.push({ key: ordered[j], by: ranking.moved[j] })
		}
		movedUp = ranking.movedUp
	}

	return {
		keys: ordered,
		sortUsed,
		hasTaste: taste !== null,
		total: passing.length,
		hidden: rows.length - passing.length,
		recoveries,
		optionCounts,
		moved,
		movedUp,
		approximate: services.kind === "column",
		ladder,
	}
}

/**
 * The ladder the viewer's age limit goes by (ladderFor), or null when the snapshot has no ratings (or hasn't loaded)
 * or REC_AGE_FILTER is off for the viewer: the flag turns the whole filter off, the URL parameters included.
 */
export function viewerLadder(viewer: ViewerContext): ViewerLadder | null {
	const userId = viewer.viewer.kind === "member" ? viewer.viewer.userId : null
	return ladderFor(
		getTitleSnapshot()?.columns.ratings,
		viewer.country,
		isEnabled("ageFilter", { userId }),
	)
}

/** The universe's snapshot rows and keys in the plain order of the sort. */
function universeInOrder(
	snapshot: TitleSnapshot,
	universe: Iterable<TitleKey> | "catalog",
	sort: PlainSort | "relevance",
): { rows: Int32Array; keys: Float64Array } {
	if (universe === "catalog")
		return catalogRows(snapshot, sort === "relevance" ? "popular" : sort)
	let found = [...new Set(universe)].map((key) => ({
		key,
		row: snapshot.rowOf(key),
	}))
	if (sort !== "relevance") {
		const compare = compareRows(snapshot.columns, sort)
		// Titles the snapshot doesn't hold have no facts to sort by: they follow, in the universe's order.
		const known = found.filter((t) => t.row >= 0)
		known.sort((a, b) => compare(a.row, b.row))
		found = known.concat(found.filter((t) => t.row < 0))
	}
	return {
		rows: Int32Array.from(found, (t) => t.row),
		keys: Float64Array.from(found, (t) => t.key),
	}
}

type ServicesBase =
	| (Omit<Extract<ServicesFilter, { kind: "index" }>, "availabilityRows"> & {
			index: CountryServices
	  })
	| { kind: "column"; kept: Set<TitleKey> | null; onMyServices: boolean }

// The viewer's saved services are already expanded through duplicateProviderMapping; explicit choices are expanded
// here, so both match the availability index's base services and the streaming column's provider ids alike.
const expand = (ids: number[]) => [
	...new Set(
		ids.flatMap((id) => [id, ...(duplicateProviderMapping[id] ?? [])]),
	),
]

async function servicesFilterBase(
	state: FilterState,
	viewer: ViewerContext,
): Promise<ServicesBase> {
	const explicit = state.onMyServices ? [] : expand(state.services ?? [])
	// On my services without saved services has nothing to keep by: it doesn't narrow.
	const kept = state.onMyServices ? viewer.services : explicit
	const index = countryServices(viewer.country)
	if (index) {
		const indexes = (ids: number[]) => [
			...new Set(
				ids.map((id) => index.indexOfService(id)).filter((at) => at >= 0),
			),
		]
		const keptIndexes = indexes(kept)
		return {
			kind: "index",
			index,
			// A choice of services none of which carries anything keeps nothing: mark it with an impossible index.
			kept: kept.length && !keptIndexes.length ? [-1] : keptIndexes,
			mine: indexes(viewer.services),
			chosen: indexes(explicit),
		}
	}
	return {
		kind: "column",
		kept: kept.length
			? await titlesOnServicesByColumn(viewer.country, kept)
			: null,
		onMyServices: state.onMyServices && viewer.services.length > 0,
	}
}

// Availability rows per snapshot row, per loaded country index and snapshot version, filled as titles are looked up.
const NOT_LOOKED_UP = -2
const availabilityRowCache = new Map<
	string,
	{ loadedAt: number; version: string; rows: Int32Array }
>()

function availabilityRows(
	country: string,
	index: CountryServices,
	snapshot: TitleSnapshot,
	rows: Int32Array,
	keys: Float64Array,
): Int32Array {
	let cache = availabilityRowCache.get(country)
	if (
		!cache ||
		cache.loadedAt !== index.loadedAt ||
		cache.version !== snapshot.version
	) {
		cache = {
			loadedAt: index.loadedAt,
			version: snapshot.version,
			rows: new Int32Array(snapshot.count).fill(NOT_LOOKED_UP),
		}
		availabilityRowCache.set(country, cache)
	}
	const out = new Int32Array(rows.length)
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]
		if (row < 0) {
			out[i] = index.rowOf(keys[i])
			continue
		}
		let at = cache.rows[row]
		if (at === NOT_LOOKED_UP) {
			at = index.rowOf(keys[i])
			cache.rows[row] = at
		}
		out[i] = at
	}
	return out
}

const DAY_MS = 86_400_000
const dayOf = (year: number) => Math.floor(Date.UTC(year, 0, 1) / DAY_MS)

/** The Released options as day ranges; "recent" is the current year and the two before it. */
function releasedRanges(now: Date): Record<Released, DayRange | null> {
	const always = {
		from: Number.NEGATIVE_INFINITY,
		to: Number.POSITIVE_INFINITY,
	}
	const ranges: Record<Released, DayRange | null> = {
		any: null,
		recent: { from: dayOf(now.getUTCFullYear() - 2), to: always.to },
		"2010s": { from: dayOf(2010), to: dayOf(2020) },
		"2000s": { from: dayOf(2000), to: dayOf(2010) },
		before2000: { from: always.from, to: dayOf(2000) },
	}
	return Object.fromEntries(RELEASED.map((r) => [r, ranges[r]])) as Record<
		Released,
		DayRange | null
	>
}
