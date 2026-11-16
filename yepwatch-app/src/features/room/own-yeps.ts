/**
 * Your Yeps this round, kept on this device. The room's own list isn't enough: once everyone has answered a
 * card that isn't a match, the server retires it and drops everyone's answers to it, so a Yep of yours that
 * someone else said Nope to would vanish. This keeps every Yep of the round, in answer order:
 *
 * - A card the room still holds follows the room: a Yep is listed, a Nope or an undo takes it off, and a
 *   changed answer (a new revision) moves to the newest place.
 * - A card the room retired keeps its place (its last answer here was Yep).
 * - A new round (another generation) or another room starts an empty list.
 *
 * - Another participant on this device (a guest linked to an account mid-round) starts an empty list too.
 *
 * Only the room's confirmed snapshots are kept (`noteOwnYeps`): a refused tap never changes the kept list.
 * Screens lay this device's unconfirmed answers over it (`useOwnYeps` with the displayed room).
 *
 * Web keeps it in this tab's sessionStorage, as it keeps the room (a reload shows it again; Erase this device
 * clears `yepwatch.` keys); native keeps it in memory while the app runs, like the room. Only you see it.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { Candidate, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';

/** What a Yep's row shows: enough of the title to draw it after the room has retired the card. */
export type OwnYep = Pick<Candidate, 'id' | 'title' | 'year' | 'posterUrl' | 'identity' | 'viewingDuration' | 'goodwatchScore'> & {
  /** The answer's revision when it was noted: a changed answer moves to the newest place. */
  revision: number;
};
export interface OwnYeps {
  /** `roomId:generation:participantId`: the round, and whose answers these are. */
  round: string;
  /** Oldest first. */
  yeps: OwnYep[];
}

const roundOf = (s: RoomSnapshot) => `${s.shared.roomId}:${s.shared.generation}:${s.own.participantId}`;
const pick = (c: Candidate, revision: number): OwnYep => ({
  id: c.id, title: c.title, year: c.year, posterUrl: c.posterUrl, identity: c.identity, viewingDuration: c.viewingDuration,
  goodwatchScore: c.goodwatchScore ?? null, revision,
});

/** The round's Yeps after `snapshot`; the same object when nothing changed. */
export function mergeOwnYeps(prev: OwnYeps | null, snapshot: RoomSnapshot): OwnYeps {
  const round = roundOf(snapshot);
  const before = prev?.round === round ? prev.yeps : [];
  const held = new Map(snapshot.shared.candidates.map((c) => [c.id, c]));
  const answers = new Map(snapshot.own.votes.map((v) => [v.candidateId, v]));
  const stays = (y: OwnYep) => {
    if (!held.has(y.id)) return true;
    const v = answers.get(y.id);
    return v?.value === 'watch' && v.revision === y.revision;
  };
  const kept = before.filter(stays);
  const listed = new Set(kept.map((y) => y.id));
  // The room's answers are in answer order (a changed one is re-added last).
  const added = snapshot.own.votes
    .filter((v) => v.value === 'watch' && !listed.has(v.candidateId) && held.has(v.candidateId))
    .map((v) => pick(held.get(v.candidateId)!, v.revision));
  if (prev?.round === round && !added.length && kept.length === before.length) return prev;
  return { round, yeps: [...kept, ...added] };
}

// ——— The device's copy, one round per room ———

const KEY = (roomId: string) => `yepwatch.v3.own-yeps.${roomId}`;
const session = () => {
  if (Platform.OS !== 'web') return null;
  try { return typeof window === 'undefined' ? null : window.sessionStorage; } catch { return null; }
};
const rooms = new Map<string, OwnYeps>();
const listeners = new Set<() => void>();

function read(roomId: string): OwnYeps | null {
  const cached = rooms.get(roomId);
  if (cached) return cached;
  try {
    const raw = session()?.getItem(KEY(roomId));
    const saved = raw ? (JSON.parse(raw) as OwnYeps) : null;
    if (saved && typeof saved.round === 'string' && Array.isArray(saved.yeps)) { rooms.set(roomId, saved); return saved; }
  } catch { /* unreadable: start over */ }
  return null;
}

/** Notes the room as it is now (the room's provider calls it on every snapshot). */
export function noteOwnYeps(snapshot: RoomSnapshot) {
  const roomId = snapshot.shared.roomId;
  const prev = read(roomId);
  const next = mergeOwnYeps(prev, snapshot);
  if (next === prev) return;
  rooms.set(roomId, next);
  try { session()?.setItem(KEY(roomId), JSON.stringify(next)); } catch { /* storage full or blocked: memory still has it */ }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const EMPTY: OwnYep[] = [];

/** Your Yeps in this round, newest first: the kept list with `display` (the room as this device shows it) over it. */
export function useOwnYeps(display: RoomSnapshot | undefined): OwnYep[] {
  const roomId = display?.shared.roomId ?? null;
  const kept = useSyncExternalStore(subscribe, () => (roomId ? read(roomId) : null), () => null);
  return useMemo(() => (display ? newestFirst(mergeOwnYeps(kept, display)) : EMPTY), [kept, display]);
}

const reversed = new WeakMap<OwnYeps, OwnYep[]>();
function newestFirst(entry: OwnYeps) {
  let list = reversed.get(entry);
  if (!list) { list = [...entry.yeps].reverse(); reversed.set(entry, list); }
  return list;
}
