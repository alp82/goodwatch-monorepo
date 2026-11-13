export const INDEX_TTL_MS = 3_600_000

/**
 * One shared generation per process. Cold reads return pending; stale reads retain the last complete index. A build
 * returns its generation with the time it was built, which is earlier for a stored copy; it expires an hour after that.
 */
export function sharedIndex<T>(
	build: () => Promise<{ value: T; builtAt: number }>,
	now = Date.now,
	onError: (error: unknown) => void = () => {},
	random = Math.random,
) {
	let current: { value: T; version: number } | undefined
	let expires = 0
	let retryAt = 0
	let failures = 0
	let pending: Promise<void> | undefined
	return () => {
		if (now() >= expires && now() >= retryAt && !pending) {
			pending = build()
				.then(({ value, builtAt }) => {
					current = { value, version: builtAt }
					failures = 0
					retryAt = 0
					expires = builtAt + INDEX_TTL_MS
				})
				.catch((error) => {
					const delay = Math.min(900_000, 30_000 * 2 ** Math.min(failures++, 5))
					retryAt = now() + delay * (1 + 0.25 * random())
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

/** Schedule once per loaded process module; unref lets scripts and tests exit normally. */
export function warmIndex(
	read: () => unknown,
	role: string,
	schedule = (task: () => void, delay: number) => setTimeout(task, delay),
) {
	if (role === "search") return
	const timer = schedule(() => {
		read()
	}, 30_000)
	timer.unref()
}
