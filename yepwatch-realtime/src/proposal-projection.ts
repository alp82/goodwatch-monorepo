import { z } from 'zod'
import type { SharedRoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal'
import { continuousSharedSchema } from './continuous-projection.js'

const id = z.string().min(1).max(256)
const count = z.number().int().nonnegative().safe()
const average = z.number().finite().min(0).max(1_200_000).nullable()
export const proposalSharedSchema = continuousSharedSchema.extend({
  contractVersion: z.literal(3),
  savedServiceIds: z.array(z.number().int().positive()).max(1200).optional(),
  participants: z.array(continuousSharedSchema.shape.participants.element.extend({ dropped: z.boolean().optional() })).max(12),
  description: z.strictObject({prompt:z.string().max(1000),attributes:z.array(z.strictObject({text:z.string().max(200),kind:z.enum(['attribute','excluded','want','avoid','phrase']),key:z.string().max(100).optional()})).max(100)}).nullable().optional(),
  candidates: z.array(continuousSharedSchema.shape.candidates.element.extend({
    viewingDuration: z.strictObject({ minutes: z.number().finite().positive(), scope: z.enum(['movie', 'episode']) }).nullable(),
  })).max(512),
  matches: z.array(z.strictObject({ candidateId: id, averageYepMs: average })).max(512),
  proposalVersion: count,
  proposal: z.strictObject({ candidateId: id, version: count, previousCandidateId: id.nullable(),
    agreeCount: count, requiredCount: count, averageYepMs: average }).nullable(),
  decision: continuousSharedSchema.shape.decision.unwrap().omit({ agreementVersion: true }).extend({ proposalVersion: count }).nullable(),
}) satisfies z.ZodType<SharedRoomSnapshot>

export function proposalProjection(input: unknown, roomId: string): SharedRoomSnapshot {
  const value = proposalSharedSchema.parse(input)
  if (value.roomId !== roomId) throw new Error('Projection room mismatch')
  const people = new Set(value.participants.map(p => p.participantId))
  const required = value.participants.filter(p => !p.dropped).length
  const candidates = new Set(value.candidates.map(c => c.id))
  const matches = new Map(value.matches.map(m => [m.candidateId, m]))
  if (people.size !== value.participants.length || (people.size > 0 && !people.has(value.hostParticipantId)) ||
      candidates.size !== value.candidates.length || matches.size !== value.matches.length ||
      value.matches.some(m => !candidates.has(m.candidateId))) throw new Error('Ambiguous proposal projection')
  if (value.candidates.some(c => c.viewingDuration && c.viewingDuration.scope !== (c.identity.kind === 'movie' ? 'movie' : 'episode')))
    throw new Error('Invalid duration scope')
  const proposal = value.proposal
  // A late join preserves the proposal while its current all-Yep match is pending.
  if (proposal && (!candidates.has(proposal.candidateId) || proposal.version !== value.proposalVersion ||
      proposal.requiredCount !== required || proposal.agreeCount > proposal.requiredCount ||
      proposal.averageYepMs !== (matches.get(proposal.candidateId)?.averageYepMs ?? null))) throw new Error('Invalid proposal aggregate')
  if ((value.phase === 'setup' && (value.matches.length || proposal || value.decision)) ||
      ((value.phase === 'decided') !== !!value.decision) ||
      (value.decision && (!proposal || proposal.candidateId !== value.decision.candidateId ||
        value.decision.proposalVersion !== proposal.version)))
    throw new Error('Invalid proposal decision')
  return value
}
