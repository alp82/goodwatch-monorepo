// A member's Taste tab numbers, cached in Redis for 10 minutes at `profile-taste-stats:v2:<user_id>` and cleared when
// their taste changes (markTasteChanged calls clearTasteStats), like the taste portrait's cache. A cached entry built
// before the member's latest write had settled (`taste:touched:<user_id>`) is not used. Watches don't touch the taste,
// so the numbers that read them (episodes, plate spinner) catch up within the 10 minutes.
import type { TasteStats } from "~/domain/profile-taste"
import { withBackendTimeout } from "~/utils/backend-timeout"

const VERSION = "v2"
const TTL_SECONDS = 10 * 60
const SETTLE_MS = 1_500
/** A slow Valkey must not hold the Taste tab: past this, the cache counts as a miss (reads) or is skipped (writes). */
const REDIS_TIMEOUT_MS = 800
const bounded = <T>(run: () => Promise<T>) =>
	withBackendTimeout("valkey", REDIS_TIMEOUT_MS, run)

const cacheKey = (userId: string) => `profile-taste-stats:${VERSION}:${userId}`
const touchedKey = (userId: string) => `taste:touched:${userId}`

interface StatsRedis {
	get(key: string): Promise<string | null>
	set(
		key: string,
		value: string,
		expiry: "EX",
		seconds: number,
	): Promise<unknown>
	del(key: string): Promise<number>
}

async function statsRedis(): Promise<StatsRedis | null> {
	const { getRedisCluster } = await import("~/utils/cache")
	return getRedisCluster() as unknown as StatsRedis | null
}

export async function readCachedTasteStats(
	userId: string,
): Promise<TasteStats | null> {
	try {
		const redis = await statsRedis()
		if (!redis) return null
		const [raw, touched] = await bounded(() =>
			Promise.all([redis.get(cacheKey(userId)), redis.get(touchedKey(userId))]),
		)
		if (!raw) return null
		const entry = JSON.parse(raw) as { readFrom: number; stats: TasteStats }
		if (entry.readFrom < (Number(touched) || 0) + SETTLE_MS) return null
		return entry.stats
	} catch (error) {
		console.error("Taste stats: reading the cache failed:", error)
		return null
	}
}

export async function writeCachedTasteStats(
	userId: string,
	stats: TasteStats,
	readFrom: number,
): Promise<void> {
	try {
		const redis = await statsRedis()
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
		console.error("Taste stats: writing the cache failed:", error)
	}
}

/** Drops the member's cached numbers. Never throws. */
export async function clearTasteStats(userId: string): Promise<void> {
	try {
		const redis = await statsRedis()
		if (redis) await bounded(() => redis.del(cacheKey(userId)))
	} catch (error) {
		console.error("Taste stats: clearing the cache failed:", error)
	}
}
