/** Web: session storage, so the "open Mood next" step survives the full-page GoodWatch sign-in round trip. */
const safe = (roomId: string) => roomId.replace(/[^a-zA-Z0-9._-]/g, '_');
const seenKey = (roomId: string) => `yepwatch.v3.ideas-seen.${safe(roomId)}`;
const moodKey = (roomId: string) => `yepwatch.v3.mood-step.${safe(roomId)}`;
const store = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);
export async function readSeenIdeas(roomId: string): Promise<string[]> {
  const raw = store()?.getItem(seenKey(roomId));
  const value: unknown = raw ? JSON.parse(raw) : [];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
export async function writeSeenIdeas(roomId: string, seen: string[]) {
  store()?.setItem(seenKey(roomId), JSON.stringify(seen));
}
// Memory as well: without session storage the step still holds within this page load.
const moodSteps = new Set<string>();
export function markMoodStep(roomId: string) {
  moodSteps.add(roomId);
  try { store()?.setItem(moodKey(roomId), '1'); } catch { /* Memory keeps it for this page load. */ }
}
export function hasMoodStep(roomId: string) {
  if (moodSteps.has(roomId)) return true;
  try { return store()?.getItem(moodKey(roomId)) === '1'; } catch { return false; }
}
export function clearMoodStep(roomId: string) {
  moodSteps.delete(roomId);
  try { store()?.removeItem(moodKey(roomId)); } catch { /* Nothing to clear. */ }
}
