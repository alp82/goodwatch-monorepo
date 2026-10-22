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
export function retainRequest(error: unknown): boolean {
  const e = failure(error);
  if ([401, 403, 404, 410].includes(Number(e.status)) ||
      ['unauthorized', 'forbidden', 'not_found', 'expired'].includes(String(e.code))) return false;
  return !e.code || e.code === 'outcome_unknown' || e.code === 'busy' || e.retryable === true;
}
export function retryDeadline(error: unknown, now = Date.now()): number {
  if (!retainRequest(error)) return 0;
  const e = failure(error);
  // Legacy unknown/busy without a server delay also gets a small bounded manual gate.
  const seconds = typeof e.retryAfterSeconds === 'number' &&
    Number.isInteger(e.retryAfterSeconds) && e.retryAfterSeconds >= 1 && e.retryAfterSeconds <= MAX_RETRY_SECONDS
    ? e.retryAfterSeconds : FALLBACK_RETRY_SECONDS;
  return now + seconds * 1000;
}
export function restoredRetryAt(value: unknown, now = Date.now()): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= now) return 0;
  return value <= now + MAX_RETRY_SECONDS * 1000 ? value : now + FALLBACK_RETRY_SECONDS * 1000;
}
