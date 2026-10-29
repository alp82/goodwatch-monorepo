// Owner data only. Visibility is checked by the route and applied after every lookup, including stale hits.
import { promisify } from "node:util"
import { gzip, gunzip } from "node:zlib"
import { withBackendTimeout } from "~/utils/backend-timeout"
import type { StaleValue } from "./stale-value"

const compress = promisify(gzip)
const decompress = promisify(gunzip)
const FRESH_MS = 10 * 60_000
const RETAIN_SECONDS = 7 * 24 * 60 * 60
const SETTLE_MS = 1_500
const bounded = <T>(work: () => Promise<T>) =>
	withBackendTimeout("valkey", 800, work)
const key = (kind: string, userId: string) =>
	`profile-summary:v2:${kind}:${userId}`

export async function readSummary<T>(
	kind: string,
	userId: string,
): Promise<StaleValue<T> | null> {
	try {
		const { getRedisCluster } = await import("~/utils/cache")
		const redis = getRedisCluster()
		if (!redis) return null
		const [raw, touched] = await bounded(() =>
			Promise.all([
				redis.get(key(kind, userId)),
				redis.get(`taste:touched:${userId}`),
			]),
		)
		if (!raw) return null
		const entry = JSON.parse(raw) as { readFrom: number; payload: string }
		const value = JSON.parse(
			(
				await decompress(Buffer.from(entry.payload, "base64"), {
					maxOutputLength: 8 * 1024 * 1024,
				})
			).toString("utf8"),
		) as T
		return {
			value,
			fresh:
				entry.readFrom >= (Number(touched) || 0) + SETTLE_MS &&
				Date.now() - entry.readFrom < FRESH_MS,
		}
	} catch (error) {
		console.error(
			"Profile summary: cache read failed",
			error instanceof Error ? error.message : "unknown error",
		)
		return null
	}
}

export async function writeSummary<T>(
	kind: string,
	userId: string,
	value: T,
	readFrom: number,
): Promise<void> {
	try {
		const { getRedisCluster } = await import("~/utils/cache")
		const redis = getRedisCluster()
		if (!redis) return
		const payload = (await compress(JSON.stringify(value))).toString("base64")
		// Two instances can finish in the opposite order. Keep the computation that started later.
		await bounded(() =>
			redis.eval(
				`
			local old = redis.call('GET', KEYS[1])
			if old and cjson.decode(old).readFrom > tonumber(ARGV[1]) then return 0 end
			return redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])`,
				1,
				key(kind, userId),
				String(readFrom),
				JSON.stringify({ readFrom, payload }),
				RETAIN_SECONDS,
			),
		)
	} catch (error) {
		console.error(
			"Profile summary: cache write failed",
			error instanceof Error ? error.message : "unknown error",
		)
	}
}

/** Remove retained owner data when the profile is reset or the account is deleted. */
export async function clearProfileSummaries(userId: string): Promise<void> {
	const { getRedisCluster } = await import("~/utils/cache")
	const redis = getRedisCluster()
	if (!redis) return
	// Each key can belong to a different cluster slot.
	await bounded(() =>
		Promise.all(
			[
				"stats",
				"portrait-fingerprint",
				"portrait-sides",
				"portrait-everyone",
			].map((kind) => redis.del(key(kind, userId))),
		),
	)
}
