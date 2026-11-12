import type { Sql } from "./repository.server.ts"
import type { HistoricalDecision } from "./proposal-types.ts"
import type { DeletionSubject } from "./proposal-deletion.ts"
import { invitationTable, tables, type Table } from "./proposal-storage-schema.ts"

export const DAY_MS = 86_400_000
export const DEFAULT_ROOM_RETENTION_DAYS = 30
/** The floor is enforced here, not only in configuration: no caller can delete a room less than a day after it expired. */
export const MIN_ROOM_RETENTION_DAYS = 1
/** More distinct people than this in one room's participant records cannot be proven free of deletion requests. */
const PEOPLE_PER_ROOM = 64
/** A room that failed waits 2^failures runs (at most this many) before this instance tries it again. */
const MAX_BACKOFF_RUNS = 60
const REMEMBERED_FAILURES = 1000

/** What the cleanup needs from the relational repository: the committed head and the account stores. */
export interface RetentionRepository {
	read(id: string): Promise<{
		room: { expiresAt: number; inviteHash: string; history?: HistoricalDecision[]; participants: { id: string; memberUserId?: string | null }[] }
		seq: number
		term: number
	} | null>
	accountStore: { publish(decisions: HistoricalDecision[]): Promise<void> }
	/** Primary-key reads of account and guest deletion requests. */
	deletionStore: { get(subject: DeletionSubject): Promise<unknown | null> }
}

export interface RoomRetentionOptions {
	retentionDays: number
	/** Heads examined per run. */
	roomsPerRun?: number
	/** Rows scanned per record table and named by one DELETE (by primary key). */
	rowsPerStatement?: number
	/** Rows deleted per run; the runtime runs once a minute, so this is the per-minute bound per API instance. */
	rowsPerRun?: number
}

export interface RoomRetentionReport {
	cutoff: number
	/** Heads removed. */
	rooms: number
	/** Unreadable heads that still have work to publish; they stay. */
	skipped: number
	/** Rooms with a person whose deletion request is open: the deletion purge removes them, nothing is published here. */
	waiting: number
	/** Rooms whose cleanup threw; retried by this instance after a backoff. */
	failed: number
	deleted: Record<string, number>
}

const ROOM = tables.room.name
const PARTICIPANT = tables.participant.name
/** Everything that carries a room's id and its expiry, apart from the head. Account history and revocations are not room data. */
export const ROOM_RECORD_TABLES: Table[] = [
	invitationTable,
	...Object.values(tables).filter((t) => t !== tables.room),
]

/**
 * Deletes every row of rooms that expired at least `retentionDays` ago, while the service is live.
 *
 * Room expiry never changes and every record repeats it, so `expires_at <= cutoff` can only match rooms that
 * expired long ago: no live or recently expired room, and no receipt or exact retry that can still be honoured
 * (sessions, tickets and receipts all end with the room).
 *
 * Order keeps readers whole: the room's decisions are published to account history, then its invitation (by primary
 * key) and its head (by primary-key compare-and-swap) go, so nothing can reach the room any more; only then are its
 * records removed. A run that stops in between leaves records no reader can find, and a later run finds them by their
 * own expiry.
 *
 * Deletion requests: a room with any participant whose account or guest deletion is still open is left alone. That
 * request's purge erases the person from history and deletes the room itself (it needs the participant rows to find
 * the person's history entries), and publishing history from such a room could race the purge's history scrub. A
 * purge can only start 30 days after its request, so a request made after this check cannot purge during the run.
 *
 * Progress: heads and each record table are walked with a rotating primary-key cursor held by this instance, so rooms
 * that must stay (unreadable, waiting for a deletion, failing) never hide the ones behind them. A failing room is
 * retried after 2, 4, … up to 60 runs.
 *
 * Work per run (bounded, the runtime calls it once a minute per API instance), with R = roomsPerRun,
 * N = rowsPerStatement and T = ROOM_RECORD_TABLES.length:
 * - one clock read and 1 + T scans (heads, one per record table), each returning at most R or N rows (key + room id);
 * - per head (at most R): its primary-key reads (head and at most 12 participants' records), one participant
 *   scan of that room (at most 64 rows), at most 2 × 64 primary-key deletion-request reads, the room's history
 *   publication (at most 128 decisions), one invitation and one head DELETE by primary key;
 * - per record table: at most N head reads by primary key and one DELETE naming at most N primary keys;
 * - at most rowsPerRun rows deleted in total.
 * Defaults (R 10, N 100, 1000 rows, T 13): ≤ 14 scans, ≤ 1300 primary-key head checks, ≤ 20 + 13 DELETEs, ≤ 1000 rows.
 *
 * Several API instances may run this at once: heads are removed with a primary-key compare-and-swap, records by
 * primary key with the expiry predicate repeated, so a second runner deletes nothing twice.
 */
