import type { Candidate } from '../../../packages/yepwatch-contracts/proposal.ts'
import type { ProposalRoom } from './proposal-types.ts'
export { evalSnapshot as rankingSnapshot } from './eval/snapshot.ts'
export type { EvalTitle as TestTitle } from './eval/snapshot.ts'
export function rankingRoom(): ProposalRoom {
  return { id: 'room-private-key', revision: 1, expiresAt: Date.now() + 3600000, hostId: 'person-private-id', inviteHash: 'private', phase: 'choosing',
    rosterVersion: 1, contextVersion: 1, format: 2, flowVersion: 3, generation: 1, history: [], ideas: [], disabledServiceIds: [], interpretationCount: 0,
    proposalVersion: 0, proposal: null, seenKeys: [], stream: { version: 1, state: 'ready', reason: null },
    agreement: { version: 0, state: 'none', error: null }, memberIntents: [], candidates: [], decision: null, tickets: [],
    constraints: { kinds: ['movie', 'show_start'], maxMinutes: null, moods: [] },
    screens: [{ id: 'room', label: 'Couch', country: 'DE', serviceIds: [1], confirmed: true }],
    participants: [{ id: 'person-private-id', nickname: 'Secret name', tokenHash: 'private', admissionHash: 'private', epoch: 1, nextSequence: 1,
      screenId: 'room', ready: true, member: { state: 'guest', prefill: null }, memberUserId: null,
      votes: {}, lastVotedId: null, pick: { candidateId: null, revision: 0 }, receipts: [], approvedProposalVersion: null, agreementRevision: 0 }] }
}

export const cards = (count: number): Candidate[] => Array.from({ length: count }, (_, i) => ({ id: `movie:${i + 1}`, identity: { kind: 'movie', tmdbId: i + 1 },
  title: 'Private title', year: 2020, overview: null, posterUrl: null, runtimeMinutes: 90, viewingDuration: { minutes: 90, scope: 'movie' }, availability: [{ screenId: 'room', state: 'watchable', scope: 'title', checkedAt: 1, offers: [{ serviceId: 1, name: 'Fixture', url: null, kind: 'where_to_watch', offerType: 'flatrate' }] }] }))
