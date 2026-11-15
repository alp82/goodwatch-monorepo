import type { Sql } from './repository.server.ts'
import type { ProposalRepository, ProposalRoom } from './proposal-types.ts'
import { emitRoundOutcome, recordOutcome } from './proposal-outcome.ts'

/** Bounded minute sweep at logical expiry, independent of the 30-day physical retention window. */
export async function expiredRoundOutcomes(sql: Sql, repository: ProposalRepository, now: number, roundEnded?: (room: ProposalRoom) => Promise<void>) {
  const ids = (await sql('SELECT id FROM doc.yepwatch_room WHERE expires_at<=? AND started_at IS NOT NULL AND outcome_emitted_at IS NULL ORDER BY expires_at,id LIMIT 100', [now])).rows
  for (const [id] of ids) {
    const old = await repository.read(String(id))
    if (!old || old.room.expiresAt > now || old.room.startedAt == null || old.room.outcomeEmittedAt != null) continue
    const room = structuredClone(old.room)
    recordOutcome(room, undefined, room.expiresAt)
    room.outcomeEmittedAt = now
    room.revision++
    if (!await repository.compareAndSwap(old, room, false)) continue
    emitRoundOutcome(room, room.phase === 'decided' ? 'decision' : 'expiry')
    await roundEnded?.(room).catch(() => {})
  }
}
