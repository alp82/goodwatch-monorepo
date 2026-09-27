// Members' portraits, cached in Redis per person and tab for 10 minutes at `taste-portrait:v2:<user_id>:<tab>`, and
// cleared when their taste changes (markTasteChanged calls clearTastePortrait).
//
// A cached view is used only when it was built after the person's latest write had settled: Crate shows a write to
// non-key reads only after its refresh, so a view built right after a write may have missed it. The write time is the
// taste module's `taste:touched:<user_id>`.
//
// TASTE_REDIS_URL points the cache at a single Redis (for development and scripts), as it does for the taste store;
// without it, it uses the webapp's Redis cluster. Without a Redis connection, nothing is cached.
import Redis from "ioredis"
import { PORTRAIT_TABS, type PortraitTab, type PortraitView } from "./view"

// Bump when a view's shape or computation changes, so cached views of the old kind are never read.
const CACHE_VERSION = "v2"
const TTL_SECONDS = 10 * 60
const SETTLE_MS = 1_500

const cacheKey = (userId: string, tab: PortraitTab) =>
	`taste-portrait:${CACHE_VERSION}:${userId}:${tab}`
const touchedKey = (userId: string) => `taste:touched:${userId}`

interface PortraitRedis {
	get(key: string): Promise<string | null>
	set(
		key: string,
		value: string,
		expiry: "EX",
		seconds: number,
	): Promise<unknown>
	del(key: string): Promise<number>
}

let singleRedis: Redis | undefined

async function portraitRedis(): Promise<PortraitRedis | null> {
	const url = process.env.TASTE_REDIS_URL
	if (url) {
		singleRedis ??= new Redis(url, { maxRetriesPerRequest: 1 })
		return singleRedis
	}
	const { getRedisCluster } = await import("~/utils/cache")
	return getRedisCluster()
}

interface Entry {
	/** When the build started reading the person's rows (ms since 1970). */
	readFrom: number
	view: PortraitView
}

/** The cached view, or null when there is none or it may predate the person's latest write. */
export async function readCachedPortrait(
	userId: string,
	tab: PortraitTab,
): Promise<PortraitView | null> {
	const redis = await portraitRedis()
	if (!redis) return null
	try {
		const [raw, touched] = await Promise.all([
			redis.get(cacheKey(userId, tab)),
			redis.get(touchedKey(userId)),
		])
		if (!raw) return null
		const entry = JSON.parse(raw) as Entry
		if (entry.readFrom < (Number(touched) || 0) + SETTLE_MS) return null
		return entry.view
	} catch (error) {
		console.error("Taste portrait: reading the cache failed:", error)
		return null
	}
}

export async function writeCachedPortrait(
	userId: string,
	view: PortraitView,
	readFrom: number,
	ttlSeconds = TTL_SECONDS,
): Promise<void> {
	const redis = await portraitRedis()
	if (!redis) return
	try {
		const entry: Entry = { readFrom, view }
		await redis.set(
			cacheKey(userId, view.tab),
			JSON.stringify(entry),
			"EX",
			ttlSeconds,
		)
	} catch (error) {
		console.error("Taste portrait: writing the cache failed:", error)
	}
}

/** Drops the person's cached views, one key per tab (the keys sit on different cluster slots). Never throws. */
export async function clearTastePortrait(userId: string): Promise<void> {
	try {
		const redis = await portraitRedis()
		if (!redis) return
		await Promise.all(
			PORTRAIT_TABS.map((tab) => redis.del(cacheKey(userId, tab))),
		)
	} catch (error) {
		console.error("Taste portrait: clearing the cache failed:", error)
	}
}

/** Closes the development Redis connection (for scripts). */
export function stopTastePortraitCache(): void {
	singleRedis?.disconnect()
	singleRedis = undefined
}
