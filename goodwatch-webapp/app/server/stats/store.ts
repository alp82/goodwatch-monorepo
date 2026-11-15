// Where the /stats snapshot lives between refreshes, and when it is computed again.
//
// - A request never waits for a computation. It gets the snapshot in memory; a process that has none yet waits a
//   moment for the stored copy in Valkey (READY_MS), never longer. With neither, the page says the numbers are being
//   counted and a computation starts in the background.
// - The snapshot is computed again once it is a day old (MAX_AGE_MS): by the first read after that, or by the hourly
//   check stats.server.ts schedules. A computation takes a lock first, so of the processes of a deploy one computes and
//   the others pick up its stored copy. It has COMPUTE_DEADLINE_MS, well inside the lock's LOCK_SECONDS, so no second
//   process starts while one still runs; past the deadline the rest is called off and it counts as failed.
// - A failed computation keeps the last snapshot. The next try waits RETRY_MS, twice as long after each further
//   failure, up to MAX_RETRY_MS. The failure is stored too (FAILED_KEY), so the other processes wait as long instead of
//   each trying for itself; a successful computation clears it.
// - The stored copy outlives a day (STORED_SECONDS), so a restart after failed refreshes still has numbers to show.
//
// This module takes its Redis client and clock as arguments, so it runs in tests.
import { randomUUID } from "node:crypto"
import {
	STATS_SNAPSHOT_VERSION,
	type StatsSnapshot,
} from "../../domain/stats/snapshot.ts"

const PREFIX = "{stats-snapshot}"
export const SNAPSHOT_KEY = `${PREFIX}:v${STATS_SNAPSHOT_VERSION}`
export const LOCK_KEY = `${PREFIX}:lock`
export const FAILED_KEY = `${PREFIX}:failed`
export const MAX_AGE_MS = 24 * 60 * 60 * 1000
export const STORED_SECONDS = 14 * 24 * 60 * 60
export const LOCK_SECONDS = 10 * 60
/** Half the lock: a computation takes about 30 s (November 2026); the rest is room for statements in flight. */
export const COMPUTE_DEADLINE_MS = 5 * 60 * 1000
export const RETRY_MS = 15 * 60 * 1000
export const MAX_RETRY_MS = 4 * 60 * 60 * 1000
/** How long the failure record lives: past every wait, so the next failure waits longer still. */
export const FAILED_SECONDS = 24 * 60 * 60
/** How soon a process looks again when another one holds the lock. */
export const WAIT_MS = 60 * 1000
/** How long a request waits for the stored copy when the process has none in memory. */
export const READY_MS = 400

export interface StatsRedis {
	get(key: string): Promise<string | null>
	set(
		key: string,
		value: string,
		expiry: "EX",
		seconds: number,
	): Promise<unknown>
	set(
		key: string,
		value: string,
		expiry: "EX",
		seconds: number,
		mode: "NX",
	): Promise<unknown>
	eval(
		script: string,
		keys: number,
		key: string,
		token: string,
	): Promise<unknown>
	del(key: string): Promise<unknown>
}

export interface Stored {
	builtAt: number
	snapshot: StatsSnapshot
}

/** Failed computations in a row, the last one's time and error, and when the next may start. */
export interface Failure {
	failures: number
	at: number
	until: number
	error: string
}

/** The wait after `failures` failed computations in a row: 15 min, 30 min, 1 h, 2 h, then 4 h. */
export const retryAfter = (failures: number) =>
	Math.min(RETRY_MS * 2 ** Math.max(0, failures - 1), MAX_RETRY_MS)

/** Deletes the lock only while it still holds this claim's token. */
const RELEASE =
	"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0"

export function statsStore(deps: {
	redis: () => StatsRedis | null | undefined
	onError: (error: unknown) => void
}) {
	return {
		/** The stored snapshot, or null without one, without Valkey, or when it is of another shape. */
		async load(): Promise<Stored | null> {
			const redis = deps.redis()
			if (!redis) return null
			try {
				const raw = await redis.get(SNAPSHOT_KEY)
				if (!raw) return null
				const stored = JSON.parse(raw) as Stored
				return Number.isFinite(stored.builtAt) &&
					stored.snapshot?.version === STATS_SNAPSHOT_VERSION
					? stored
					: null
			} catch (error) {
				deps.onError(error)
				return null
			}
		},
		async save(stored: Stored) {
			const redis = deps.redis()
			if (!redis) return
			try {
				await redis.set(
					SNAPSHOT_KEY,
					JSON.stringify(stored),
					"EX",
					STORED_SECONDS,
				)
			} catch (error) {
				deps.onError(error)
			}
		},
		/** The last failure any process stored, or null. */
		async loadFailure(): Promise<Failure | null> {
			const redis = deps.redis()
			if (!redis) return null
			try {
				const raw = await redis.get(FAILED_KEY)
				if (!raw) return null
				const failure = JSON.parse(raw) as Failure
				return Number.isFinite(failure.until) &&
					Number.isFinite(failure.failures)
					? failure
					: null
			} catch (error) {
				deps.onError(error)
				return null
			}
		},
		async saveFailure(failure: Failure) {
			const redis = deps.redis()
			if (!redis) return
			try {
				await redis.set(
					FAILED_KEY,
					JSON.stringify(failure),
					"EX",
					FAILED_SECONDS,
				)
			} catch (error) {
				deps.onError(error)
			}
		},
		async clearFailure() {
			const redis = deps.redis()
			if (!redis) return
			try {
				await redis.del(FAILED_KEY)
			} catch (error) {
				deps.onError(error)
			}
		},
		/** A claim when this process may compute; null while another process holds the lock. */
		async claim(): Promise<{ token?: string } | null> {
			const redis = deps.redis()
			if (!redis) return {}
			const token = randomUUID()
			try {
				const taken = await redis.set(LOCK_KEY, token, "EX", LOCK_SECONDS, "NX")
				return taken === "OK" ? { token } : null
			} catch (error) {
				deps.onError(error)
				return {}
			}
		},
		async release(claim: { token?: string }) {
			const redis = deps.redis()
			if (!redis || !claim.token) return
			try {
				await redis.eval(RELEASE, 1, LOCK_KEY, claim.token)
			} catch (error) {
				deps.onError(error)
			}
		},
	}
}

