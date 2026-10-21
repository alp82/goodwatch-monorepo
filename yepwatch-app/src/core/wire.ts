import { z } from 'zod';
import type { ServerRealtimeFrame } from '@goodwatch/yepwatch-contracts';
const integer = z.number().int().nonnegative();
const episode = z.object({ tmdbId: integer, season: integer, number: integer, displaySeason: integer.optional(), displayNumber: integer.optional(), presentationVersion: z.string().optional() });
const identity = z.discriminatedUnion('kind', [z.object({ kind: z.literal('movie'), tmdbId: integer }), z.object({ kind: z.literal('show_start'), tmdbId: integer, episode }), z.object({ kind: z.literal('show_continue'), tmdbId: integer, episode })]);
const presence = z.enum(['unknown', 'connected', 'reconnecting']);
const availability = z.object({ screenId: z.string(), state: z.enum(['watchable', 'no_match', 'unknown']), scope: z.enum(['title', 'episode']), checkedAt: integer.nullable(), offers: z.array(z.object({ serviceId: integer, name: z.string(), url: z.string().nullable(), kind: z.enum(['provider', 'where_to_watch', 'search']), offerType: z.enum(['flatrate', 'free', 'ads']) })) });
const shared = z.object({
  contractVersion: z.literal(1), roomId: z.string(), revision: integer, phase: z.enum(['setup', 'voting', 'shortlist', 'decided', 'expired']), expiresAt: integer, rosterVersion: integer, contextVersion: integer, hostParticipantId: z.string(),
  participants: z.array(z.object({ participantId: z.string(), nickname: z.string(), screenId: z.string().nullable(), ready: z.boolean(), participation: z.enum(['invited', 'included', 'waiting']), completedCount: integer, presence }).strict()),
  screens: z.array(z.object({ id: z.string(), label: z.string(), country: z.string().nullable(), serviceIds: z.array(integer), confirmed: z.boolean() })),
  constraints: z.object({ kinds: z.array(z.enum(['movie', 'show_start', 'show_continue'])), maxMinutes: integer.nullable(), moods: z.array(z.string()) }),
  episodeProposals: z.array(z.object({ showId: integer, episode, version: integer })).default([]),
  round: z.object({ version: integer, rosterVersion: integer, contextVersion: integer, candidateCount: integer, completed: z.boolean() }).nullable(),
  candidates: z.array(z.object({ id: z.string(), identity, title: z.string(), year: integer.nullable(), overview: z.string().nullable(), posterUrl: z.string().nullable(), runtimeMinutes: integer.nullable(), availability: z.array(availability) })),
  shortlist: z.object({ version: integer, proposalVersion: integer, candidateIds: z.array(z.string()), proposedCandidateId: z.string().nullable(), consentCount: integer }).nullable(),
  decision: z.object({ candidateId: z.string(), proposalVersion: integer, decidedAt: integer, availability: z.array(availability) }).nullable(),
}).strict();
const code = z.enum(['invalid_request', 'unauthorized', 'forbidden', 'not_found', 'expired', 'conflict', 'busy', 'outcome_unknown', 'limit_reached', 'needs_context', 'needs_progress', 'no_intersection', 'catalog_unavailable', 'not_implemented']);
const frame = z.discriminatedUnion('type', [
  z.object({ type: z.literal('room.snapshot'), snapshot: shared }), z.object({ type: z.literal('room.updated'), snapshot: shared }),
  z.object({ type: z.literal('presence'), roomId: z.string(), participants: z.array(z.object({ participantId: z.string(), presence }).strict()) }),
  z.object({ type: z.literal('resync_required'), roomId: z.string() }), z.object({ type: z.literal('restarting'), retryAfterMs: integer }), z.object({ type: z.literal('degraded'), retryAfterMs: integer }), z.object({ type: z.literal('error'), code }), z.object({ type: z.literal('pong') }),
]);
/** Reject private extensions to public participants/snapshots; accept only the v1 wire shape. */
export function parseRealtimeFrame(data: string): ServerRealtimeFrame | null {
  if (data.length > 512 * 1024) return null;
  try { const result = frame.safeParse(JSON.parse(data)); return result.success ? result.data : null; } catch { return null; }
}
