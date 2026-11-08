/**
 * What the voting screen reads from the room for its looks: whether one of your Yeps made a match
 * (the confirmed room lists the candidate as a match only after your vote), and the card underneath.
 */
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import type { Look } from './looks';

/**
 * A Yep of yours the room hasn't confirmed yet. Several can be on their way at once (Yep A, then Yep
 * B before A is answered): each is kept until the confirmed room shows it, so a match made by any
 * of them plays MATCH.
 */
export interface YepRecord {
  /** Counts Yeps on this screen, so a Yep after an Undo celebrates again. */
  serial: number;
  generation: number;
  candidateId: string;
  /** The vote revision this Yep has once the server applies it. */
  revision: number;
  look: Look;
  /** Already a match before your vote (never yours to celebrate). */
  wasMatch: boolean;
}

type Room = { shared: Pick<RoomSnapshot['shared'], 'generation' | 'matches'>; own: Pick<RoomSnapshot['own'], 'votes'> };
const voteOn = (room: Room, candidateId: string) => room.own.votes.find((v) => v.candidateId === candidateId);

/** A Yep just made. `shown` is the room as this device shows it (its unconfirmed votes in it), so the revision counts the votes still on their way. */
export function yepRecord(serial: number, shown: Room, candidateId: string, look: Look): YepRecord {
  return {
    serial, generation: shown.shared.generation, candidateId, look,
    revision: (voteOn(shown, candidateId)?.revision ?? 0) + 1,
    wasMatch: shown.shared.matches.some((m) => m.candidateId === candidateId),
  };
}

/** The MATCH moment's key for a Yep. */
export const matchKey = (record: YepRecord) => `${record.generation}:${record.candidateId}:${record.serial}`;

export interface YepSettlement {
  /** Confirmed Yeps that made their candidate a match, oldest first. */
  matched: YepRecord[];
  /** Still waiting for the room. */
  pending: YepRecord[];
  /** Anything settled or dropped (the list to keep changed). */
  changed: boolean;
}

/**
 * Settles Yeps against the confirmed room. A Yep the room shows (its revision, still a Yep) is done:
 * MATCH when the room now lists the candidate and didn't before. Yeps from another round, undone or
 * overwritten (a newer revision) are dropped. The rest wait.
 */
export function settleYeps(records: readonly YepRecord[], confirmed: Room): YepSettlement {
  const matched: YepRecord[] = [];
  const pending: YepRecord[] = [];
  for (const r of records) {
    if (r.generation !== confirmed.shared.generation) continue;
    const vote = voteOn(confirmed, r.candidateId);
    if (!vote || vote.revision < r.revision) { pending.push(r); continue; }
    if (vote.revision === r.revision && vote.value === 'watch' && !r.wasMatch && confirmed.shared.matches.some((m) => m.candidateId === r.candidateId)) matched.push(r);
  }
  return { matched, pending, changed: pending.length !== records.length };
}

/**
 * The server answered a Yep. Refused: it's dropped. Accepted: it takes the revision the confirmed
 * room gave it (a vote before it that was refused leaves it one lower than counted).
 */
export function answerYep(records: readonly YepRecord[], serial: number, accepted: boolean, confirmed: Room | undefined): readonly YepRecord[] {
  const record = records.find((r) => r.serial === serial);
  if (!record) return records;
  if (!accepted) return records.filter((r) => r !== record);
  const vote = confirmed ? voteOn(confirmed, record.candidateId) : undefined;
  if (!vote || vote.value !== 'watch' || vote.revision >= record.revision) return records;
  return records.map((r) => (r === record ? { ...r, revision: vote.revision } : r));
}

/** Undo on a candidate: its Yeps no longer count. */
export const undoYeps = (records: readonly YepRecord[], candidateId: string) =>
  (records.some((r) => r.candidateId === candidateId) ? records.filter((r) => r.candidateId !== candidateId) : records);

/** The next unanswered candidate after `currentId`, in deck order (seen under the moving card). */
export function nextCandidate(snapshot: RoomSnapshot, currentId: string | undefined) {
  const answered = new Set(snapshot.own.votes.filter((v) => v.value !== null).map((v) => v.candidateId));
  return snapshot.shared.candidates.find((c) => c.id !== currentId && !answered.has(c.id));
}
