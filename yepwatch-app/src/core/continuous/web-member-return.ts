/** A short-lived presentation hint only. The server snapshot remains the sign-in authority. */
const key = 'yepwatch.member-return';
export function rememberMemberReturn(roomId: string) {
  try { window.sessionStorage.setItem(key, JSON.stringify({ path: `/room/${encodeURIComponent(roomId)}`, until: Date.now() + 10 * 60_000 })); } catch { /* Sign-in still works without this animation hint. */ }
}
export function isMemberReturn() {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return false;
    const hint = JSON.parse(raw);
    return hint.path === window.location.pathname && typeof hint.until === 'number' && hint.until > Date.now() && hint.until <= Date.now() + 10 * 60_000;
  } catch { return false; }
}

export function clearMemberReturn() {
  try { window.sessionStorage.removeItem(key); } catch { /* Presentation only. */ }
}
