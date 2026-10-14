import { Buffer } from "node:buffer"

export interface LocaleCacheRedis {
	get(key: string): Promise<string | null>
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
	}: {
		namespace: string
		ttlSeconds?: number
		maxValueBytes?: number
		memoryBytes?: number
		maxEntries?: number
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
		`${namespace}:${language}:${key}`
	return {
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
			if (client)
				await Promise.all(
					missing.map(async (key) => {
						try {
							// Cluster keys have independent slots; concurrent GETs avoid an invalid cross-slot MGET.
							const id = cacheKey(key, language),
								raw = await client.get(id)
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
							remember(id, value, size, expires)
							found.set(key, value)
						} catch {
							/* A source-cache miss must not fail the canonical page. */
						}
					}),
				)
			return found
		},
		async write(
			entries: ReadonlyMap<string, T>,
			language: string,
		): Promise<void> {
			const client = redis()
			await Promise.all(
				[...entries].map(async ([key, value]) => {
					const expires = Date.now() + ttlSeconds * 1000
					const raw = JSON.stringify({ expires, value }),
						size = Buffer.byteLength(raw)
					if (size > maxValueBytes) return
					const id = cacheKey(key, language)
					remember(id, value, size, expires)
					try {
						await client?.set(id, raw, "EX", ttlSeconds)
					} catch {
						/* Source reads still succeed. */
					}
				}),
			)
		},
	}
}
