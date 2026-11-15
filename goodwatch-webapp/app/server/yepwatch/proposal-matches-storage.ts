import { z } from 'zod'
import type { ProposalRoom } from './proposal-types.ts'
const n = z.number().int().nonnegative().safe()
const id = z.string().min(1).max(256)
const favorite = z.strictObject({ tiebreakVersion: n, candidateId: id.nullable() }).nullable()
const state = z.strictObject({
  tiebreak: z.strictObject({ version: n, candidateIds: z.array(id).min(2).max(512), seed: z.string().min(8).max(64),
    outcome: z.strictObject({ candidateId: id, spun: z.boolean(), among: z.array(id).min(1).max(512) }).nullable() }).nullable(),
  participants: z.array(z.strictObject({ id, ins: z.array(id).max(512), inRevision: n, favorite })).max(12),
})
/** This checkout has typed participant rows, so the additive room TEXT holds the private extension too. */
export function encodeMatches(room: ProposalRoom) {
  return JSON.stringify(state.parse({ tiebreak: room.tiebreak ?? null, participants: room.participants.map(p => ({ id: p.id,
    ins: p.ins ?? (room.proposal && p.approvedProposalVersion === room.proposal.version ? [room.proposal.candidateId] : []),
    inRevision: p.inRevision ?? p.agreementRevision, favorite: p.favorite ?? null })) }))
}
export function decodeMatches(room: ProposalRoom, record: string | null | undefined) {
  if (record == null) return
  const value = state.parse(JSON.parse(record))
  if (new Set(value.participants.map(p => p.id)).size !== value.participants.length) throw new Error('Invalid matches participants')
  for (const p of room.participants) {
    const stored = value.participants.find(s => s.id === p.id)
    p.ins = stored?.ins ?? []; p.inRevision = stored?.inRevision ?? p.agreementRevision; p.favorite = stored?.favorite ?? null
  }
  room.tiebreak = value.tiebreak
}
