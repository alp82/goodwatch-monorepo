import { z } from 'zod'
import { RoomError } from './errors.ts'
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const n = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const episodeId = z.number().int().positive()
const progress = z.discriminatedUnion('state', [z.object({ state: z.literal('unknown') }), z.object({ state: z.literal('not_started') }), z.object({ state: z.literal('continue'), nextEpisodeId: episodeId })])
const screen = z.object({ id, label: z.string().trim().min(1).max(40), country: z.string().regex(/^[A-Z]{2}$/).nullable(), serviceIds: z.array(episodeId).max(2000), confirmed: z.boolean() }).strict()
const constraints = z.object({ kinds: z.array(z.enum(['movie', 'show_start', 'show_continue'])).min(1).max(3), maxMinutes: z.number().int().positive().max(1440).nullable(), moods: z.array(z.string().max(80)).max(20) }).strict()
export const admissionSchema = z.object({ commandId: id, admissionSecret: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/), nickname: z.string().trim().min(1).max(40) }).strict()
export const joinSchema = admissionSchema.extend({ inviteCode: z.string().max(200), screenId: id.optional() })
export const commandSchema = z.object({ commandId: id, sequence: n.min(1), command: z.discriminatedUnion('type', [
  z.object({ type: z.literal('setup'), expectedContextVersion: n, screens: z.array(screen).min(1).max(12), constraints, screenId: id.nullable() }),
  z.object({ type: z.literal('assign_screen'), expectedContextVersion: n, screenId: id }),
  z.object({ type: z.literal('ready'), expectedContextVersion: n, ready: z.boolean() }),
  z.object({ type: z.literal('show_progress'), showId: episodeId, input: progress, approvedEpisodeId: episodeId.nullable() }),
  z.object({ type: z.literal('propose_episode'), expectedContextVersion: n, showId: episodeId, episodeId }),
  z.object({ type: z.literal('start_round'), expectedRosterVersion: n, expectedContextVersion: n, hostReady: z.boolean().optional() }),
  z.object({ type: z.literal('vote'), roundVersion: n, candidateId: id, expectedVoteRevision: n, value: z.enum(['watch', 'pass', 'veto']).nullable() }),
  z.object({ type: z.literal('complete_round'), roundVersion: n }),
  z.object({ type: z.literal('shortlist_preference'), shortlistVersion: n, candidateId: id }),
  z.object({ type: z.literal('propose'), shortlistVersion: n, candidateId: id }),
  z.object({ type: z.literal('consent'), proposalVersion: n.min(1), accepted: z.boolean() }),
  z.object({ type: z.literal('decide'), proposalVersion: n.min(1) }),
  z.object({ type: z.literal('new_round'), expectedRevision: n }),
]) }).strict()
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new RoomError('invalid_request', 'Invalid request shape', 400)
  return parsed.data
}
export const resolveSchema = z.object({ code: z.string().min(1).max(200) }).strict()
export const attachSchema = z.object({ ticket: z.string().min(1).max(256), roomId: id }).strict()
export const viewSchema = z.object({ lease: z.string().min(1).max(2048), roomId: id }).strict()
