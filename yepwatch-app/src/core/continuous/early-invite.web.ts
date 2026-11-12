import { takeEarlyInvite, type EarlyInvite } from './early-invite-core';
/** The answer the invitation page asked for before the app loaded (see early-invite-core), or null. */
export function earlyInviteResponse(url: string, init: RequestInit, fetcher: (url: string, init: RequestInit) => Promise<Response>) {
  if (typeof window === 'undefined') return null;
  return takeEarlyInvite((window as { __ywEarlyInvite?: EarlyInvite }).__ywEarlyInvite, window.location.origin, Date.now(), url, init, fetcher);
}
