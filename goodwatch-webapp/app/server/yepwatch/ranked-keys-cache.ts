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

/** Resolves on the next turn of the event loop, after pending I/O callbacks. */
export const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve))

/**
 * Builds a ranking over a large universe slice by slice, yielding to the event loop between slices, so other requests
 * run in between instead of waiting for one long synchronous pass. `rank` filters and orders one slice; it must keep or
 * drop each title by the title alone and order by `compare`, a total order, so that merging the ranked slices equals
 * ranking the whole universe at once.
 */
export async function rankInSlices(
	universe: ArrayLike<number>,
	rank: (slice: number[]) => Promise<readonly number[]>,
	compare: (a: number, b: number) => number,
	sliceSize = 8_192,
): Promise<number[]> {
	const lists: (readonly number[])[] = []
	for (let start = 0; start < universe.length; start += sliceSize) {
		const slice: number[] = []
		for (let i = start; i < Math.min(universe.length, start + sliceSize); i++) slice.push(universe[i])
		lists.push(await rank(slice))
		await yieldToEventLoop()
	}
	// k-way merge with a binary heap of list heads; ties can't happen in a total order.
	const heap: number[] = []
	const at = new Int32Array(lists.length)
	const less = (x: number, y: number) => compare(lists[x][at[x]], lists[y][at[y]]) < 0
	const down = (i: number) => {
		for (;;) {
			const l = 2 * i + 1, r = l + 1
			let m = i
			if (l < heap.length && less(heap[l], heap[m])) m = l
			if (r < heap.length && less(heap[r], heap[m])) m = r
			if (m === i) return
			;[heap[i], heap[m]] = [heap[m], heap[i]]
			i = m
		}
	}
	for (let x = 0; x < lists.length; x++) if (lists[x].length) heap.push(x)
	for (let i = (heap.length >> 1) - 1; i >= 0; i--) down(i)
	const merged: number[] = []
	while (heap.length) {
		const x = heap[0]
		merged.push(lists[x][at[x]++])
		if (at[x] >= lists[x].length) {
			heap[0] = heap[heap.length - 1]
			heap.pop()
		}
		if (heap.length) down(0)
		if ((merged.length & 32_767) === 0) await yieldToEventLoop()
	}
	return merged
}
