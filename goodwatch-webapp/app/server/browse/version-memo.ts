// A small in-process memo for values computed from one version of a data set (the title snapshot, the trope members,
// an availability index): a new version empties it, and it keeps at most `limit` entries, dropping the least recently
// used. Browse uses it for counts and pair counts per snapshot, kinds (clusters) per place, and streaming numbers per
// country, so a value is computed once per version and process instead of once per request. Pure.

export interface VersionMemo<V> {
	/** The value for `key` under `version`, computing it on a miss. */
	get(version: string, key: string, compute: () => V): V
	/** Entries held now (for tests and metrics). */
	readonly size: number
}

export function createVersionMemo<V>(limit: number): VersionMemo<V> {
	let current = ""
	const entries = new Map<string, V>()
	return {
		get(version, key, compute) {
			if (version !== current) {
				entries.clear()
				current = version
			}
			if (entries.has(key)) {
				const value = entries.get(key) as V
				// Re-insert to mark it recently used.
				entries.delete(key)
				entries.set(key, value)
				return value
			}
			const value = compute()
			entries.set(key, value)
			if (entries.size > limit) entries.delete(entries.keys().next().value as string)
			return value
		},
		get size() {
			return entries.size
		},
	}
}
