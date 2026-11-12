import type { Sql } from "./repository.server.ts"
import type { HistoricalDecision } from "./proposal-types.ts"
import { invitationTable, tables, type Table } from "./proposal-storage-schema.ts"

export const DAY_MS = 86_400_000
export const DEFAULT_ROOM_RETENTION_DAYS = 30
/** The floor is enforced here, not only in configuration: no caller can delete a room less than a day after it expired. */
export const MIN_ROOM_RETENTION_DAYS = 1

/** What the cleanup needs from the relational repository: the committed head and the account stores. */
export interface RetentionRepository {
	read(id: string): Promise<{ room: { expiresAt: number; history?: HistoricalDecision[] }; seq: number; term: number } | null>
	accountStore: { publish(decisions: HistoricalDecision[]): Promise<void> }
	deletionStore: { retainTargetsBeforeRoomCleanup(): Promise<void> }
}

export interface RoomRetentionOptions {
	retentionDays: number
	/** Heads removed per run. Each costs one primary-key read, a history publication and two small deletes. */
	roomsPerRun?: number
	/** Rows named by one DELETE (by primary key). */
	rowsPerStatement?: number
	/** Rows deleted per run; the runtime runs once a minute, so this is the per-minute bound per API instance. */
	rowsPerRun?: number
}

export interface RoomRetentionReport {
	cutoff: number
	rooms: number
	skipped: number
	deleted: Record<string, number>
}

const ROOM = tables.room.name
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
 * Order keeps readers whole: the invitation and then the head go first (after the room's decisions are published to
 * account history), so nothing can reach the room any more; only then are its records removed. A run that stops in
 * between leaves records no reader can find, and the next run finds them by their own expiry.
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
		// The database clock, like room admission and the operator purge.
		const now = Number((await this.sql("SELECT CURRENT_TIMESTAMP")).rows[0]?.[0])
		if (!Number.isSafeInteger(now)) throw new Error("Store clock unavailable")
		const cutoff = now - this.retentionMs
		const report: RoomRetentionReport = { cutoff, rooms: 0, skipped: 0, deleted: {} }
		let budget = this.rowsPerRun
		const count = (table: string, rows: number) => {
			if (!rows) return
			report.deleted[table] = (report.deleted[table] ?? 0) + rows
			budget -= rows
		}

		const heads = (
			await this.sql(`SELECT id FROM ${ROOM} WHERE expires_at<=? ORDER BY expires_at LIMIT ?`, [
				cutoff,
				Math.min(this.roomsPerRun, budget),
			])
		).rows.map((r) => String(r[0]))
		// An account deletion keeps the identities it must still erase before their participant rows go.
		if (heads.length) await this.repository.deletionStore.retainTargetsBeforeRoomCleanup()
		for (const id of heads) {
			if (budget <= 0) break
			const head = await this.closedHead(id, cutoff)
			if (!head) {
				report.skipped++
				continue
			}
			count(invitationTable.name, (await this.sql(`DELETE FROM ${invitationTable.name} WHERE room_id=? AND expires_at<=?`, [id, cutoff])).rowcount)
			// Crate 5.10 rejects extra predicates beside a CAS; the head read above proved the expiry.
			const removed = (await this.sql(`DELETE FROM ${ROOM} WHERE id=? AND _seq_no=? AND _primary_term=?`, [id, head.seq, head.term])).rowcount
			count(ROOM, removed)
			if (removed) report.rooms++
		}

		// Records of rooms whose head is gone, found by their own expiry, a bounded batch per statement.
		for (const table of ROOM_RECORD_TABLES) {
			if (budget <= 0) break
			const rows = (
				await this.sql(
					`SELECT ${table.primary},room_id FROM ${table.name} WHERE expires_at<=? AND room_id NOT IN (SELECT id FROM ${ROOM}) LIMIT ?`,
					[cutoff, Math.min(this.rowsPerStatement, budget)]
				)
			).rows.map((r) => ({ key: String(r[0]), room: String(r[1]) }))
			if (!rows.length) continue
			// The search above can lag; a head read by primary key is current.
			const open = new Set<string>()
			for (const room of new Set(rows.map((r) => r.room)))
				if ((await this.sql(`SELECT id FROM ${ROOM} WHERE id=?`, [room])).rows.length) open.add(room)
			const keys = rows.filter((r) => !open.has(r.room)).map((r) => r.key)
			if (keys.length)
				count(table.name, (await this.sql(`DELETE FROM ${table.name} WHERE ${table.primary}=ANY(?) AND expires_at<=?`, [keys, cutoff])).rowcount)
		}
		return report
	}

	/** The committed head, once its decisions are in account history; null when it must stay for now. */
	private async closedHead(id: string, cutoff: number) {
		let stored: Awaited<ReturnType<RetentionRepository["read"]>>
		try {
			stored = await this.repository.read(id)
		} catch {
			// A head whose records are already incomplete cannot be read. It may go only if nothing is left to publish.
			const raw = (await this.sql(`SELECT expires_at,pending_revision,pending_agreement,_seq_no,_primary_term FROM ${ROOM} WHERE id=?`, [id])).rows[0]
			if (!raw || Number(raw[0]) > cutoff || Number(raw[1]) !== 0 || raw[2] !== false) return null
			return { seq: Number(raw[3]), term: Number(raw[4]) }
		}
		if (!stored || stored.room.expiresAt > cutoff) return null
		await this.repository.accountStore.publish(stored.room.history ?? [])
		return { seq: stored.seq, term: stored.term }
	}
}

function bounded(value: number, min: number, max: number) {
	if (!Number.isInteger(value) || value < min || value > max) throw new Error("Invalid room retention bound")
	return value
}

export function hasDeletions(report: RoomRetentionReport) {
	return report.skipped > 0 || Object.keys(report.deleted).length > 0
}
