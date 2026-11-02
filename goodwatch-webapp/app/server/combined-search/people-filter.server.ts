// Explicit People filters use the same cast-or-crew membership as Discover's
// personTitles, before any retrieval depth or ranked-result limit is applied.
import { searchQuery } from "./catalog.server.ts"
import { withTitleScope, type SearchFilters } from "./search-filters.ts"

const CREDIT_LIMIT = 5000
const KEEP_MS = 30 * 60 * 1000
const MAX_PEOPLE = 128
const cache = new Map<number, { at: number; keys: string[] }>()

async function creditsOf(id: number, signal?: AbortSignal): Promise<string[]> {
	signal?.throwIfAborted()
	const hit = cache.get(id)
	if (hit && Date.now() - hit.at < KEEP_MS) {
		cache.delete(id)
		cache.set(id, hit)
		return hit.keys
	}
	const groups = await Promise.all(
		["person_appeared_in", "person_worked_on"].map((table) =>
			searchQuery<{ media_type: string; media_tmdb_id: number }>(
				`SELECT media_type, media_tmdb_id FROM ${table} WHERE person_tmdb_id = ? LIMIT ${CREDIT_LIMIT + 1}`,
				[id],
				signal,
			),
		),
	)
	signal?.throwIfAborted()
	if (groups.some((rows) => rows.length > CREDIT_LIMIT))
		throw Error("People credits exceed the search read limit")
	const keys = [
		...new Set(
			groups
				.flat()
				.filter(
					(row) =>
						(row.media_type === "movie" || row.media_type === "show") &&
						Number.isSafeInteger(row.media_tmdb_id) &&
						row.media_tmdb_id > 0,
				)
				.map((row) => `${row.media_type}:${row.media_tmdb_id}`),
		),
	]
	// Cache completed successes only. A request abort cannot cancel another
	// caller's in-flight credit read, and failed/partial reads never widen search.
	cache.delete(id)
	cache.set(id, { at: Date.now(), keys })
	while (cache.size > MAX_PEOPLE) cache.delete(cache.keys().next().value!)
	return keys
}

export async function peopleSearchFilters(
	filters: SearchFilters | undefined,
	signal?: AbortSignal,
): Promise<SearchFilters | undefined> {
	if (!filters?.people?.length) return filters
	signal?.throwIfAborted()
	const groups = await Promise.all(
		[...new Set(filters.people)].map((id) => creditsOf(id, signal)),
	)
	signal?.throwIfAborted()
	// Union within People, intersection with any independent title restriction.
	return withTitleScope(filters, groups.flat())
}