export class RoomRetention {
	private sql: Sql
	private repository: RetentionRepository
	private retentionMs: number
	private roomsPerRun: number
	private rowsPerStatement: number
	private rowsPerRun: number
	private headCursor = ""
	private recordCursors = new Map<string, string>()
	private runs = 0
	private failures = new Map<string, { count: number; retryAt: number }>()
	constructor(sql: Sql, repository: RetentionRepository, options: RoomRetentionOptions) {
		if (!Number.isFinite(options.retentionDays) || options.retentionDays < MIN_ROOM_RETENTION_DAYS)
			throw new Error(`Room retention must be at least ${MIN_ROOM_RETENTION_DAYS} day`)
		this.sql = sql
		this.repository = repository
		this.retentionMs = Math.round(options.retentionDays * DAY_MS)
		this.roomsPerRun = bounded(options.roomsPerRun ?? 10, 1, 100)
		this.rowsPerStatement = bounded(options.rowsPerStatement ?? 100, 1, 500)
		this.rowsPerRun = bounded(options.rowsPerRun ?? 1000, 1, 10_000)
	}

	async run(): Promise<RoomRetentionReport> {
		const run = ++this.runs
		// The database clock, like room admission and the operator purge.
		const now = Number((await this.sql("SELECT CURRENT_TIMESTAMP")).rows[0]?.[0])
		if (!Number.isSafeInteger(now)) throw new Error("Store clock unavailable")
		const cutoff = now - this.retentionMs
		const report: RoomRetentionReport = { cutoff, rooms: 0, skipped: 0, waiting: 0, failed: 0, deleted: {} }
		let budget = this.rowsPerRun
		const count = (table: string, rows: number) => {
			if (!rows) return
			report.deleted[table] = (report.deleted[table] ?? 0) + rows
			budget -= rows
		}

		const limit = Math.min(this.roomsPerRun, budget)
		const heads = (await this.sql(`SELECT id FROM ${ROOM} WHERE expires_at<=? AND id>? ORDER BY id LIMIT ?`, [cutoff, this.headCursor, limit])).rows.map((r) => String(r[0]))
		this.headCursor = heads.length < limit ? "" : heads[heads.length - 1]
		for (const id of heads) {
			if (budget < 2) break
			const failure = this.failures.get(id)
			if (failure && failure.retryAt > run) continue
			try {
				const outcome = await this.removeHead(id, cutoff, count)
				if (outcome === "removed") report.rooms++
				else if (outcome === "skipped") report.skipped++
				else if (outcome === "waiting") report.waiting++
				this.failures.delete(id)
			} catch {
				report.failed++
				const n = (failure?.count ?? 0) + 1
				this.failures.delete(id)
				this.failures.set(id, { count: n, retryAt: run + Math.min(2 ** n, MAX_BACKOFF_RUNS) })
				if (this.failures.size > REMEMBERED_FAILURES) this.failures.delete(this.failures.keys().next().value!)
			}
		}

		// Records of rooms whose head is gone, found by their own expiry: a bounded window per table, checked by primary key.
		for (const table of ROOM_RECORD_TABLES) {
			if (budget <= 0) break
			const window = Math.min(this.rowsPerStatement, budget)
			const rows = (
				await this.sql(`SELECT ${table.primary},room_id FROM ${table.name} WHERE expires_at<=? AND ${table.primary}>? ORDER BY ${table.primary} LIMIT ?`, [
					cutoff,
					this.recordCursors.get(table.name) ?? "",
					window,
				])
			).rows.map((r) => ({ key: String(r[0]), room: String(r[1]) }))
			this.recordCursors.set(table.name, rows.length < window ? "" : rows[rows.length - 1].key)
			if (!rows.length) continue
			const open = new Set<string>()
			for (const room of new Set(rows.map((r) => r.room)))
				if ((await this.sql(`SELECT id FROM ${ROOM} WHERE id=?`, [room])).rows.length) open.add(room)
			const keys = rows.filter((r) => !open.has(r.room)).map((r) => r.key)
			if (keys.length)
				count(table.name, (await this.sql(`DELETE FROM ${table.name} WHERE ${table.primary}=ANY(?) AND expires_at<=?`, [keys, cutoff])).rowcount)
		}
		return report
	}

