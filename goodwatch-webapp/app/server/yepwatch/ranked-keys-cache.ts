/**
 * Memoizes a room's base ranking (the whole title snapshot filtered and sorted by popularity).
 *
 * Building it walks and sorts every snapshot title synchronously: about 0.5 s on a fast desktop and 2.3-2.7 s on
 * the production host, during which the API answers nothing else. It depends only on the snapshot version and the
 * room's country, kinds and moods, so Start, refills and a Start retried after a concurrent write reuse it.
 * Callers get the cached array itself and must not mutate it.
 */
export function rankedKeysCache(maxEntries = 16) {
	const entries = new Map<string, Promise<readonly number[]>>()
	return function ranked(key: string, compute: () => Promise<readonly number[]>): Promise<readonly number[]> {
		const hit = entries.get(key)
		if (hit) {
			// Map order is the recency order: a hit moves to the end.
			entries.delete(key)
			entries.set(key, hit)
			return hit
		}
		const value = compute()
		entries.set(key, value)
		// A failed build isn't kept: the next room tries again.
		value.catch(() => {
			if (entries.get(key) === value) entries.delete(key)
		})
		while (entries.size > maxEntries) entries.delete(entries.keys().next().value!)
		return value
	}
}

/** The numeric title keys (movie 1e12 + id, show 2e12 + id) of `movie_<id>` / `show_<id>` ids. */
export function titleKeySet(ids: Iterable<string>): Set<number> {
	const keys = new Set<number>()
	for (const id of ids) {
		// Canonical ids only (no "007", "1e3", " 7"), below 1e12 so movie and show keys never collide.
		const match = /^(movie|show)_([1-9][0-9]{0,11})$/.exec(id)
		if (!match) continue
		const tmdbId = Number(match[2])
		if (tmdbId < 1_000_000_000_000) keys.add((match[1] === "movie" ? 1_000_000_000_000 : 2_000_000_000_000) + tmdbId)
	}
	return keys
}
