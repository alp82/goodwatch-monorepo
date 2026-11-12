import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';

/**
 * The open room as the server last confirmed it, kept so a reload paints the room at once (then reads it
 * again) instead of waiting for the first answer. Older than this, or saved under another sign-in, it
 * isn't shown: the page waits for the server as before.
 */
export const SAVED_ROOM_MAX_AGE_MS = 15 * 60_000;
/** How long a reload waits for the server's own answer before it paints the saved room instead. */
export const SAVED_ROOM_GRACE_MS = 300;

export interface SavedRoom { v: 1; epoch: string; savedAt: number; snapshot: RoomSnapshot }

/**
 * What is kept: the room and this device's place in it, never account data (the GoodWatch prefill:
 * country and services). Nothing for a room this device left or one that has ended.
 */
export function savedRoom(snapshot: RoomSnapshot, epoch: string, now: number): SavedRoom | null {
  if (snapshot.own.left || snapshot.shared.phase === 'expired' || snapshot.shared.expiresAt <= now) return null;
  return { v: 1, epoch, savedAt: now, snapshot: { shared: snapshot.shared, own: { ...snapshot.own, member: { state: snapshot.own.member.state, prefill: null } } } };
}

/** The saved room to paint, or null when it's missing, damaged, stale, ended or from another sign-in. */
export function restoredRoom(raw: string | null, roomId: string, epoch: string, now: number): RoomSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SavedRoom>;
    const snapshot = value?.snapshot;
    if (value?.v !== 1 || value.epoch !== epoch || typeof value.savedAt !== 'number') return null;
    if (value.savedAt > now || now - value.savedAt > SAVED_ROOM_MAX_AGE_MS) return null;
    if (!snapshot?.shared || !snapshot.own || snapshot.shared.roomId !== roomId) return null;
    if (!Array.isArray(snapshot.shared.candidates) || !Array.isArray(snapshot.own.votes) || typeof snapshot.shared.revision !== 'number') return null;
    if (snapshot.own.left || snapshot.shared.phase === 'expired' || !(snapshot.shared.expiresAt > now)) return null;
    return snapshot;
  } catch { return null; }
}