	/** Publishes the room's decisions, then removes its invitation and head; leaves it when it must stay for now. */
	private async removeHead(id: string, cutoff: number, count: (table: string, rows: number) => void): Promise<"removed" | "skipped" | "waiting" | "gone"> {
		let head: { seq: number; term: number; inviteHash: string; history: HistoricalDecision[]; people: { id: string; memberUserId?: string | null }[] }
		try {
			const stored = await this.repository.read(id)
			if (!stored || stored.room.expiresAt > cutoff) return "gone"
			head = { seq: stored.seq, term: stored.term, inviteHash: stored.room.inviteHash, history: stored.room.history ?? [], people: stored.room.participants }
		} catch {
			// A head whose records are already incomplete cannot be read. It may go only if nothing is left to publish.
			const raw = (await this.sql(`SELECT expires_at,pending_revision,pending_agreement,_seq_no,_primary_term,invite_hash FROM ${ROOM} WHERE id=?`, [id])).rows[0]
			if (!raw || Number(raw[0]) > cutoff) return "gone"
			if (Number(raw[1]) !== 0 || raw[2] !== false) return "skipped"
			head = { seq: Number(raw[3]), term: Number(raw[4]), inviteHash: String(raw[5]), history: [], people: [] }
		}
		if (await this.deletionOpen(id, head.people)) return "waiting"
		await this.repository.accountStore.publish(head.history)
		count(invitationTable.name, (await this.sql(`DELETE FROM ${invitationTable.name} WHERE code_hash=? AND room_id=? AND expires_at<=?`, [head.inviteHash, id, cutoff])).rowcount)
		// Crate 5.10 rejects extra predicates beside a CAS; the head read above proved the expiry.
		const removed = (await this.sql(`DELETE FROM ${ROOM} WHERE id=? AND _seq_no=? AND _primary_term=?`, [id, head.seq, head.term])).rowcount
		count(ROOM, removed)
		return removed ? "removed" : "gone"
	}

	/** Whether anyone who was ever in the room (head or participant records) has an open deletion request. */
	private async deletionOpen(roomId: string, people: { id: string; memberUserId?: string | null }[]) {
		const rows = (await this.sql(`SELECT DISTINCT participant_id,member_user_id FROM ${PARTICIPANT} WHERE room_id=? LIMIT ?`, [roomId, PEOPLE_PER_ROOM])).rows
		if (rows.length >= PEOPLE_PER_ROOM) throw new Error("Too many people to check for deletion requests")
		const participants = new Set(people.map((p) => p.id))
		const accounts = new Set(people.flatMap((p) => (p.memberUserId ? [p.memberUserId] : [])))
		for (const [participant, account] of rows) {
			participants.add(String(participant))
			if (account) accounts.add(String(account))
		}
		for (const userId of accounts) if (await this.repository.deletionStore.get({ kind: "account", userId })) return true
		for (const participantId of participants) if (await this.repository.deletionStore.get({ kind: "guest", roomId, participantId })) return true
		return false
	}
}

function bounded(value: number, min: number, max: number) {
	if (!Number.isInteger(value) || value < min || value > max) throw new Error("Invalid room retention bound")
	return value
}

export function hasDeletions(report: RoomRetentionReport) {
	return report.skipped > 0 || report.waiting > 0 || report.failed > 0 || Object.keys(report.deleted).length > 0
}

/**
 * Runs the minute's cleanup operations together, one round at a time: a new round starts only after every operation of
 * the previous one has settled, whether it succeeded or failed. Returns the tick to call from the timer.
 */
export function cleanupRounds(operations: (() => Promise<unknown>)[], onFailure: (error: unknown) => void) {
	let running: Promise<void> | null = null
	return function tick(): Promise<void> | null {
		if (running) return null
		running = Promise.allSettled(operations.map((op) => Promise.resolve().then(op))).then((results) => {
			for (const result of results) if (result.status === "rejected") onFailure(result.reason)
		}).finally(() => {
			running = null
		})
		return running
	}
}
