import { z } from 'zod'
import { clientActivitySchema, serverActivitySchema } from './activity-protocol.js'
import type { ClientActivity, ServerActivity, MatchInspection, DecisionCheer } from '@goodwatch/yepwatch-contracts/proposal'

/** These refer only to the shared matches room, never a private choosing card. */
export const inspectionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('poster'), candidateId: z.string().min(1).max(256) }),
  z.strictObject({ kind: z.literal('lens') }),
  z.strictObject({ kind: z.literal('dice') }),
])
export type Inspection = MatchInspection
export const pointerSchema = z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), pressed: z.boolean(), kind: z.enum(['mouse', 'touch']) })
export const cheerSchema = z.strictObject({ kind: z.enum(['tap', 'hold', 'release']), generation: z.number().int().nonnegative().safe(), seed: z.number().int().min(0).max(2147483647) }) satisfies z.ZodType<DecisionCheer>
const inspection = { cheer: cheerSchema.optional(), inspection: inspectionSchema.optional(), pointer: pointerSchema.nullable().optional() }
function scope(frame: { view: string; inspection?: Inspection; beat?: 'answer'; pointer?: unknown; cheer?: DecisionCheer; gesture?: string }, context: z.RefinementCtx) {
  if (frame.cheer && (frame.view !== 'matches' || frame.inspection || frame.pointer !== undefined || frame.beat || frame.gesture)) context.addIssue({ code: 'custom', message: 'Cheer requires an exclusive matches action' })
  if (frame.pointer !== undefined && frame.view !== 'voting') context.addIssue({ code: 'custom', message: 'Pointer requires voting view' })
  if (frame.inspection && frame.view !== 'matches') context.addIssue({ code: 'custom', message: 'Inspection requires matches view' })
  if (frame.beat && frame.view !== 'voting') context.addIssue({ code: 'custom', message: 'Answer pulse requires private voting view' })
}
export const proposalClientActivitySchema = clientActivitySchema.extend(inspection).superRefine(scope) satisfies z.ZodType<ClientActivity>
export const proposalServerActivitySchema = serverActivitySchema.extend(inspection).superRefine(scope) satisfies z.ZodType<ServerActivity>
export function inspectionAllowed(frame: { inspection?: Inspection }, snapshot?: { matches: { candidateId: string }[] }) {
  const inspection = frame.inspection
  return !inspection || (!!snapshot?.matches.length && (inspection.kind !== 'poster' ||
    snapshot.matches.some(match => match.candidateId === inspection.candidateId)))
}

export interface DecisionActivityScope {
  phase: string
  generation: number
  participants: { participantId: string; dropped?: boolean }[]
}
/** Rechecked at accept, queued delivery and receipt against each authorized snapshot. */
export function cheerAllowed(frame: { cheer?: DecisionCheer }, snapshot: DecisionActivityScope | undefined, participantId: string) {
  return !frame.cheer || (!!snapshot && snapshot.phase === 'decided' && frame.cheer.generation === snapshot.generation &&
    snapshot.participants.some(p => p.participantId === participantId && !p.dropped))
}
