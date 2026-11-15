import type { ProposalParticipant, ProposalRoom } from './proposal-types.ts'

/** Calibrated at answer write/member read, never at Start. Fingerprint dimensions use snapshot key order. */
export interface PersonSignal {
  vector: Float32Array
  /** 119 entries at 0..99, 99.1..99.9, 99.91..99.99, 100 percent. */
  quantiles: Float32Array
  confidence: number
  unseen: ReadonlySet<number>
  source: 'member' | 'profile'
  snapshotVersion: string
}
export interface PersonalSignals {
  revision: string
  taste: PersonSignal | null
  seen: ReadonlySet<number>
  hidden: ReadonlySet<number>
  /** Members only. Profile implementations leave this empty. */
  wishlist: ReadonlySet<number>
  /** Only explicit Nopes, with their time. At most 300; unanswered cards never enter this map. */
  nopes: ReadonlyMap<number, number>
}
/** Profile integration boundary: prepare reads/batches profiles during a build; stored is synchronous and private. */
export interface RoomTasteSource {
  prepare(room: ProposalRoom): Promise<void>
  stored(room: ProposalRoom, participant: ProposalParticipant): PersonalSignals | null
  /** Persist the person's explicit Nope/undo before room vote retirement can discard it. Best effort after CAS. */
  voteCommitted?(room: ProposalRoom, participant: ProposalParticipant, key: number, value: 'watch' | 'pass' | null, at: number): Promise<void>
  /** Best effort after a committed round end; store a bounded, idempotent dealt/Nope ring here. */
  roundEnded?(room: ProposalRoom): Promise<void>
}
const levels = [...Array.from({ length: 100 }, (_, i) => i / 100),
  ...Array.from({ length: 9 }, (_, i) => (991 + i) / 1000),
  ...Array.from({ length: 9 }, (_, i) => (9991 + i) / 10000), 1]
/** Same interpolation as GoodWatch percentileOf, returned on the ranker's 0..1 scale. */
export function tastePercentile(cosine: number, table: Float32Array): number {
  if (cosine <= table[0]) return 0
  const last = table.length - 1
  if (cosine >= table[last]) return 1
  let lo = 0, hi = last
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (table[mid] <= cosine) lo = mid; else hi = mid }
  const span = table[hi] - table[lo]
  return levels[lo] + (span > 0 ? (levels[hi] - levels[lo]) * (cosine - table[lo]) / span : 0)
}
