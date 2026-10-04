// The title snapshot in webapp memory. It loads from Redis when the server starts and again whenever the manifest at
// `title-snapshot:current` names a new version (checked once a minute). A load reads every chunk, checks the checksum
// and the fingerprint key order, derives what the webapp needs, and only then replaces the loaded snapshot, in one
// assignment. A failed load keeps the previous snapshot and logs why.
//
// The ratings sidecar (what the age and content filter reads) is optional: a manifest without `ratings`, a missing
// ratings chunk, ratings that are refused (a bad shape, size, or checksum), or a Redis error on the ratings keys leave
// the snapshot loaded without ratings, and the filter unavailable until the next version. It isn't read at all while
// REC_AGE_FILTER is off (see loadRatings).
//
// TITLE_SNAPSHOT_REDIS_URL points the loader at a single Redis (for example a local one that
// scripts/write-title-snapshot.ts filled with a sample); without it, it reads the webapp's Redis cluster.
import Redis from "ioredis"
import { getFeatureMode } from "~/server/features.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import {
	CURRENT_KEY,
	SnapshotRefused,
	checkManifest,
	chunkKey,
	joinChunks,
} from "./format.server"
import { loadRatings } from "./ratings.server"
import { type TitleSnapshot, buildSnapshot } from "./snapshot.server"

export type { CatalogStats } from "./catalog-stats.server"
export type {
	TitleColumns,
	TitleFacts,
	TitleKey,
	TitleRatings,
	TitleSnapshot,
} from "./snapshot.server"
export {
	FLAG_ADULT,
	FLAG_ANIME,
	FLAG_POSTER,
	NO_RATING,
	UNKNOWN_DAY,
	UNKNOWN_SCORE,
} from "./format.server"

const CHECK_EVERY_MS = 60_000
// Before the first load, retry connection and transient load failures quickly.
// Nothing published or a refused manifest keeps the normal 60-second cadence.
const RETRY_UNCONNECTED_MS = 2_000

interface SnapshotRedis {
	get(key: string): Promise<string | null>
	getBuffer(key: string): Promise<Buffer | null>
}

let current: TitleSnapshot | null = null
let started = false
let timer: NodeJS.Timeout | undefined
// The manifest text of a snapshot that was refused, so it's refused (and logged) once, not every minute.
let refusedManifest: string | null = null
let reportedMissing = false
let singleRedis: Redis | undefined

async function snapshotRedis(): Promise<SnapshotRedis | null> {
	const url = process.env.TITLE_SNAPSHOT_REDIS_URL
	if (url) {
		singleRedis ??= new Redis(url, { maxRetriesPerRequest: 1 })
		return singleRedis
	}
	const { getRedisCluster } = await import("~/utils/cache")
	return getRedisCluster()
}

/** One check: loads the snapshot the manifest names when it's new. Returns false when a connection or transient load failure needs a retry. */
async function check(): Promise<boolean> {
	const redis = await snapshotRedis()
	if (!redis) return false
	const raw = await redis.get(CURRENT_KEY)
	if (!raw) {
		if (!reportedMissing)
			console.info(`Title snapshot: nothing published at ${CURRENT_KEY} yet`)
		reportedMissing = true
		return true
	}
	reportedMissing = false
	if (raw === refusedManifest) return true
	try {
		const startedAt = performance.now()
		let parsed: unknown
		try {
			parsed = JSON.parse(raw)
		} catch {
			throw new SnapshotRefused("Title snapshot manifest refused: not JSON")
		}
		const manifest = checkManifest(parsed, VALID_FINGERPRINT_KEYS)
		if (manifest.version === current?.version) return true
		const chunks = await Promise.all(
			Array.from({ length: manifest.chunks }, (_, n) =>
				redis.getBuffer(chunkKey(manifest.version, n)),
			),
		)
		const missing = chunks.findIndex((chunk) => !chunk)
		// A newer publish may have pruned this version between the two reads; the next check reads the new manifest.
		if (missing >= 0)
			throw new Error(
				`Title snapshot ${manifest.version} lacks chunk ${missing}; retrying at the next check`,
			)
		const ratings = await loadRatings(
			redis,
			manifest,
			getFeatureMode("ageFilter") !== "off",
		)
		const readMs = performance.now() - startedAt
		const snapshot = buildSnapshot(
			manifest,
			joinChunks(manifest, chunks as Buffer[]),
			ratings,
		)
		current = snapshot
		console.info(
			`Title snapshot ${snapshot.version} loaded: ${snapshot.count} titles, ${snapshot.stats.pool} in the reference pool, ${ratings ? `ratings for ${ratings.countries.length} countries` : "no ratings"}, in ${Math.round(performance.now() - startedAt)} ms (${Math.round(readMs)} ms reading Redis)`,
		)
	} catch (error) {
		if (error instanceof SnapshotRefused) refusedManifest = raw
		console.error(
			current
				? `Title snapshot not updated; keeping ${current.version}:`
				: "Title snapshot not loaded:",
			error instanceof SnapshotRefused ? error.message : error,
		)
		if (!current && !(error instanceof SnapshotRefused)) return false
	}
	return true
}

function schedule(delayMs: number) {
	timer = setTimeout(async () => {
		let connected = false
		try {
			connected = await check()
		} catch (error) {
			console.error("Title snapshot check failed:", error)
		}
		if (started)
			schedule(connected || current ? CHECK_EVERY_MS : RETRY_UNCONNECTED_MS)
	}, delayMs)
	timer.unref()
}

/** Starts loading the snapshot in the background and checking for new versions. Safe to call more than once. */
export function startTitleSnapshot(): void {
	if (started) return
	started = true
	schedule(0)
}

/** The loaded snapshot, or null until the first load completes. Starts loading on first use. */
export function getTitleSnapshot(): TitleSnapshot | null {
	startTitleSnapshot()
	return current
}

/** Stops checking for new versions (for scripts). The loaded snapshot stays readable. */
export function stopTitleSnapshot(): void {
	started = false
	if (timer) clearTimeout(timer)
	timer = undefined
	singleRedis?.disconnect()
	singleRedis = undefined
}
