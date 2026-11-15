/**
 * Whether this device has finished the Tonight how-to (the first-round guide on the voting card). Kept on
 * the device only: a person's first round ever on this phone shows it, later rounds don't.
 */
import * as SecureStore from 'expo-secure-store';

export const TUTORIAL_SEEN_KEY = 'yepwatch.v3.tonight-howto-seen';

/** Native reads are asynchronous: null until `readTutorialSeen` answers. */
export function tutorialSeenNow(): boolean | null {
  return null;
}
export async function readTutorialSeen(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(TUTORIAL_SEEN_KEY)) === '1'; } catch { return true; }
}
export async function writeTutorialSeen() {
  try { await SecureStore.setItemAsync(TUTORIAL_SEEN_KEY, '1'); } catch { /* the how-to shows again next round */ }
}
