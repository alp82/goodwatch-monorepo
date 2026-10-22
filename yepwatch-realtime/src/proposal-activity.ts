import { z } from 'zod'
import { clientActivitySchema, serverActivitySchema } from './activity-protocol.js'
import type { ClientActivity, ServerActivity, MatchInspection } from '@goodwatch/yepwatch-contracts/proposal'

/** These refer only to the shared matches room, never a private choosing card. */
export const inspectionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('poster'), candidateId: z.string().min(1).max(256) }),
  z.strictObject({ kind: z.literal('lens') }),
  z.strictObject({ kind: z.literal('dice') }),
])
export type Inspection = MatchInspection
const inspection = { inspection: inspectionSchema.optional() }
function scope(frame: { view: string; inspection?: Inspection; beat?: 'answer' }, context: z.RefinementCtx) {
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
