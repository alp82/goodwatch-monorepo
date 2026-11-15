/**
 * Whether this browser has finished the Tonight how-to (the first-round guide on the voting card). In
 * localStorage, so it holds across tabs and visits: a person's first round ever in this browser shows it.
 */
export const TUTORIAL_SEEN_KEY = 'yepwatch.v3.tonight-howto-seen';

const store = () => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};
/** Read at once on the web (no storage: treated as seen, so nothing half-plays). */
export function tutorialSeenNow(): boolean | null {
  const s = store();
  if (!s) return true;
  try { return s.getItem(TUTORIAL_SEEN_KEY) === '1'; } catch { return true; }
}
export async function readTutorialSeen(): Promise<boolean> {
  return tutorialSeenNow() ?? true;
}
export async function writeTutorialSeen() {
  try { store()?.setItem(TUTORIAL_SEEN_KEY, '1'); } catch { /* the how-to shows again next round */ }
}
