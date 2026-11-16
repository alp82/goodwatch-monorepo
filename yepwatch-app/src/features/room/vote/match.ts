/**
 * What the voting screen reads from the room for MATCH: the room's matches as confirmed, and the card
 * underneath. Every phone in the room plays MATCH when the room gets a new match, whoever's Yep made it.
 */
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';

/** The confirmed room's matches in one round. */
export interface MatchList {
  generation: number;
  ids: readonly string[];
}

export const matchList = (room: Pick<RoomSnapshot, 'shared'>): MatchList =>
  ({ generation: room.shared.generation, ids: room.shared.matches.map((m) => m.candidateId) });

export const sameMatches = (a: MatchList | null, b: MatchList) =>
  a !== null && a.generation === b.generation && a.ids.length === b.ids.length && a.ids.every((id, i) => id === b.ids[i]);

/**
 * Matches in `now` that `before` didn't list, in the room's order. Nothing on the first read or in a new round:
 * those matches were made before this screen saw them. A match that left (an Undo) and comes back is new again.
 */
export function gainedMatches(before: MatchList | null, now: MatchList): string[] {
  if (!before || before.generation !== now.generation) return [];
  return now.ids.filter((id) => !before.ids.includes(id));
}

/** The next unanswered candidate after `currentId`, in deck order (seen under the moving card). */
export function nextCandidate(snapshot: RoomSnapshot, currentId: string | undefined) {
  const answered = new Set(snapshot.own.votes.filter((v) => v.value !== null).map((v) => v.candidateId));
  return snapshot.shared.candidates.find((c) => c.id !== currentId && !answered.has(c.id));
}
