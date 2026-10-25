import { withBackendTimeout } from "~/utils/backend-timeout"
// A member's trope pool, cached in Redis for 10 minutes at `profile-tropes:v1:<user_id>` and cleared when
// their taste changes (markTasteChanged calls clearTropePool), like the taste portrait's cache. A cached entry built
// before the member's latest write had settled (`taste:touched:<user_id>`) is not used. Watches don't touch the taste;
// viewer Seen state is read separately on each request.
import type { TropePool } from "./tropes-model"

const VERSION = "v1"
const TTL_SECONDS = 10 * 60
const SETTLE_MS = 1_500
/** A slow Valkey must not hold the Tropes tab: past this, the cache counts as a miss (reads) or is skipped (writes). */
const REDIS_TIMEOUT_MS = 800
const bounded = <T>(run: () => Promise<T>) =>
	withBackendTimeout("valkey", REDIS_TIMEOUT_MS, run)

const cacheKey = (userId: string) => `profile-tropes:${VERSION}:${userId}`
const touchedKey = (userId: string) => `taste:touched:${userId}`

interface TropesRedis {
	get(key: string): Promise<string | null>
	set(
		key: string,
		value: string,
		expiry: "EX",
		seconds: number,
	): Promise<unknown>
	del(key: string): Promise<number>
}

async function tropesRedis(): Promise<TropesRedis | null> {
	const { getRedisCluster } = await import("~/utils/cache")
	return getRedisCluster() as unknown as TropesRedis | null
}

export async function readCachedTropePool(
	userId: string,
): Promise<TropePool | null> {
	try {
		const redis = await tropesRedis()
		if (!redis) return null
		const [raw, touched] = await bounded(() =>
			Promise.all([redis.get(cacheKey(userId)), redis.get(touchedKey(userId))]),
		)
		if (!raw) return null
		const entry = JSON.parse(raw) as { readFrom: number; stats: TropePool }
		if (entry.readFrom < (Number(touched) || 0) + SETTLE_MS) return null
		return entry.stats
	} catch (error) {
		console.error("Profile tropes: reading the cache failed:", error)
		return null
	}
}

export async function writeCachedTropePool(
	userId: string,
	stats: TropePool,
	readFrom: number,
): Promise<void> {
	try {
		const redis = await tropesRedis()
		if (redis)
			await bounded(() =>
				redis.set(
					cacheKey(userId),
					JSON.stringify({ readFrom, stats }),
					"EX",
					TTL_SECONDS,
				),
			)
	} catch (error) {
		console.error("Profile tropes: writing the cache failed:", error)
	}
}

/** Drops the member's cached trope pool. Never throws. */
export async function clearTropePool(userId: string): Promise<void> {
	try {
		const redis = await tropesRedis()
		if (redis) await bounded(() => redis.del(cacheKey(userId)))
	} catch (error) {
		console.error("Profile tropes: clearing the cache failed:", error)
	}
}
