import { appOrigin } from './config';
/** Preserve the entire invite through optional sign-in; no credential enters a query string. */
export function inviteIntent(invite?: string) { return invite ? `/r/${encodeURIComponent(invite)}` : '/'; }
export function safeReturnTo(value: string | undefined) {
  if (!value || (!/^\/r\/[^/?#]+$/.test(value) && !/^\/room\/[^/?#]+$/.test(value))) return '/';
  return value;
}
export function parseInvite(input: string) {
  const value = input.trim();
  if (!value.includes('://')) return value;
  try { const url = new URL(value); return (url.origin === new URL(appOrigin).origin || url.origin === 'https://yepwatch.com') && /^\/r\/[^/?#]+$/.test(url.pathname) && !url.search && !url.hash ? decodeURIComponent(url.pathname.slice(3)) : ''; } catch { return ''; }
}

export function appInviteUrl(path: string, origin = appOrigin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Invitations require a secure app origin.');
  if (!/^\/r\/[^/?#]+$/.test(path)) throw new Error('Unexpected invitation path.');
  return `${url.origin}${path}`;
}
