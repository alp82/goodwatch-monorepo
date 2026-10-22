import { z } from 'zod'
import type { SharedRoomSnapshot } from '@goodwatch/yepwatch-contracts'

const id = z.string().min(1).max(256)
const count = z.number().int().nonnegative().safe()
const text = z.string().max(20_000)
const episode = z.strictObject({ tmdbId: count, season: count, number: count,
  displaySeason: count.optional(), displayNumber: count.optional(), presentationVersion: id.optional() })
const identity = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('movie'), tmdbId: count }),
  z.strictObject({ kind: z.literal('show_start'), tmdbId: count, episode }),
  z.strictObject({ kind: z.literal('show_continue'), tmdbId: count, episode }),
])
const availability = z.array(z.strictObject({ screenId: id,
  state: z.enum(['watchable', 'no_match', 'unknown']), scope: z.enum(['title', 'episode']),
  checkedAt: count.nullable(), offers: z.array(z.strictObject({ serviceId: count, name: text,
    url: text.nullable(), kind: z.enum(['provider', 'where_to_watch', 'search']),
    offerType: z.enum(['flatrate', 'free', 'ads']) })).max(256),
})).max(64)
// Strict at EVERY object boundary: a private field anywhere invalidates the response.
const sharedSchema = z.strictObject({
  contractVersion: z.literal(1), roomId: id, revision: count,
  phase: z.enum(['setup', 'voting', 'shortlist', 'decided', 'expired']), expiresAt: count,
  rosterVersion: count, contextVersion: count, hostParticipantId: id,
  participants: z.array(z.strictObject({ participantId: id, nickname: text, screenId: id.nullable(),
    ready: z.boolean(), participation: z.enum(['invited', 'included', 'waiting']),
    completedCount: count, presence: z.enum(['unknown', 'connected', 'reconnecting']),
  })).max(64),
  screens: z.array(z.strictObject({ id, label: text, country: text.nullable(),
    serviceIds: z.array(count).max(512), confirmed: z.boolean() })).max(64),
  episodeProposals: z.array(z.strictObject({ showId: count, episode, version: count })).max(128),
  constraints: z.strictObject({ kinds: z.array(z.enum(['movie', 'show_start', 'show_continue'])).max(3),
    maxMinutes: count.nullable(), moods: z.array(id).max(128) }),
  round: z.strictObject({ version: count, rosterVersion: count, contextVersion: count,
    candidateCount: count, completed: z.boolean() }).nullable(),
  candidates: z.array(z.strictObject({ id, identity, title: text, year: count.nullable(),
    overview: text.nullable(), posterUrl: text.nullable(), runtimeMinutes: count.nullable(), availability })).max(512),
  shortlist: z.strictObject({ version: count, proposalVersion: count, candidateIds: z.array(id).max(512),
    proposedCandidateId: id.nullable(), consentCount: count }).nullable(),
  decision: z.strictObject({ candidateId: id, proposalVersion: count, decidedAt: count, availability }).nullable(),
}) satisfies z.ZodType<SharedRoomSnapshot>

export function sharedProjection(input: unknown, roomId: string): SharedRoomSnapshot {
  const snapshot = sharedSchema.parse(input)
  if (snapshot.roomId !== roomId) throw new Error('Projection room mismatch')
  if ((snapshot.phase === 'setup' || snapshot.phase === 'voting') && (snapshot.shortlist || snapshot.decision)) {
    throw new Error('Premature outcome')
  }
  if ((snapshot.shortlist || snapshot.decision) && !snapshot.round?.completed) throw new Error('Incomplete round')
  // There is no shared, distributed presence registry. Never claim somebody went offline
  // because a device or gateway disconnected; authority/readiness remain API-owned.
  return { ...snapshot, participants: snapshot.participants.map(p => ({ ...p, presence: 'unknown' })) }
}

export const attachmentSchema = z.strictObject({
  roomId: id, participantId: id, lease: z.string().min(1).max(8192),
  leaseExpiresAt: count, roomExpiresAt: count, capabilityEpoch: count, scope: z.literal('shared:read'),
})
export const authenticateSchema = z.strictObject({ type: z.literal('authenticate'),
  ticket: z.string().min(1).max(4096), roomId: id, lastRevision: count.nullable() })
export const hintSchema = z.strictObject({ roomId: id, revision: count })
