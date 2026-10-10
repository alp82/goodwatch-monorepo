// How long each of some movies runs, for "How long?" on My movies (#385). The title snapshot holds no runtime, so
// they are read from Crate by primary key and kept in memory for 6 hours: a runtime is public and rarely changes.
// Only movies not kept yet are read, and only once a person has chosen a time.
import { query } from "~/utils/crate"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"

const KEEP_MS = 6 * 60 * 60 * 1000
const MAX_KEPT = 100_000
const BATCH = 500
const kept = new Map<TitleKey, { at: number; minutes: number | null }>()

/** Minutes per movie key; null for a movie without a known runtime. Keys of shows are left out. */
export async function movieRuntimes(
	keys: Iterable<TitleKey>,
): Promise<Map<TitleKey, number | null>> {
	const now = Date.now()
	const found = new Map<TitleKey, number | null>()
	const toRead: number[] = []
	for (const key of keys) {
		const { mediaType, tmdbId } = parseTitleKey(key)
		if (mediaType !== "movie") continue
		const entry = kept.get(key)
		if (entry && now - entry.at < KEEP_MS) found.set(key, entry.minutes)
		else toRead.push(tmdbId)
	}
	for (let i = 0; i < toRead.length; i += BATCH) {
		const batch = toRead.slice(i, i + BATCH)
		const rows = await query<{ tmdb_id: number; runtime: number | null }>(
			`SELECT tmdb_id, runtime FROM movie WHERE tmdb_id IN (${batch.map(() => "?").join(", ")})`,
			batch,
		)
		const read = new Map(rows.map((row) => [Number(row.tmdb_id), row.runtime]))
		for (const id of batch) {
			const key = titleKey("movie", id)
			const minutes = read.get(id) || null
			kept.set(key, { at: now, minutes })
			found.set(key, minutes)
		}
	}
	if (kept.size > MAX_KEPT) kept.clear()
	return found
}
