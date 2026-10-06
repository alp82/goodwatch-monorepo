// The Redis-backed data cache deduplicates target runs and serves stale catalog data during refreshes.
// Lookup and refresh outcomes are counted per cache name
// (see docs/benchmarks/viral-spike-metrics.md).
import crypto from "node:crypto"
import Redis, { type Cluster, Command } from "ioredis"
import type { ClusterNode } from "ioredis/built/cluster"
import type { ClusterOptions } from "ioredis/built/cluster/ClusterOptions"
import { onShutdown } from "~/server/lifecycle.server"
import {
	counter,
	durationBuckets,
	gauge,
	histogram,
} from "~/server/metrics/registry.server"

import { RedisNodeDownError, createRedisBreakers } from "./redis-breaker"

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
// Redis answers in 30 to 40 microseconds; values reach about 1 MB (snapshot chunks 4 MB).
// Only a stalled event loop or Redis reaches this limit. Routine event loop stalls are
// 100 to 330 ms about once a minute; this is three times the largest routine stall.
// Startup stalls reach 2.4 s; a lookup cut there falls through to the target.
export const REDIS_COMMAND_TIMEOUT_MS = 1000

// The guard bounds commands across the cluster queue and redirection loop. A node's
// first failure opens its breaker; later commands bypass it while detached probes
// check recovery. Node commandTimeout also bounds individual connection attempts.
// Keep the offline queue for nodes connecting on demand. ioredis ends a closed
// cluster instead of reconnecting it; our lifecycle disconnects it before replacing
// it, with a 1-second exponential backoff capped at 30 seconds.
export const cacheScripts = {
	gwCacheStore: {
		numberOfKeys: 2,
		lua: "local m = redis.call('GET', KEYS[2]); if (m or '') ~= ARGV[1] then return 0 end; redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[2]); return 1",
	},
	gwCacheReset: {
		numberOfKeys: 2,
		lua: "redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2]); return redis.call('DEL', KEYS[1])",
	},
}

export const redisOptions: ClusterOptions = {
	scripts: cacheScripts,
	clusterRetryStrategy: () => null,
	dnsLookup: (address, callback) => callback(null, address),
	lazyConnect: true,
	slotsRefreshTimeout: 200,
	redisOptions: {
		commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
		connectTimeout: 300,
		lazyConnect: true,
		maxLoadingRetryTime: 200,
		maxRetriesPerRequest: 0,
		password: process.env.REDIS_PASS || "",
		sentinelRetryStrategy: () => null,
	},
}

let commandTimeoutMs = REDIS_COMMAND_TIMEOUT_MS
export function setRedisCommandTimeoutForTest(ms: number | null): void {
	commandTimeoutMs = ms ?? REDIS_COMMAND_TIMEOUT_MS
}

const breakerEvents = counter(
	"goodwatch_redis_breaker_events_total",
	"Redis node breaker transitions and rejected commands.",
	["node", "event"],
	64,
)
const breakers = createRedisBreakers({
	onEvent: (node, event) => breakerEvents.inc([node, event]),
})
export const resetRedisBreakersForTest = () => breakers.reset()
export const redisBreakerStates = () => breakers.states()
gauge(
	"goodwatch_redis_breaker_open_nodes",
	"Open Redis node breakers.",
	[],
	() => [{ labels: [], value: breakers.openCount() }],
)

export function isRedisNodeFailure(error: unknown): boolean {
	if (error instanceof RedisNodeDownError) return false
	if (typeof error !== "object" || error === null) return true
	return !(
		"name" in error &&
		error.name === "ReplyError" &&
		"message" in error &&
		typeof error.message === "string" &&
		!/^(CLUSTERDOWN|LOADING|MASTERDOWN|TRYAGAIN)/.test(error.message)
	)
}

type DispatchArgs = Parameters<Cluster["sendCommand"]>

