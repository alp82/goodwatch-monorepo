export interface MemberIntent {
  roomId: string;
  expectedState: string;
  verifier: string;
  expiresAt: number;
}
/** Fixed callback identity and locally retained state; neither a URL roomId nor a code establishes membership. */
export function nativeMemberCallback(raw: string, pending: MemberIntent, now = Date.now()) {
  const url = new URL(raw);
  if (
    url.protocol !== 'yepwatch:' ||
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
