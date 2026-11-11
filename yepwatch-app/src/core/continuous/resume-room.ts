/**
 * Back to the room after the app was closed (owner decision Q25a). The room in front is remembered
 * while a room screen shows and forgotten on the start page. A launch on the start page goes back to
 * it, at the person's current card, when the room is still going and the person is still in it;
 * otherwise the start page shows as usual.
 */
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import type { RoomAccess } from '../credentials';

/** Answers that mean the room can't be resumed (gone, ended, or the place in it is). */
const FINAL = new Set(['unauthorized', 'not_found', 'expired', 'forbidden', 'gone']);

export interface ResumeDeps {
  loadFront: () => Promise<string | null>;
  forget: () => Promise<void>;
  loadAccess: (roomId: string) => Promise<RoomAccess | null>;
  snapshot: (access: RoomAccess) => Promise<RoomSnapshot>;
  /** The confirmed room goes into the cache, so the room shows from its first frame. */
  adopt: (snapshot: RoomSnapshot) => void;
  now: () => number;
}

/** Still going and still yours: setup or choosing, not expired, not left. */
export function resumable(snapshot: RoomSnapshot, now: number) {
  return !snapshot.own.left && (snapshot.shared.phase === 'setup' || snapshot.shared.phase === 'choosing') && snapshot.shared.expiresAt > now;
}

/**
 * The room to go back to, or null for the start page. A check that can't reach the server (offline, a
 * restart) still goes back: the room says so itself and catches up when the connection is back.
 */
export async function resumeRoom(deps: ResumeDeps): Promise<string | null> {
  const roomId = await deps.loadFront().catch(() => null);
  if (!roomId) return null;
  const access = await deps.loadAccess(roomId).catch(() => null);
  if (!access || (access.expiresAt && access.expiresAt <= deps.now())) {
    await deps.forget().catch(() => undefined);
    return null;
  }
  try {
    const snapshot = await deps.snapshot(access);
    if (!resumable(snapshot, deps.now())) {
      await deps.forget().catch(() => undefined);
      return null;
    }
    deps.adopt(snapshot);
    return roomId;
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && FINAL.has(code)) {
      await deps.forget().catch(() => undefined);
      return null;
    }
    return roomId;
  }
}
