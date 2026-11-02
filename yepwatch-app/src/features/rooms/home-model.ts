import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import type { DecisionRecord, RegisteredRoom } from '../../core/continuous/room-registry-state';
import { roomView, statusLine } from '../room/model';

/** A room on the personal home. Everything comes from the room's own authoritative snapshot. */
export interface HomeRoom {
  roomId: string;
  /** The room's ideas ("cheer me up +1"), or "Anything". */
  label: string;
  /** Open right now (not yet decided). */
  live: boolean;
  /** "Setting up", "Choosing · 2 matches", "Proposed: Heat", "Tonight: Heat", "Left". */
  status: string;
  /** A proposal or Tonight: the status line is amber. */
  hot: boolean;
  /** Tonight's poster once decided. */
  poster: string | null;
  people: { id: string; nickname: string; dropped: boolean; self: boolean }[];
  hostNickname: string | null;
  own: boolean;
  openedAt: number;
}
export type Classified =
  | { kind: 'active'; room: HomeRoom; record: DecisionRecord | null }
  | { kind: 'left'; room: HomeRoom }
  | { kind: 'gone' }
  | { kind: 'unavailable'; roomId: string; nickname: string };

const ACCESS_ENDED = ['unauthorized', 'forbidden', 'not_found', 'expired'];

/** A room has no name of its own: its switched-on ideas name it. */
export function roomLabel(snapshot: RoomSnapshot) {
  return roomView(snapshot).label;
}

export function decisionRecord(snapshot: RoomSnapshot): DecisionRecord | null {
  const { shared } = snapshot;
  const d = shared.decision;
  if (shared.phase !== 'decided' || !d) return null;
  const c = shared.candidates.find((x) => x.id === d.candidateId);
  if (!c) return null;
  return {
    id: `${shared.roomId}:${shared.generation}:${d.decidedAt}`,
    roomId: shared.roomId,
    roomLabel: roomLabel(snapshot),
    title: c.title,
    year: c.year ?? null,
    posterUrl: c.posterUrl ?? null,
    decidedAt: d.decidedAt,
    people: shared.participants.filter((p) => !p.dropped).map((p) => p.nickname).slice(0, 4),
  };
}

export function homeRoom(entry: RegisteredRoom, snapshot: RoomSnapshot): HomeRoom {
  const view = roomView(snapshot);
  return {
    roomId: view.roomId,
    label: view.label,
    live: view.phase !== 'decided',
    status: statusLine(view),
    hot: view.phase === 'decided' || Boolean(view.proposal),
    poster: view.phase === 'decided' ? view.decision?.posterUrl ?? null : null,
    people: snapshot.shared.participants.map((p) => ({ id: p.participantId, nickname: p.nickname, dropped: Boolean(p.dropped), self: p.participantId === snapshot.own.participantId })),
    hostNickname: view.hostName || null,
    own: view.isHost,
    openedAt: entry.openedAt,
  };
}

/** A room you left: only what this device remembered, since the server no longer shows it to you. */
export function leftRoom(entry: RegisteredRoom): HomeRoom {
  return {
    roomId: entry.roomId, label: entry.left?.label || 'A room you left', live: false, status: 'Left', hot: false, poster: null,
    people: [{ id: 'self', nickname: entry.nickname, dropped: true, self: true }], hostNickname: null, own: false, openedAt: entry.openedAt,
  };
}

/** A room whose read failed: only what this device remembered, enough to find it and put it back. */
export function unreadRoom(entry: RegisteredRoom): HomeRoom {
  return {
    roomId: entry.roomId, label: 'A room', live: false, status: 'Didn’t load', hot: false, poster: null,
    people: [{ id: 'self', nickname: entry.nickname, dropped: false, self: true }], hostNickname: null, own: false, openedAt: entry.openedAt,
  };
}

/** Sorts each registered room into the home, History, or out of the registry. */
export function classify(entry: RegisteredRoom, result: { snapshot?: RoomSnapshot; error?: { code?: string; status?: number } | null }, now: number): Classified {
  if (result.error) {
    const e = result.error;
    // Someone who left can no longer read the room (403 forbidden); History keeps it with Return.
    if (entry.left && (e.code === 'forbidden' || e.status === 403)) return { kind: 'left', room: leftRoom(entry) };
    if ((e.code && ACCESS_ENDED.includes(e.code)) || e.status === 410) return { kind: 'gone' };
    return { kind: 'unavailable', roomId: entry.roomId, nickname: entry.nickname };
  }
  const s = result.snapshot;
  if (!s) return { kind: 'unavailable', roomId: entry.roomId, nickname: entry.nickname };
  if (s.shared.phase === 'expired' || s.shared.expiresAt <= now) return { kind: 'gone' };
  const room = homeRoom(entry, s);
  if (s.own.left) return { kind: 'left', room };
  if (s.shared.phase === 'decided') {
    const record = decisionRecord(s);
    return record ? { kind: 'active', room, record } : { kind: 'gone' };
  }
  return { kind: 'active', room, record: null };
}

/** Time of day greeting for the start page. */
export function greeting(hour: number) {
  return hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}