export class GuardedCluster extends Redis.Cluster {
	sendCommand(...[command, stream, node]: DispatchArgs): unknown {
		const slot = node ? node.slot : command.getSlot()
		const owner =
			command.name === "cluster" || slot == null
				? undefined
				: this.slots[slot]?.[0]
		if (!owner) return this.dispatch(command, stream, node)
		if (breakers.isOpen(owner)) {
			const key = command.getKeys()[0]
			if (key && breakers.claimProbe(owner)) {
				const probe = new Command("exists", [key])
				this.track(probe, undefined, undefined, owner, true)
				probe.promise.catch(() => {})
			}
			breakerEvents.inc([owner, "rejected"])
			command.reject(new RedisNodeDownError(owner))
			return command.promise
		}
		return this.track(command, stream, node, owner, false)
	}

	protected dispatch(...args: DispatchArgs): unknown {
		return super.sendCommand(...args)
	}

	private track(
		command: Command,
		stream: DispatchArgs[1],
		node: DispatchArgs[2],
		owner: string,
		probe: boolean,
	): unknown {
		let settled = false
		let timedOut = false
		const failure = () =>
			probe ? breakers.probeFailed(owner) : breakers.failure(owner)
		const timer = setTimeout(() => {
			if (settled) return
			timedOut = true
			failure()
			command.reject(new Error("Command timed out"))
		}, commandTimeoutMs)
		command.promise
			.then(
				() => {
					settled = true
					clearTimeout(timer)
					breakers.success(owner)
				},
				(error: unknown) => {
					settled = true
					clearTimeout(timer)
					if (timedOut || error instanceof RedisNodeDownError) return
					if (isRedisNodeFailure(error)) failure()
					else breakers.success(owner)
				},
			)
			.catch(() => {})
		try {
			this.dispatch(command, stream, node)
		} catch (error) {
			command.reject(error as Error)
		}
		return command.promise
	}
}

function withRedisDeadline<T>(operation: Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error("Redis command timed out")),
			commandTimeoutMs,
		)
		operation.then(
			(value) => {
				clearTimeout(timer)
				resolve(value)
			},
			(error) => {
				clearTimeout(timer)
				reject(error)
			},
		)
	})
}

const redisFailures = new Map<
	string,
	{ loggedAt: number; suppressed: number }
>()
export function resetRedisFailureLogsForTest(): void {
	redisFailures.clear()
}

function logRedisFailure(
	operation: "get" | "set" | "del" | "cluster",
	error: unknown,
): void {
	const now = Date.now()
	const previous = redisFailures.get(operation)
	if (previous && now - previous.loggedAt < 10_000) {
		previous.suppressed++
		return
	}
	const message = error instanceof Error ? error.message : String(error)
	console.warn(
		`Redis ${operation} failed: ${message.replace(/[\r\n]+/g, " ")} (suppressed: ${previous?.suppressed ?? 0})`,
	)
	redisFailures.set(operation, { loggedAt: now, suppressed: 0 })
}

