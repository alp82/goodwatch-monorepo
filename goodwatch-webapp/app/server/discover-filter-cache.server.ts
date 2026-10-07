// Keeps plain guests' filter results because the scan costs about 27 ms of main-thread time per request and repeats
// for every page and every plain guest. These guests have nothing rated, hidden, or skipped and no taste: the
// server's view of any anonymous visitor. Entries last 30 minutes, like the id sets behind Similar to, cast and
// crew, and legacy filters. A new snapshot version or reloaded availability index gives new keys; old entries age
// out. The bounds are 300 entries and 3,000,000 title keys, about 24 MB. DISCOVER_FILTER_CACHE=off plus a restart
// turns it off.
import type { FilterState, SortKey } from "~/domain/filter-state"
import type { Taste } from "~/server/taste/taste.server"
import type { FilterResult } from "~/server/title-filter/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import { counter } from "./metrics/registry.server.ts"

const outcomes = counter(
	"goodwatch_discover_filter_cache_total",
	"Discover filter result cache outcomes.",
	["result"],
	10,
)

const sortedFields = (value: Record<string, unknown> | undefined) =>
	value === undefined
		? undefined
		: Object.fromEntries(
				Object.keys(value)
					.sort()
					.map((key) => [key, value[key]]),
			)

/**
 * The cache key for a viewer's browse filter result, or null when the result may not be shared: the viewer is a
 * member, has seen, skipped, or hidden titles, has taste, or their country's availability index is still loading (the
 * result is approximate then). The key holds every input filterTitles reads for such a viewer. The For you switch and
 * the page aren't in it: without taste the switch doesn't change the result, and every page reads the same entry.
 */
export function discoverFilterKey(input: {
	viewer: ViewerContext
	taste: Pick<Taste, "signal">
	state: FilterState
	sort: SortKey
	snapshotVersion: string
	availabilityLoadedAt: number | null
	ageFilter: boolean
	year: number
}): string | null {
	const { viewer, taste, state } = input
	// Members never get a key, even with empty data, because member results must never be shared.
	if (
		viewer.viewer.kind !== "guest" ||
		viewer.seen.size !== 0 ||
		viewer.skipped.size !== 0 ||
		viewer.hidden.size !== 0 ||
		taste.signal === "some" ||
		input.availabilityLoadedAt === null
	)
		return null

	// Explicit fields keep insertion order stable and make new FilterState fields fail typecheck here.
	const serialized: Record<keyof FilterState, unknown> = {
		type: state.type,
		anime: state.anime,
		onMyServices: state.onMyServices,
		services: state.services,
		notSeenYet: state.notSeenYet,
		moods: state.moods,
		genres: state.genres,
		minScore: state.minScore,
		minMatch: state.minMatch,
		released: state.released,
		similarTo: state.similarTo,
		people: state.people,
		legacy: sortedFields(state.legacy),
		ageLimit: state.ageLimit,
		content: sortedFields(state.content),
	}
	return JSON.stringify([
		input.snapshotVersion,
		viewer.country,
		input.availabilityLoadedAt,
		[...new Set(viewer.services)].sort((a, b) => a - b),
		input.ageFilter,
		input.year,
		input.sort,
		serialized,
	])
}

/**
 * A bounded store of filter results by key, with one run per key at a time. A result is shared between requests:
 * callers must not change it or its arrays and objects. Approximate results and results that For you reordered are
 * never stored.
 */
export function createFilterResultCache(
	options: {
		maxEntries?: number
		maxKeys?: number
		ttlMs?: number
		now?: () => number
		enabled?: () => boolean
	} = {},
) {
	const {
		maxEntries = 300,
		maxKeys = 3_000_000,
		ttlMs = 30 * 60_000,
		now = Date.now,
		enabled = () => process.env.DISCOVER_FILTER_CACHE !== "off",
	} = options
	const entries = new Map<string, { result: FilterResult; until: number }>()
	const flights = new Map<string, Promise<FilterResult>>()
	let keys = 0
	let hits = 0
	let misses = 0
	let uncacheable = 0
	const remove = (key: string) => {
		const entry = entries.get(key)
		if (entry) keys -= entry.result.keys.length
		entries.delete(key)
	}
	return {
		run(
			key: string | null,
			compute: () => Promise<FilterResult>,
		): Promise<FilterResult> {
			if (key === null || !enabled()) {
				uncacheable++
				outcomes.inc(["uncacheable"])
				return compute()
			}
			const entry = entries.get(key)
			if (entry && entry.until > now()) {
				hits++
				outcomes.inc(["hit"])
				entries.delete(key)
				entries.set(key, entry)
				return Promise.resolve(entry.result)
			}
			if (entry) remove(key)
			const flight = flights.get(key)
			if (flight) {
				hits++
				outcomes.inc(["hit"])
				return flight
			}
			misses++
			outcomes.inc(["miss"])
			const pending = Promise.resolve()
				.then(compute)
				.then((result) => {
					if (
						flights.get(key) === pending &&
						!result.approximate &&
						result.moved === undefined &&
						result.keys.length <= maxKeys
					) {
						entries.set(key, { result, until: now() + ttlMs })
						keys += result.keys.length
						for (const oldest of entries.keys()) {
							if (entries.size <= maxEntries && keys <= maxKeys) break
							remove(oldest)
						}
					}
					return result
				})
				.finally(() => {
					if (flights.get(key) === pending) flights.delete(key)
				})
			flights.set(key, pending)
			return pending
		},
		stats: () => ({ entries: entries.size, keys, hits, misses, uncacheable }),
		clear() {
			entries.clear()
			flights.clear()
			keys = 0
			hits = 0
			misses = 0
			uncacheable = 0
		},
	}
}

export const discoverFilterCache = createFilterResultCache()
