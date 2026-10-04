// The Redis-backed data cache deduplicates target runs and serves stale catalog data during refreshes.
// Lookup and refresh outcomes are counted per cache name
// (see docs/benchmarks/viral-spike-metrics.md).
import crypto from "node:crypto"
import Redis, { type Cluster } from "ioredis"
import type { ClusterNode } from "ioredis/built/cluster"
import type { ClusterOptions } from "ioredis/built/cluster/ClusterOptions"
import {
	counter,
	durationBuckets,
	gauge,
	histogram,
} from "~/server/metrics/registry.server"

const clusterNodes: ClusterNode[] = [
	{
		host: process.env.REDIS_HOST || "",
		port: Number.parseInt(process.env.REDIS_PORT || ""),
	},
	{
		host: process.env.REDIS_HOST2 || "",
		port: Number.parseInt(process.env.REDIS_PORT || ""),
	},
	{
		host: process.env.REDIS_HOST3 || "",
		port: Number.parseInt(process.env.REDIS_PORT || ""),
	},
]
const redisOptions: ClusterOptions = {
	clusterRetryStrategy: () => {
		// Don't retry - fail immediately
		return null
	},
	dnsLookup: (address, callback) => callback(null, address),
	lazyConnect: true,
	slotsRefreshTimeout: 200, // Reduced timeout
	redisOptions: {
		connectTimeout: 300, // Very small timeout
		lazyConnect: true,
		maxLoadingRetryTime: 200, // Reduced retry time
		maxRetriesPerRequest: 0, // No retries
		offlineQueue: false,
		password: process.env.REDIS_PASS || "",
		sentinelRetryStrategy: () => {
			// Don't retry - fail immediately
			return null
		},
	},
}

type CacheRedis = {
	get(key: string): Promise<string | null>
	setex(key: string, ttl: number, value: string): Promise<unknown>
	del(key: string): Promise<number>
	info(): Promise<string>
}
let redisCluster: Cluster | null = null
export function setRedisClusterForTest(client: CacheRedis | null): void {
	// Only cache tests use this seam; production callers retain the complete Redis API.
	redisCluster = client as Cluster | null
}
const cacheRequests = counter(
	"goodwatch_data_cache_requests_total",
	"Redis cache lookup outcomes.",
	["cache", "result"],
	100,
)
const cacheDuration = histogram(
	"goodwatch_data_cache_miss_duration_seconds",
	"Time spent running the cache target.",
	["cache"],
	durationBuckets,
	100,
)
const cacheRefreshes = counter(
	"goodwatch_data_cache_refreshes_total",
	"Background cache refresh outcomes.",
	["cache", "result"],
	100,
)
const DEFAULT_MAX_STALE_MINUTES = 60
const MAX_BACKGROUND_REFRESHES = 8
const MAX_JOIN_AGE_MS = 30_000
const MAX_IN_FLIGHT = 1000
type InFlight = {
	promise: Promise<JsonData>
	startedAt: number
	background: boolean
}
const inFlight = new Map<string, InFlight>()
// Keep counting detached refreshes until they settle, even after a reset.
let backgroundRefreshes = 0
export function cacheInFlightCount(): number {
	return inFlight.size
}
gauge("goodwatch_data_cache_in_flight", "Registered cache runs.", [], () => [
	{ labels: [], value: cacheInFlightCount() },
])
export const getRedisCluster = () => redisCluster

const connectToRedisCluster = async () => {
	if (redisCluster) return null

	console.log("Connecting to Redis Cluster...")
	const cluster = new Redis.Cluster(clusterNodes, redisOptions)

	cluster.once("ready", () => {
		console.log("Connected to Redis Cluster")
		redisCluster = cluster

		// Handle errors to prevent crashes
		cluster.on("error", (err) => {
			console.error("Redis Cluster Error:", err)
			// Potentially set redisCluster to null if connection is unusable
			if (
				err.message &&
				(err.message.includes("connection") ||
					err.message.includes("timeout") ||
					err.message.includes("closed"))
			) {
				console.log("Redis connection lost, will operate without cache")
				redisCluster = null
				connectToRedisCluster()
			}
		})
	})

	cluster.once("end", () => {
		console.log("Redis connection ended")
		redisCluster = null
	})

	cluster.connect().catch((err) => {
		console.error("Redis connect error, skipping:", err)
		redisCluster = null
	})
}

connectToRedisCluster()

interface JsonObject {
	[key: string]: unknown
}

type JsonArray = JsonObject[]

type JsonData = JsonObject | JsonArray

function serializeJson(obj: JsonData): string {
	const sortedKeys = Object.keys(obj).sort()
	const sortedObj: JsonData = {}
	for (const key of sortedKeys) {
		sortedObj[key] = obj[key]
	}
	return JSON.stringify(sortedObj)
}

function generateCacheKey(data: JsonData): string {
	const serializedData = serializeJson(data)
	return crypto.createHash("sha256").update(serializedData).digest("hex")
}

export function cacheEntryKey(name: string, params: JsonData): string {
	return `cached-${name}:${generateCacheKey(params)}`
}

export function serializeCacheEntry(
	data: JsonData,
	timestamp = Date.now(),
): string {
	return JSON.stringify({ data, timestamp })
}

async function cacheSet<CacheData extends JsonData>(
	key: string,
	data: CacheData,
	ttl: number,
): Promise<boolean> {
	const redis = getRedisCluster()
	if (!redis) return false
	redis.info()

	const jsonData = serializeCacheEntry(data)

	try {
		await redis.setex(key, ttl || 1, jsonData)
		return true
	} catch (e) {
		console.log("Error while setting cache value:", e)
		return false
	}
}

