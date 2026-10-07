// Shared by load.mjs and probe.mjs: a deterministic key set shaped like production's
// (sampled on October 7, 2026: about 80% data cache entries of 1 to 20 KB and about 20%
// OG cards near 110 KB, mean about 29 KB), and a client built like the webapp's.
import crypto from "node:crypto"
import calculateSlot from "cluster-key-slot"
import Redis from "ioredis"

export const KEYS = Number(process.env.KEYS || 40000)
export const SNAPSHOT_CHUNKS = Number(process.env.SNAPSHOT_CHUNKS || 36)
// Optional dense keys: DENSE_PER_SLOT keys of about 30 KB in each of the slots 0 to
// DENSE_SLOTS - 1. A rebalance takes the lowest slots of a node first, so these slots move
// with production's density (about 43 keys and 1.3 MB per slot) while the rest of the
// rehearsal cluster stays small.
export const DENSE_SLOTS = Number(process.env.DENSE_SLOTS || 0)
export const DENSE_PER_SLOT = Number(process.env.DENSE_PER_SLOT || 45)
const denseKeys = []
if (DENSE_SLOTS > 0) {
	const perSlot = new Array(DENSE_SLOTS).fill(0)
	for (let n = 0; denseKeys.length < DENSE_SLOTS * DENSE_PER_SLOT; n++) {
		const key = `cached-person-profile-v2:${crypto.createHash("md5").update(`dense:${n}`).digest("hex")}`
		const slot = calculateSlot(key)
		if (slot < DENSE_SLOTS && perSlot[slot] < DENSE_PER_SLOT) {
			perSlot[slot]++
			denseKeys.push(key)
		}
	}
}
export const TOTAL = KEYS + denseKeys.length
const PREFIXES = [
	["cached-details-movie-v2:", 30],
	["cached-person-profile-v2:", 33],
	["cached-media_fingerprint_v1:", 8],
	["cached-details-show-v2:", 6],
	["cached-episode-grid:", 2],
	["og-card:", 21],
]
const filler = crypto.randomBytes(768 * 1024).toString("base64")

function unit(i, salt) {
	return crypto.createHash("md5").update(`${salt}:${i}`).digest().readUInt32BE(0) / 2 ** 32
}
export function keyOf(i) {
	if (i >= KEYS) return denseKeys[i - KEYS]
	let pick = unit(i, "prefix") * 100
	for (const [prefix, share] of PREFIXES) {
		if (pick < share) return prefix + crypto.createHash("md5").update(`key:${i}`).digest("hex")
		pick -= share
	}
	return `cached-misc:${i}`
}
export function isCard(i) {
	return keyOf(i).startsWith("og-card:")
}
export function lengthOf(i) {
	const u = unit(i, "len")
	if (i >= KEYS) return Math.floor(5_000 + u * 50_000)
	return Math.floor(isCard(i) ? 60_000 + u * 100_000 : 1_000 + u * u * 19_000)
}
export function ttlOf(i) {
	return isCard(i) ? 7 * 86400 : 3600 + Math.floor(unit(i, "ttl") * 23 * 3600)
}
// The value starts with its index, so a reader can tell a wrong or cut value from a right one.
export function valueOf(i) {
	const head = `${i}|`
	const offset = Math.floor(unit(i, "off") * 1000)
	return head + filler.slice(offset, offset + lengthOf(i) - head.length)
}
export function checkValue(i, value) {
	return typeof value === "string" && value.startsWith(`${i}|`) && value.length === lengthOf(i)
}
export const markerKeyOf = (key) => `cached-reset:{${key}}`
export const chunkKeyOf = (n) => `title-snapshot:rehearsal:${n}`

// Copied from goodwatch-webapp/app/utils/cache.ts (redisOptions and cacheScripts).
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
export const REDIS_COMMAND_TIMEOUT_MS = 1000
export const redisOptions = {
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
export const startupNodes = (process.env.REDIS_HOSTS || "")
	.split(",")
	.filter(Boolean)
	.map((host) => ({ host, port: Number(process.env.REDIS_PORT || 6379) }))
export { Redis }
