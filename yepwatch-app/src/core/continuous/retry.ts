import { unanswered } from './backoff';

/** Server delay is a manual retry gate, never permission to replay an action. */
export const MAX_RETRY_SECONDS = 21600;
export const FALLBACK_RETRY_SECONDS = 2;
export function parseRetryAfter(value: string | null | undefined): number {
  const text = value?.trim() ?? '';
  if (!/^\d{1,6}$/.test(text)) return FALLBACK_RETRY_SECONDS;
  const seconds = Number(text);
  return Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= MAX_RETRY_SECONDS
    ? seconds : FALLBACK_RETRY_SECONDS;
}
interface Failure {
  code?: unknown;
  status?: unknown;
  retryable?: unknown;
  retryAfterSeconds?: unknown;
}
function failure(error: unknown): Failure {
  return error instanceof Error ? error as Error & Failure : {};
}
/**
 * Keep the saved request unless the API itself refused it. Only an API JSON error with a non-retryable
 * code is a definitive refusal; anything else (no answer, a proxy or gateway page with any status,
 * including 404 while the server restarts, a network error, exhausted retries) may hide a request that
 * already succeeded, so dropping it could make a second room on the next try.
 */
export function retainRequest(error: unknown): boolean {
  const e = failure(error);
  if (!e.code || e.code === 'outcome_unknown') return true;
  if ([401, 403, 404, 410].includes(Number(e.status)) ||
      ['unauthorized', 'forbidden', 'not_found', 'expired'].includes(String(e.code))) return false;
  return e.code === 'busy' || e.retryable === true;
}
/**
 * A saved server deadline (Retry-After) too long to wait out by itself: the request didn't go, and it may
 * not go before `until` (epoch ms), so the page's manual gate counts down to the server's own deadline.
 */
export class ServerWaitError extends Error {
  constructor(readonly until: number) {
    super('Wait before retrying this room request.');
    this.name = 'ServerWaitError';
  }
}
export function retryDeadline(error: unknown, now = Date.now()): number {
  // A saved deadline that stopped the send before it went: keep it, never a fresh (shorter) fallback.
  if (error instanceof ServerWaitError) return error.until > now ? error.until : 0;
  if (!retainRequest(error)) return 0;
  const e = failure(error);
  // Legacy unknown/busy without a server delay also gets a small bounded manual gate.
  const seconds = typeof e.retryAfterSeconds === 'number' &&
    Number.isInteger(e.retryAfterSeconds) && e.retryAfterSeconds >= 1 && e.retryAfterSeconds <= MAX_RETRY_SECONDS
    ? e.retryAfterSeconds : FALLBACK_RETRY_SECONDS;
  return now + seconds * 1000;
}
/**
 * The saved request a failed send leaves for the next try, or null when the API refused it for good. No
 * answer at all has no server deadline (Try again, back online, back in front may go at once); a saved wait
 * that stopped the send keeps its own deadline.
 */
export function keptRequest<T extends { retryAt: number }>(saved: T, error: unknown): T | null {
  return retainRequest(error) ? { ...saved, retryAt: unanswered(error) ? 0 : retryDeadline(error) } : null;
}
export function restoredRetryAt(value: unknown, now = Date.now()): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= now) return 0;
  return value <= now + MAX_RETRY_SECONDS * 1000 ? value : now + FALLBACK_RETRY_SECONDS * 1000;
}
