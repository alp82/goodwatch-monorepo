import { RoomError } from "./errors.ts"
import { accountKey, type SqlAccountRooms } from "./proposal-account-store.ts"
import { RECOVERY_MS, type DeletionState, type DeletionStore, type DeletionSubject, type SqlDeletionStore } from "./proposal-deletion.ts"
import type { AccountRoomIndex, AccountRoomsStore, HistoricalDecision } from "./proposal-types.ts"
import { K, readCall, script, writeCall, type RoomsValkey } from "./proposal-rooms-valkey.ts"

/** History outbox jobs other than room copies (proposal-history-sync.ts runs them). */
export type HistoryJob =
	| { k: "acct"; u: string; r: string; e: number }
	| { k: "hist"; d: HistoricalDecision }
/** Queues a job for the history copy; the same job queued twice is one job. */
export async function enqueue(redis: RoomsValkey, job: HistoryJob, now: number) {
	await writeCall(redis.zadd(K.jobs, "NX", now, JSON.stringify(job)))
}

/**
 * An account's rooms and sign-in state in the rooms Valkey, Crate as the copy (docs/yepwatch-valkey-rooms.md).
 * remember: the account's room set here plus an outbox job for the Crate index; rooms() merges both. Log out sets
 * the deny marker here first (fail closed), then in Crate. sessionActive reads the marker, or Crate until logouts
 * were imported. Decision history goes through the outbox; history() reads Crate.
 */
export class ValkeyAccountRooms implements AccountRoomsStore {
	private redis: RoomsValkey
	private sql: SqlAccountRooms
	private secret: string
	private now: () => number
	private published = new Map<string, string>()
	constructor(redis: RoomsValkey, sql: SqlAccountRooms, secret: string, now: () => number = Date.now) {
		this.redis = redis
		this.sql = sql
		this.secret = secret
		this.now = now
	}
	async remember(userId: string, entry: AccountRoomIndex) {
		const key = K.account(accountKey(this.secret, userId))
		const job: HistoryJob = { k: "acct", u: userId, r: entry.roomId, e: entry.expiresAt }
		await writeCall(
			this.redis
				.multi()
				.zadd(key, entry.expiresAt, entry.roomId)
				.zremrangebyscore(key, "-inf", this.now())
				.pexpireat(key, entry.expiresAt + 86400_000)
				.zadd(K.jobs, "NX", this.now(), JSON.stringify(job))
				.exec()
				.then((results) => {
					if (!results || results.some(([e]) => e)) throw new RoomError("busy", "Your rooms could not be updated; retry shortly", 503, true)
				})
		)
	}
	async rooms(userId: string): Promise<AccountRoomIndex[]> {
		const [live, stored] = await Promise.all([
			readCall(this.redis.zrange(K.account(accountKey(this.secret, userId)), 0, -1, "WITHSCORES")),
			this.sql.rooms(userId),
		])
		const merged = new Map(stored.map((r) => [r.roomId, r]))
		for (let i = 0; i < live.length; i += 2) merged.set(live[i], { roomId: live[i], expiresAt: Number(live[i + 1]) })
		return [...merged.values()]
	}
	async revokeSession(id: string, expiresAt: number) {
		const key = accountKey(this.secret, id)
		await writeCall(this.redis.set(K.revoked(key), "1", "PXAT", Math.max(expiresAt, this.now() + 1000)))
		await this.sql.revokeSession(id, expiresAt)
	}
	async sessionActive(id: string) {
		const found = Number(await readCall(script(this.redis, "ywExists", K.revoked(accountKey(this.secret, id)), K.mirror, "sessions")))
		if (found === -1) return this.sql.sessionActive(id)
		return found === 0
	}
	async publish(decisions: HistoricalDecision[]) {
		for (const d of decisions) {
			const job = JSON.stringify({ k: "hist", d } satisfies HistoryJob)
			if (this.published.get(d.id) === job) continue
			await writeCall(this.redis.zadd(K.jobs, "NX", this.now(), job))
			this.published.set(d.id, job)
			if (this.published.size > 2048) this.published.delete(this.published.keys().next().value!)
		}
	}
	history(userId: string) {
		return this.sql.history(userId)
	}
}

/** A deletion marker in the rooms Valkey: get()'s state, and when this copy was written (for imports). */
interface Marker {
	requestedAt: number
	purgeAfter: number
	phase: DeletionState["phase"]
	since: number
}
/** A deletion restored within the last ten minutes: imports don't write its marker back. */
const gone = (id: string) => `{yw}:del:gone:${id}`
/** A marker this young is never removed by an import: its Crate row may not be visible to a search yet. */
const MARKER_GRACE_MS = 5 * 60_000

