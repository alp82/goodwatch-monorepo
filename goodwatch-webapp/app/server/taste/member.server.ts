// Members' taste, stored in Redis at `taste:v2:<user_id>` and rebuilt after every write to their ratings or Want to See.
//
// - A write path calls markTasteChanged after its write commits. That sets `taste:touched:<user_id>` to the write time
//   and schedules one rebuild for the person, coalesced: writes in quick succession (onboarding, an import) share it.
// - A rebuild reads the person's ratings and Want to See in one Crate statement, builds the vector and the quantile
//   table, and writes the key.
// - A reader rebuilds inline, before answering, when the key is missing, was built from another snapshot version, or
//   is older than the latest write. The key records which write it has seen (`touchedAt`): the touched time it read
//   before reading Crate. Crate shows a write to non-key reads only after its refresh (1 s by default), so a rebuild
//   that reads within SETTLE_MS of the write records the previous touched time, and the next reader rebuilds again.
//
// The value's layout is in stored.server.ts.
//
// TASTE_REDIS_URL points the store at a single Redis (for development and scripts); without it, it uses the webapp's
// Redis cluster. Without a Redis connection, a member's taste is built on every read and not stored.
import Redis from "ioredis"
import { getFeatureMode } from "~/server/features.server"
import { clearTastePortrait } from "~/server/taste-portrait/cache.server"
import {
	type TitleSnapshot,
	getTitleSnapshot,
} from "~/server/title-snapshot/index.server"
import { query } from "~/utils/crate"
import { titleKey } from "~/utils/title-key"
import { type TasteSignals, quantileTable, tasteVector } from "./formula.server"
import { poolCosines, tastePool } from "./pool.server"
import { type StoredTaste, decodeTaste, encodeTaste } from "./stored.server"
import { NO_TASTE, type Taste, makeTaste } from "./taste.server"

// Bump when the formula, the calibration, or the value layout changes: every member's taste then rebuilds on first read.
// - v2: the quantile table also holds the top 1 percent in fine steps (QUANTILE_LEVELS). The v1 keys are never read
//   again and expire on their own.
const TASTE_KEY_VERSION = "v2"
const tasteKey = (userId: string) => `taste:${TASTE_KEY_VERSION}:${userId}`
const touchedKey = (userId: string) => `taste:touched:${userId}`
// Both keys expire after half a year without a write; a reader then rebuilds.
const TTL_SECONDS = 180 * 24 * 60 * 60
const SETTLE_MS = 1_500
const REBUILD_DELAY_MS = 1_500
// The per-person read, far below Crate's timeout: heavy raters have about 1,400 rows.
const MAX_ROWS = 20_000

interface TasteRedis {
	getBuffer(key: string): Promise<Buffer | null>
	get(key: string): Promise<string | null>
	set(
		key: string,
		value: string | Buffer,
		expiry: "EX",
		seconds: number,
	): Promise<unknown>
}

let singleRedis: Redis | undefined

async function tasteRedis(): Promise<TasteRedis | null> {
	const url = process.env.TASTE_REDIS_URL
	if (url) {
		singleRedis ??= new Redis(url, { maxRetriesPerRequest: 1 })
		return singleRedis
	}
	const { getRedisCluster } = await import("~/utils/cache")
	return getRedisCluster()
}

/** The person's ratings and Want to See, in one statement. */
async function readSignals(userId: string): Promise<TasteSignals> {
	const rows = await query<{
		kind: "score" | "plan"
		tmdb_id: number
		media_type: "movie" | "show"
		score: number
		updated_at: number | string | null
	}>(
		`SELECT 'score' AS kind, tmdb_id, media_type, score, updated_at FROM user_score WHERE user_id = ?
		 UNION ALL
		 SELECT 'plan' AS kind, tmdb_id, media_type, 0 AS score, updated_at FROM user_wishlist WHERE user_id = ?
		 LIMIT ${MAX_ROWS}`,
		[userId, userId],
	)
	const signals: TasteSignals = { ratings: [], wantToSee: [] }
	for (const row of rows) {
		const key = titleKey(row.media_type, Number(row.tmdb_id))
		const at = row.updated_at == null ? 0 : new Date(row.updated_at).getTime()
		if (row.kind === "score")
			signals.ratings.push({ key, score: Number(row.score), at })
		else signals.wantToSee.push({ key, at })
	}
	return signals
}

