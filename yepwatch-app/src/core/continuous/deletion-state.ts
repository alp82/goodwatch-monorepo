import { z } from 'zod';
export const deletionStateSchema = z.object({ requestedAt: z.number().int().nonnegative(), purgeAfter: z.number().int().nonnegative(), phase: z.enum(['pending', 'purging']), recoveryId: z.string().min(1) });
export type DeletionState = z.infer<typeof deletionStateSchema>;
