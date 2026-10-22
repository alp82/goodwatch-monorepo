import { z } from 'zod'
import type { ClientActivity, ServerActivity } from '@goodwatch/yepwatch-contracts/continuous'
const id = z.string().min(1).max(256)
const count = z.number().int().nonnegative().safe()
export const clientActivitySchema = z.strictObject({ type: z.literal('activity'), sessionId: id,
  sequence: count, view: z.enum(['voting', 'matches', 'trailer', 'away']),
  gesture: z.enum(['reach', 'handle', 'release']).optional(), beat: z.literal('answer').optional(),
}) satisfies z.ZodType<ClientActivity>
export const serverActivitySchema = clientActivitySchema.extend({ roomId: id, participantId: id, serverTime: count, expiresAt: count }) satisfies z.ZodType<ServerActivity>
