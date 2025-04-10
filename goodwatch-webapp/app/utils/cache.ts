import crypto from "node:crypto"
import Redis, { type Cluster } from "ioredis"
import type { ClusterNode } from "ioredis/built/cluster"
import type { ClusterOptions } from "ioredis/built/cluster/ClusterOptions"

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

let redisCluster: Cluster | null = null
let isConnecting = false

const connectToRedisCluster = async () => {
	// Don't try to connect if already connecting or connected
	if (isConnecting || redisCluster) return null

	isConnecting = true
	return new Promise<Cluster | null>((resolve) => {
		try {
			console.log("Connecting to Redis Cluster...")
			const cluster = new Redis.Cluster(clusterNodes, redisOptions)

			// Set a connection timeout to fail fast
			const connectionTimeout = setTimeout(() => {
				console.log("Redis connection timed out, moving on without cache")
				isConnecting = false
				resolve(null)
				try {
					cluster.disconnect(false)
				} catch (e) {
					// Ignore disconnect errors
				}
			}, 500) // 500ms timeout for connection

			cluster.once("ready", () => {
				console.log("Connected to Redis Cluster")
				clearTimeout(connectionTimeout)
				redisCluster = cluster
				isConnecting = false

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

				resolve(cluster)
			})

			// Handle connection failures
			cluster.once("end", () => {
				clearTimeout(connectionTimeout)
				console.log("Redis connection ended")
				redisCluster = null
				isConnecting = false
				resolve(null)
			})

			// Attempt connection
			cluster.connect().catch((err) => {
				clearTimeout(connectionTimeout)
				console.error("Redis connect error, skipping:", err)
				redisCluster = null
				isConnecting = false
				resolve(null)
			})
		} catch (err) {
			console.error("Failed to initialize Redis Cluster:", err)
			isConnecting = false
			resolve(null)
		}
	})
}

// Connect to redis optionally
connectToRedisCluster()

const getRedisCluster = () => redisCluster

interface JsonData {
	[key: string]: unknown
}

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

async function cacheSet<CacheData extends JsonData>(
	namespace: string,
	key: string,
	data: CacheData,
	ttl: number,
): Promise<void> {
	const redis = getRedisCluster()
	if (!redis) return

	const namespaceKey = `${namespace}:${key}`
	const timestamp = Date.now()
	const jsonData = JSON.stringify({
		data,
		timestamp,
	})

	try {
		await Promise.race([
			redis.setex(namespaceKey, ttl || 1, jsonData),
			new Promise<void>((_, reject) =>
				setTimeout(() => reject(new Error("Cache set timeout")), 300),
			),
		])
	} catch (e) {
		console.log("Error while setting cache value:", e)
	}
}

async function cacheGet<CacheData extends JsonData>(
	namespace: string,
	key: string,
): Promise<{ data: CacheData; timestamp: number } | null> {
	const redis = getRedisCluster()
	if (!redis) return null

	const namespaceKey = `${namespace}:${key}`

	try {
		const result = await Promise.race([
			redis.get(namespaceKey),
			new Promise<string | null>((_, reject) =>
				setTimeout(() => reject(new Error("Cache get timeout")), 300),
			),
		])
		return result ? JSON.parse(result) : null
	} catch (e) {
		console.log("Error while getting cache value:", e)
		return null
	}
}

async function cacheDelete(namespace: string, key: string): Promise<number> {
	const redis = getRedisCluster()
	if (!redis) return 0

	const namespaceKey = `${namespace}:${key}`
	try {
		const result = await Promise.race([
			redis.del(namespaceKey),
			new Promise<number>((_, reject) =>
				setTimeout(() => reject(new Error("Cache delete timeout")), 300),
			),
		])
		return result
	} catch (e) {
		console.log("Error while deleting cache value:", e)
		return 0
	}
}

export type TargetFunction<Params, Return> = (args: Params) => Promise<Return>

export interface CachedParams<Params, Return> {
	target: TargetFunction<Params, Return>
	params: Params
	name: string
	ttlMinutes: number
}

export const cached = async <
	Params extends Partial<Record<keyof Params, unknown>>,
	Return extends JsonData,
>({
	target,
	params,
	name,
	ttlMinutes,
}: CachedParams<Params, Return>): Promise<Return> => {
	const cacheName = `cached-${name}`
	const cacheKey = generateCacheKey(params)

	// check cache for existing entries within TTL
	try {
		const cachedResult = await cacheGet<Return>(cacheName, cacheKey)
		if (cachedResult) {
			const { timestamp, data } = cachedResult
			if (Date.now() - timestamp < 1000 * 60 * ttlMinutes) {
				const sizeKB = Math.round(
					Buffer.byteLength(JSON.stringify(data)) / 1024,
				)
				const size =
					sizeKB < 1000 ? `${sizeKB} KB` : `${(sizeKB / 1024).toFixed(2)} MB`
				if (sizeKB >= 300) {
					console.warn("cached (big)", { cacheName, size, params })
				} else {
					console.info("cached", { cacheName, params })
				}
				return data as Return
			}
		}
	} catch (error) {
		console.log("Cache get failed, continuing with target function", error)
	}

	// fetch data if no cache hit
	const results = await target(params)

	// update cache
	try {
		await cacheSet<Return>(cacheName, cacheKey, results, ttlMinutes * 60)
	} catch (error) {
		console.error({ error })
	}

	return results
}

export interface ResetCacheParams {
	params: JsonData
	name: string
}

export const resetCache = async ({
	params,
	name,
}: ResetCacheParams): Promise<number> => {
	const cacheName = `cached-${name}`
	const cacheKey = generateCacheKey(params)
	return await cacheDelete(cacheName, cacheKey)
}
