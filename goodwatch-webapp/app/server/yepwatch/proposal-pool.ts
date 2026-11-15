import type { TitleSnapshot } from '../title-snapshot/snapshot.server.ts'
import { FLAG_ADULT, FLAG_BACKDROP, SHOW_BASE, UNKNOWN_DAY, presentableAt } from '../title-snapshot/format.server.ts'
import { rankInSlices, rankedKeysCache } from './ranked-keys-cache.ts'

export const QUALITY = {
  movie: { minVotes: 5000, minScore: 60 }, show: { minVotes: 1500, minScore: 65 },
  relax: [
    { movie: { minVotes: 2000, minScore: 55 }, show: { minVotes: 700, minScore: 60 } },
    { movie: { minVotes: 1000, minScore: 50 }, show: { minVotes: 300, minScore: 55 } },
  ], excludedGenres: ['Talk', 'News', 'Reality', 'Soap'], needBackdrop: false,
} as const
export const POOL_TARGET = 300
export const MAX_RANKED = 3000
const cache = rankedKeysCache()
const poolPriors = new WeakMap<readonly number[], ReadonlyMap<number, number>>()
export const poolQualityOf = (keys: readonly number[]) => poolPriors.get(keys)
export function passesFloor(snapshot: TitleSnapshot, key: number, step = 0, idea = false, today = Math.floor(Date.now() / 86400000)): boolean {
  const row = snapshot.rowOf(key)
  if (row < 0) return false
  const c = snapshot.columns, kind = key < SHOW_BASE ? 'movie' : 'show'
  if (!presentableAt(c, row) || c.flags[row] & FLAG_ADULT || (QUALITY.needBackdrop && !(c.flags[row] & FLAG_BACKDROP))) return false
  const year = new Date(today * 86400000).getUTCFullYear()
  if (kind === 'movie' ? c.releaseDays[row] === UNKNOWN_DAY || c.releaseDays[row] > today :
    c.facts ? !c.facts.releaseYears[row] || c.facts.releaseYears[row] > year : c.releaseDays[row] === UNKNOWN_DAY || c.releaseDays[row] > today) return false
  if (!idea && c.genreNames.some((g, bit) => (QUALITY.excludedGenres as readonly string[]).includes(g) && (c.genres[row] & (1 << bit)))) return false
  const floor = [QUALITY, ...QUALITY.relax][Math.min(2, step + Number(idea))][kind]
  return c.votes[row] >= floor.minVotes && c.scores[row] >= floor.minScore
}
/** Cached and sliced; all relax steps share the same snapshot and room kind/mood filter. */
export function basePool(snapshot: TitleSnapshot, kinds: readonly string[], moodMask = 0, step = 0): Promise<readonly number[]> {
  const day = Math.floor(Date.now() / 86400000)
  return cache(JSON.stringify([snapshot.version, kinds, moodMask, step, day]), async () => {
    const c = snapshot.columns
    const keys = await rankInSlices(c.pointIds, async slice => slice.filter(key => {
      const row = snapshot.rowOf(key)
      return kinds.includes(key < SHOW_BASE ? 'movie' : 'show') && (!moodMask || (c.moods[row] & moodMask) !== 0) && passesFloor(snapshot, key, step, false, day)
    }), (a, b) => a - b)
    const priors = qualityPriors(snapshot, keys)
    keys.sort((a, b) => priors.get(b)! - priors.get(a)! || c.popularity[snapshot.rowOf(b)] - c.popularity[snapshot.rowOf(a)] || a - b)
    poolPriors.set(keys, priors)
    return keys
  })
}
export function qualityPriors(snapshot: TitleSnapshot, keys: readonly number[]): Map<number, number> {
  const result = new Map<number, number>(), c = snapshot.columns
  const year = new Date().getUTCFullYear()
  for (const show of [false, true]) {
    const rows = keys.filter(k => (k >= SHOW_BASE) === show).map(k => snapshot.rowOf(k))
    const scores = rows.map(r => c.scores[r]).sort((a, b) => a - b)
    const votes = rows.map(r => Math.log1p(c.votes[r])).sort((a, b) => a - b)
    for (const row of rows) {
      const released = c.facts?.releaseYears[row] || new Date(c.releaseDays[row] * 86400000).getUTCFullYear()
      result.set(c.pointIds[row], .7 * percentile(c.scores[row], scores) + .3 * percentile(Math.log1p(c.votes[row]), votes) + (released >= year - 3 ? .05 : 0))
    }
  }
  return result
}
function percentile(value: number, sorted: number[]) {
  let lo = 0, hi = sorted.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid] < value) lo = mid + 1; else hi = mid }
  let end = lo
  // Upper bound gives equal facts equal priors.
  hi = sorted.length
  while (end < hi) { const mid = (end + hi) >>> 1; if (sorted[mid] <= value) end = mid + 1; else hi = mid }
  return (lo + end) / (2 * Math.max(1, sorted.length))
}
const roomSteps = new WeakMap<readonly number[], number>()
export const poolStepOf = (keys: readonly number[]) => roomSteps.get(keys) ?? 0
/** null index means cold: evidence scan remains authoritative. */
export async function roomPool(build: (step: number) => Promise<readonly number[]>, watchable: ((key: number) => boolean) | null) {
  let keys: readonly number[] = [], step = 0
  for (; step <= 2; step++) {
    const base = await build(step)
    keys = watchable ? base.filter(watchable) : base
    const priors = poolPriors.get(base); if (priors) poolPriors.set(keys, priors)
    if (keys.length >= POOL_TARGET || step === 2) break
  }
  roomSteps.set(keys, step)
  return { keys, step }
}
export function roomJitter(seed: string, key: number) {
  let hash = 2166136261
  const text = `${seed}:${key}`
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619) }
  return .03 * (hash >>> 0) / 4294967296
}
export function unitFingerprint(snapshot: Pick<TitleSnapshot, 'fingerprint'>, key: number): Float32Array | null {
  const fp = snapshot.fingerprint(key)
  if (!fp) return null
  let norm = 0
  for (const v of fp) if (v !== 255) norm += v * v
  if (!norm) return null
  const result = new Float32Array(fp.length), inverse = 1 / Math.sqrt(norm)
  for (let d = 0; d < fp.length; d++) result[d] = fp[d] === 255 ? 0 : fp[d] * inverse
  return result
}
