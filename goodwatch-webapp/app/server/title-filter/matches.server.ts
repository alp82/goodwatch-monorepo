// Taste match per title of a universe, for the taste match filter, the Best match sort, and For you in browse mode,
// which all need it for every title on every request. Asking the taste costs about 20 ms over the catalog, so the
// answers are kept per snapshot row, per taste vector and snapshot version, for 10 minutes: only a person's first
// request after their taste changed pays for the catalog. A member's taste is decoded anew on every request, so the
// entry goes by the vector's values, not by the array.
import type { Taste } from "~/server/taste/index.server"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"

const KEEP_MS = 10 * 60_000
// One entry is a byte per snapshot title (about 240 KB).
const MAX_KEPT = 64
const NOT_ASKED = 255
/** A title without a taste match (no fingerprint, or not in the snapshot). */
export const NO_MATCH = 0

const kept = new Map<string, { until: number; byRow: Uint8Array }>()

function matchesByRow(snapshot: TitleSnapshot, vector: Float32Array) {
	const id = `${snapshot.version}:${Buffer.from(
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
			byRow: new Uint8Array(snapshot.count).fill(NOT_ASKED),
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
 * The taste match (50 to 99) of each universe title, NO_MATCH for a title without one. `rows` and `keys` are the
 * universe's snapshot rows (-1 for a title the snapshot doesn't hold) and title keys. The taste must have a vector.
 */
export function universeMatches(
	snapshot: TitleSnapshot,
	taste: Taste,
	rows: Int32Array,
	keys: Float64Array,
): Uint8Array {
	const out = new Uint8Array(rows.length)
	if (!taste.vector) return out
	const byRow = matchesByRow(snapshot, taste.vector)
	const unasked: number[] = []
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]
		// A title the snapshot doesn't hold has no fingerprint, so no match.
		if (row < 0) continue
		if (byRow[row] === NOT_ASKED) unasked.push(i)
		else out[i] = byRow[row]
	}
	if (unasked.length) {
		const asked = taste.match(unasked.map((i) => keys[i]))
		for (let u = 0; u < unasked.length; u++) {
			const i = unasked[u]
			out[i] = byRow[rows[i]] = asked[u] ?? NO_MATCH
		}
	}
	return out
}
