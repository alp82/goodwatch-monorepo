import { Buffer } from "node:buffer"

export interface LocaleCacheRedis {
	mget(...keys: string[]): Promise<(string | null)[]>
	pipeline?(): {
		set(key: string, value: string, expiry: "EX", seconds: number): unknown
		exec(): Promise<unknown>
	}
	set(
		key: string,
		value: string,
		expiry: "EX",
		seconds: number,
	): Promise<unknown>
}

/** Per-entity entries reuse overlapping batches. Memory and individual Redis values have hard byte limits. */
export function createLocaleSourceCache<T>(
	redis: () => LocaleCacheRedis | null,
	{
		namespace,
		ttlSeconds = 1800,
		maxValueBytes = 64 * 1024,
		memoryBytes = 4 * 1024 * 1024,
		maxEntries = 2048,
		validate,
		deadline,
	}: {
		namespace: string
		ttlSeconds?: number
		maxValueBytes?: number
		memoryBytes?: number
		maxEntries?: number
		deadline: <R>(operation: Promise<R>) => Promise<R>
		validate: (value: unknown) => value is T
	},
) {
	const memory = new Map<string, { value: T; expires: number; bytes: number }>()
	let bytes = 0
	const drop = (key: string) => {
		const item = memory.get(key)
		if (item) {
			bytes -= item.bytes
			memory.delete(key)
		}
	}
	const remember = (key: string, value: T, size: number, expires: number) => {
		if (size > maxValueBytes || size > memoryBytes) return
		drop(key)
		while (memory.size >= maxEntries || bytes + size > memoryBytes)
			drop(memory.keys().next().value!)
		memory.set(key, {
			value,
			expires,
			bytes: size,
		})
		bytes += size
	}
	const cacheKey = (key: string, language: string) =>
		`${namespace}:{${namespace}:${language}}:${key}`
	const flights = new Map<string, Promise<T | undefined>>()
	const cache = {
		clear() {
			memory.clear()
			bytes = 0
		},
		async read(
			keys: readonly string[],
			language: string,
		): Promise<Map<string, T>> {
			const found = new Map<string, T>(),
				missing: string[] = []
			for (const key of new Set(keys)) {
				const id = cacheKey(key, language),
					entry = memory.get(id)
				if (entry && entry.expires > Date.now()) {
					drop(id)
					memory.set(id, entry)
					bytes += entry.bytes
					found.set(key, entry.value)
				} else {
					drop(id)
					missing.push(key)
				}
			}
			const client = redis()
			if (client && missing.length) {
				try {
					// The locale hash tag puts a batch in one cluster slot: exactly one bounded MGET.
					const raws = await deadline(
						client.mget(...missing.map((key) => cacheKey(key, language))),
					)
					missing.forEach((key, i) => {
						try {
							const raw = raws[i]
							if (!raw || raw.length > maxValueBytes) return
							const size = Buffer.byteLength(raw)
							if (size > maxValueBytes) return
							const stored: unknown = JSON.parse(raw)
							if (
								!stored ||
								typeof stored !== "object" ||
								!("expires" in stored) ||
								!("value" in stored)
							)
								return
							const { expires, value } = stored
							if (
								typeof expires !== "number" ||
								!Number.isFinite(expires) ||
								expires <= Date.now() ||
								expires > Date.now() + ttlSeconds * 1000 + 5000 ||
								!validate(value)
							)
								return
							remember(cacheKey(key, language), value, size, expires)
							found.set(key, value)
						} catch {
							/* Invalid values are misses. */
						}
					})
				} catch {
					/* Redis failure cannot fail canonical presentation. */
				}
			}
			return found
		},
		async write(
			entries: ReadonlyMap<string, T>,
			language: string,
		): Promise<void> {
			const client = redis()
			const writes: [string, string][] = []
			for (const [key, value] of entries) {
				const expires = Date.now() + ttlSeconds * 1000
				const raw = JSON.stringify({ expires, value }),
					size = Buffer.byteLength(raw)
				if (size > maxValueBytes) continue
				const id = cacheKey(key, language)
				remember(id, value, size, expires)
				writes.push([id, raw])
			}
			if (client && writes.length) {
				try {
					if (client.pipeline) {
						const pipeline = client.pipeline()
						for (const [id, raw] of writes)
							pipeline.set(id, raw, "EX", ttlSeconds)
						await deadline(pipeline.exec())
					} else
						await deadline(
							Promise.all(
								writes.map(([id, raw]) =>
									client.set(id, raw, "EX", ttlSeconds),
								),
							),
						)
				} catch {
					/* A failed publication leaves the bounded memory cache usable. */
				}
			}
		},
	}
	return {
		...cache,
		async load(
			keys: readonly string[],
			language: string,
			loader: (missing: string[]) => Promise<ReadonlyMap<string, T>>,
		): Promise<Map<string, T>> {
			const owners = new Map<
				string,
				{
					promise: Promise<T | undefined>
					resolve: (value: T | undefined) => void
					reject: (error: unknown) => void
				}
			>()
			const pending = [...new Set(keys)].map((key) => {
				const id = cacheKey(key, language),
					previous = flights.get(id)
				if (previous) return { key, promise: previous }
				let resolve!: (value: T | undefined) => void,
					reject!: (error: unknown) => void
				const promise = new Promise<T | undefined>((yes, no) => {
					resolve = yes
					reject = no
				})
				owners.set(key, { promise, resolve, reject })
				if (flights.size < 2048) flights.set(id, promise)
				return { key, promise }
			})
			if (owners.size)
				void (async () => {
					try {
						const found = await cache.read([...owners.keys()], language)
						const missing = [...owners.keys()].filter((key) => !found.has(key))
						if (missing.length) {
							const loaded = await loader(missing)
							await cache.write(loaded, language)
							for (const [key, value] of loaded) found.set(key, value)
						}
						for (const [key, owner] of owners) owner.resolve(found.get(key))
					} catch (error) {
						for (const owner of owners.values()) owner.reject(error)
					} finally {
						for (const [key, owner] of owners)
							if (flights.get(cacheKey(key, language)) === owner.promise)
								flights.delete(cacheKey(key, language))
					}
				})()
			const found = new Map<string, T>()
			await Promise.all(
				pending.map(async ({ key, promise }) => {
					const value = await promise
					if (value !== undefined) found.set(key, value)
				}),
			)
			return found
		},
	}
}
