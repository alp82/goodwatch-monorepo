/** Unsent taste answers on this browser (localStorage, like the profile secret; nothing when storage is blocked). */
const KEY = 'yepwatch.v3.taste-outbox';
const storage = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
export async function readOutbox() { try { return storage()?.getItem(KEY) ?? null; } catch { return null; } }
export async function writeOutbox(value: string | null) {
  try { if (value) storage()?.setItem(KEY, value); else storage()?.removeItem(KEY); } catch { /* kept in memory only */ }
}
export const TASTE_OUTBOX_KEY = KEY;
