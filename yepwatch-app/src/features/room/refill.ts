/**
 * When the background refill may send, per confirmed stream (generation, stream version, stream
 * state). One refill in flight at a time. A refill that didn't go through (another command was in
 * flight, a network error, a refusal) may try again after a short wait, a few times. A refill that
 * went through isn't repeated for the same stream; a fresh snapshot with a new stream version or
 * state starts over.
 */
export const REFILL_TRIES = 3;
export const refillBackoffMs = (failures: number) => 1_500 * failures;

export type RefillDecision = { send: true } | { send: false; retryInMs: number | null };

export class RefillGate {
  private key = '';
  private inFlight = false;
  private failures = 0;
  private done = false;
  private retryAt = 0;

  begin(key: string, now: number): RefillDecision {
    if (key !== this.key) Object.assign(this, { key, inFlight: false, failures: 0, done: false, retryAt: 0 });
    if (this.inFlight || this.done || this.failures >= REFILL_TRIES) return { send: false, retryInMs: null };
    if (now < this.retryAt) return { send: false, retryInMs: this.retryAt - now };
    this.inFlight = true;
    return { send: true };
  }

  settle(key: string, ok: boolean, now: number) {
    if (key !== this.key) return;
    this.inFlight = false;
    if (ok) { this.done = true; return; }
    this.failures++;
    this.retryAt = now + refillBackoffMs(this.failures);
  }
}
