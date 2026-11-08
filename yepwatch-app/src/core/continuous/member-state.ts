export interface MemberIntent {
  roomId: string;
  expectedState: string;
  verifier: string;
  expiresAt: number;
  returnUri?: string;
}
/** Fixed callback identity and locally retained state; neither a URL roomId nor a code establishes membership. */
export function nativeMemberCallback(raw: string, pending: MemberIntent, now = Date.now()) {
  const url = new URL(raw);
  if (
    `${url.protocol}//${url.host}${url.pathname}` !== (pending.returnUri ?? 'yepwatch://auth/callback') ||
    !['yepwatch:', 'yepwatch-preview:'].includes(url.protocol) ||
    url.hostname !== 'auth' ||
    url.pathname !== '/callback' ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error('Unexpected sign-in callback.');
  if (pending.expiresAt <= now)
    throw new Error('Sign-in expired. Return to your room and start again.');
  const state = url.searchParams.get('state');
  const roomId = url.searchParams.get('roomId');
  const code = url.searchParams.get('code');
  if (
    roomId !== pending.roomId ||
    !state ||
    !sameState(state, pending.expectedState) ||
    !code ||
    code.length > 4096 ||
    [...url.searchParams.keys()].some((k) => !['state', 'roomId', 'code'].includes(k)) ||
    ['state', 'roomId', 'code'].some((k) => url.searchParams.getAll(k).length !== 1)
  )
    throw new Error('Sign-in does not match your pending room request.');
  return { roomId, state, code, codeVerifier: pending.verifier };
}
export function sameState(a: string, b: string) {
  if (a.length !== b.length || a.length > 512) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}
export function secureAuthorizeUrl(raw: string) {
  const url = new URL(raw);
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  )
    throw new Error('Sign-in requires a secure issuer.');
  if (url.username || url.password) throw new Error('Unexpected sign-in destination.');
  return url.href;
}

export function memberReturnUri(scheme: string | string[] | undefined) {
  const selected = Array.isArray(scheme) ? scheme[0] : scheme;
  if (!selected || !['yepwatch', 'yepwatch-preview'].includes(selected)) throw new Error('This app build has no configured GoodWatch return link.');
  return `${selected}://auth/callback`;
}

/** A native GoodWatch sign-in waiting for its return link (no room). */
export interface AccountIntent {
  expectedState: string;
  verifier: string;
  expiresAt: number;
  returnUri: string;
}
/** The app's own return link with exactly the state it started and a one-use code; nothing else. */
export function nativeAccountCallback(raw: string, pending: AccountIntent, now = Date.now()) {
  const url = new URL(raw);
  if (
    `${url.protocol}//${url.host}${url.pathname}` !== pending.returnUri ||
    !['yepwatch:', 'yepwatch-preview:'].includes(url.protocol) ||
    url.hostname !== 'auth' ||
    url.pathname !== '/callback' ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error('Unexpected sign-in callback.');
  if (pending.expiresAt <= now) throw new Error('Sign-in expired. Try again.');
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (
    !state ||
    !sameState(state, pending.expectedState) ||
    !code ||
    code.length > 4096 ||
    [...url.searchParams.keys()].some((k) => !['state', 'code'].includes(k)) ||
    ['state', 'code'].some((k) => url.searchParams.getAll(k).length !== 1)
  )
    throw new Error('Sign-in does not match your request.');
  return { state, code, codeVerifier: pending.verifier };
}
/** A GoodWatch return link for the device sign-in (its state starts with acctn.), not an older room link. */
export const isAccountCallback = (raw: string) => {
  try { return new URL(raw).searchParams.get('state')?.startsWith('acctn.') === true; } catch { return false; }
};

/**
 * Where a browser comes back to after GoodWatch: the page you signed in from, without one-off arrival
 * parameters (a room's fresh/signin markers, a sheet already open).
 */
export function returnPath(pathname: string, search = '') {
  const params = new URLSearchParams(search);
  for (const key of ['signin', 'fresh', 'arrival']) params.delete(key);
  const path = pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/';
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
