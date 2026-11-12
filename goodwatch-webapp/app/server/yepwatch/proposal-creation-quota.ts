import { creationQuotaTable as quotaTable, creationReservationTable as reservationTable, columns, parseRow, tableDdl } from './proposal-storage-schema.ts'
import { CONTINUOUS_LIMITS } from './continuous-types.ts'
import { IndeterminateWrite, RoomError } from './errors.ts'
import type { Sql } from './repository.server.ts'

interface Reservation { room_id: string; admission_digest: string; expires_at: number }
interface Quota { reservations: Reservation[]; seq: number; term: number; now: number; expiresAt: number }
export interface CreationQuotaStore {
  readonly limit: number
  reserve(roomId: string, admissionDigest: string, creatorDigest: string): Promise<number>
  /**
   * Read only: throws what `reserve` would refuse with now (a full allowance, a changed retry), without writing.
   * Passing is no promise: `reserve` stays the authoritative compare-and-swap.
   */
  eligible(roomId: string, admissionDigest: string, creatorDigest: string): Promise<void>
  active(roomId: string, expectedExpiry?: number): Promise<void>
  count(): Promise<number>
}
export const allowanceFull = (limit: number) => new RoomError('limit_reached', `You can create up to ${limit} rooms at a time. Start again in an existing room, or wait for a room to expire.`, 409)
const busy = () => new RoomError('busy', 'Room allowance could not be confirmed. Retry the same request.', 503, true)
export async function provisionCreationQuotas(sql: Sql, replicas: 0 | 2) {
  for (const table of [quotaTable, reservationTable]) await sql(tableDdl(table, replicas))
}

