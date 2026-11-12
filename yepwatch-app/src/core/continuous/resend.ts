import { abortableSleep, BACKOFF_BASE_MS, BACKOFF_JITTER, QUIET_OUTAGE_MS, serverWait, transientFailure, unanswered } from './backoff';
import { browserOffline } from './network';
import { ServerWaitError } from './retry';

/**
 * A saved admission (create or join) going again by itself while its page is in front: a slow or
 * restarting server never strands the person (owner rule Q16b). Every resend is the same saved request
 * (same command id and secret), so the server answers it as the one room or the one seat it already made.
 */

/** Longest wait between automatic resends while the page is in front. */
export const RESEND_MAX_MS = 5000;
/** A server wait (Retry-After) up to this is waited out by itself; a longer one is shown as a manual gate. */
export const SERVER_WAIT_MAX_MS = 60000;

/**
 * The server's headers came but its answer never did: the body stalled past the wait or the connection
 * dropped while it was read (a 2xx), or it stalled with any status. No API answer was read, so the room or
 * the seat may already be made; it is as uncertain as no answer at all, never a refusal.
 */
export function incompleteAnswer(error: unknown) {
  if (!(error instanceof Error)) return false;
  const e = error as Error & { code?: unknown; status?: unknown; diagnostic?: { reason?: unknown } };
  if (e.code !== 'outcome_unknown' || typeof e.status !== 'number') return false;
  return (e.status >= 200 && e.status < 300) || e.diagnostic?.reason === 'timeout';
}

/** A failure after which the same request may go again by itself. */
export function resendable(error: unknown) {
  if (transientFailure(error) || incompleteAnswer(error)) return true;
  // A rate limit that names its wait: wait it out, then send the same request.
  const e = error as Error & { status?: unknown; retryable?: unknown };
  return error instanceof Error && Number(e.status) === 429 && e.retryable === true;
}

/**
 * The server answered and said no (a parsed API refusal: a 409, a 4xx): no resend can change it, so a
 * cancellation doesn't hide it. An answer that couldn't be read (outcome_unknown) is never one.
 */
export function definitiveRefusal(error: unknown) {
  if (!(error instanceof Error)) return false;
  const e = error as Error & { code?: unknown; status?: unknown; diagnostic?: { reason?: unknown } };
  // An answer the page cancelled while it was still being read (the app left the front mid-response) has
  // a status but no verdict: the request is kept and goes again, after the server's wait if it named one.
  return typeof e.status === 'number' && e.code !== 'outcome_unknown' && !resendable(error) && e.diagnostic?.reason !== 'cancelled';
}

/** One send's trouble callback that passes on only the first call (a saved wait, then a failed resend, is one outage). */
export function troubleOnce(onTrouble?: (since: number) => void) {
  let troubled = false;
  return (since: number) => { if (!troubled) { troubled = true; onTrouble?.(since); } };
}

/** 1 s, 2 s, 4 s, then 5 s between resends (minus up to 30 % jitter), never shorter than the server's wait. */
export function resendDelay(failures: number, error: unknown, random: () => number = Math.random) {
  const step = Math.min(RESEND_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, Math.min(failures, 8)));
  return Math.round(Math.max(step * (1 - Math.min(1, Math.max(0, random())) * BACKOFF_JITTER), serverWait(error)));
}

/**
 * What is left of a saved server deadline (`retryAt`, epoch ms) before the request may go: up to
 * SERVER_WAIT_MAX_MS is waited out (it ends at once when `signal` aborts), and the page hears the trouble as
 * it begins (a resumed wait is the same outage, so its connection line comes after the quiet period as before
 * the interruption); a longer one is the person's manual gate and throws a ServerWaitError carrying the
 * deadline, so the page keeps the server's wait instead of a fallback.
 */
export async function waitOutDeadline(retryAt: number, signal: AbortSignal, sleep: (ms: number, signal?: AbortSignal) => Promise<void> = abortableSleep, onTrouble?: (since: number) => void) {
  const left = retryAt - Date.now();
  if (left <= 0) return;
  if (left > SERVER_WAIT_MAX_MS) throw new ServerWaitError(retryAt);
  onTrouble?.(Date.now());
  await sleep(left, signal);
}

/**
 * Sends the saved request until it is answered. Stops (resolves false) when `signal` aborts (the page left
 * the front, the app went to the background); throws a final refusal (also one that came as it aborted), an offline browser (the page resends
 * on the online event) and a server wait longer than SERVER_WAIT_MAX_MS. `onTrouble` hears when the first
 * attempt began, once it has waited QUIET_OUTAGE_MS without an answer or failed (whichever comes first), so
 * the page's connection line shows at the end of the quiet period while a request still hangs (owner rule
 * Q24a). `onServerWait` hears the absolute end of a server's wait (Retry-After) before it is waited out, and
 * also when the answer lands as `signal` aborts, so an interrupted wait (background, relaunch) still holds
 * when the request goes again.
 */
export async function resendUntilAnswered(attempt: () => Promise<void>, o: {
  signal: AbortSignal;
  onTrouble?: (since: number) => void;
  onServerWait?: (until: number) => Promise<void>;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
}): Promise<boolean> {
  const sleep = o.sleep ?? abortableSleep;
  for (let failures = 0; ; failures++) {
    if (o.signal.aborted) return false;
    const began = Date.now();
    // Still unanswered after the quiet period: the trouble began with this attempt (a prompt answer cancels it).
    const quiet = failures === 0 && o.onTrouble ? setTimeout(() => { if (!o.signal.aborted) o.onTrouble?.(began); }, QUIET_OUTAGE_MS) : undefined;
    try {
      await attempt();
      return true;
    } catch (error) {
      // A refusal the server already gave is final, even when the page cancelled while its answer was still
      // being processed (a renewed session being stored, then the app left the front): it never becomes a
      // cancellation that the next send in front repeats.
      if (definitiveRefusal(error)) throw error;
      // A server's wait (Retry-After) that came back as the page cancelled still holds for the next send,
      // a relaunch too: dropping it here sent the same request again at once when the page was back in front.
      if (o.signal.aborted) {
        if (serverWait(error) > 0) await o.onServerWait?.(Date.now() + serverWait(error));
        return false;
      }
      if (!resendable(error) || (unanswered(error) && browserOffline()) || serverWait(error) > SERVER_WAIT_MAX_MS) throw error;
      if (failures === 0) o.onTrouble?.(began);
      const delay = resendDelay(failures, error, o.random);
      if (serverWait(error) > 0) await o.onServerWait?.(Date.now() + delay);
      await sleep(delay, o.signal);
    } finally {
      clearTimeout(quiet);
    }
  }
}