async function readTouched(redis: TasteRedis | null, userId: string) {
	if (!redis) return 0
	try {
		return Number(await redis.get(touchedKey(userId))) || 0
	} catch (error) {
		console.error("Taste: reading the touched time failed:", error)
		return 0
	}
}

async function rebuild(
	userId: string,
	snapshot: TitleSnapshot,
	knownTouched?: number,
): Promise<StoredTaste> {
	const startedAt = Date.now()
	const redis = await tasteRedis()
	const touched = knownTouched ?? (await readTouched(redis, userId))
	const readFrom = Date.now()
	const signals = await readSignals(userId)
	const readMs = Date.now() - readFrom
	const built = tasteVector(snapshot, signals)
	const quantiles = built.vector
		? quantileTable(poolCosines(tastePool(snapshot), built.vector))
		: null
	const stored: StoredTaste = {
		...built,
		quantiles,
		builtAt: Date.now(),
		touchedAt: readFrom - touched >= SETTLE_MS ? touched : touched - 1,
		snapshotVersion: snapshot.version,
	}
	if (redis)
		try {
			await redis.set(tasteKey(userId), encodeTaste(stored), "EX", TTL_SECONDS)
		} catch (error) {
			console.error("Taste: storing the rebuilt taste failed:", error)
		}
	console.info(
		`Taste rebuilt for ${userId.slice(0, 8)}: ${built.ratings} ratings, ${built.liked} liked, ${built.wantToSee} Want to See${built.vector ? "" : ", no taste yet"}, in ${Date.now() - startedAt} ms (${readMs} ms reading Crate)`,
	)
	return stored
}

// One rebuild in flight per person; readers that find the key stale meanwhile wait for it.
const inflight = new Map<string, Promise<StoredTaste>>()
const scheduled = new Map<string, NodeJS.Timeout>()

function sharedRebuild(
	userId: string,
	snapshot: TitleSnapshot,
	knownTouched?: number,
): Promise<StoredTaste> {
	let running = inflight.get(userId)
	if (!running) {
		running = rebuild(userId, snapshot, knownTouched).finally(() =>
			inflight.delete(userId),
		)
		inflight.set(userId, running)
	}
	return running
}

export async function loadMemberTaste(userId: string): Promise<Taste> {
	const snapshot = getTitleSnapshot()
	if (!snapshot) return NO_TASTE
	const redis = await tasteRedis()
	let stored: StoredTaste | null = null
	let touched = 0
	if (redis)
		try {
			const [value, touchedValue] = await Promise.all([
				redis.getBuffer(tasteKey(userId)),
				redis.get(touchedKey(userId)),
			])
			stored = value ? decodeTaste(value) : null
			touched = Number(touchedValue) || 0
		} catch (error) {
			console.error("Taste: reading the stored taste failed:", error)
		}
	if (
		!stored ||
		stored.snapshotVersion !== snapshot.version ||
		stored.touchedAt < touched
	)
		stored = await sharedRebuild(userId, snapshot, touched)
	return makeTaste(snapshot, stored)
}

/**
 * Call after every committed write to the person's ratings or Want to See. Records the write time for readers, clears
 * the person's cached Taste page views, and, unless REC_TASTE_MATCH is off, schedules a rebuild off the request path.
 * Never throws.
 */
export async function markTasteChanged(
	userId: string | null | undefined,
): Promise<void> {
	if (!userId) return
	try {
		// Recorded in every mode, so vectors stored while the flag was on are known to be stale when it's on again.
		const redis = await tasteRedis()
		await redis?.set(touchedKey(userId), String(Date.now()), "EX", TTL_SECONDS)
	} catch (error) {
		console.error("Taste: recording the write failed:", error)
	}
	// The Taste page's cached views describe the old ratings.
	await clearTastePortrait(userId)
	if (getFeatureMode("tasteMatch") === "off" || scheduled.has(userId)) return
	const timer = setTimeout(async () => {
		scheduled.delete(userId)
		try {
			// A rebuild already running may have read Crate before this write; run another after it.
			await inflight.get(userId)?.catch(() => null)
			const snapshot = getTitleSnapshot()
			if (snapshot) await sharedRebuild(userId, snapshot)
		} catch (error) {
			console.error("Taste: the scheduled rebuild failed:", error)
		}
	}, REBUILD_DELAY_MS)
	timer.unref()
	scheduled.set(userId, timer)
}

/** Closes the development Redis connection (for scripts). */
export function stopTasteStore(): void {
	for (const timer of scheduled.values()) clearTimeout(timer)
	scheduled.clear()
	singleRedis?.disconnect()
	singleRedis = undefined
}
