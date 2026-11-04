// Discover's search with read preferences (domain/search-preferences.ts), the parts that need the search index:
// - which titles a query names exactly (then the words are the title, and only the person's own filters apply);
// - which keys of the original reading's pool and the wider one are one title (the page folds them);
// - what a filter read from the words keeps out of the candidates the same reading finds without it.
// The ranking itself stays rankSearch's; nothing here reorders a pool.
import { citedYear } from "~/domain/cited-year"
import { CONCEPT_TITLE_VOTES, conceptTitles } from "../search-ranking/concept-query.server"
import type { SearchIndex } from "../search-ranking/search-index.server"
import type { SearchFilters } from "./search-filters"

const SHOW_POINT_IDS = 2_000_000_000_000
const normalize = (value: string) =>
	value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()

/**
 * The titles a query names: its whole text is a title's name (or original name), with a cited year when it has one,
 * and the title is well known (1,000 votes, or the concept bar for a query that is also a concept). Not for a query
 * the reference reader takes ("movies like X"): that names a title as a reference, not as what to find.
 */
export async function namedTitleKeys(
	index: SearchIndex,
	query: string,
	now = new Date(),
	isReference: (index: SearchIndex, text: string) => Promise<boolean> = readsReference,
): Promise<number[]> {
	const text = normalize(query)
	if (!text || (await isReference(index, text))) return []
	const adultBit = index.titleTable.flagNames.indexOf("adult")
	const cited = citedYear(text, now)
	const names = [text, ...(cited ? [normalize(cited.title)] : [])]
	const threshold = conceptTitles(index, text) ? CONCEPT_TITLE_VOTES : 1000
	const table = index.titleTable
	const out: number[] = []
	for (let row = 0; row < table.size; row++) {
		// Only a title Discover would show: not adult, with a score. Naming one that can't show relaxes nothing.
		if (table.votes[row] < threshold || Number.isNaN(table.goodwatchScores[row])) continue
		if (adultBit >= 0 && ((table.flags[row] >> adultBit) & 1) === 1) continue
		const title = normalize(table.titles[row])
		const original = normalize(table.originalTitles[row] || "")
		if (!names.some((name) => name === title || name === original)) continue
		if (cited && names[0] !== title && table.years[row] !== cited.year) continue
		out.push(table.pointIds[row])
	}
	return out
}

// Loaded on use: the reference reader brings the query parser and its word lists.
async function readsReference(index: SearchIndex, text: string) {
	const { detect } = await import("../search-ranking/references.server")
	return Boolean(detect(index, text))
}

// One identity per title: the same IMDb id, or alternate cuts of one film. Per loaded build.
const identities = new WeakMap<SearchIndex, (key: number) => string>()
function identityOf(index: SearchIndex): (key: number) => string {
	const known = identities.get(index)
	if (known) return known
	const parent = new Map<number, number>()
	const find = (key: number): number => {
		const p = parent.get(key)
		if (p === undefined || p === key) {
			if (p === undefined) parent.set(key, key)
			return key
		}
		const root = find(p)
		parent.set(key, root)
		return root
	}
	const unite = (a: number, b: number) => {
		const ra = find(a)
		const rb = find(b)
		if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb))
	}
	const firstImdb = new Map<string, number>()
	const table = index.titleTable
	for (let row = 0; row < table.size; row++) {
		const key = table.pointIds[row]
		const imdb = table.imdbIds[row]?.trim()
		if (!imdb) continue
		const first = firstImdb.get(imdb)
		if (first === undefined) {
			firstImdb.set(imdb, key)
			find(key)
		} else unite(key, first)
	}
	for (const [a, neighbours] of index.alternateCuts) for (const b of neighbours) unite(a, b)
	const identity = (key: number) => (parent.has(key) ? `t:${find(key)}` : `k:${key}`)
	identities.set(index, identity)
	return identity
}

/**
 * Where the wider pool and the original pool hold one title under different keys (an alternate cut, a second record
 * of one IMDb title): `[wider key, original key]` pairs, flattened. Only one-to-one matches. The page folds them once it
 * knows which of the two keys pass every filter (discover-preference-order.ts), so a pair never hides a title that
 * passes under one key but not the other.
 */
export function identityPairs(
	index: SearchIndex,
	wider: readonly number[],
	original: readonly number[],
): number[] {
	const identity = identityOf(index)
	const group = (keys: readonly number[]) => {
		const out = new Map<string, number[]>()
		for (const key of keys) {
			const id = identity(key)
			if (id.startsWith("k:")) continue
			const at = out.get(id) ?? []
			if (!at.includes(key)) at.push(key)
			out.set(id, at)
		}
		return out
	}
	const w = group(wider)
	const o = group(original)
	const pairs: number[] = []
	for (const [id, keys] of w) {
		const other = o.get(id)
		if (keys.length === 1 && other?.length === 1 && keys[0] !== other[0]) pairs.push(keys[0], other[0])
	}
	return pairs
}

/** A filter read from the words that the search applies itself, and that the title table can test. */
export type CountedFilter = "years" | "type" | "anime"

export function withoutFilter(filters: SearchFilters, name: CountedFilter): SearchFilters {
	const out = { ...filters }
	if (name === "years") {
		delete out.minYear
		delete out.maxYear
	} else delete out[name]
	return out
}

/** How many of a pool's titles the filter keeps out, by the title table (the same tests as filterHides). */
export function keptOut(
	index: SearchIndex,
	pool: readonly number[],
	name: CountedFilter,
	filters: SearchFilters,
): number {
	const table = index.titleTable
	const animeBit = table.flagNames.indexOf("is_anime")
	let out = 0
	for (const key of pool) {
		const row = table.rowOf.get(key)
		if (row === undefined) continue
		let passes = true
		if (name === "type" && filters.type) passes = (key >= SHOW_POINT_IDS) === (filters.type === "show")
		else if (name === "anime" && filters.anime && animeBit >= 0) {
			const anime = ((table.flags[row] >> animeBit) & 1) === 1
			passes = anime === (filters.anime === "only")
		} else if (name === "years") {
			const year = table.years[row]
			passes =
				year > 0 &&
				(filters.minYear === undefined || year >= filters.minYear) &&
				(filters.maxYear === undefined || year <= filters.maxYear)
		}
		if (!passes) out++
	}
	return out
}
