// Taste per title of a universe, for the taste match filter, the Best match sort, and For you in browse mode, which
// all need it for every title on every request: the match shown (what the filter goes by) and the percentile behind it
// (what the two orders go by). Asking the taste costs about 20 ms over the catalog, so the answers are kept per
// snapshot row, per taste and snapshot version, for 10 minutes: only a person's first request after their taste
// changed pays for the catalog. A member's taste is decoded anew on every request, so the entry goes by the vector's
// values (and the liked count, which the match shown depends on), not by the array.
import type { Taste } from "~/server/taste/index.server"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"

const KEEP_MS = 10 * 60_000
// One entry is 5 bytes per snapshot title (about 1.2 MB).
const MAX_KEPT = 64
const NOT_ASKED = 255
/** A title without a taste match (no fingerprint, or not in the snapshot). */
export const NO_MATCH = 0
/** The percentile of a title without a taste match. */
export const NO_RANK = -1

interface ByRow {
	matches: Uint8Array
	percentiles: Float32Array
}

/** Per universe title: the taste match shown (50 to 99, or NO_MATCH) and its percentile (0 to 100, or NO_RANK). */
export interface UniverseTaste {
	matches: Uint8Array
	percentiles: Float32Array
}

const kept = new Map<string, { until: number; byRow: ByRow }>()

function tasteByRow(
	snapshot: TitleSnapshot,
	vector: Float32Array,
	liked: number,
): ByRow {
	const id = `${snapshot.version}:${liked}:${Buffer.from(
		vector.buffer,
		vector.byteOffset,
		vector.byteLength,
	).toString("base64")}`
	const now = Date.now()
	let entry = kept.get(id)
	kept.delete(id)
	if (!entry || entry.until <= now)
		entry = {
			until: 0,
			byRow: {
				matches: new Uint8Array(snapshot.count).fill(NOT_ASKED),
				percentiles: new Float32Array(snapshot.count),
			},
		}
	entry.until = now + KEEP_MS
	kept.set(id, entry)
	// Drop expired entries, and the least recently used beyond the cap (a Map iterates in insertion order).
	for (const [key, other] of kept) {
		if (other.until > now && kept.size <= MAX_KEPT) break
		kept.delete(key)
	}
	return entry.byRow
}

/**
 * The taste match and percentile of each universe title. `rows` and `keys` are the universe's snapshot rows (-1 for a
 * title the snapshot doesn't hold) and title keys. The taste must have a vector.
 */
export function universeTaste(
	snapshot: TitleSnapshot,
	taste: Taste,
	rows: Int32Array,
	keys: Float64Array,
): UniverseTaste {
	const matches = new Uint8Array(rows.length)
	const percentiles = new Float32Array(rows.length).fill(NO_RANK)
	if (!taste.vector) return { matches, percentiles }
	const byRow = tasteByRow(snapshot, taste.vector, taste.liked)
	const unasked: number[] = []
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]
		// A title the snapshot doesn't hold has no fingerprint, so no match.
		if (row < 0) continue
		if (byRow.matches[row] === NOT_ASKED) unasked.push(i)
		else {
			matches[i] = byRow.matches[row]
			percentiles[i] = byRow.percentiles[row]
		}
	}
	if (unasked.length) {
		const asked = unasked.map((i) => keys[i])
		const askedMatches = taste.match(asked)
		const askedPercentiles = taste.percentile(asked)
		for (let u = 0; u < unasked.length; u++) {
			const i = unasked[u]
			const row = rows[i]
			matches[i] = byRow.matches[row] = askedMatches[u] ?? NO_MATCH
			percentiles[i] = byRow.percentiles[row] = askedPercentiles[u] ?? NO_RANK
		}
	}
	return { matches, percentiles }
}
