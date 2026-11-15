import type { ProposalRoom } from './proposal-types.ts'
import type { TitleSnapshot } from '../title-snapshot/snapshot.server.ts'
import { rankedKey } from './proposal-redesign.ts'
import { unitFingerprint } from './proposal-pool.ts'
import { CONTINUOUS_LIMITS } from './continuous-types.ts'

export interface FeedbackVote { position: number; yep: number; nope: number }
export interface RoundFeedback { yeps: { vector: Float32Array; weight: number }[]; nopes: { vector: Float32Array; weight: number }[] }
export function feedbackClass(yep: number, nope: number): { yep: number; nope: number } {
  const answers = yep + nope
  return { yep: yep >= 2 && yep * 2 >= answers ? 1 : answers === 1 && yep === 1 ? .5 : 0,
    nope: answers >= 2 && nope * 2 >= answers ? 1 : answers === 1 && nope === 1 ? .5 : 0 }
}
/** Only feedback class crossings invalidate a refill; additional votes within a class reuse it. */
export function feedbackDigest(room: ProposalRoom) {
  return recentFeedbackTallies(room).flatMap(t => { const c = feedbackClass(t.yep, t.nope); return [c.yep ? `y${c.yep}:${t.position}` : '', c.nope ? `n${c.nope}:${t.position}` : ''].filter(Boolean) }).sort()
}
export function feedbackTallies(room: ProposalRoom): FeedbackVote[] {
  const result = (room.outcome ?? []).map(t => ({ position: t.position, yep: t.yep, nope: t.nope }))
  for (const card of room.candidates) {
    const position = (room.dealtKeys ?? room.seenKeys).indexOf(`${card.identity.kind === 'movie' ? 'movie' : 'show'}_${card.identity.tmdbId}`)
    const votes = room.participants.filter(p => p.leftAt == null).map(p => p.votes[card.id]?.value)
    const tally = { position, yep: votes.filter(v => v === 'watch').length, nope: votes.filter(v => v === 'pass').length }
    const at = result.findIndex(t => t.position === position)
    if (at >= 0) result[at] = tally; else if (position >= 0) result.push(tally)
  }
  return result
}
/** Bound close-neighbor work to one active-deck window, including recently retired answers. */
function recentFeedbackTallies(room: ProposalRoom) {
  return feedbackTallies(room).filter(t => t.yep + t.nope > 0).sort((a, b) => a.position - b.position).slice(-CONTINUOUS_LIMITS.active)
}
export function roundFeedback(room: ProposalRoom, snapshot: Pick<TitleSnapshot, 'fingerprint'>): RoundFeedback {
  const result: RoundFeedback = { yeps: [], nopes: [] }
  for (const t of recentFeedbackTallies(room)) {
    const text = (room.dealtKeys ?? room.seenKeys)[t.position]
    if (!text) continue
    const [kind, id] = text.split('_'), vector = unitFingerprint(snapshot, (kind === 'movie' ? 1e12 : 2e12) + Number(id))
    if (!vector) continue
    const c = feedbackClass(t.yep, t.nope)
    if (c.yep) result.yeps.push({ vector, weight: c.yep })
    if (c.nope) result.nopes.push({ vector, weight: c.nope })
  }
  return result
}
export function feedbackAdjustment(snapshot: Pick<TitleSnapshot, 'cosine'>, key: number, feedback?: RoundFeedback) {
  if (!feedback) return 0
  const max = (items: RoundFeedback['yeps']) => items.reduce((best, item) => {
    const cosine = snapshot.cosine(key, item.vector) ?? 0
    return Math.max(best, cosine > .8 ? cosine * item.weight : 0)
  }, 0)
  return .12 * max(feedback.yeps) - .15 * max(feedback.nopes)
}
/**
 * How many of each person's next unanswered cards never move: the card they are on and the one under it, and two
 * more, because the app answers ahead of the server (a Yep or Nope shows the next card at once, the vote is sent
 * behind it). Someone two votes ahead of what the server has seen still keeps their two visible cards in place.
 */
export const PROTECTED_UNANSWERED = 4
/** Protect the current card and the one under it for EVERY present person, including lagging voters. */
export function reorderTail(room: ProposalRoom, score: (key: number) => number): void {
  const protectedIds = new Set<string>()
  for (const p of room.participants.filter(p => p.leftAt == null)) {
    let unanswered = 0
    for (const c of room.candidates) {
      if (Object.prototype.hasOwnProperty.call(p.votes, c.id)) protectedIds.add(c.id)
      if (p.votes[c.id]?.value == null && ++unanswered <= PROTECTED_UNANSWERED) protectedIds.add(c.id)
    }
  }
  const tail = room.candidates.filter(c => !protectedIds.has(c.id)).map((c, order) => ({ c, order, score: score(rankedKey(c)) }))
  tail.sort((a, b) => b.score - a.score || a.order - b.order)
  let i = 0
  room.candidates = room.candidates.map(c => {
    if (protectedIds.has(c.id)) return c
    const next = tail[i++].c
    if (next.id !== c.id) {
      for (const moved of [c, next]) {
        const position = (room.dealtKeys ?? room.seenKeys).indexOf(`${moved.identity.kind === 'movie' ? 'movie' : 'show'}_${moved.identity.tmdbId}`)
        const tally = room.outcome?.find(t => t.position === position)
        if (tally) tally.moved = true
      }
    }
    return next
  })
}
