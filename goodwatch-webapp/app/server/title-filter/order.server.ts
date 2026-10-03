// The plain orders the filter sorts by, over snapshot rows, and the catalog universe in each of them. Browse filters the
// catalog on every request, so its orders are sorted once per snapshot version and reused.
import type { SortKey } from "~/domain/filter-state"
import {
	FLAG_ADULT,
	FLAG_POSTER,
	type TitleColumns,
	type TitleSnapshot,
	UNKNOWN_DAY,
	UNKNOWN_SCORE,
} from "~/server/title-snapshot/index.server"

/** The sorts that are an order of the titles' own facts. Relevance is a ranked list's order; Best match is per person. */
export type PlainSort = Exclude<SortKey, "relevance" | "match">

/** Discover's eligibility, as its SQL has it: enough votes, a poster, a release date, and not adult. */
export const MIN_VOTES = 1000

/**
 * Compares two snapshot rows in a plain order: Popular by TMDB popularity, Top rated by GoodWatch score, Newest by
 * release day, unknown values last. Ties fall back to votes, then the title key, so every order is total.
 */
export function compareRows(
	columns: TitleColumns,
	sort: PlainSort,
): (a: number, b: number) => number {
	const { popularity, scores, releaseDays, votes, pointIds } = columns
	const tieBreak = (a: number, b: number) =>
		votes[b] - votes[a] || pointIds[a] - pointIds[b]
	if (sort === "top")
		return (a, b) => {
			const sa = scores[a] === UNKNOWN_SCORE ? -1 : scores[a]
			const sb = scores[b] === UNKNOWN_SCORE ? -1 : scores[b]
			return sb - sa || tieBreak(a, b)
		}
	if (sort === "newest")
		return (a, b) => {
			const da = releaseDays[a]
			const db = releaseDays[b]
			if (da !== db) {
				if (da === UNKNOWN_DAY) return 1
				if (db === UNKNOWN_DAY) return -1
				return db - da
			}
			return tieBreak(a, b)
		}
	return (a, b) => popularity[b] - popularity[a] || tieBreak(a, b)
}

interface CatalogOrders {
	version: string
	eligible: Int32Array
	sorted: Map<PlainSort, CatalogOrder>
}

/** The catalog in one plain order: snapshot rows and their title keys. */
export interface CatalogOrder {
	rows: Int32Array
	keys: Float64Array
}

let orders: CatalogOrders | null = null

function catalogOrders(snapshot: TitleSnapshot): CatalogOrders {
	if (orders?.version === snapshot.version) return orders
	const { votes, flags, releaseDays } = snapshot.columns
	const rows: number[] = []
	for (let row = 0; row < snapshot.count; row++) {
		if (
			votes[row] >= MIN_VOTES &&
			(flags[row] & FLAG_POSTER) !== 0 &&
			(flags[row] & FLAG_ADULT) === 0 &&
			releaseDays[row] !== UNKNOWN_DAY
		)
			rows.push(row)
	}
	orders = {
		version: snapshot.version,
		eligible: Int32Array.from(rows),
		sorted: new Map(),
	}
	return orders
}

/** The catalog's eligible titles in a plain order. */
export function catalogRows(
	snapshot: TitleSnapshot,
	plain: PlainSort,
): CatalogOrder {
	const catalog = catalogOrders(snapshot)
	let sorted = catalog.sorted.get(plain)
	if (!sorted) {
		const rows = catalog.eligible
			.slice()
			.sort(compareRows(snapshot.columns, plain))
		const { pointIds } = snapshot.columns
		sorted = { rows, keys: Float64Array.from(rows, (row) => pointIds[row]) }
		catalog.sorted.set(plain, sorted)
	}
	return sorted
}

/**
 * The sort the results are in for a requested sort. Best match needs taste: without it the results are in the plain
 * default, Popular for the catalog and Relevance for a ranked list. Relevance means Popular for the catalog, which has
 * no ranking.
 */
export function sortToUse(
	sort: SortKey,
	hasTaste: boolean,
	ranked: boolean,
): SortKey {
	if (sort === "match" && hasTaste) return sort
	if (sort === "match" || sort === "relevance")
		return ranked ? "relevance" : "popular"
	return sort
}

/**
 * Best match: universe positions that are in the Top rated order, reordered by taste match, highest first, titles
 * without one last. `matches` is per universe position. Titles with the same match keep their order, so ties go by
 * GoodWatch score, then votes, then the title key.
 */
export function byMatch(
	positions: Int32Array,
	matches: Uint8Array,
): Int32Array {
	// A stable counting sort: a match is one byte.
	const starts = new Uint32Array(257)
	for (let p = 0; p < positions.length; p++)
		starts[256 - matches[positions[p]]]++
	for (let b = 1; b < starts.length; b++) starts[b] += starts[b - 1]
	const out = new Int32Array(positions.length)
	for (let p = 0; p < positions.length; p++)
		out[starts[255 - matches[positions[p]]]++] = positions[p]
	return out
}