async function cacheGet<CacheData extends JsonData>(
	key: string,
): Promise<{ data: CacheData; timestamp: number; length: number } | null> {
	const redis = getRedisCluster()
	if (!redis) return null

	const result = await redis.get(key)
	if (!result) return null
	// The raw length stands in for the size, so a hit never serializes the value again.
	return { ...JSON.parse(result), length: result.length }
}

async function cacheDelete(key: string): Promise<number> {
	const redis = getRedisCluster()
	if (!redis) return 0

	try {
		const result = await redis.del(key)
		return result
	} catch (e) {
		console.log("Error while deleting cache value:", e)
		return 0
	}
}

// Keys already reported as big, so a hot key warns once instead of on every hit.
const MAX_WARNED_BIG_KEYS = 500
const warnedBigKeys = new Set<string>()

function shouldWarnBig(key: string): boolean {
	if (warnedBigKeys.has(key)) return false
	if (warnedBigKeys.size >= MAX_WARNED_BIG_KEYS) {
		// Sets iterate in insertion order: drop the oldest key.
		warnedBigKeys.delete(warnedBigKeys.values().next().value as string)
	}
	warnedBigKeys.add(key)
	return true
}

export type TargetFunction<Params, Return> = (args: Params) => Promise<Return>

export interface CachedParams<Params, Return> {
	target: TargetFunction<Params, Return>
	params: Params
	name: string
	metricName?: string
	ttlMinutes: number
	// Catalog data uses the default; caches whose params or result depend on a member (user id) pass 0.
	staleMinutes?: number
}

export const cached = async <
	Params extends Partial<Record<keyof Params, unknown>>,
	Return extends JsonData,
>({
	target,
	params,
	name,
	metricName,
	ttlMinutes,
	staleMinutes = Math.min(ttlMinutes, DEFAULT_MAX_STALE_MINUTES),
}: CachedParams<Params, Return>): Promise<Return> => {
	const label = metricName ?? name
	const runTarget = async () => {
		const start = performance.now()
		try {
			return await target(params)
		} finally {
			cacheDuration.observe([label], (performance.now() - start) / 1000)
		}
	}
	if (ttlMinutes <= 0) {
		cacheRequests.inc([label, "bypass"])
		return await runTarget()
	}
	const cacheName = `cached-${name}`
	const cacheKey = cacheEntryKey(name, params)

	staleMinutes = Number.isFinite(staleMinutes) ? Math.max(0, staleMinutes) : 0
	const physicalTtl = Math.max(1, Math.round((ttlMinutes + staleMinutes) * 60))
	const startRun = (background: boolean): Promise<Return> => {
		if (inFlight.size >= MAX_IN_FLIGHT) {
			return runTarget()
		}
		// Defer execution so the entry exists before the target can settle or reset it.
		const entry: InFlight = {
			startedAt: Date.now(),
			background,
			promise: Promise.resolve().then(async () => {
				try {
					const data = await runTarget()
					let outcome = "discarded"
					if (inFlight.get(cacheKey) === entry) {
						try {
							outcome = (await cacheSet(cacheKey, data, physicalTtl))
								? "ok"
								: "error"
						} catch (error) {
							outcome = "error"
							console.error({ error })
						}
					}
					if (background) cacheRefreshes.inc([label, outcome])
					return data
				} catch (error) {
					if (background) {
						cacheRefreshes.inc([label, "error"])
						const message =
							error instanceof Error ? error.message : String(error)
						console.warn(
							`Cache refresh failed (${name}): ${message.replace(/[\r\n]+/g, " ")}`,
						)
					}
					throw error
				} finally {
					if (inFlight.get(cacheKey) === entry) inFlight.delete(cacheKey)
					if (background) backgroundRefreshes--
				}
			}),
		}
		inFlight.set(cacheKey, entry)
		if (background) backgroundRefreshes++
		// Background failures must be handled even when no caller joins the run.
		entry.promise.catch(() => {})
		return entry.promise as Promise<Return>
	}

	let result = getRedisCluster() ? "miss" : "unavailable"
	try {
		const cachedResult = await cacheGet<Return>(cacheKey)
		if (cachedResult) {
			const { timestamp, data, length } = cachedResult
			const age = Date.now() - timestamp
			if (age < 60_000 * ttlMinutes) {
				const sizeKB = Math.round(length / 1024)
				if (sizeKB >= 500 && shouldWarnBig(cacheKey)) {
					const size =
						sizeKB < 1000 ? `${sizeKB} KB` : `${(sizeKB / 1024).toFixed(2)} MB`
					console.warn("cached (big)", { cacheName, size, params })
				}
				cacheRequests.inc([label, "hit"])
				return data
			}
			if (staleMinutes > 0 && age < (ttlMinutes + staleMinutes) * 60_000) {
				cacheRequests.inc([label, "stale"])
				if (
					!inFlight.has(cacheKey) &&
					inFlight.size < MAX_IN_FLIGHT &&
					backgroundRefreshes < MAX_BACKGROUND_REFRESHES
				)
					startRun(true)
				return data
			}
		}
	} catch (error) {
		result = "error"
		console.log("Cache get failed, continuing with target function", error)
	}
	const existing = inFlight.get(cacheKey)
	if (existing && Date.now() - existing.startedAt < MAX_JOIN_AGE_MS) {
		cacheRequests.inc([label, "joined"])
		const data = await existing.promise
		try {
			return structuredClone(data) as Return
		} catch {
			return data as Return
		}
	}
	cacheRequests.inc([label, result])
	return await startRun(false)
}

export interface ResetCacheParams {
	params: JsonData
	name: string
}

export const resetCache = async ({
	params,
	name,
}: ResetCacheParams): Promise<number> => {
	const key = cacheEntryKey(name, params)
	inFlight.delete(key)
	return await cacheDelete(key)
}
