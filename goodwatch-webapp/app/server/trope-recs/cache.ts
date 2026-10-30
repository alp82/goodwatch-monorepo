/** One shared generation per process. Cold reads return pending; stale reads retain the last complete index. */
export function sharedIndex<T>(
	build: () => Promise<T>,
	now = Date.now,
	onError: (error: unknown) => void = () => {},
) {
	let current: { value: T; version: number } | undefined
	let expires = 0
	let retryAt = 0
	let pending: Promise<void> | undefined
	return () => {
		if (now() >= expires && now() >= retryAt && !pending) {
			pending = build()
				.then((value) => {
					current = { value, version: now() }
					expires = now() + 3_600_000
				})
				.catch((error) => {
					retryAt = now() + 30_000
					onError(error)
				})
				.finally(() => {
					pending = undefined
				})
		}
		return { current, pending: !!pending }
	}
}

/** Bounded short-lived member results. Keys include member inputs and both shared/profile generations. */
export function resultCache<T>(now = Date.now) {
	const entries = new Map<string, { value: T; expires: number }>()
	return {
		get(key: string) {
			const entry = entries.get(key)
			if (!entry || entry.expires <= now()) {
				entries.delete(key)
				return undefined
			}
			return entry.value
		},
		set(key: string, value: T) {
			for (const [id, entry] of entries)
				if (entry.expires <= now()) entries.delete(id)
			entries.delete(key)
			if (entries.size >= 128) entries.delete(entries.keys().next().value!)
			entries.set(key, { value, expires: now() + 15_000 })
			return value
		},
	}
}
