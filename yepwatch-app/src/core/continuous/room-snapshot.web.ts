/**
 * Web: the open room's last confirmed snapshot in this tab's sessionStorage, so a reload paints the
 * room at once (room-snapshot-state.ts). Saved rooms belong to the browser's sign-in generation in
 * localStorage: Log out, a sign-in (leaving for GoodWatch and coming back) or another account, in any tab,
 * replaces it, so no saved room outlives the sign-in it was read under.
 */
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { authEpoch } from './account-flow';
import { AUTH_GENERATION_KEY, createSnapshotStore } from './room-snapshot-state';

const storage = (name: 'sessionStorage' | 'localStorage') => {
  try { return typeof window === 'undefined' ? null : window[name]; } catch { return null; }
};
const store = createSnapshotStore({ session: storage('sessionStorage'), shared: storage('localStorage'), now: Date.now });

export const readSavedRoom = (roomId: string): RoomSnapshot | null => store.read(roomId);
export const saveRoom = (roomId: string, snapshot: RoomSnapshot | null) => store.save(roomId, snapshot);
/** Note before asking the server for the room; pass to `confirmRoom` with its answer. */
export const snapshotGeneration = () => store.generation();
export const confirmRoom = (roomId: string, asked: string | null) => store.confirm(roomId, asked);
/**
 * Continue with GoodWatch, before the page leaves: no tab saves or paints a room until this page is back
 * (`settleSignIn`, also run when it loads again), so nothing read with the old account's cookie paints after.
 */
export const beginSignIn = () => store.beginSignIn();
export const settleSignIn = () => store.settleSignIn();

// Log out or a new sign-in in this tab.
authEpoch.subscribe(store.replaceGeneration);
// The same in another tab of this browser (or its storage cleared there).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_GENERATION_KEY || event.key === null) store.sharedChanged();
  });
  // Back from GoodWatch through the back/forward cache (a fresh load settles when the store is made).
  window.addEventListener('pageshow', (event) => { if (event.persisted) store.settleSignIn(); });
}
