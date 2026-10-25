// A value requests read without ever loading it: the last one a load gave. Loads come from somewhere else (a warmup
// at server start and a timer, see `refreshIfDue`), so a request never waits for one and never starts one. One load
// runs at a time. A failed load (a rejection, which is also how a caller refuses an incomplete value) keeps the last
// value, and the next load starts no sooner than `retryMs` later.

export interface LastGood<T> {
	/** The last value, or null before the first load finishes. Never starts a load. */
	peek(): T | null
	/**
	 * Loads when the value is missing or older than `maxAgeMs`, unless a load runs or the last one failed less than
	 * `retryMs` ago. Never rejects.
	 */
	refreshIfDue(): Promise<void>
}

export function lastGood<T>(
	load: () => Promise<T>,
	{
		maxAgeMs,
		retryMs,
		now = Date.now,
	}: { maxAgeMs: number; retryMs: number; now?: () => number },
): LastGood<T> {
	let value: T | null = null
	let loadedAt = 0
	let loading: Promise<void> | null = null
	let failedAt = Number.NEGATIVE_INFINITY

	return {
		peek: () => value,
		refreshIfDue() {
			if (loading) return loading
			if (value !== null && now() - loadedAt <= maxAgeMs) return Promise.resolve()
			if (now() - failedAt < retryMs) return Promise.resolve()
			let run: Promise<T>
			try {
				run = load()
			} catch (error) {
				run = Promise.reject(error)
			}
			loading = run
				.then(
					(next) => {
						value = next
						loadedAt = now()
						failedAt = Number.NEGATIVE_INFINITY
					},
					() => {
						failedAt = now()
					},
				)
				.finally(() => {
					loading = null
				})
			return loading
		},
	}
}
