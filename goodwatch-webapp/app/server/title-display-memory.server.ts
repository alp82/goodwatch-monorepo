// Keeps display fields in memory to avoid 40 Redis reads and 40 JSON.parse calls per page of cards. These fields
// are the same for everyone and already allowed to be 6 hours old. Keeps up to 10,000 titles, about 6 MB, for
// 10 minutes. Values are shared between requests and must not be changed.
export function createDisplayMemory<V>(
	options: {
		max?: number
		ttlMs?: number
		now?: () => number
	} = {},
) {
	const { max = 10_000, ttlMs = 10 * 60_000, now = Date.now } = options
	const entries = new Map<number, { value: V; until: number }>()
	return {
		get(key: number): V | undefined {
			const entry = entries.get(key)
			if (!entry) return undefined
			entries.delete(key)
			if (entry.until <= now()) return undefined
			entries.set(key, entry)
			return entry.value
		},
		set(key: number, value: V): void {
			entries.delete(key)
			entries.set(key, { value, until: now() + ttlMs })
			for (const oldest of entries.keys()) {
				if (entries.size <= max) break
				entries.delete(oldest)
			}
		},
		size: () => entries.size,
		clear: () => entries.clear(),
	}
}
