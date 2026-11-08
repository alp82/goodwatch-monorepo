import { backoffDelay, transientFailure } from '../../core/continuous/backoff';
import { RoomFailure } from '../../core/continuous/api-client';

/**
 * When a room may link your place to this device's GoodWatch sign-in, per key (participant, member
 * state, session generation). One request in flight; a transient failure (network, busy) tries again
 * after a short backoff, a few times; a refusal (sign in again, another account) waits for the key to
 * change; anything else, or retries running out, leaves the room showing a quiet Retry.
 */
export const LINK_TRIES = 3;
export type LinkOutcome = 'linked' | 'transient' | 'refused' | 'failed';
export type LinkDecision = { send: true } | { send: false; retryInMs: number | null };

export function linkOutcome(error: unknown): Exclude<LinkOutcome, 'linked'> {
  if (error instanceof RoomFailure) {
    if (error.code === 'member_required' || error.code === 'conflict') return 'refused';
    return transientFailure(error) ? 'transient' : 'failed';
  }
  // No answer at all (fetch threw before any response).
  return 'transient';
}

export class RoomLinkGate {
  private key = '';
  private inFlight = false;
  private failures = 0;
  private settled: LinkOutcome | null = null;
  private retryAt = 0;

  private use(key: string) {
    if (key !== this.key) Object.assign(this, { key, inFlight: false, failures: 0, settled: null, retryAt: 0 });
  }

  begin(key: string, now: number): LinkDecision {
    this.use(key);
    if (this.inFlight || (this.settled && this.settled !== 'transient') || this.failures >= LINK_TRIES) return { send: false, retryInMs: null };
    if (now < this.retryAt) return { send: false, retryInMs: this.retryAt - now };
    this.inFlight = true;
    return { send: true };
  }

  settle(key: string, outcome: LinkOutcome, now: number) {
    if (key !== this.key) return;
    this.inFlight = false;
    this.settled = outcome;
    if (outcome !== 'transient') return;
    this.failures++;
    this.retryAt = now + backoffDelay(this.failures - 1);
  }

  /** Linking gave up for this key: retries ran out or an unexpected refusal. */
  failed(key: string) {
    return key === this.key && !this.inFlight && (this.settled === 'failed' || (this.settled === 'transient' && this.failures >= LINK_TRIES));
  }

  /** A press of Retry: start this key over. */
  retry(key: string) {
    if (key === this.key) Object.assign(this, { inFlight: false, failures: 0, settled: null, retryAt: 0 });
  }
}
