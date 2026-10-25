// A value a request reads without waiting: the last one a load gave, refreshed in the background when it is older
// than `maxAgeMs` or missing. A request never waits for a load; while none has finished, it reads null. One load runs
// at a time, and after a failed one the next starts no sooner than `retryMs` later. A failed load keeps the last value.

export interface LastGood<T> {
	/** The last value, or null before the first load finishes. Starts a refresh when the value is old or missing. */
	read(): T | null
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
	let loading = false
	let failedAt = Number.NEGATIVE_INFINITY

	const refresh = () => {
		if (loading || now() - failedAt < retryMs) return
		loading = true
		let run: Promise<T>
		try {
			run = load()
		} catch (error) {
			run = Promise.reject(error)
		}
		run
			.then(
				(next) => {
					value = next
					loadedAt = now()
				},
				() => {
					failedAt = now()
				},
			)
			.finally(() => {
				loading = false
			})
	}

	return {
		read() {
			if (value === null || now() - loadedAt > maxAgeMs) refresh()
			return value
		},
	}
}
