import { useEffect, useState } from 'react';
import type { Connection } from '../realtime';
import { useLateSince } from '../useLate';
import { PLANNED_RESTART_QUIET_MS, QUIET_OUTAGE_MS } from './backoff';

/**
 * What a room says about its connection, decided here and nowhere else (owner rule Q24a):
 *  - nothing while an outage is younger than QUIET_OUTAGE_MS: actions show at once and queue meanwhile; an outage
 *    the server announced (the live channel got "restarting" while live: a deploy) is quiet for
 *    PLANNED_RESTART_QUIET_MS, unless the device itself is offline,
 *  - after that, one small line: "You’re offline." when the device has no network, else "Reconnecting…",
 *  - never a countdown, a retry timer or "awaiting confirmation".
 * The E2E harness holds the app to the same rule (e2e/lib/gates.ts, connectionWords).
 */
export { PLANNED_RESTART_QUIET_MS, QUIET_OUTAGE_MS };
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

/**
 * How long an outage stays quiet. `planned`: it began as an announced restart (its first disrupted state was
 * `restarting`); decided once at its start, so the line never shows and then hides again within one outage.
 */
export function quietPeriod(planned: boolean, offline: boolean): number {
  return planned && !offline ? PLANNED_RESTART_QUIET_MS : QUIET_OUTAGE_MS;
}

/** The room's connection line: '' until an outage has lasted its quiet period (quietPeriod) without a break. */
export function useConnectionWords(input: ConnectionInput): string {
  const active = disrupted(input);
  const [outage, setOutage] = useState<{ since: number; planned: boolean } | null>(null);
  const startsPlanned = input.connection === 'restarting';
  useEffect(() => {
    setOutage((old) => (!active ? null : old ?? { since: Date.now(), planned: startsPlanned }));
  }, [active, startsPlanned]);
  const late = useLateSince(active ? outage?.since ?? null : null, quietPeriod(outage?.planned ?? false, input.offline));
  return connectionWords(input, late);
}
