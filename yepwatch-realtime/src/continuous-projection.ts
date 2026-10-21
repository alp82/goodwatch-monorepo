import { z } from 'zod'
import type { SharedRoomSnapshot } from '@goodwatch/yepwatch-contracts/continuous'

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
const availability = z.array(z.strictObject({ screenId: id, state: z.enum(['watchable', 'no_match', 'unknown']),
  scope: z.enum(['title', 'episode']), checkedAt: count.nullable(), offers: z.array(z.strictObject({
    serviceId: count, name: text, url: text.nullable(), kind: z.enum(['provider', 'where_to_watch', 'search']),
    offerType: z.enum(['flatrate', 'free', 'ads']),
  })).max(256) })).max(64)
const actions = z.array(z.enum(['retry', 'review_screen_services', 'review_constraints', 'use_guest_modes'])).max(4)
const reason = z.enum(['availability_unknown', 'episode_catalog_unavailable', 'catalog_metadata_missing', 'scan_limit', 'deadline', 'filtered_catalog_empty', 'verified_no_intersection'])
const details = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('catalog'), reason: z.literal('catalog_loading'), actions }),
  z.strictObject({ type: z.literal('access'), reason: z.enum(['member_auth_unavailable', 'manual_progress_not_supported']), actions }),
  z.strictObject({ type: z.literal('deck'), reason, reasons: z.array(reason).max(7), actions,
    scannedTitles: count, poolSize: count, scanComplete: z.boolean(), uncertainTitles: count, noMatchTitles: count,
    missingMetadataTitles: count, missingEpisodeTitles: count,
    screens: z.array(z.strictObject({ screenId: id, country: text, serviceIds: z.array(count).max(512), watchable: count, noMatch: count, unknown: count })).max(64),
  }),
])
const errorCode = z.enum(['invalid_request', 'unauthorized', 'forbidden', 'not_found', 'expired', 'conflict', 'busy', 'outcome_unknown',
  'limit_reached', 'needs_context', 'needs_progress', 'no_intersection', 'catalog_unavailable', 'not_implemented', 'member_required'])
// Whitelist every nested field, including failure details and optional catalog presentation.
export const continuousSharedSchema = z.strictObject({
  contractVersion: z.literal(2), roomId: id, revision: count, phase: z.enum(['setup', 'choosing', 'decided', 'expired']),
  expiresAt: count, hostParticipantId: id, rosterVersion: count, contextVersion: count, generation: count,
  participants: z.array(z.strictObject({ participantId: id, nickname: text, screenId: id.nullable(), ready: z.boolean() })).max(12),
  screens: z.array(z.strictObject({ id, label: text, country: text.nullable(), serviceIds: z.array(count).max(512), confirmed: z.boolean() })).max(12),
  constraints: z.strictObject({ kinds: z.array(z.enum(['movie', 'show_start', 'show_continue'])).max(3), maxMinutes: count.nullable(), moods: z.array(id).max(128) }),
  candidates: z.array(z.strictObject({ id, identity, title: text, year: count.nullable(), overview: text.nullable(),
    posterUrl: text.nullable(), runtimeMinutes: count.nullable(), availability, backdropUrl: text.nullable().optional(),
    trailerUrl: text.nullable().optional(), goodwatchScore: z.number().finite().nullable().optional(), genres: z.array(text).max(128).optional(),
  })).max(512),
  stream: z.strictObject({ version: count, state: z.enum(['ready', 'exhausted', 'unavailable', 'capacity']),
    reason: z.enum(['catalog_end', 'catalog_incomplete', 'room_capacity', 'awaiting_answers']).nullable() }),
  matches: z.array(z.strictObject({ candidateId: id, pickCount: count })).max(512),
  agreement: z.strictObject({ version: count, state: z.enum(['none', 'checking', 'unavailable']),
    error: z.strictObject({ code: errorCode, details: details.optional() }).nullable() }),
  decision: z.strictObject({ candidateId: id, agreementVersion: count, decidedAt: count, availability }).nullable(),
}) satisfies z.ZodType<SharedRoomSnapshot>

export function continuousProjection(input: unknown, roomId: string): SharedRoomSnapshot {
  const value = continuousSharedSchema.parse(input)
  if (value.roomId !== roomId) throw new Error('Projection room mismatch')
  const candidates = new Set(value.candidates.map(c => c.id))
  const people = new Set(value.participants.map(p => p.participantId))
  if (candidates.size !== value.candidates.length || people.size !== value.participants.length || !people.has(value.hostParticipantId)) throw new Error('Ambiguous projection')
  const matches = new Set(value.matches.map(m => m.candidateId))
  if (matches.size !== value.matches.length || value.matches.some(m => !candidates.has(m.candidateId) || m.pickCount > people.size)) throw new Error('Invalid match projection')
  if ((value.phase === 'setup' && (value.matches.length || value.decision)) ||
      ((value.phase === 'decided') !== !!value.decision) || (value.decision && !matches.has(value.decision.candidateId))) throw new Error('Invalid decision projection')
  return value
}
