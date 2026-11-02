/**
 * Waits between automatic attempts while the server restarts: 1 s, 2 s, 4 s, 8 s, then 15 s,
 * each ±20 % so a room full of phones doesn't knock at the same moment.
 */
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 15000;
export function backoffDelay(failures: number, random: () => number = Math.random, minimum = 0): number {
  const step = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, Math.min(failures, 4)));
  const jittered = step * (0.8 + random() * 0.4);
  const floor = Math.min(Math.max(0, minimum), BACKOFF_MAX_MS);
  return Math.round(Math.min(BACKOFF_MAX_MS, Math.max(floor, jittered)));
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
/**
 * Runs `attempt` again after transient failures, waiting the backoff (or the server's Retry-After,
 * whichever is longer) between tries. Throws the last failure once `retries` are used up, when it isn't
 * transient, or when the server asks for a longer pause than one backoff step. Resolves `false` when
 * `alive` turns false while waiting (the screen went away); the caller keeps its saved request.
 */
export async function retryTransient(
  attempt: () => Promise<void>,
  o: {
    retries: number;
    retryAt: (error: unknown) => number;
    alive?: () => boolean;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
    now?: () => number;
  }
): Promise<boolean> {
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  for (let tries = 0; ; tries++) {
    try {
      await attempt();
      return true;
    } catch (e) {
      if (tries >= o.retries || !transientFailure(e)) throw e;
      const delay = Math.max(backoffDelay(tries, o.random), o.retryAt(e) - now());
      if (delay > BACKOFF_MAX_MS) throw e;
      await sleep(delay);
      if (o.alive && !o.alive()) return false;
    }
  }
}
