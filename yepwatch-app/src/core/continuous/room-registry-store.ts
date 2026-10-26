import {
  addDecision, decodeDecisions, decodeNickname, decodeRooms, markLeft, migrateRecent, removeRoom, upsertRoom,
  type DecisionRecord, type RegisteredRoom,
} from './room-registry-state';

export const REGISTRY_KEYS = { rooms: 'yepwatch.v3.rooms', profile: 'yepwatch.v3.profile', decisions: 'yepwatch.v3.decisions', migrated: 'yepwatch.v3.migrated' } as const;
export interface KeyValue { read: (key: string) => Promise<string | null>; write: (key: string, value: string) => Promise<void>; remove?: (key: string) => Promise<void> }

/** Characters per stored item: at most 4 UTF-8 bytes each keeps every item under SecureStore's 2048-byte guidance. */
export const CHUNK_CHARS = 500;
const MAX_CHUNKS = 40;
const HEADER = /^~([ab])(\d+)~$/;
/**
 * Splits long values into chunks under `key.a.N` or `key.b.N` and keeps a small header at `key`.
 * A write fills the bank the header does not point to, then switches the header in one item
 * write, so a failure part-way leaves the previous value whole. Short values stay in `key` itself.
 */
export function chunkedKeyValue(base: KeyValue, size: number = CHUNK_CHARS): KeyValue {
  const part = (key: string, bank: string, i: number) => `${key}.${bank}.${i}`;
  const header = (raw: string | null) => {
    const m = raw?.match(HEADER);
    return m ? { bank: m[1], count: Number(m[2]) } : null;
  };
  return {
    async read(key) {
      const head = await base.read(key);
      if (head === null || !head.startsWith('~')) return head;
      const h = header(head);
      if (!h || !h.count || h.count > MAX_CHUNKS) return null;
      const parts: string[] = [];
      for (let i = 0; i < h.count; i++) {
        const next = await base.read(part(key, h.bank, i));
        if (next === null) return null;
        parts.push(next);
      }
      return parts.join('');
    },
    async write(key, value) {
      const old = header(await base.read(key));
      if (value.length <= size && !value.startsWith('~')) {
        await base.write(key, value);
      } else {
        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
        if (!chunks.length) chunks.push('');
        if (chunks.length > MAX_CHUNKS) throw new Error('Value too large for the device store');
        const bank = old?.bank === 'a' ? 'b' : 'a';
        for (let i = 0; i < chunks.length; i++) await base.write(part(key, bank, i), chunks[i]);
        await base.write(key, `~${bank}${chunks.length}~`);
      }
      // The previous bank is unreachable now; tidy it when the store can.
      if (old && base.remove) for (let i = 0; i < Math.min(old.count, MAX_CHUNKS); i++) await base.remove(part(key, old.bank, i)).catch(() => undefined);
    },
    remove: base.remove,
  };
}
export interface RegistrySnapshot { rooms: RegisteredRoom[]; nickname: string | null; decisions: DecisionRecord[] }

/**
 * Read-modify-write is serialized so the home, a room and a sign-in callback can update the
 * registry at the same time without losing each other's changes.
 */
export function createRegistry(store: KeyValue, recent: () => Promise<{ roomId: string; nickname: string; expiresAt: number } | null>, now: () => number = Date.now) {
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };
  const readRooms = async () => decodeRooms(await store.read(REGISTRY_KEYS.rooms), now());
  const writeRooms = (rooms: RegisteredRoom[]) => store.write(REGISTRY_KEYS.rooms, JSON.stringify(rooms));
  return {
    /** Everything the home needs. Migrates the previous single recent room once. */
    load: () => serial(async (): Promise<RegistrySnapshot> => {
      let rooms = await readRooms();
      // Once only: a room forgotten later (ended, or left for good) must not come back from the old reminder.
      const recentRoom = (await store.read(REGISTRY_KEYS.migrated)) ? null : await recent().catch(() => null);
      if (!(await store.read(REGISTRY_KEYS.migrated))) {
        const migrated = migrateRecent(rooms, recentRoom, now());
        if (migrated !== rooms) { rooms = migrated; await writeRooms(rooms); }
        await store.write(REGISTRY_KEYS.migrated, '1');
        if (recentRoom?.nickname?.trim() && !decodeNickname(await store.read(REGISTRY_KEYS.profile)))
          await store.write(REGISTRY_KEYS.profile, JSON.stringify({ nickname: recentRoom.nickname.trim() }));
      }
      const nickname = decodeNickname(await store.read(REGISTRY_KEYS.profile));
      return { rooms, nickname, decisions: decodeDecisions(await store.read(REGISTRY_KEYS.decisions)) };
    }),
    /** Called whenever a room is opened with a confirmed identity. Also remembers the nickname. */
    remember: (entry: { roomId: string; nickname: string; expiresAt: number }) => serial(async () => {
      await writeRooms(upsertRoom(await readRooms(), entry, now()));
      if (entry.nickname.trim()) await store.write(REGISTRY_KEYS.profile, JSON.stringify({ nickname: entry.nickname.trim() }));
    }),
    forget: (roomId: string) => serial(async () => { await writeRooms(removeRoom(await readRooms(), roomId)); }),
    /** After a confirmed Leave. Opening or rejoining the room (remember) clears it. */
    markLeft: (roomId: string, label: string) => serial(async () => { await writeRooms(markLeft(await readRooms(), roomId, label, now())); }),
    setNickname: (nickname: string) => serial(async () => { await store.write(REGISTRY_KEYS.profile, JSON.stringify({ nickname: nickname.trim() })); }),
    recordDecision: (record: DecisionRecord) => serial(async () => {
      const list = decodeDecisions(await store.read(REGISTRY_KEYS.decisions));
      const next = addDecision(list, record);
      if (next !== list) await store.write(REGISTRY_KEYS.decisions, JSON.stringify(next));
    }),
  };
}
export type RoomRegistry = ReturnType<typeof createRegistry>;