export type StatsStore = ReturnType<typeof statsStore>

export function statsSnapshotSource(deps: {
	store: StatsStore
	/** Computes a snapshot; the signal aborts once COMPUTE_DEADLINE_MS (or `deadlineMs`) has passed. */
	compute: (signal: AbortSignal) => Promise<StatsSnapshot>
	now?: () => number
	wait?: (ms: number) => Promise<void>
	deadlineMs?: number
	onError: (error: unknown) => void
}) {
	const now = deps.now ?? Date.now
	const wait =
		deps.wait ??
		((ms: number) =>
			new Promise<void>((resolve) => setTimeout(resolve, ms).unref?.()))
	let current: Stored | null = null
	let running: Promise<void> | null = null
	let loaded: Promise<void> | null = null
	let nextTry = 0
	let failures = 0
	const deadlineMs = deps.deadlineMs ?? COMPUTE_DEADLINE_MS

	const fresh = (s: Stored | null) => !!s && now() - s.builtAt < MAX_AGE_MS
	const adopt = (s: Stored | null) => {
		if (s && (!current || s.builtAt > current.builtAt)) current = s
	}
	const loadStored = () => {
		loaded ??= deps.store.load().then(adopt)
		return loaded
	}

	/** One computation, called off at the deadline: its statements still to come throw, and it counts as failed. */
	async function computeInTime(): Promise<StatsSnapshot> {
		const controller = new AbortController()
		let timer: ReturnType<typeof setTimeout> | undefined
		const late = new Promise<never>((_, reject) => {
			timer = setTimeout(() => {
				const error = new Error(
					`the computation passed its deadline of ${Math.round(deadlineMs / 1000)} s`,
				)
				controller.abort(error)
				reject(error)
			}, deadlineMs)
		})
		const work = deps.compute(controller.signal)
		// What the computation does after the deadline is no one's business; its rejection is expected.
		work.catch(() => {})
		try {
			return await Promise.race([work, late])
		} finally {
			clearTimeout(timer)
		}
	}

	async function refresh() {
		// The first refresh reads the stored copy once; later ones read it again for another process's newer copy.
		if (loaded) adopt(await deps.store.load())
		else await loadStored()
		if (fresh(current)) return
		// Another process failed lately: wait as long as it does.
		const failed = await deps.store.loadFailure()
		if (failed && failed.until > now()) {
			failures = Math.max(failures, failed.failures)
			nextTry = failed.until
			return
		}
		const claim = await deps.store.claim()
		if (!claim) {
			// Another process is computing: its copy is picked up on a later read.
			nextTry = now() + WAIT_MS
			return
		}
		try {
			adopt(await deps.store.load())
			if (fresh(current)) return
			const start = now()
			let snapshot: StatsSnapshot
			try {
				snapshot = await computeInTime()
			} catch (error) {
				failures =
					Math.max(failures, (await deps.store.loadFailure())?.failures ?? 0) +
					1
				const at = now()
				nextTry = at + retryAfter(failures)
				const message = error instanceof Error ? error.message : String(error)
				await deps.store.saveFailure({
					failures,
					at,
					until: nextTry,
					error: message.slice(0, 500),
				})
				// The cause keeps the original error and its stack for the log.
				deps.onError(
					Object.assign(
						new Error(
							`refresh failed after ${Math.round((at - start) / 1000)} s (${failures} in a row; the last snapshot ${current ? `is from ${new Date(current.builtAt).toISOString()}` : "is missing"}; next try at ${new Date(nextTry).toISOString()}): ${message}`,
						),
						{ cause: error },
					),
				)
				return
			}
			const stored = { builtAt: now(), snapshot }
			current = stored
			await deps.store.save(stored)
			await deps.store.clearFailure()
			failures = 0
		} finally {
			await deps.store.release(claim)
		}
	}

	/** Starts a refresh when the snapshot is missing or a day old and none is running or waiting to retry. */
	const kick = () => {
		if (running || fresh(current) || now() < nextTry) return
		running = refresh()
			.catch(deps.onError)
			.finally(() => {
				running = null
			})
	}

	return {
		/** The last snapshot, or null while the first one is counted. Never waits for a computation. */
		async read(): Promise<StatsSnapshot | null> {
			kick()
			if (!current) await Promise.race([loadStored(), wait(READY_MS)])
			return current?.snapshot ?? null
		},
		/** For the hourly check and tests: starts what `read` would, and resolves when that is done. */
		async check() {
			kick()
			await running
		},
		/** For the metrics: when this process's snapshot was built (null without one), and failures in a row. */
		status(): { builtAt: number | null; failures: number } {
			return { builtAt: current?.builtAt ?? null, failures }
		},
	}
}
