import type { RecentRoom } from './recent-room-state';

/**
 * Device-local index of the rooms this person is in, so the home can list them and History can keep
 * past decisions. Routing reminders and public results only: room credentials, invitations and
 * pending commands stay in their own stores. Values are capped so each stored item stays small.
 */
export interface RegisteredRoom {
  roomId: string;
  nickname: string;
  expiresAt: number;
  /** First time this device saw the room. */
  joinedAt: number;
  /** Last time this device opened the room; orders the home. */
  openedAt: number;
  /** Set by an explicit Leave on this device: the room moves to History with Return until it expires. */
  left?: { at: number; label: string };
}
/** A confirmed decision as this device saw it. Kept after the room moves on or expires. */
export interface DecisionRecord {
  /** `${roomId}:${generation}:${decidedAt}` so a later round of the same room is a new record. */
  id: string;
  roomId: string;
  roomLabel: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  decidedAt: number;
  people: string[];
}

export const REGISTRY_LIMITS = { rooms: 12, decisions: 8, people: 4, label: 60, title: 80, nickname: 40 } as const;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);
const finite = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function decodeRooms(raw: string | null, now: number): RegisteredRoom[] {
  let value: unknown;
  try { value = raw ? JSON.parse(raw) : []; } catch { return []; }
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rooms: RegisteredRoom[] = [];
  for (const item of value) {
    const roomId = text(item?.roomId, 200);
    const nickname = text(item?.nickname, REGISTRY_LIMITS.nickname);
    const expiresAt = finite(item?.expiresAt);
    if (!roomId || nickname === null || expiresAt === null || expiresAt <= now || seen.has(roomId)) continue;
    seen.add(roomId);
    const leftAt = finite(item?.left?.at);
    rooms.push({
      roomId, nickname, expiresAt, joinedAt: finite(item?.joinedAt) ?? now, openedAt: finite(item?.openedAt) ?? now,
      ...(leftAt !== null ? { left: { at: leftAt, label: text(item?.left?.label, REGISTRY_LIMITS.label) ?? '' } } : {}),
    });
  }
  return sortRooms(rooms).slice(0, REGISTRY_LIMITS.rooms);
}
export const sortRooms = (rooms: RegisteredRoom[]) => [...rooms].sort((a, b) => b.openedAt - a.openedAt);

/** Adds or refreshes a room. Opening it again moves it to the top; the first join time is kept. */
export function upsertRoom(rooms: RegisteredRoom[], entry: { roomId: string; nickname: string; expiresAt: number }, now: number): RegisteredRoom[] {
  const old = rooms.find((r) => r.roomId === entry.roomId);
  const next: RegisteredRoom = { roomId: entry.roomId, nickname: entry.nickname.slice(0, REGISTRY_LIMITS.nickname), expiresAt: entry.expiresAt, joinedAt: old?.joinedAt ?? now, openedAt: now };
  return sortRooms([next, ...rooms.filter((r) => r.roomId !== entry.roomId && r.expiresAt > now)]).slice(0, REGISTRY_LIMITS.rooms);
}
export const removeRoom = (rooms: RegisteredRoom[], roomId: string) => rooms.filter((r) => r.roomId !== roomId);
/** Explicit Leave: keep the room (the server no longer shows it to you) so History can offer Return. */
export const markLeft = (rooms: RegisteredRoom[], roomId: string, label: string, now: number) =>
  rooms.map((r) => (r.roomId === roomId ? { ...r, left: { at: now, label: label.slice(0, REGISTRY_LIMITS.label) } } : r));

/** The single recent room of earlier builds becomes the first registered room. */
export function migrateRecent(rooms: RegisteredRoom[], recent: RecentRoom | null, now: number): RegisteredRoom[] {
  if (!recent || recent.expiresAt <= now || rooms.some((r) => r.roomId === recent.roomId)) return rooms;
  return sortRooms([...rooms, { roomId: recent.roomId, nickname: recent.nickname, expiresAt: recent.expiresAt, joinedAt: now, openedAt: 0 }]).slice(0, REGISTRY_LIMITS.rooms);
}

export function decodeNickname(raw: string | null): string | null {
  try {
    const value = raw ? JSON.parse(raw) : null;
    const name = typeof value?.nickname === 'string' ? value.nickname.trim().slice(0, REGISTRY_LIMITS.nickname) : '';
    return name || null;
  } catch { return null; }
}

export function decodeDecisions(raw: string | null): DecisionRecord[] {
  let value: unknown;
  try { value = raw ? JSON.parse(raw) : []; } catch { return []; }
  if (!Array.isArray(value)) return [];
  const out: DecisionRecord[] = [];
  for (const item of value) {
    const id = text(item?.id, 300), roomId = text(item?.roomId, 200), title = text(item?.title, REGISTRY_LIMITS.title);
    const decidedAt = finite(item?.decidedAt);
    if (!id || !roomId || !title || decidedAt === null || out.some((d) => d.id === id)) continue;
    out.push({
      id, roomId, title, decidedAt,
      roomLabel: text(item?.roomLabel, REGISTRY_LIMITS.label) ?? '',
      year: finite(item?.year),
      posterUrl: typeof item?.posterUrl === 'string' && /^https:\/\//.test(item.posterUrl) ? item.posterUrl.slice(0, 300) : null,
      people: Array.isArray(item?.people) ? item.people.filter((p: unknown) => typeof p === 'string').slice(0, REGISTRY_LIMITS.people).map((p: string) => p.slice(0, REGISTRY_LIMITS.nickname)) : [],
    });
  }
  return out.sort((a, b) => b.decidedAt - a.decidedAt).slice(0, REGISTRY_LIMITS.decisions);
}
/** Newest first, deduplicated by decision id, capped. */
export function addDecision(list: DecisionRecord[], record: DecisionRecord): DecisionRecord[] {
  if (list.some((d) => d.id === record.id)) return list;
  return [record, ...list].sort((a, b) => b.decidedAt - a.decidedAt).slice(0, REGISTRY_LIMITS.decisions);
}