export type CacheRedis = {
	mget?(...keys: string[]): Promise<(string | null)[]>
	gwCacheStore?(
		valueKey: string,
		markerKey: string,
		expected: string,
		ttl: number,
		value: string,
	): Promise<number>
	gwCacheReset?(
		valueKey: string,
		markerKey: string,
		token: string,
		markerTtl: number,
	): Promise<number>
	get(key: string): Promise<string | null>
	setex(key: string, ttl: number, value: string): Promise<unknown>
	del(key: string): Promise<number>
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
// Crate, Qdrant, Postgres or Redis failures last seconds to minutes, not milliseconds.
// Retry hot keys at most twice a minute, still allowing 120 attempts in the default
// 60-minute stale window. This equals MAX_JOIN_AGE_MS, when a run counts as stuck.
const REFRESH_PAUSE_MS = 30_000
const MAX_REFRESH_PAUSES = 1000
const refreshPauses = new Map<string, number>()

export function cacheRefreshPauseCount(): number {
	return refreshPauses.size
}

export function resetRefreshPausesForTest(): void {
	refreshPauses.clear()
}

function isRefreshPaused(key: string): boolean {
	const until = refreshPauses.get(key)
	if (until === undefined) return false
	if (until > Date.now()) return true
	refreshPauses.delete(key)
	return false
}

function pauseRefresh(key: string): void {
	const now = Date.now()
	refreshPauses.delete(key)
	if (refreshPauses.size >= MAX_REFRESH_PAUSES) {
		for (const [pausedKey, until] of refreshPauses) {
			if (until <= now) refreshPauses.delete(pausedKey)
		}
		if (refreshPauses.size >= MAX_REFRESH_PAUSES) {
			// Maps iterate in insertion order: drop the oldest pause.
			refreshPauses.delete(refreshPauses.keys().next().value as string)
		}
	}
	refreshPauses.set(key, now + REFRESH_PAUSE_MS)
}

export function cachePhysicalTtlSeconds(
	ttlMinutes: number,
	staleMinutes = Math.min(ttlMinutes, DEFAULT_MAX_STALE_MINUTES),
): number {
	const stale = Number.isFinite(staleMinutes) ? Math.max(0, staleMinutes) : 0
	return Math.max(1, Math.round((ttlMinutes + stale) * 60))
}

// Reset guard (docs/adr/0006-reset-markers-for-the-data-cache.md): a cache with a reset path
// declares it. A reset in any process writes a new token to the marker key, which shares the
// value key's slot. A lookup reads the marker with the value, and a run stores only if the
// marker is still the one its lookup saw. Undeclared caches keep one GET and one SETEX.
// A run older than this minus 30 seconds stores nothing; markers outlive values by this long.
export const RESET_GUARD_MAX_RUN_SECONDS = 300
export interface ResettableCacheDeclaration {
	name: string
	ttlMinutes: number
	staleMinutes?: number
}
const declarations = new Map<
	string,
	{ physicalTtlSeconds: number; markerTtlSeconds: number; enabled: boolean }
>()
export function declareResettableCache({
	name,
	ttlMinutes,
	staleMinutes,
}: ResettableCacheDeclaration): void {
	if (/[{}]/.test(name))
		throw new Error(`Cache name ${name} must not contain braces`)
	const physicalTtlSeconds = cachePhysicalTtlSeconds(ttlMinutes, staleMinutes)
	declarations.set(name, {
		physicalTtlSeconds,
		markerTtlSeconds: physicalTtlSeconds + RESET_GUARD_MAX_RUN_SECONDS,
		enabled: ttlMinutes > 0,
	})
}
export function cacheResetMarkerKey(cacheKey: string): string {
	return `cached-reset:{${cacheKey}}`
}
const resetGuard = counter(
	"goodwatch_data_cache_reset_guard_total",
	"Cross-process reset guard events.",
	["cache", "event"],
	64,
)
let runClock = () => performance.now()
export function setResetRunClockForTest(clock: (() => number) | null): void {
	runClock = clock ?? (() => performance.now())
}

type InFlight = {
	marker: string | null | undefined
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

export interface ClusterLike {
	on(event: "error", listener: (error: Error) => void): unknown
	on(event: "ready" | "end", listener: () => void): unknown
	connect(): Promise<void>
	disconnect(): void
}
const clientEvents = counter(
	"goodwatch_redis_client_events_total",
	"Redis cluster lifecycle events.",
	["event"],
	3,
)
gauge("goodwatch_redis_client_ready", "Redis client is published.", [], () => [
	{ labels: [], value: redisCluster ? 1 : 0 },
])
let currentClient: ClusterLike | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let reconnectAttempt = 0
let createClient: () => ClusterLike = () =>
	new GuardedCluster(clusterNodes, redisOptions)
let reconnectDelays = [1000, 2000, 4000, 8000, 16000, 30000]

function retireClient(cluster: ClusterLike): void {
	if (currentClient !== cluster) return
	currentClient = null
	if (redisCluster === cluster) redisCluster = null
	// Invalidate listeners before disconnect(), which can emit end synchronously.
	cluster.disconnect()
}

function scheduleReconnect(): void {
	if (reconnectTimer) return
	const delay =
		reconnectDelays[Math.min(reconnectAttempt++, reconnectDelays.length - 1)]
	reconnectTimer = setTimeout(() => {
		reconnectTimer = undefined
		connectToRedisCluster()
	}, delay)
	reconnectTimer.unref()
}

function connectToRedisCluster(): void {
	if (currentClient) return
	const cluster = createClient()
	currentClient = cluster
	cluster.on("error", (error: Error) => {
		if (currentClient === cluster) logRedisFailure("cluster", error)
	})
	cluster.on("ready", () => {
		if (currentClient !== cluster) return
		redisCluster = cluster as Cluster
		reconnectAttempt = 0
		clientEvents.inc(["ready"])
	})
	cluster.on("end", () => {
		if (currentClient !== cluster) return
		clientEvents.inc(["ended"])
		retireClient(cluster)
		scheduleReconnect()
	})
	const failed = (error: unknown) => {
		if (currentClient !== cluster) return
		clientEvents.inc(["connect_failed"])
		logRedisFailure("cluster", error)
		retireClient(cluster)
		scheduleReconnect()
	}
	try {
		cluster.connect().catch(failed)
	} catch (error) {
		failed(error)
	}
}

export function stopRedisClusterForTest(): void {
	if (reconnectTimer) clearTimeout(reconnectTimer)
	reconnectTimer = undefined
	if (currentClient) retireClient(currentClient)
	redisCluster = null
	reconnectAttempt = 0
}

export function startRedisClusterForTest(
	create: () => ClusterLike,
	delaysMs?: number[],
): void {
	stopRedisClusterForTest()
	createClient = create
	reconnectDelays = delaysMs?.length
		? delaysMs
		: [1000, 2000, 4000, 8000, 16000, 30000]
	connectToRedisCluster()
}

// At shutdown, after the last request: closes the node connections and cancels a pending reconnect.
onShutdown("redis cluster", () => {
	resetPendingResetsForTest()
	stopRedisClusterForTest()
})

// Tests and deployments without Redis configuration never attempt a connection.
if (process.env.REDIS_HOST) connectToRedisCluster()
else console.log("REDIS_HOST is empty, running without a cache")

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

	try {
		const jsonData = serializeCacheEntry(data)
		await withRedisDeadline(redis.setex(key, ttl || 1, jsonData))
		return true
	} catch (e) {
		if (!(e instanceof RedisNodeDownError)) logRedisFailure("set", e)
		return false
	}
}

async function cacheGet<CacheData extends JsonData>(
	key: string,
): Promise<{ data: CacheData; timestamp: number; length: number } | null> {
	const redis = getRedisCluster()
	if (!redis) return null

	const result = await withRedisDeadline(redis.get(key))
	if (!result) return null
	// The raw length stands in for the size, so a hit never serializes the value again.
	return { ...JSON.parse(result), length: result.length }
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

// A Response body can be read only once.
// Callers of one shared run must not share its rejected Response.
function rethrowCacheError(error: unknown): never {
	throw error instanceof Response ? error.clone() : error
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
	const declaration = declarations.get(name)
	const guarded = declaration?.enabled === true
	if (
		guarded &&
		cachePhysicalTtlSeconds(ttlMinutes, staleMinutes) >
			declaration.physicalTtlSeconds
	) {
		throw new Error(`Cache ${name} exceeds its declared physical TTL`)
	}
	let marker: string | null | undefined
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
	const physicalTtl = cachePhysicalTtlSeconds(ttlMinutes, staleMinutes)
	const startRun = (background: boolean): Promise<Return> => {
		if (inFlight.size >= MAX_IN_FLIGHT) {
			return runTarget()
		}
		const runStarted = runClock()
		// Defer execution so the entry exists before the target can settle or reset it.
		const entry: InFlight = {
			marker,
			startedAt: Date.now(),
			background,
			promise: Promise.resolve().then(async () => {
				try {
					const data = await runTarget()
					let outcome = "discarded"
					if (inFlight.get(cacheKey) === entry) {
						try {
							if (guarded) {
								if (
									entry.marker === undefined ||
									pendingResets.has(cacheKey) ||
									runClock() - runStarted >=
										(RESET_GUARD_MAX_RUN_SECONDS - 30) * 1000
								) {
									resetGuard.inc([label, "store_skipped"])
								} else {
									const redis = getRedisCluster() as CacheRedis | null
									if (!redis?.gwCacheStore)
										throw new Error("Redis reset guard unavailable")
									const stored = await withRedisDeadline(
										redis.gwCacheStore(
											cacheKey,
											cacheResetMarkerKey(cacheKey),
											entry.marker ?? "",
											physicalTtl,
											serializeCacheEntry(data),
										),
									)
									outcome = stored === 1 ? "ok" : "discarded"
									if (stored === 0) resetGuard.inc([label, "store_rejected"])
								}
							} else {
								outcome = (await cacheSet(cacheKey, data, physicalTtl))
									? "ok"
									: "error"
							}
						} catch (error) {
							outcome = "error"
							if (!(error instanceof RedisNodeDownError))
								logRedisFailure("set", error)
						}
					}
					if (background) {
						if (outcome === "error") pauseRefresh(cacheKey)
						if (outcome === "ok") refreshPauses.delete(cacheKey)
						cacheRefreshes.inc([label, outcome])
					}
					return data
				} catch (error) {
					if (background) {
						// A refresh that a reset outdated says nothing about the key's next run.
						if (inFlight.get(cacheKey) === entry) pauseRefresh(cacheKey)
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
		let cachedResult: {
			data: Return
			timestamp: number
			length: number
		} | null = null
		if (guarded) {
			if (pendingReset(cacheKey)) result = "reset_pending"
			else {
				const redis = getRedisCluster() as CacheRedis | null
				if (redis) {
					if (!redis.mget || !redis.gwCacheStore || !redis.gwCacheReset)
						throw new Error("Redis reset guard unavailable")
					const [value, token] = await withRedisDeadline(
						redis.mget(cacheKey, cacheResetMarkerKey(cacheKey)),
					)
					marker = token
					if (value)
						cachedResult = { ...JSON.parse(value), length: value.length }
				}
			}
		} else cachedResult = await cacheGet<Return>(cacheKey)
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
					(!inFlight.has(cacheKey) ||
						(guarded && inFlight.get(cacheKey)?.marker !== marker)) &&
					!isRefreshPaused(cacheKey) &&
					inFlight.size < MAX_IN_FLIGHT &&
					backgroundRefreshes < MAX_BACKGROUND_REFRESHES
				) {
					if (guarded && inFlight.has(cacheKey))
						resetGuard.inc([label, "join_refused"])
					startRun(true)
				}
				return data
			}
		}
	} catch (error) {
		marker = undefined
		result = error instanceof RedisNodeDownError ? "open" : "error"
		if (!(error instanceof RedisNodeDownError)) logRedisFailure("get", error)
	}
	const existing = inFlight.get(cacheKey)
	if (existing && guarded && existing.marker !== marker)
		resetGuard.inc([label, "join_refused"])
	if (
		existing &&
		(!guarded || existing.marker === marker) &&
		Date.now() - existing.startedAt < MAX_JOIN_AGE_MS
	) {
		cacheRequests.inc([label, result === "reset_pending" ? result : "joined"])
		const data = await existing.promise.catch(rethrowCacheError)
		try {
			return structuredClone(data) as Return
		} catch {
			return data as Return
		}
	}
	cacheRequests.inc([label, result])
	return await startRun(false).catch(rethrowCacheError)
}

export interface ResetCacheParams {
	params: JsonData
	name: string
}

type PendingReset = {
	name: string
	markerTtlSeconds: number
	until: number
	retryAt: number
}
const pendingResets = new Map<string, PendingReset>()
const RESET_RETRY_MS = 5000
const MAX_PENDING_RESETS = 1000
let resetRetryMs = RESET_RETRY_MS
let resetTimer: ReturnType<typeof setInterval> | undefined
export const pendingResetCount = () => pendingResets.size
gauge(
	"goodwatch_data_cache_pending_resets",
	"Unconfirmed cache resets.",
	[],
	() => [{ labels: [], value: pendingResetCount() }],
)
export function resetPendingResetsForTest(): void {
	pendingResets.clear()
	if (resetTimer) clearInterval(resetTimer)
	resetTimer = undefined
}
export function setResetRetryMsForTest(ms: number | null): void {
	resetRetryMs = ms ?? RESET_RETRY_MS
	if (resetTimer) clearInterval(resetTimer)
	resetTimer = undefined
	startResetTimer()
}
function removePending(key: string, pending: PendingReset): void {
	if (pendingResets.get(key) === pending) pendingResets.delete(key)
	if (!pendingResets.size && resetTimer) {
		clearInterval(resetTimer)
		resetTimer = undefined
	}
}
async function attemptReset(
	key: string,
	pending: PendingReset,
	retry: boolean,
): Promise<number | null> {
	let deleted: number | null = null
	try {
		const redis = getRedisCluster() as CacheRedis | null
		if (redis) {
			if (!redis.gwCacheReset) throw new Error("Redis reset guard unavailable")
			deleted = await withRedisDeadline(
				redis.gwCacheReset(
					key,
					cacheResetMarkerKey(key),
					crypto.randomBytes(9).toString("base64url"),
					pending.markerTtlSeconds,
				),
			)
		}
	} catch (error) {
		if (!(error instanceof RedisNodeDownError)) logRedisFailure("del", error)
	}
	if (deleted !== null) {
		removePending(key, pending)
		resetGuard.inc([
			pending.name,
			retry ? "retry_confirmed" : "reset_confirmed",
		])
	} else if (!retry) resetGuard.inc([pending.name, "reset_unconfirmed"])
	return deleted
}
function retryReset(key: string, pending: PendingReset): void {
	pending.retryAt = Date.now() + resetRetryMs
	void attemptReset(key, pending, true)
}
function pendingReset(key: string): boolean {
	const pending = pendingResets.get(key)
	if (!pending) return false
	if (pending.until <= Date.now()) {
		removePending(key, pending)
		return false
	}
	if (pending.retryAt <= Date.now()) retryReset(key, pending)
	return true
}
function startResetTimer(): void {
	if (resetTimer || !pendingResets.size) return
	resetTimer = setInterval(() => {
		let retries = 0
		const now = Date.now()
		for (const [key, pending] of pendingResets) {
			if (pending.until <= now) removePending(key, pending)
			else if (pending.retryAt <= now && retries < 20) {
				retries++
				retryReset(key, pending)
			}
		}
	}, resetRetryMs)
	resetTimer.unref()
}
async function resetDeclaredCache({
	name,
	params,
}: ResetCacheParams): Promise<number | null> {
	const declaration = declarations.get(name)
	if (!declaration)
		throw new Error(
			`Cache ${name}: call declareResettableCache before resetting`,
		)
	const key = cacheEntryKey(name, params)
	inFlight.delete(key)
	refreshPauses.delete(key)
	if (!declaration.enabled) return 0
	const now = Date.now()
	const pending = {
		name,
		markerTtlSeconds: declaration.markerTtlSeconds,
		until: now + declaration.markerTtlSeconds * 1000,
		retryAt: now + resetRetryMs,
	}
	pendingResets.delete(key)
	if (pendingResets.size >= MAX_PENDING_RESETS)
		pendingResets.delete(pendingResets.keys().next().value as string)
	pendingResets.set(key, pending)
	startResetTimer()
	return attemptReset(key, pending, false)
}
export const resetCache = async (options: ResetCacheParams): Promise<number> =>
	(await resetDeclaredCache(options)) ?? 0

/** True only when Redis acknowledged the reset, including an already absent key. */
export const resetCacheConfirmed = async (
	options: ResetCacheParams,
): Promise<boolean> => (await resetDeclaredCache(options)) !== null
