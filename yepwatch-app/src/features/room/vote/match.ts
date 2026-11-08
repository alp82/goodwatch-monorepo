/**
 * What the voting screen reads from the room for its looks: whether your Yep just made a match
 * (the snapshot lists the candidate as a match only after your vote), and the card underneath.
 */
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import type { Look } from './looks';

/** Your latest Yep, remembered until the room answers. */
export interface YepRecord {
  /** Counts Yeps on this screen, so a Yep after an Undo celebrates again. */
  serial: number;
  generation: number;
  candidateId: string;
  look: Look;
  /** Already a match before your vote (never yours to celebrate). */
  wasMatch: boolean;
}

type Shared = Pick<RoomSnapshot['shared'], 'generation' | 'matches'>;

export function yepRecord(serial: number, shared: Shared, candidateId: string, look: Look): YepRecord {
  return { serial, generation: shared.generation, candidateId, look, wasMatch: shared.matches.some((m) => m.candidateId === candidateId) };
}

/** The moment's key when your Yep made the candidate a match in this round; null otherwise. */
export function madeMatch(record: YepRecord | null, shared: Shared): string | null {
  if (!record || record.wasMatch || record.generation !== shared.generation) return null;
  return shared.matches.some((m) => m.candidateId === record.candidateId) ? `${record.generation}:${record.candidateId}:${record.serial}` : null;
}

/** The next unanswered candidate after `currentId`, in deck order (seen under the moving card). */
export function nextCandidate(snapshot: RoomSnapshot, currentId: string | undefined) {
  const answered = new Set(snapshot.own.votes.filter((v) => v.value !== null).map((v) => v.candidateId));
  return snapshot.shared.candidates.find((c) => c.id !== currentId && !answered.has(c.id));
}
