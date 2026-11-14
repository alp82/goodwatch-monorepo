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
 * `restarting`); `offline`: the device was offline at any point of it. Both are decided for the whole outage and the
 * period can only shrink, so the line never shows and then hides again within one outage.
 */
export function quietPeriod(planned: boolean, offline: boolean): number {
  return planned && !offline ? PLANNED_RESTART_QUIET_MS : QUIET_OUTAGE_MS;
}

interface Outage {
  since: number;
  planned: boolean;
  offline: boolean;
}
/** The outage after one more render: started (planned when it starts as `restarting`), latched offline, or over. */
export function nextOutage(old: Outage | null, input: ConnectionInput, now: number): Outage | null {
  if (!disrupted(input)) return null;
  const outage = old ?? { since: now, planned: input.connection === 'restarting', offline: false };
  return input.offline && !outage.offline ? { ...outage, offline: true } : outage;
}

/** The room's connection line: '' until an outage has lasted its quiet period (quietPeriod) without a break. */
export function useConnectionWords(input: ConnectionInput): string {
  const { offline, connection, pending } = input;
  const [outage, setOutage] = useState<Outage | null>(null);
  useEffect(() => {
    // The outage's start is a moment in time (Date.now), so it is taken after the render that first shows it.
    setOutage((old) => nextOutage(old, { offline, connection, pending }, Date.now())); // eslint-disable-line react-hooks/set-state-in-effect
  }, [offline, connection, pending]);
  const current = disrupted(input) ? outage : null;
  const late = useLateSince(current?.since ?? null, quietPeriod(current?.planned ?? false, (current?.offline ?? false) || offline));
  return connectionWords(input, late);
}
