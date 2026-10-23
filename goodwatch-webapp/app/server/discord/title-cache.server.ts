// The guest read behind a title card, kept in Valkey for five minutes per title and place, so repeat views and the
// stream redirect skip the catalog reads. Only guest reads come here: a member's own read never crosses users.
import { createHash } from "node:crypto"

export const TITLE_CACHE_SECONDS = 300

export interface CacheStore {
	get(key: string): Promise<string | null>
	set(key: string, value: string, ttlSeconds: number): Promise<void>
}

export interface TitlePlace {
	country: string
	services?: number[]
}

/** One key per title, country, and service set; the service set is hashed so long lists keep keys short. */
export function titleCacheKey(id: string, place: TitlePlace) {
	const services = [...new Set(place.services ?? [])].sort((a, b) => a - b)
	const scope = services.length
		? createHash("sha1").update(services.join(",")).digest("hex").slice(0, 16)
		: "all"
	return `discord:title:v1:${id}:${place.country.toUpperCase()}:${scope}`
}

/** Valkey with the shared command deadline, or null when this process has no Valkey (tests, local runs). */
export async function valkeyTitleStore(): Promise<CacheStore | null> {
	if (!process.env.REDIS_HOST) return null
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../utils/cache"
	)
	const redis = getRedisCluster()
	if (!redis) return null
	return {
		get: (key) => withRedisDeadline(redis.get(key)),
		set: async (key, value, ttl) => {
			await withRedisDeadline(redis.set(key, value, "EX", ttl))
		},
	}
}

/**
 * The cached read for the title and place, or a fresh one that is stored when it found the title. A failing or slow
 * store never fails the read.
 */
export async function cachedTitleRead(
	id: string,
	place: TitlePlace,
	read: () => Promise<Record<string, unknown>>,
	store: CacheStore | null,
): Promise<Record<string, unknown>> {
	const key = titleCacheKey(id, place)
	if (store) {
		const hit = await store.get(key).catch(() => null)
		if (hit) {
			try {
				const parsed = JSON.parse(hit) as Record<string, unknown>
				if (parsed?.title) return parsed
			} catch {
				/* A corrupt entry is replaced below. */
			}
		}
	}
	const result = await read()
	// The write runs after the answer; the card doesn't wait for it.
	if (store && result.title)
		void store
			.set(key, JSON.stringify(result), TITLE_CACHE_SECONDS)
			.catch(() => {})
	return result
}
