/**
 * Waits between automatic attempts while the server restarts: 1 s, 2 s, 4 s, 8 s, then 15 s. A server
 * minimum (Retry-After, a gateway's retryAfterMs) replaces the step when it is longer. Jitter comes last,
 * adding 0-30 %, so a room full of phones doesn't knock at the same moment even when the server named one
 * wait for everybody; the result never drops below the server's minimum.
 */
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 15000;
export const BACKOFF_JITTER = 0.3;
/** The longest automatic wait: the capped step with full jitter. */
export const BACKOFF_CEILING_MS = BACKOFF_MAX_MS * (1 + BACKOFF_JITTER);
export function backoffDelay(failures: number, random: () => number = Math.random, minimum = 0): number {
  const step = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, Math.min(failures, 4)));
  const base = Math.max(step, Number.isFinite(minimum) ? minimum : 0);
  return Math.round(base * (1 + Math.min(1, Math.max(0, random())) * BACKOFF_JITTER));
}
/**
 * How long the server asked us to wait, in ms (0 when it didn't): the Retry-After of an answered request,
 * including 429 rate limits. An unanswered request has no server deadline.
 */
export function serverWait(error: unknown): number {
  if (!(error instanceof Error)) return 0;
  const e = error as Error & { status?: unknown; retryAfterSeconds?: unknown };
  if (e.status === undefined || typeof e.retryAfterSeconds !== 'number' || !(e.retryAfterSeconds > 0)) return 0;
  return e.retryAfterSeconds * 1000;
}
/** A failure worth trying again by itself: the server said busy/retryable, or the request never got an answer. */
export function transientFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const e = error as Error & { code?: unknown; status?: unknown; retryable?: unknown };
  // A rate limit is the server asking for a manual pace; never hammer it.
  if (Number(e.status) === 429) return false;
  if (e.code === 'busy' || e.retryable === true) return true;
  // No JSON answer: no response at all, a proxy page while the server restarts, or a 5xx.
  return e.code === 'outcome_unknown' && (e.status === undefined || Number(e.status) >= 500 || [404, 408].includes(Number(e.status)));
}
/** Resolves after `ms`, or at once when `signal` aborts; the timer is cleared either way. */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}
/**
 * Runs `attempt` again after transient failures, waiting the backoff (never shorter than the server's
 * Retry-After) between tries. Throws the last failure once `retries` are used up, when it isn't transient,
 * or when the server asks for a longer pause than one backoff step. Resolves `false` as soon as `signal`
 * aborts (the person left the screen or the app went to the background): a pending wait ends at once and
 * no further attempt starts; the caller keeps its saved request.
 */
export async function retryTransient(
  attempt: (signal?: AbortSignal) => Promise<void>,
  o: {
    retries: number;
    retryAt: (error: unknown) => number;
    signal?: AbortSignal;
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
    random?: () => number;
    now?: () => number;
  }
): Promise<boolean> {
  const sleep = o.sleep ?? abortableSleep;
  const now = o.now ?? Date.now;
  for (let tries = 0; ; tries++) {
    if (o.signal?.aborted) return false;
    try {
      await attempt(o.signal);
      return true;
    } catch (e) {
      if (o.signal?.aborted) return false;
      if (tries >= o.retries || !transientFailure(e)) throw e;
      const floor = Math.max(0, o.retryAt(e) - now());
      if (floor > BACKOFF_MAX_MS) throw e;
      await sleep(backoffDelay(tries, o.random, floor), o.signal);
      if (o.signal?.aborted) return false;
    }
  }
}
