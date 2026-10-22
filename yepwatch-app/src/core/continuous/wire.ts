import { z } from 'zod';
import type { ServerRealtimeFrame } from '@goodwatch/yepwatch-contracts/continuous';
const n = z.number().int().nonnegative();
const id = z.string().min(1).max(512);
const episode = z
  .object({
    tmdbId: n,
    season: n,
    number: n,
    displaySeason: n.optional(),
    displayNumber: n.optional(),
    presentationVersion: z.string().optional(),
  })
  .strict();
const identity = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('movie'), tmdbId: n }).strict(),
  z.object({ kind: z.literal('show_start'), tmdbId: n, episode }).strict(),
  z.object({ kind: z.literal('show_continue'), tmdbId: n, episode }).strict(),
]);
const offer = z
  .object({
    serviceId: n,
    name: z.string(),
    url: z.string().nullable(),
    kind: z.enum(['provider', 'where_to_watch', 'search']),
    offerType: z.enum(['flatrate', 'free', 'ads']),
  })
  .strict();
const availability = z
  .object({
    screenId: id,
    state: z.enum(['watchable', 'no_match', 'unknown']),
    scope: z.enum(['title', 'episode']),
    checkedAt: n.nullable(),
    offers: z.array(offer),
  })
  .strict();
const candidate = z
  .object({
    id,
    identity,
    title: z.string(),
    year: n.nullable(),
    overview: z.string().nullable(),
    posterUrl: z.string().nullable(),
    runtimeMinutes: n.nullable(),
    availability: z.array(availability),
    backdropUrl: z.string().nullable().optional(),
    trailerUrl: z.string().nullable().optional(),
    goodwatchScore: z.number().nullable().optional(),
    genres: z.array(z.string()).optional(),
  })
  .strict();
const code = z.enum([
  'invalid_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'expired',
  'conflict',
  'busy',
  'outcome_unknown',
  'limit_reached',
  'needs_context',
  'needs_progress',
  'no_intersection',
  'catalog_unavailable',
  'not_implemented',
  'member_required',
]);
const actions = z.array(
  z.enum(['retry', 'review_screen_services', 'review_constraints', 'use_guest_modes'])
);
const details = z.union([
  z.object({ type: z.literal('catalog'), reason: z.literal('catalog_loading'), actions }).strict(),
  z
    .object({
      type: z.literal('access'),
      reason: z.enum(['member_auth_unavailable', 'manual_progress_not_supported']),
      actions,
    })
    .strict(),
  z
    .object({
      type: z.literal('deck'),
      reason: z.enum([
        'availability_unknown',
        'episode_catalog_unavailable',
        'catalog_metadata_missing',
        'scan_limit',
        'deadline',
        'filtered_catalog_empty',
        'verified_no_intersection',
      ]),
      reasons: z.array(
        z.enum([
          'availability_unknown',
          'episode_catalog_unavailable',
          'catalog_metadata_missing',
          'scan_limit',
          'deadline',
          'filtered_catalog_empty',
          'verified_no_intersection',
        ])
      ),
      actions,
      scannedTitles: n,
      poolSize: n,
      scanComplete: z.boolean(),
      uncertainTitles: n,
      noMatchTitles: n,
      missingMetadataTitles: n,
      missingEpisodeTitles: n,
      screens: z.array(
        z
          .object({
            screenId: id,
            country: z.string(),
            serviceIds: z.array(n),
            watchable: n,
            noMatch: n,
            unknown: n,
          })
          .strict()
      ),
    })
    .strict(),
]);
export const sharedSchema = z
  .object({
    contractVersion: z.literal(2),
    roomId: id,
    revision: n,
    phase: z.enum(['setup', 'choosing', 'decided', 'expired']),
    expiresAt: n,
    hostParticipantId: id,
    rosterVersion: n,
    contextVersion: n,
    generation: n,
    participants: z.array(
      z
        .object({
          participantId: id,
          nickname: z.string(),
          screenId: id.nullable(),
          ready: z.boolean(),
        })
        .strict()
    ),
    screens: z.array(
      z
        .object({
          id,
          label: z.string(),
          country: z.string().nullable(),
          serviceIds: z.array(n),
          confirmed: z.boolean(),
        })
        .strict()
    ),
    constraints: z
      .object({
        kinds: z.array(z.enum(['movie', 'show_start', 'show_continue'])),
        maxMinutes: n.nullable(),
        moods: z.array(z.string()),
      })
      .strict(),
    candidates: z.array(candidate),
    stream: z
      .object({
        version: n,
        state: z.enum(['ready', 'exhausted', 'unavailable', 'capacity']),
        reason: z
          .enum(['catalog_end', 'catalog_incomplete', 'room_capacity', 'awaiting_answers'])
          .nullable(),
      })
      .strict(),
    matches: z.array(z.object({ candidateId: id, pickCount: n }).strict()),
    agreement: z
      .object({
        version: n,
        state: z.enum(['none', 'checking', 'unavailable']),
        error: z.object({ code, details: details.optional() }).strict().nullable(),
      })
      .strict(),
    decision: z
      .object({
        candidateId: id,
        agreementVersion: n,
        decidedAt: n,
        availability: z.array(availability),
      })
      .strict()
      .nullable(),
  })
  .strict();
const frame = z.discriminatedUnion('type', [
  z.object({ type: z.literal('room.snapshot'), snapshot: sharedSchema }).strict(),
  z.object({ type: z.literal('room.updated'), snapshot: sharedSchema }).strict(),
  z
    .object({ type: z.literal('activity.session'), roomId: id, sessionId: id, serverTime: n })
    .strict(),
  z
    .object({
      type: z.literal('activity'),
      sessionId: id,
      sequence: n,
      view: z.enum(['voting', 'matches', 'trailer', 'away']),
      gesture: z.enum(['reach', 'handle', 'release']).optional(),
      beat: z.literal('answer').optional(),
      roomId: id,
      participantId: id,
      serverTime: n,
      expiresAt: n,
    })
    .strict(),
  z.object({ type: z.literal('resync_required'), roomId: id }).strict(),
  z.object({ type: z.literal('restarting'), retryAfterMs: n }).strict(),
  z.object({ type: z.literal('degraded'), retryAfterMs: n }).strict(),
  z.object({ type: z.literal('error'), code }).strict(),
  z.object({ type: z.literal('pong') }).strict(),
]);
/** Exact public allowlist: unknown participant/activity fields are rejected, never copied to UI. */
export function parseFrame(raw: unknown): ServerRealtimeFrame | null {
  if (typeof raw !== 'string' || raw.length > 1024 * 1024) return null;
  try {
    const result = frame.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
