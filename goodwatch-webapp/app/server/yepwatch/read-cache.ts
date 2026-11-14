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

/**
 * Catalog reads kept per key (a title's offer evidence in a country, a show's episodes, a title's extras) in this
 * process for at most `ttlMs` after they were read, the least recently used dropped beyond `maxEntries`.
 *
 * `many(keys, load)` answers every key it has a fresh value for, waits for keys another caller is reading already,
 * and reads the rest with one `load` call. `load` answers the keys it read; a key it leaves out is answered without
 * a value, and a `load` that fails fails every caller waiting for it. Neither is kept: the next caller reads again.
 * A value `keep` refuses (a partial or empty answer) is answered to the callers of that read only.
 *
 * Why in this process (not Valkey): there is one API instance; the rooms Valkey never evicts and must keep its memory
 * for live rooms, and the shared GoodWatch Valkey is read-only for this API (proposal-release-catalog-env.ts).
 */
export class KeyedReads<V> {
	private entries = new Map<string, { value: V; at: number }>()
	private reading = new Map<string, Promise<{ value: V } | null>>()
	private ttlMs: number
	private maxEntries: number
	private keep: (value: V) => boolean
	private now: () => number
	constructor(ttlMs: number, maxEntries: number, keep: (value: V) => boolean = () => true, now: () => number = Date.now) {
		this.ttlMs = ttlMs
		this.maxEntries = maxEntries
		this.keep = keep
		this.now = now
	}
	async many(keys: readonly string[], load: (missing: string[]) => Promise<ReadonlyMap<string, V>>): Promise<Map<string, V>> {
		const found = new Map<string, V>()
		const waits: [string, Promise<{ value: V } | null>][] = []
		const missing: string[] = []
		const now = this.now()
		for (const key of new Set(keys)) {
			const entry = this.entries.get(key)
			if (entry && now - entry.at < this.ttlMs) {
				// Map order is the recency order: a hit moves to the end.
				this.entries.delete(key)
				this.entries.set(key, entry)
				found.set(key, entry.value)
				continue
			}
			if (entry) this.entries.delete(key)
			const pending = this.reading.get(key)
			if (pending) waits.push([key, pending])
			else missing.push(key)
		}
		if (missing.length) {
			// A value's age counts from when its read started: it is never older than ttlMs when answered.
			const started = now
			const read = Promise.resolve().then(() => load(missing))
			for (const key of missing) {
				const one = read.then((values) => (values.has(key) ? { value: values.get(key)! } : null))
				this.reading.set(key, one)
				waits.push([key, one])
				one.then(
					(answer) => {
						if (this.reading.get(key) === one) this.reading.delete(key)
						if (answer && this.keep(answer.value)) this.set(key, answer.value, started)
					},
					() => {
						if (this.reading.get(key) === one) this.reading.delete(key)
					},
				)
			}
		}
		for (const [key, wait] of waits) {
			const answer = await wait
			if (answer) found.set(key, answer.value)
		}
		return found
	}
	/** Starts reading `keys` that aren't kept or being read (a later `many` waits for them); never throws. */
	warm(keys: readonly string[], load: (missing: string[]) => Promise<ReadonlyMap<string, V>>): void {
		void this.many(keys, load).catch(() => {})
	}
	get size() {
		return this.entries.size
	}
	private set(key: string, value: V, at: number) {
		this.entries.delete(key)
		this.entries.set(key, { value, at })
		while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!)
	}
}
