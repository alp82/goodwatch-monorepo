/**
 * A catalog read that rarely changes (the streaming service list, the country list), read at most once per `ttlMs`.
 * Callers at the same time share one read, and a failed read isn't kept: the next caller reads again.
 *
 * The service list is a whole-table read of about 60-70 ms in production. Every service pick and country change
 * validates against it and every room screen asks for it, so without this a friend's pick (and a Start queued behind
 * it) waited for that read each time.
 */
export function readEvery<T>(ttlMs: number, read: () => Promise<T>, now: () => number = Date.now): () => Promise<T> {
	let entry: { value: Promise<T>; at: number } | null = null
	return () => {
		if (entry && now() - entry.at < ttlMs) return entry.value
		const current = { value: read(), at: now() }
		entry = current
		current.value.catch(() => {
			if (entry === current) entry = null
		})
		return current.value
	}
}
