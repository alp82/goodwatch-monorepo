import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';

/**
 * The open room as the server last confirmed it, kept so a reload paints the room at once (then reads it
 * again) instead of waiting for the first answer. Older than this (counted from the server's answer, not
 * from the last save), or saved under another sign-in, it isn't shown: the page waits for the server.
 */
export const SAVED_ROOM_MAX_AGE_MS = 15 * 60_000;
/** How long a reload waits for the server's own answer before it paints the saved room instead. */
export const SAVED_ROOM_GRACE_MS = 300;

/** `generation`: the browser's sign-in generation it was read under. `savedAt`: when the server answered. */
export interface SavedRoom { v: 2; generation: string; savedAt: number; snapshot: RoomSnapshot }

/**
 * What is kept: the room and this device's place in it, never account data (the GoodWatch prefill:
 * country and services). Nothing for a room this device left or one that has ended.
 */
export function savedRoom(snapshot: RoomSnapshot, generation: string, confirmedAt: number, now = confirmedAt): SavedRoom | null {
  if (snapshot.own.left || snapshot.shared.phase === 'expired' || snapshot.shared.expiresAt <= now) return null;
  return { v: 2, generation, savedAt: confirmedAt, snapshot: { shared: snapshot.shared, own: { ...snapshot.own, member: { state: snapshot.own.member.state, prefill: null } } } };
}

/** The saved room to paint, or null when it's missing, damaged, stale, ended or from another sign-in. */
export function restoredRoom(raw: string | null, roomId: string, generation: string, now: number): RoomSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SavedRoom>;
    const snapshot = value?.snapshot;
    if (value?.v !== 2 || value.generation !== generation || typeof value.savedAt !== 'number') return null;
    if (value.savedAt > now || now - value.savedAt > SAVED_ROOM_MAX_AGE_MS) return null;
    if (!snapshot?.shared || !snapshot.own || snapshot.shared.roomId !== roomId) return null;
    if (!Array.isArray(snapshot.shared.candidates) || !Array.isArray(snapshot.own.votes) || typeof snapshot.shared.revision !== 'number') return null;
    if (snapshot.own.left || snapshot.shared.phase === 'expired' || !(snapshot.shared.expiresAt > now)) return null;
    return snapshot;
  } catch { return null; }
}

type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
const PREFIX = 'yepwatch.v3.room-snapshot.';
/** In localStorage, shared by every tab of the browser and kept through a sign-in's page round trip. */
export const AUTH_GENERATION_KEY = 'yepwatch.v3.auth-generation';
const roomKey = (roomId: string) => `${PREFIX}${roomId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
const fresh = () => `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`;

/**
 * Saved rooms for one tab (`session`: its sessionStorage), bound to the browser's sign-in generation
 * (`shared`: localStorage). Every sign-in, Log out or account switch, in any tab, replaces the generation:
 * rooms saved under an earlier one never paint again, and nothing is saved again until the server has
 * answered a read asked under the new one. No shared storage, no saved rooms.
 */
export function createSnapshotStore({ session, shared, now }: { session: KeyStore | null; shared: KeyStore | null; now: () => number }) {
  /** Per room: the generation and time of the last authorized server answer read in this page. */
  const confirmed = new Map<string, { generation: string; at: number }>();
  const generation = (): string | null => {
    if (!shared) return null;
    try {
      let value = shared.getItem(AUTH_GENERATION_KEY);
      if (!value) { value = fresh(); shared.setItem(AUTH_GENERATION_KEY, value); }
      return value;
    } catch { return null; }
  };
  const forgetLocal = () => {
    confirmed.clear();
    if (!session) return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < session.length; i++) { const k = session.key(i); if (k?.startsWith(PREFIX)) keys.push(k); }
      keys.forEach((k) => session.removeItem(k));
    } catch { /* nothing kept */ }
  };
  return {
    /** The current generation, to note before asking the server (null: nothing is saved). */
    generation,
    /** The server answered a read asked under `asked`: from now on this room may be saved with this time. */
    confirm(roomId: string, asked: string | null) {
      const current = generation();
      if (asked && asked === current) confirmed.set(roomId, { generation: current, at: now() });
    },
    read(roomId: string): RoomSnapshot | null {
      const current = generation();
      if (!session || !current) return null;
      try {
        const raw = session.getItem(roomKey(roomId));
        const room = restoredRoom(raw, roomId, current, now());
        if (!room && raw) session.removeItem(roomKey(roomId));
        return room;
      } catch { return null; }
    },
    /** Saves the room as the server last confirmed it in this page; without that (or for an ended room), keeps what's there. */
    save(roomId: string, snapshot: RoomSnapshot | null) {
      if (!session) return;
      try {
        if (!snapshot) { session.removeItem(roomKey(roomId)); return; }
        const current = generation();
        const mine = confirmed.get(roomId);
        if (!current || mine?.generation !== current) return;
        const value = savedRoom(snapshot, current, mine.at, now());
        if (value) session.setItem(roomKey(roomId), JSON.stringify(value));
        else session.removeItem(roomKey(roomId));
      } catch { /* Full or blocked storage: a reload just waits for the server. */ }
    },
    /** This tab's sign-in changes (Log out, Continue with GoodWatch, a new account): a new generation for the browser. */
    replaceGeneration() {
      forgetLocal();
      try { shared?.setItem(AUTH_GENERATION_KEY, fresh()); } catch { /* without shared storage nothing is saved */ }
    },
    /** Another tab replaced the generation (the storage event). */
    sharedChanged: forgetLocal,
  };
}
