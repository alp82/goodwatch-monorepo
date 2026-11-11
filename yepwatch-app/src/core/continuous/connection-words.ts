import type { Connection } from '../realtime';
import { useLate } from '../useLate';

/**
 * What a room says about its connection, decided here and nowhere else (owner rule Q24a):
 *  - nothing while an outage is younger than QUIET_OUTAGE_MS: actions show at once and queue meanwhile,
 *  - after that, one small line: "You’re offline." when the device has no network, else "Reconnecting…",
 *  - never a countdown, a retry timer or "awaiting confirmation".
 * The E2E harness holds the app to the same rule (e2e/lib/gates.ts, connectionWords).
 */
export const QUIET_OUTAGE_MS = 3000;
export const OFFLINE_WORDS = 'You’re offline.';
export const RECONNECTING_WORDS = 'Reconnecting…';

export interface ConnectionInput {
  /** The browser says it has no network. */
  offline: boolean;
  connection: Connection;
  /** An action is saved and waits to be confirmed (its request failed without a refusal). */
  pending: boolean;
}

/**
 * Not an outage: the live channel, its HTTP fallback, a page in the background, or the channel's first
 * connect (the room itself came over HTTP; a channel that never comes up falls back to polling).
 */
const CONNECTED: Connection[] = ['live', 'polling', 'background', 'connecting', 'expired'];

export function disrupted(input: ConnectionInput): boolean {
  return input.offline || input.pending || !CONNECTED.includes(input.connection);
}

/** The words for an outage that has lasted `late` (past QUIET_OUTAGE_MS), or '' for none. */
export function connectionWords(input: ConnectionInput, late: boolean): string {
  if (!late || !disrupted(input)) return '';
  return input.offline ? OFFLINE_WORDS : RECONNECTING_WORDS;
}

/** The room's connection line: '' until an outage has lasted QUIET_OUTAGE_MS without a break. */
export function useConnectionWords(input: ConnectionInput): string {
  const late = useLate(disrupted(input), QUIET_OUTAGE_MS);
  return connectionWords(input, late);
}
