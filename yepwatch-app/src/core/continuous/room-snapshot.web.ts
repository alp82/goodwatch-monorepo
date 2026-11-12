/**
 * Web: the open room's last confirmed snapshot in this tab's sessionStorage, so a reload paints the
 * room at once (room-snapshot-state.ts). Every saved room belongs to the sign-in it was saved under:
 * Log out or a new sign-in drops them all and starts a new epoch.
 */
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { authEpoch } from './account-flow';
import { restoredRoom, savedRoom } from './room-snapshot-state';

const PREFIX = 'yepwatch.v3.room-snapshot.';
const EPOCH_KEY = 'yepwatch.v3.room-snapshot-epoch';
const key = (roomId: string) => `${PREFIX}${roomId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
const store = () => { try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; } };
const freshEpoch = () => `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`;

function epoch(s: Storage) {
  let value = s.getItem(EPOCH_KEY);
  if (!value) { value = freshEpoch(); s.setItem(EPOCH_KEY, value); }
  return value;
}

export function readSavedRoom(roomId: string): RoomSnapshot | null {
  const s = store();
  if (!s) return null;
  try { return restoredRoom(s.getItem(key(roomId)), roomId, epoch(s), Date.now()); } catch { return null; }
}

export function saveRoom(roomId: string, snapshot: RoomSnapshot | null) {
  const s = store();
  if (!s) return;
  try {
    const value = snapshot ? savedRoom(snapshot, epoch(s), Date.now()) : null;
    if (value) s.setItem(key(roomId), JSON.stringify(value));
    else s.removeItem(key(roomId));
  } catch { /* Full or blocked storage: a reload just waits for the server. */ }
}

function forgetAll() {
  const s = store();
  if (!s) return;
  try {
    for (const k of Object.keys(s)) if (k.startsWith(PREFIX)) s.removeItem(k);
    s.setItem(EPOCH_KEY, freshEpoch());
  } catch { /* nothing kept */ }
}
// Log out or a new sign-in: rooms saved under the earlier sign-in never paint again.
authEpoch.subscribe(forgetAll);
