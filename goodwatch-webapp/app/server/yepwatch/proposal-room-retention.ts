import type { Sql } from "./repository.server.ts"
import type { HistoricalDecision } from "./proposal-types.ts"
import type { DeletionSubject } from "./proposal-deletion.ts"
import { invitationTable, tables, type Table } from "./proposal-storage-schema.ts"

export const DAY_MS = 86_400_000
export const DEFAULT_ROOM_RETENTION_DAYS = 30
/** The floor is enforced here, not only in configuration: no caller can delete a room less than a day after it expired. */
export const MIN_ROOM_RETENTION_DAYS = 1
/** Participant records checked for deletion requests per room and run; a room with more continues on later runs. */
const PARTICIPANT_PAGE = 64
/**
 * A room's identity check that started longer ago than this starts over. A purge only begins 30 days after its request,
 * so no purge can be running for an identity found free less than a day ago.
 */
const CHECK_VALID_MS = DAY_MS
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
	/** Rooms with more participant records than one run checks for deletion requests; the check continues next run. */
	checking: number
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
 * Participant records are not bounded by the roster, so they are checked 64 per run across as many runs as needed;
 * the head's people are rechecked in the run that removes it, and a check older than a day starts over.
 *
 * Progress: heads and each record table are walked with a rotating primary-key cursor held by this instance, so rooms
 * that must stay (unreadable, waiting for a deletion, failing) never hide the ones behind them. The record table that
 * is scanned first rotates every run, so no table waits behind the others for the shared row budget. A failing room
 * is retried after 2, 4, … up to 60 runs.
 *
 * Work per run (bounded, the runtime calls it once a minute per API instance), with R = roomsPerRun,
 * N = rowsPerStatement, T = ROOM_RECORD_TABLES.length and P = 64 participant records per room:
 * - one clock read and at most 1 + T + R scans: heads (≤ R rows), one per record table (≤ N rows), and one page of
 *   each examined head's participant records (≤ P rows);
 * - per head (at most R): its repository read (head and at most 12 participants' records) or, when that fails, one raw
 *   head read; at most 2 × (12 + P) primary-key deletion-request reads (accounts and guests of the head's people and
 *   of the page); the room's history publication; one invitation and one head DELETE by primary key;
 * - per record table: at most N head reads by primary key and one DELETE naming at most N primary keys;
 * - at most rowsPerRun rows deleted in total.
 * Defaults (R 10, N 100, 1000 rows, T 13, P 64): ≤ 24 scans, ≤ 1320 primary-key head reads (1300 record checks and
 * 2 per head), ≤ 152 deletion-request reads per head (1520 per run), ≤ 20 + 13 DELETEs, ≤ 1000 rows.
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
	private tableStart = 0
	/** Per room: the participant record after which its deletion-request check continues, and when the check began. */
	private checks = new Map<string, { cursor: string; since: number }>()
	private failures = new Map<string, { count: number; retryAt: number }>()
	constructor(sql: Sql, repository: RetentionRepository, options: RoomRetentionOptions) {
		if (!Number.isFinite(options.retentionDays) || options.retentionDays < MIN_ROOM_RETENTION_DAYS)
			throw new Error(`Room retention must be at least ${MIN_ROOM_RETENTION_DAYS} day`)
		this.sql = sql
		this.repository = repository
		this.retentionMs = Math.round(options.retentionDays * DAY_MS)
		this.roomsPerRun = bounded(options.roomsPerRun ?? 10, 1, 100)
		this.rowsPerStatement = bounded(options.rowsPerStatement ?? 100, 1, 500)
		// A head needs two rows of budget (its invitation and itself).
		this.rowsPerRun = bounded(options.rowsPerRun ?? 1000, 2, 10_000)
	}

	async run(): Promise<RoomRetentionReport> {
		const run = ++this.runs
		// The database clock, like room admission and the operator purge.
		const now = Number((await this.sql("SELECT CURRENT_TIMESTAMP")).rows[0]?.[0])
		if (!Number.isSafeInteger(now)) throw new Error("Store clock unavailable")
		const cutoff = now - this.retentionMs
		const report: RoomRetentionReport = { cutoff, rooms: 0, skipped: 0, waiting: 0, checking: 0, failed: 0, deleted: {} }
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
				const outcome = await this.removeHead(id, cutoff, now, count)
				if (outcome === "removed") report.rooms++
				else if (outcome === "skipped") report.skipped++
				else if (outcome === "waiting") report.waiting++
				else if (outcome === "checking") report.checking++
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
		// The first table rotates, so tables late in the list still get the budget when earlier ones have plenty to delete.
		const start = this.tableStart
		this.tableStart = (start + 1) % ROOM_RECORD_TABLES.length
		for (const table of [...ROOM_RECORD_TABLES.slice(start), ...ROOM_RECORD_TABLES.slice(0, start)]) {
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
	private async removeHead(
		id: string,
		cutoff: number,
		now: number,
		count: (table: string, rows: number) => void
	): Promise<"removed" | "skipped" | "waiting" | "checking" | "gone"> {
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
		const check = await this.deletionCheck(id, head.people, now)
		if (check !== "clear") return check
		await this.repository.accountStore.publish(head.history)
		count(invitationTable.name, (await this.sql(`DELETE FROM ${invitationTable.name} WHERE code_hash=? AND room_id=? AND expires_at<=?`, [head.inviteHash, id, cutoff])).rowcount)
		// Crate 5.10 rejects extra predicates beside a CAS; the head read above proved the expiry.
		const removed = (await this.sql(`DELETE FROM ${ROOM} WHERE id=? AND _seq_no=? AND _primary_term=?`, [id, head.seq, head.term])).rowcount
		count(ROOM, removed)
		return removed ? "removed" : "gone"
	}

	/**
	 * Whether anyone who was ever in the room (head or participant records) has an open deletion request. Participant
	 * records are not bounded by the roster (guests who joined and merged leave theirs), so they are checked one page per
	 * run, continuing where the last run stopped. The head's people are checked on every run, so the run that removes the
	 * head has rechecked them right before; identities from earlier pages were found free within CHECK_VALID_MS.
	 */
	private async deletionCheck(roomId: string, people: { id: string; memberUserId?: string | null }[], now: number): Promise<"clear" | "waiting" | "checking"> {
		let progress = this.checks.get(roomId)
		if (!progress || now - progress.since > CHECK_VALID_MS) progress = { cursor: "", since: now }
		const page = (
			await this.sql(`SELECT ${tables.participant.primary},participant_id,member_user_id FROM ${PARTICIPANT} WHERE room_id=? AND ${tables.participant.primary}>? ORDER BY ${tables.participant.primary} LIMIT ?`, [
				roomId,
				progress.cursor,
				PARTICIPANT_PAGE,
			])
		).rows
		const participants = new Set(people.map((p) => p.id))
		const accounts = new Set(people.flatMap((p) => (p.memberUserId ? [p.memberUserId] : [])))
		for (const [, participant, account] of page) {
			participants.add(String(participant))
			if (account) accounts.add(String(account))
		}
		let open = false
		for (const userId of accounts) if (!open && (await this.repository.deletionStore.get({ kind: "account", userId }))) open = true
		for (const participantId of participants) if (!open && (await this.repository.deletionStore.get({ kind: "guest", roomId, participantId }))) open = true
		this.checks.delete(roomId)
		// Once a request is restored the whole room is checked again from the start.
		if (open) return "waiting"
		if (page.length < PARTICIPANT_PAGE) return "clear"
		this.checks.set(roomId, { cursor: String(page[page.length - 1][0]), since: progress.since })
		if (this.checks.size > REMEMBERED_FAILURES) this.checks.delete(this.checks.keys().next().value!)
		return "checking"
	}
}

function bounded(value: number, min: number, max: number) {
	if (!Number.isInteger(value) || value < min || value > max) throw new Error("Invalid room retention bound")
	return value
}

export function hasDeletions(report: RoomRetentionReport) {
	return report.skipped > 0 || report.waiting > 0 || report.checking > 0 || report.failed > 0 || Object.keys(report.deleted).length > 0
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
