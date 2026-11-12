/**
 * The invitation page (/r/<code>, scripts/invite-page.cjs) asks for the room's preview and its invite resolution in
 * an inline script, before the app's scripts have even downloaded. The app's own first request for each takes that
 * answer instead of asking again, so the join page doesn't wait for a round trip after the app starts.
 */
export interface EarlyInvite {
  code: string;
  /** Page time (Date.now()) the requests left. */
  at: number;
  /** Pathname → the request the page started; each is taken at most once. */
  requests: Record<string, Promise<Response> | undefined>;
}
/** An answer older than this is asked for again (the page sat in a background tab). */
export const EARLY_INVITE_MAX_AGE_MS = 15_000;

/**
 * The page's own answer for this request, or null: same origin, a path the page asked for, the exact body it sent,
 * not yet taken, and fresh. A request the page's answer failed goes out again through `fetcher`; the caller's
 * abort ends the wait as an aborted fetch would.
 */
export function takeEarlyInvite(
  early: EarlyInvite | undefined,
  origin: string,
  now: number,
  url: string,
  init: RequestInit,
  fetcher: (url: string, init: RequestInit) => Promise<Response>
): Promise<Response> | null {
  if (!early || init.method !== 'POST' || typeof init.body !== 'string' || now - early.at > EARLY_INVITE_MAX_AGE_MS) return null;
  let path: string;
  try {
    const parsed = new URL(url, origin);
    if (parsed.origin !== origin) return null;
    path = parsed.pathname;
  } catch {
    return null;
  }
  const answer = early.requests[path];
  if (!answer || init.body !== JSON.stringify({ code: early.code })) return null;
  delete early.requests[path];
  const signal = init.signal;
  return new Promise<Response>((resolve, reject) => {
    const aborted = () => reject(signal?.reason ?? new Error('aborted'));
    if (signal?.aborted) return aborted();
    signal?.addEventListener('abort', aborted, { once: true });
    answer
      .catch(() => fetcher(url, init))
      .then(resolve, reject)
      .finally(() => signal?.removeEventListener('abort', aborted));
  });
}