/** Each person has an independent CAS row. The fixed room proof recovers uncertain acknowledgements. */
export class SqlCreationQuotas implements CreationQuotaStore {
  private readonly sql: Sql
  readonly limit: number
  constructor(sql: Sql, limit = 10) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid personal room allowance')
    this.sql = sql
    this.limit = limit
  }
  private async read(creator: string): Promise<Quota | null> {
    const names = columns(quotaTable)
    const row = (await this.sql(`SELECT ${names.join(',')},_seq_no,_primary_term,CURRENT_TIMESTAMP FROM ${quotaTable.name} WHERE creator_digest=?`, [creator])).rows[0]
    if (!row) return null
    const parsed = parseRow(quotaTable, Object.fromEntries(names.map((k, i) => [k, row[i]])))
    if (parsed.format !== 1 || parsed.creator_digest !== creator || new Set(parsed.reservations.map((r: Reservation) => r.room_id)).size !== parsed.reservations.length) throw busy()
    const now = Number(row[names.length + 2])
    if (!Number.isSafeInteger(now)) throw busy()
    return { reservations: parsed.reservations, expiresAt: parsed.expires_at, seq: Number(row[names.length]), term: Number(row[names.length + 1]), now }
  }
  /**
   * A room's reservation row is written once and only deleted after it expires, so once read it is kept here and
   * a room's proof is one read of its owner's row (still read every time: the reservation must stay in it).
   */
  private reservations = new Map<string, Record<string, any>>()
  private async proof(roomId: string) {
    const cached = this.reservations.get(roomId)
    if (cached) {
      const owner = await this.read(cached.creator_digest)
      if (owner && cached.expires_at <= owner.now) throw new RoomError('expired', 'Room expired', 410)
      if (!owner?.reservations.some(r => r.room_id === roomId && r.admission_digest === cached.admission_digest && r.expires_at === cached.expires_at)) throw busy()
      return cached
    }
    const names = columns(reservationTable)
    const row = (await this.sql(`SELECT ${names.join(',')},CURRENT_TIMESTAMP FROM ${reservationTable.name} WHERE room_id=?`, [roomId])).rows[0]
    if (!row) return null
    const proof = parseRow(reservationTable, Object.fromEntries(names.map((k, i) => [k, row[i]])))
    const now = Number(row[names.length])
    if (proof.room_id !== roomId || !Number.isSafeInteger(now)) throw busy()
    if (proof.expires_at <= now) throw new RoomError('expired', 'Room expired', 410)
    const owner = await this.read(proof.creator_digest)
    if (!owner?.reservations.some(r => r.room_id === roomId && r.admission_digest === proof.admission_digest && r.expires_at === proof.expires_at)) throw busy()
    this.reservations.set(roomId, proof)
    if (this.reservations.size > 4096) this.reservations.delete(this.reservations.keys().next().value!)
    return proof
  }
  async active(roomId: string, expectedExpiry?: number) {
    const proof = await this.proof(roomId)
    if (!proof || (expectedExpiry !== undefined && expectedExpiry !== proof.expires_at)) throw busy()
  }
  async eligible(roomId: string, admissionDigest: string, creator: string) {
    const prior = await this.proof(roomId)
    if (prior) {
      if (prior.admission_digest !== admissionDigest) throw new RoomError('conflict', 'Admission retry changed', 409)
      return
    }
    const current = await this.read(creator)
    if (!current) return
    const live = current.reservations.filter(r => r.expires_at > current.now)
    const own = live.find(r => r.room_id === roomId)
    if (own) {
      // A reservation whose room proof isn't written yet: `reserve` finishes it.
      if (own.admission_digest !== admissionDigest) throw new RoomError('conflict', 'Admission retry changed', 409)
      return
    }
    if (live.length >= this.limit) throw allowanceFull(this.limit)
  }
  async reserve(roomId: string, admissionDigest: string, creator: string) {
    const prior = await this.proof(roomId)
    if (prior) {
      if (prior.admission_digest !== admissionDigest) throw new RoomError('conflict', 'Admission retry changed', 409)
      return prior.expires_at
    }
    for (let attempt = 0; attempt < 12; attempt++) {
      const current = await this.read(creator)
      const now = current?.now ?? Number((await this.sql('SELECT CURRENT_TIMESTAMP')).rows[0]?.[0])
      if (!Number.isSafeInteger(now)) throw busy()
      const reservations = (current?.reservations ?? []).filter(r => r.expires_at > now)
      let reservation = reservations.find(r => r.room_id === roomId)
      if (reservation && reservation.admission_digest !== admissionDigest) throw new RoomError('conflict', 'Admission retry changed', 409)
      if (!reservation) {
        if (reservations.length >= this.limit) throw allowanceFull(this.limit)
        reservation = { room_id: roomId, admission_digest: admissionDigest, expires_at: now + CONTINUOUS_LIMITS.roomMs }
        reservations.push(reservation)
        const expiresAt = Math.max(...reservations.map(r => r.expires_at))
        try {
          const result = current
            ? await this.sql(`UPDATE ${quotaTable.name} SET reservations=?,expires_at=? WHERE creator_digest=? AND _seq_no=? AND _primary_term=?`, [reservations, expiresAt, creator, current.seq, current.term])
            : await this.sql(`INSERT INTO ${quotaTable.name} (creator_digest,format,expires_at,reservations) VALUES (?,?,?,?) ON CONFLICT DO NOTHING`, [creator, 1, expiresAt, reservations])
          if (result.rowcount !== 1) continue
        } catch (error) { if (!(error instanceof IndeterminateWrite)) throw error }
        const confirmed = await this.read(creator)
        if (!confirmed?.reservations.some(r => r.room_id === roomId && r.admission_digest === admissionDigest && r.expires_at === reservation!.expires_at)) continue
      }
      try {
        await this.sql(`INSERT INTO ${reservationTable.name} (room_id,creator_digest,admission_digest,expires_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING`, [roomId, creator, admissionDigest, reservation.expires_at])
      } catch (error) { if (!(error instanceof IndeterminateWrite)) throw error }
      const confirmed = await this.proof(roomId)
      if (confirmed?.admission_digest === admissionDigest) return confirmed.expires_at
      if (confirmed) throw new RoomError('conflict', 'Admission retry changed', 409)
    }
    throw busy()
  }
  async count() { return Number((await this.sql(`SELECT count(*) FROM ${reservationTable.name} WHERE expires_at>CURRENT_TIMESTAMP`)).rows[0]?.[0] ?? 0) }
  /** Search finds candidates only; a current primary-key read and CAS protect a newly renewed allowance. */
  async purgeExpired() {
    const candidates = (await this.sql(`SELECT creator_digest FROM ${quotaTable.name} WHERE expires_at<=CURRENT_TIMESTAMP LIMIT 100`)).rows
    for (const [creator] of candidates) {
      const current = await this.read(String(creator))
      if (current && current.expiresAt <= current.now) await this.sql(`DELETE FROM ${quotaTable.name} WHERE creator_digest=? AND _seq_no=? AND _primary_term=?`, [creator, current.seq, current.term])
    }
    const rooms = (await this.sql(`SELECT room_id FROM ${reservationTable.name} WHERE expires_at<=CURRENT_TIMESTAMP LIMIT 100`)).rows
    for (const [roomId] of rooms) {
      const row = (await this.sql(`SELECT expires_at,_seq_no,_primary_term,CURRENT_TIMESTAMP FROM ${reservationTable.name} WHERE room_id=?`, [roomId])).rows[0]
      if (row && Number(row[0]) <= Number(row[3])) await this.sql(`DELETE FROM ${reservationTable.name} WHERE room_id=? AND _seq_no=? AND _primary_term=?`, [roomId, row[1], row[2]])
    }
  }
}
