/** HttpOnly room cookies expire at the server-issued deadline; no browser script reads their credentials. */
export async function eraseDevice(_roomIds: string[]) {
  if (typeof sessionStorage === 'undefined') return;
  for (const key of Object.keys(sessionStorage)) if (key.startsWith('yepwatch.') && !key.startsWith('yepwatch.v3.deletion-recovery')) sessionStorage.removeItem(key);
}
