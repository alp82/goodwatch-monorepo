/**
 * A catalog read that rarely changes (the streaming service list, the country list): read once, then served from
 * memory. Callers at the same time share one read, and a failed first read isn't kept: the next caller reads again.
 *
 * Once a value is older than `ttlMs`, callers still get it at once while one new read runs in the background, and
 * its value replaces the old one when it arrives (a failed one leaves the old value, and the next caller tries
 * again). So no command ever waits for these reads after the first: the service list alone is a whole-table read of
 * about 60-70 ms in production, and every service pick, country change and new room's setup reads it.
 */
export function readEvery<T>(ttlMs: number, read: () => Promise<T>, now: () => number = Date.now): () => Promise<T> {
	/** The value answered now: a read still running (none succeeded yet), or the last value read. */
	let entry: { value: Promise<T>; at: number } | null = null
	let refreshing = false
	return () => {
		if (entry && now() - entry.at < ttlMs) return entry.value
		if (entry && entry.at >= 0) {
			// Stale: answered as it is, and read again in the background (one read at a time).
			if (!refreshing) {
				refreshing = true
				read().then(
					(value) => { entry = { value: Promise.resolve(value), at: now() } },
					() => {},
				).finally(() => { refreshing = false })
			}
			return entry.value
		}
		if (entry) return entry.value // The first read is still running.
		// The first read: `at` stays negative until it succeeds, so a caller meanwhile shares it and a failure is dropped.
		const current = { value: read(), at: -1 }
		entry = current
		current.value.then(
			() => { if (entry === current) current.at = now() },
			() => { if (entry === current) entry = null },
		)
		return current.value
	}
}
