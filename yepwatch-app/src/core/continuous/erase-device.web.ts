/** HttpOnly room cookies expire at the server-issued deadline; no browser script reads their credentials. */
export async function eraseDevice(_roomIds: string[]) {
  // The taste profile's secret and unsent answers (profile-secret.web.ts, taste-outbox-store.web.ts).
  try { for (const key of ['yepwatch.v3.taste-secret', 'yepwatch.v3.taste-outbox']) localStorage.removeItem(key); } catch { /* storage blocked */ }
  if (typeof sessionStorage === 'undefined') return;
  for (const key of Object.keys(sessionStorage)) if (key.startsWith('yepwatch.') && !key.startsWith('yepwatch.v3.deletion-recovery')) sessionStorage.removeItem(key);
  try { localStorage.removeItem('yepwatch.v3.tonight-howto-seen'); } catch { /* no storage */ }
}