/**
 * Deletion markers read from the rooms Valkey (every guest command and account request checks one), Crate as the
 * authority for the lifecycle. Fail closed: schedule writes the marker here before Crate; restore and purge remove
 * it only after Crate did. Until markers were imported, reads go to Crate. `historyCaughtUp`: the purge waits until
 * the history outbox has nothing old left, so no queued copy can bring erased data back.
 */
export class MirroredDeletionStore implements DeletionStore {
	readonly sql: SqlDeletionStore
	private redis: RoomsValkey
	private now: () => number
	private historyCaughtUp: () => Promise<boolean>
	constructor(redis: RoomsValkey, sql: SqlDeletionStore, historyCaughtUp: () => Promise<boolean>, now: () => number = Date.now) {
		this.redis = redis
		this.sql = sql
		this.historyCaughtUp = historyCaughtUp
		this.now = now
	}
	async get(subject: DeletionSubject) {
		const id = this.sql.id(subject)
		const raw = await readCall(script<string | null>(this.redis, "ywMirrorGet", K.deletions, K.mirror, id, "deletions"))
		if (raw === null) return this.sql.get(subject)
		if (!raw) return null
		const m = JSON.parse(raw) as Marker
		return this.sql.state(id, m.requestedAt, m.purgeAfter, m.phase)
	}
	private async mark(id: string, state: Omit<Marker, "since">) {
		await writeCall(this.redis.hset(K.deletions, id, JSON.stringify({ ...state, since: this.now() } satisfies Marker)))
	}
	async schedule(subject: DeletionSubject, now: number) {
		const id = this.sql.id(subject)
		const existing = await this.sql.get(subject).catch(() => null)
		// The deny fence first: from here on, nothing new is admitted for this subject.
		await writeCall(this.redis.del(gone(id)))
		await this.mark(id, existing ?? { requestedAt: now, purgeAfter: now + RECOVERY_MS, phase: "pending" })
		const state = await this.sql.schedule(subject, now)
		await this.mark(id, state)
		return state
	}
	async restore(subject: DeletionSubject, now: number) {
		const id = this.sql.id(subject)
		const before = await readCall(this.redis.hget(K.deletions, id))
		await this.sql.restore(subject, now)
		// In one step: a tombstone that keeps an import holding an earlier Crate read from writing the marker back, and
		// the removal of only the marker this restore saw (a deletion scheduled again meanwhile keeps its new one).
		await writeCall(
			this.redis.eval(
				"redis.call('SET', KEYS[2], '1', 'PX', 600000) if ARGV[2] ~= '' and redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then redis.call('HDEL', KEYS[1], ARGV[1]) end return 1",
				2,
				K.deletions,
				gone(id),
				id,
				before ?? ""
			)
		)
	}
	private async removeIfUnchanged(id: string, raw: string) {
		await writeCall(
			this.redis.eval(
				"if redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then return redis.call('HDEL', KEYS[1], ARGV[1]) end return 0",
				1,
				K.deletions,
				id,
				raw
			)
		)
	}
	async purgeDue(now: number) {
		if (!(await this.historyCaughtUp())) throw new Error("YepWatch deletion waits for the history copy")
		try {
			await this.sql.purgeDue(now)
		} finally {
			await this.importMarkers()
		}
	}
	/**
	 * Copies Crate's requests here and removes markers Crate no longer has: only once a primary-key read confirms the
	 * row is gone, and never a marker younger than MARKER_GRACE_MS (its row may not be searchable yet).
	 */
	async importMarkers() {
		const entries = await this.sql.entries()
		const known = new Set(entries.map((e) => e.id))
		const stored = await readCall(this.redis.hgetall(K.deletions))
		const writes: string[] = []
		for (const e of entries) {
			const current = stored[e.id] ? (JSON.parse(stored[e.id]) as Marker) : null
			if (!current || current.requestedAt !== e.requestedAt || current.purgeAfter !== e.purgeAfter || current.phase !== e.phase)
				writes.push(e.id, JSON.stringify({ requestedAt: e.requestedAt, purgeAfter: e.purgeAfter, phase: e.phase, since: this.now() } satisfies Marker))
		}
		for (let n = 0; n < writes.length; n += 2)
			await writeCall(
				this.redis.eval(
					"if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end return redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])",
					2,
					K.deletions,
					gone(writes[n]),
					writes[n],
					writes[n + 1]
				)
			)
		for (const [id, raw] of Object.entries(stored)) {
			if (known.has(id)) continue
			const m = JSON.parse(raw) as Marker
			if (this.now() - m.since < MARKER_GRACE_MS) continue
			if (await this.sql.exists(id)) continue
			// Removed only if unchanged since read (a schedule racing this import keeps its marker).
			await this.removeIfUnchanged(id, raw)
		}
		await writeCall(this.redis.hset(K.mirror, "deletions", "1"))
	}
}
