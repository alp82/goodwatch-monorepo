/** A short-lived presentation hint only. The server remains the sign-in authority. */
const key = 'yepwatch.member-return';
/** Remembers the page GoodWatch sends this browser back to (path and query). */
export function rememberMemberReturn(path: string) {
  try { window.sessionStorage.setItem(key, JSON.stringify({ path, until: Date.now() + 10 * 60_000 })); } catch { /* Sign-in still works without this animation hint. */ }
}
/** This page load is the return from GoodWatch sign-in: the startup word doesn't play again. */
export function isMemberReturn() {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return false;
    const hint = JSON.parse(raw);
    return typeof hint.path === 'string' && hint.path.split('?')[0] === window.location.pathname &&
      typeof hint.until === 'number' && hint.until > Date.now() && hint.until <= Date.now() + 10 * 60_000;
  } catch { return false; }
}
export function clearMemberReturn() {
  try { window.sessionStorage.removeItem(key); } catch { /* Presentation only. */ }
}

/**
 * Whether this browser may hold a GoodWatch session cookie (signed in here before). Not proof of
 * sign-in: the API decides. Native builds don't use it.
 */
const hintKey = 'yepwatch.member-hint';
export function hasMemberHint() {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(hintKey) === '1' || isMemberReturn(); } catch { return true; }
}
export function rememberMemberHint() {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(hintKey, '1'); } catch { /* Asking anyway is fine. */ }
}
export function forgetMemberHint() {
  try { if (typeof window !== 'undefined') window.localStorage.removeItem(hintKey); } catch { /* The next read just asks. */ }
}
