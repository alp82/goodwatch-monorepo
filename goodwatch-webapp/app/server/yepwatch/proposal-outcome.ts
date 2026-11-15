import type { ProposalRoom, ProposalCatalog } from './proposal-types.ts'
import type { ReasonCode } from '../../../packages/yepwatch-contracts/proposal.ts'
import { REASON_CODES } from '../../../packages/yepwatch-contracts/proposal.ts'
import { titleKey, candidateEligible } from './proposal-redesign.ts'
import { RANKER_VERSION } from './proposal-ranker.ts'

/** Stored by stable dealt position, never by person or title. Score components are bucketed. */
export interface CardOutcome {
  position: number; reason: ReasonCode | null; taste: number; idea: number; quality: number; score: number
  yep: number; nope: number; unanswered: number; matched: boolean; moved: boolean
}
const bucket = (n: number) => Math.round(n * 10) / 10
export function recordOutcome(room: ProposalRoom, page?: Awaited<ReturnType<ProposalCatalog['page']>>, now = Date.now()) {
  if (room.startedAt == null) return
  room.outcome ??= []
  room.dealtKeys ??= [...room.seenKeys]
  const people = room.participants.filter(p => p.leftAt == null)
  for (const card of room.candidates) {
    const key = titleKey(card)
    let position = room.dealtKeys.indexOf(key)
    if (position < 0) { position = room.dealtKeys.length; room.dealtKeys.push(key) }
    let tally = room.outcome.find(t => t.position === position)
    if (!tally) {
      const rank = page?.ranking?.[card.id]
      tally = { position, reason: card.reason?.code ?? null, taste: bucket(rank?.parts.minimum ?? 0), idea: bucket(rank?.parts.idea ?? 0),
        quality: bucket(rank?.parts.quality ?? 0), score: rank ? rank.score - rank.parts.feedback : 0, yep: 0, nope: 0, unanswered: people.length, matched: false, moved: false }
      room.outcome.push(tally)
    }
    tally.yep = people.filter(p => p.votes[card.id]?.value === 'watch').length
    tally.nope = people.filter(p => p.votes[card.id]?.value === 'pass').length
    tally.unanswered = people.length - tally.yep - tally.nope
    tally.matched ||= people.length > 0 && tally.yep === people.length && candidateEligible(room, card)
    if (tally.matched && room.firstMatchAt == null) room.firstMatchAt = now
  }
}
/** Exact analytics allowlist. Do not serialize room, cards, people or rank inputs here. */
export function roundOutcome(room: ProposalRoom, end: 'restart' | 'decision' | 'expiry' = 'expiry') {
  const cards = (room.outcome ?? []).map(t => ({ position: t.position, reason: t.reason,
    taste: bucket(t.taste), idea: bucket(t.idea), quality: bucket(t.quality),
    yep: t.yep, nope: t.nope, unanswered: t.unanswered, matched: t.matched, moved: t.moved }))
  const matched = cards.filter(c => c.matched)
  const people = room.participants.filter(p => p.leftAt == null)
  return { event: 'yepwatch_round_outcome', rankerVersion: room.rankerVersion ?? RANKER_VERSION, end,
    people: people.length, tasteSources: { member: room.tasteSources?.member ?? 0, profile: room.tasteSources?.profile ?? 0, none: room.tasteSources?.none ?? people.length },
    kinds: [...room.constraints.kinds], ideasOn: (room.ideas ?? []).filter(i => i.on).length,
    cardsDealt: cards.length, cards, matches: matched.length,
    firstMatchPosition: matched.length ? Math.min(...matched.map(c => c.position)) : null,
    firstMatchMs: room.firstMatchAt != null && room.startedAt != null ? room.firstMatchAt - room.startedAt : null,
    decisionMs: room.decision && room.startedAt != null ? room.decision.decidedAt - room.startedAt : null,
    decided: !!room.decision }
}
export interface DeckDiagnostics {
  rankerVersion: string; poolSize: number; poolStep: number; medianScore: number | null; medianVotes: number | null
  tasteShare: number; reasons: Partial<Record<ReasonCode, number>>
}
/** Keep future private catalog metadata out of stdout even if it is added to the page. */
export function deckBuildDiagnostics(d?: DeckDiagnostics) {
  if (!d) return {}
  return { rankerVersion: d.rankerVersion, poolSize: d.poolSize, poolStep: d.poolStep, medianScore: d.medianScore,
    medianVotes: d.medianVotes, tasteShare: d.tasteShare, reasons: Object.fromEntries(REASON_CODES.filter(code => d.reasons[code] !== undefined).map(code => [code, d.reasons[code]])) }
}
export function emitRoundOutcome(room: ProposalRoom, end: 'restart' | 'decision' | 'expiry') {
  if (room.startedAt != null && (room.outcome?.length ?? 0) > 0) console.info(JSON.stringify(roundOutcome(room, end)))
}
