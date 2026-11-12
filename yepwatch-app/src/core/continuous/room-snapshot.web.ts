/**
 * Web: the open room's last confirmed snapshot in this tab's sessionStorage, so a reload paints the
 * room at once (room-snapshot-state.ts). Saved rooms belong to the browser's sign-in generation in
 * localStorage: Log out, a sign-in (before its page round trip) or another account, in any tab, replaces
 * it, so no saved room outlives the sign-in it was read under.
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
/** Continue with GoodWatch: rooms saved before the page leaves for GoodWatch never paint after it returns. */
export const replaceSignInGeneration = () => store.replaceGeneration();

// Log out or a new sign-in in this tab.
authEpoch.subscribe(store.replaceGeneration);
// The same in another tab of this browser (or its storage cleared there).
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_GENERATION_KEY || event.key === null) store.sharedChanged();
  });
