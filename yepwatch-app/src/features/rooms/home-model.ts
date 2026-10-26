import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import type { DecisionRecord, RegisteredRoom } from '../../core/continuous/room-registry-state';

/** A room on the personal home. Everything comes from the room's own authoritative snapshot. */
export interface HomeRoom {
  roomId: string;
  label: string;
  prompt: string | null;
  phase: 'setup' | 'choosing';
  people: { id: string; nickname: string; dropped: boolean; self: boolean }[];
  hostNickname: string | null;
  own: boolean;
  matches: number;
  proposal: { agree: number; required: number } | null;
  posters: string[];
  status: { key: 'setup' | 'proposal' | 'matches' | 'choosing'; label: string };
  openedAt: number;
}
export type Classified =
  | { kind: 'active'; room: HomeRoom }
  | { kind: 'left'; room: HomeRoom }
  | { kind: 'decided'; record: DecisionRecord }
  | { kind: 'gone' }
  | { kind: 'unavailable'; roomId: string; nickname: string };

const ACCESS_ENDED = ['unauthorized', 'forbidden', 'not_found', 'expired'];

/** A room has no name of its own: the mood prompt names it, otherwise its host does. */
export function roomLabel(snapshot: RoomSnapshot) {
  const prompt = snapshot.shared.description?.prompt?.trim();
  if (prompt) return prompt.length > 48 ? `${prompt.slice(0, 47)}…` : prompt.charAt(0).toUpperCase() + prompt.slice(1);
  const host = snapshot.shared.participants.find((p) => p.participantId === snapshot.shared.hostParticipantId)?.nickname;
  return host ? `${host}’s room` : 'Your room';
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
  const { shared, own } = snapshot;
  const matches = shared.matches.length;
  const proposal = shared.proposal ? { agree: shared.proposal.agreeCount, required: shared.proposal.requiredCount } : null;
  const posters = [
    ...(shared.proposal ? [shared.proposal.candidateId] : []),
    ...shared.matches.map((m) => m.candidateId).filter((id) => id !== shared.proposal?.candidateId),
  ]
    .map((id) => shared.candidates.find((c) => c.id === id)?.posterUrl)
    .filter((u): u is string => Boolean(u))
    .slice(0, 3);
  const status: HomeRoom['status'] = shared.phase === 'setup'
    ? { key: 'setup', label: 'Setting up' }
    : proposal
    ? { key: 'proposal', label: `Proposal · ${proposal.agree} of ${proposal.required} agree` }
    : matches
    ? { key: 'matches', label: `${matches} ${matches === 1 ? 'match' : 'matches'}` }
    : { key: 'choosing', label: 'Choosing' };
  return {
    roomId: shared.roomId,
    label: roomLabel(snapshot),
    prompt: shared.description?.prompt?.trim() || null,
    phase: shared.phase === 'setup' ? 'setup' : 'choosing',
    people: shared.participants.map((p) => ({ id: p.participantId, nickname: p.nickname, dropped: Boolean(p.dropped), self: p.participantId === own.participantId })),
    hostNickname: shared.participants.find((p) => p.participantId === shared.hostParticipantId)?.nickname ?? null,
    own: own.canHost,
    matches,
    proposal,
    posters,
    status,
    openedAt: entry.openedAt,
  };
}

/** A room you left: only what this device remembered, since the server no longer shows it to you. */
export function leftRoom(entry: RegisteredRoom): HomeRoom {
  return {
    roomId: entry.roomId, label: entry.left?.label || 'A room you left', prompt: null, phase: 'choosing',
    people: [{ id: 'self', nickname: entry.nickname, dropped: true, self: true }], hostNickname: null, own: false,
    matches: 0, proposal: null, posters: [], status: { key: 'choosing', label: 'Left' }, openedAt: entry.openedAt,
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
  if (s.shared.phase === 'decided') {
    const record = decisionRecord(s);
    return record ? { kind: 'decided', record } : { kind: 'gone' };
  }
  const room = homeRoom(entry, s);
  return s.own.left ? { kind: 'left', room } : { kind: 'active', room };
}

/** Time of day greeting for the home subheader. */
export function greeting(hour: number) {
  return hour < 5 ? 'Late night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
}
