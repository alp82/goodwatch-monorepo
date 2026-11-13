import type { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import type { SqlCreationQuotas } from "./proposal-creation-quota.ts"
import type { SqlAccountRooms } from "./proposal-account-store.ts"
import type { MirroredDeletionStore, HistoryJob } from "./proposal-valkey-accounts.ts"
import { incarnation, INVITE_KEEP_MS, type ValkeyRoomRepository } from "./proposal-valkey-repository.ts"
import { K, ROOM_JOB, script, type RoomsValkey } from "./proposal-rooms-valkey.ts"

const LEASE_MS = 30_000
/** A pipeline whose every command succeeded; otherwise it throws (an import is then not marked complete). */
async function settled(results: Promise<[Error | null, unknown][] | null>) {
	const all = await results
	const failed = all?.find(([error]) => error)
	if (!all || failed) throw failed?.[0] ?? new Error("Pipeline did not run")
}
const RETRY_BASE_MS = 1_000
const RETRY_MAX_MS = 5 * 60_000
const CLAIM = 20
const PARALLEL = 4
/** A job that failed this often in a row (about four minutes of backoff) is reported as failing. */
const BEHIND_TRIES = 8
/** Rooms imported and reconciled: live ones, and those expired within the last day (pending history). */
const RECENT_MS = 86400_000

export interface HistorySyncDeps {
	redis: RoomsValkey
	repository: ValkeyRoomRepository
	crate: RelationalProposalRepository
	quotas: SqlCreationQuotas
	accounts: SqlAccountRooms
	deletions: MirroredDeletionStore
	retentionDays: number
	now?: () => number
	log?: (event: Record<string, unknown>) => void
}

/**
 * The Crate history copy of the rooms Valkey (docs/yepwatch-valkey-rooms.md): runs the outbox `{yw}:jobs` (room
 * copies, account index entries, decisions) and keeps Valkey's copies of Crate's tables (mirrors) and of rooms
 * written to Crate by anyone else (reconcile).
 *
 * A room copy writes the room's newest state over the Crate head this store last wrote (its `_seq_no` and
 * `_primary_term`, recorded in the room's `cs`/`ct`), so an older state can never land over a newer one: a writer
 * whose base moved fails and reconciles. Before a room's first head, its invite and capacity reservation are copied.
 */
export class HistorySync {
	private d: Required<Omit<HistorySyncDeps, "log">> & { log: (event: Record<string, unknown>) => void }
	private running: Promise<void> | null = null
	private again = false
	private timers: ReturnType<typeof setInterval>[] = []
	private stopped = false
	private maintaining: Promise<void> | null = null
	private logged = new Map<string, number>()
	private inviteKeepMs: number
	constructor(deps: HistorySyncDeps) {
		this.d = { now: Date.now, log: (e) => console.error(JSON.stringify(e)), ...deps }
		this.inviteKeepMs = INVITE_KEEP_MS(deps.retentionDays)
	}
	private get redis() {
		return this.d.redis
	}
	/** Starts the loops: due jobs every second, mirror flags every 5 s, imports and reconciliation every minute. */
	start() {
		this.stopped = false
		const every = (ms: number, work: () => unknown) => {
			const t = setInterval(() => void Promise.resolve().then(work).catch(() => {}), ms)
			t.unref()
			this.timers.push(t)
		}
		every(1_000, () => this.kick())
		every(5_000, () => this.ensureMirrors())
		every(60_000, async () => {
			await this.maintain().catch((error) => this.d.log({ event: "yepwatch_history_import_failed", error: String(error).slice(0, 200) }))
			const lag = await this.lag()
			if (lag.failing || lag.queued > 50) this.d.log({ event: "yepwatch_history_lag", ...lag })
		})
	}
	/** Stops the loops and waits for the jobs in hand (leases expire for anything cut short). */
	async stop() {
		this.stopped = true
		if (this.soon) clearTimeout(this.soon)
		this.soon = null
		for (const t of this.timers) clearInterval(t)
		this.timers = []
		await Promise.allSettled([this.running, this.maintaining])
	}
	private soon: ReturnType<typeof setTimeout> | null = null
	/**
	 * After a commit: runs due jobs shortly, off the command's answer (a copy plans the room on this thread, which
	 * would hold up the answer's revision publish), and once for a burst of votes.
	 */
	kickSoon(delayMs = 200) {
		if (this.soon || this.stopped) return
		this.soon = setTimeout(() => {
			this.soon = null
			void this.kick().catch(() => {})
		}, delayMs)
		this.soon.unref?.()
	}
	/** Runs due jobs now; a run already going runs once more. */
	kick() {
		if (this.stopped) return this.running ?? Promise.resolve()
		if (this.running) {
			this.again = true
			return this.running
		}
		this.running = (async () => {
			try {
				do {
					this.again = false
					await this.run()
				} while (this.again && !this.stopped)
			} finally {
				this.running = null
			}
		})()
		return this.running
	}
	private async run() {
		for (;;) {
			const now = this.d.now()
			const lease = now + LEASE_MS
			const due = await script<string[]>(this.redis, "ywClaim", K.jobs, now, lease, CLAIM).catch(() => [] as string[])
			if (!due.length) return
			let next = 0
			await Promise.all(
				Array.from({ length: Math.min(PARALLEL, due.length) }, async () => {
					while (next < due.length) await this.process(due[next++], lease)
				})
			)
			if (due.length < CLAIM || this.stopped) return
		}
	}
	private async process(member: string, lease: number) {
		try {
			if (member.startsWith(ROOM_JOB)) return await this.room(member.slice(ROOM_JOB.length), member, lease)
			const job = JSON.parse(member) as HistoryJob
			if (job.k === "acct") await this.d.accounts.remember(job.u, { roomId: job.r, expiresAt: job.e })
			else if (job.k === "hist") await this.d.accounts.publish([job.d])
			await script(this.redis, "ywDone", K.jobs, K.tries, member, lease)
		} catch (error) {
			this.report(member, error)
			await script(this.redis, "ywRetry", K.jobs, K.tries, member, lease, this.d.now(), RETRY_BASE_MS, RETRY_MAX_MS).catch(() => {})
		}
	}
	private report(member: string, error: unknown) {
		const key = member.slice(0, 80)
		const now = this.d.now()
		if ((this.logged.get(key) ?? 0) > now - 10 * 60_000) return
		this.logged.set(key, now)
		if (this.logged.size > 1000) this.logged.delete(this.logged.keys().next().value!)
		this.d.log({
			event: "yepwatch_history_retry",
			job: member.startsWith(ROOM_JOB) ? `room:${member.slice(ROOM_JOB.length, ROOM_JOB.length + 8)}` : (JSON.parse(member) as HistoryJob).k,
			error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
		})
	}
	/** One room's copy: its newest state over the head this store last wrote. */
	private async room(id: string, member: string, lease: number) {
		let [v, i, body, s, cs, ct, w, x] = await this.redis.hmget(K.room(id), "v", "i", "b", "s", "cs", "ct", "w", "x")
		if (v !== null && (w !== null || x !== null)) {
			// An earlier attempt's write may have landed unrecorded (a crash, a lost answer), or the minute's check
			// found the head moved: settle that first, holding this room's lease (no other copy runs meanwhile). A head
			// still where this store left it lets the copy go on: writing over it fences out any earlier write.
			const outcome = await this.reconcile(id, member, lease)
			if (outcome !== "consistent" && outcome !== "unsynced") {
				await script(this.redis, "ywRetry", K.jobs, K.tries, member, lease, this.d.now(), 50, RETRY_MAX_MS)
				return
			}
			;[v, i, body, s, cs, ct] = await this.redis.hmget(K.room(id), "v", "i", "b", "s", "cs", "ct")
		}
		const synced = (written: number, seq = "", term = "") =>
			script(this.redis, "ywSynced", K.jobs, K.tries, K.room(id), member, lease, written, seq, term, this.d.now(), i ?? "")
		if (v === null) return void (await synced(0))
		// Synced, though an unresolved earlier write may still land: it can only land on the head this store recorded,
		// and reconcile adopts it by fingerprint.
		if (Number(s ?? 0) >= Number(v)) return void (await synced(0))
		const room = this.d.repository.decode(id, body!)
		const base = cs ? { seq: Number(cs), term: Number(ct) } : null
		if (!base) await this.dependencies(room)
		const fingerprint = this.d.crate.fingerprint(room)
		if (Number(await script(this.redis, "ywMark", K.jobs, K.room(id), member, lease, v, fingerprint, i!)) !== 1) return
		const written = await this.d.crate.archive(room, base)
		if (typeof written === "object") return void (await synced(Number(v), String(written.seq), String(written.term)))
		// The head isn't where this store left it: someone else wrote it, or this store's own write landed unrecorded.
		await this.reconcile(id, member, lease)
		await script(this.redis, "ywRetry", K.jobs, K.tries, member, lease, this.d.now(), RETRY_BASE_MS, RETRY_MAX_MS)
	}
	/** A new room's invite and capacity reservation, copied before its first head names it. */
	private async dependencies(room: { id: string; inviteHash: string }) {
		const [invite, [creator, admission, expiry]] = await Promise.all([
			this.redis.get(K.invite(room.inviteHash)),
			this.redis.hmget(K.quotaRoom(room.id), "c", "a", "e"),
		])
		const [inviteRoom, inviteExpiry] = invite?.split(" ") ?? []
		await Promise.all([
			inviteRoom === room.id
				? this.d.crate.rememberInvite(room.inviteHash, room.id, Number(inviteExpiry)).then((kept) => {
						if (kept === null) this.d.log({ event: "yepwatch_history_invite_taken", room: room.id.slice(0, 8) })
				  })
				: undefined,
			creator && admission && expiry ? this.d.quotas.record(room.id, admission, creator, Number(expiry)) : undefined,
		])
	}
	/**
	 * Compares a room with its Crate head (a primary-key read). Runs only from the room's copy job, holding its lease.
	 * Consistent: nothing to do. This store's own write whose record was lost (the head's fingerprint is the marked
	 * write's): adopted. Anything else moved the head (a rollback to Crate-only code, a write Valkey lost): Crate's room
	 * replaces the live copy, its revision raised above both so phones take it. The replacement is refused if the room
	 * or its copy bookkeeping changed since it was read.
	 */
	private async reconcile(id: string, member: string, lease: number) {
		const [i, v, r, cs, ct, w, wf] = await this.redis.hmget(K.room(id), "i", "v", "r", "cs", "ct", "w", "wf")
		if (i === null) return "missing"
		const done = () => this.redis.hdel(K.room(id), "x")
		const head = await this.d.crate.head(id)
		if (!head) {
			if (cs) await script(this.redis, "ywUnsync", K.room(id), i)
			await done()
			return "unsynced"
		}
		if (cs && Number(cs) === head.seq && Number(ct) === head.term) {
			// Marked writes are kept: one with a lost answer may still land, until a newer write fences it out.
			await done()
			return "consistent"
		}
		const own = w === null ? undefined : (wf ?? "").split(" ").find((p) => p.endsWith(`:${head.fingerprint}`))
		if (own) {
			const adopted = await script(this.redis, "ywAdopt", K.room(id), K.jobs, i, own.split(":")[0], head.seq, head.term, member, lease, cs ?? "", ct ?? "")
			return Number(adopted) === 1 ? "adopted" : "changed"
		}
		const stored = await this.d.crate.read(id)
		if (!stored) return "missing"
		let room = stored.room
		let pendingRevision = stored.pendingRevision
		let synced = 1
		if (Number(r) >= room.revision) {
			room = { ...structuredClone(room), revision: Number(r) + 1 }
			pendingRevision = room.revision
			synced = 0
		}
		const replaced = await script(
			this.redis,
			"ywReplace",
			K.room(id),
			K.pending,
			K.jobs,
			this.d.now(),
			v!,
			i,
			incarnation(),
			room.revision,
			room.expiresAt,
			pendingRevision,
			room.agreement.state === "checking" ? 1 : 0,
			this.d.repository.encode(room),
			id,
			stored.seq,
			stored.term,
			synced,
			cs ?? "",
			ct ?? "",
			w ?? ""
		)
		if (Number(replaced) !== 1) return "changed"
		this.d.log({ event: "yepwatch_history_replaced", room: id.slice(0, 8), revision: room.revision })
		return "replaced"
	}
	/** Re-imports any mirror the store lost (a fresh or wiped Valkey). */
	async ensureMirrors() {
		const flags = await this.redis.hgetall(K.mirror)
		if (["sessions", "quotas", "invites", "deletions", "rooms"].every((f) => flags[f] === "1")) return
		await this.maintain()
	}
	/** Imports Crate's tables and reconciles rooms; one run at a time. */
	maintain() {
		this.maintaining ??= this.importAll().finally(() => {
			this.maintaining = null
		})
		return this.maintaining
	}
	private async importAll() {
		const now = this.d.now()
		const [revocations, reservations, invites] = await Promise.all([
			this.d.accounts.liveRevocations(now),
			this.d.quotas.liveReservations(),
			this.d.crate.invites(),
		])
		const batch = this.redis.pipeline()
		for (const r of revocations) batch.set(K.revoked(r.key), "1", "PXAT", r.expiresAt, "NX")
		await settled(batch.exec())
		await this.redis.hset(K.mirror, "sessions", "1")
		const quotas = this.redis.pipeline()
		for (const q of reservations) {
			quotas.hsetnx(K.quotaRoom(q.roomId), "c", q.creator)
			quotas.hsetnx(K.quotaRoom(q.roomId), "a", q.admission)
			quotas.hsetnx(K.quotaRoom(q.roomId), "e", q.expiresAt)
			quotas.pexpireat(K.quotaRoom(q.roomId), q.expiresAt + 604800_000)
			quotas.zadd(K.quotaCreator(q.creator), "NX", q.expiresAt, q.roomId)
			quotas.pexpireat(K.quotaCreator(q.creator), q.expiresAt + 86400_000)
		}
		await settled(quotas.exec())
		await this.redis.hset(K.mirror, "quotas", "1")
		const codes = this.redis.pipeline()
		for (const c of invites) {
			const until = c.expiresAt + this.inviteKeepMs
			if (until > now) codes.set(K.invite(c.hash), `${c.roomId} ${c.expiresAt}`, "PXAT", until, "NX")
		}
		await settled(codes.exec())
		await this.redis.hset(K.mirror, "invites", "1")
		await this.d.deletions.importMarkers()
		await this.reconcileAll()
		await this.redis.hset(K.mirror, "rooms", "1")
	}
	/**
	 * Every recent Crate head against the live store: a missing room is imported, a head this store didn't write is
	 * reconciled. Then every room with unsynced versions is queued (a lost job is found again).
	 */
	async reconcileAll() {
		const heads = await this.d.crate.liveHeads(this.d.now() - RECENT_MS)
		let next = 0
		let failed = 0
		// A few at a time: the first start imports every live room before the API answers.
		await Promise.all(
			Array.from({ length: Math.min(8, heads.length) }, async () => {
				while (next < heads.length) {
					const head = heads[next++]
					const [i, cs, ct] = await this.redis.hmget(K.room(head.id), "i", "cs", "ct")
					if (i === null) {
						const stored = await this.d.crate.read(head.id).catch(() => undefined)
						if (stored === undefined) failed++
						else if (stored) await this.d.repository.import(stored)
					} else if (Number(cs) !== head.seq || Number(ct) !== head.term) {
						// Its copy job reconciles it (holding the room's lease); a search may lag, so this only asks.
						await this.redis.multi().hset(K.room(head.id), "x", "1").zadd(K.jobs, "NX", this.d.now(), ROOM_JOB + head.id).exec()
					}
				}
			})
		)
		// Until every live room is in, misses keep reading through from Crate (the rooms mirror stays unset).
		if (failed) throw new Error(`${failed} rooms could not be imported yet`)
		let cursor = "0"
		do {
			const [next, keys] = await this.redis.scan(cursor, "MATCH", K.room("*"), "COUNT", 500)
			cursor = next
			for (const key of keys) {
				const [v, s] = await this.redis.hmget(key, "v", "s")
				if (v !== null && Number(s ?? 0) < Number(v)) await this.redis.zadd(K.jobs, "NX", this.d.now(), ROOM_JOB + key.slice(K.room("").length))
			}
		} while (cursor !== "0")
	}
	/** Queue size and how many jobs keep failing, for readiness and logs. */
	async lag() {
		const [queued, tries] = await Promise.all([this.redis.zcard(K.jobs), this.redis.hvals(K.tries)])
		return { queued, failing: tries.filter((t) => Number(t) >= BEHIND_TRIES).length }
	}
	/**
	 * True when the outbox is empty: nothing queued or in flight could still write a room or decision to Crate (a
	 * deletion purge waits for this). Jobs finish in milliseconds, so the queue is empty nearly all the time.
	 */
	async caughtUp() {
		return (await this.redis.zcard(K.jobs)) === 0
	}
}
