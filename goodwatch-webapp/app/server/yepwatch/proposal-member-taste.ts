import { z } from 'zod'
import type { PersonalSignals } from './proposal-person-signal.ts'

const key = z.number().int().safe().min(1e12).max(3e12 - 1)
export const memberTasteSchema = z.strictObject({
  vector: z.array(z.number().finite().min(-1).max(1)).length(74).nullable(),
  liked: z.number().int().nonnegative(), version: z.string().min(1).max(256),
  wishlist: z.array(key).max(500), hidden: z.array(key).max(100000),
})
export type MemberTaste = z.infer<typeof memberTasteSchema>
/** Runs when the member copy is read; never on Start or a vote. */
export async function calibrateMemberTaste(data: MemberTaste): Promise<PersonalSignals> {
  const [{ getTitleSnapshot }, { quantileTable }, { tastePool, poolCosines }] = await Promise.all([
    import('../title-snapshot/index.server'), import('../taste/formula.server'), import('../taste/pool.server'),
  ])
  const snapshot = getTitleSnapshot()
  let vector = data.vector ? Float32Array.from(data.vector) : null
  if (vector) { const norm = Math.hypot(...vector); vector = norm ? vector.map(v => v / norm) : null }
  return { revision: `${data.version}:${snapshot?.version ?? 'none'}`, seen: new Set(), hidden: new Set(data.hidden),
    wishlist: new Set(data.wishlist), nopes: new Map(),
    taste: vector && snapshot ? { vector, quantiles: quantileTable(poolCosines(tastePool(snapshot), vector)),
      confidence: Math.min(1, data.liked / 8), unseen: new Set(), source: 'member', snapshotVersion: snapshot.version } : null }
}
