/** Preserve the entire invite through optional sign-in; no credential enters a query string. */
export function inviteIntent(invite?: string) { return invite ? `/r/${encodeURIComponent(invite)}` : '/'; }
export function safeReturnTo(value: string | undefined) {
  if (!value || (!/^\/r\/[^/?#]+$/.test(value) && !/^\/room\/[^/?#]+$/.test(value))) return '/';
  return value;
}
export function parseInvite(input: string) {
  const value = input.trim();
  if (!value.includes('://')) return value;
  try { const url = new URL(value); return url.hostname === 'yepwatch.com' && url.pathname.startsWith('/r/') ? decodeURIComponent(url.pathname.slice(3)) : ''; } catch { return ''; }
}
