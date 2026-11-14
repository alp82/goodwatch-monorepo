import { retainRequest, retryDeadline } from './retry';
import type {
  CommandEnvelope,
  OwnRead,
  RoomCommand,
  RoomSnapshot,
  SharedRoomSnapshot,
} from '@goodwatch/yepwatch-contracts/proposal';
export type CachedRoom = RoomSnapshot & { ownRevision: number };
export function mergeRoom(current: CachedRoom | undefined, incoming: RoomSnapshot): CachedRoom {
  if (!current || current.shared.roomId !== incoming.shared.roomId)
    return { ...incoming, ownRevision: incoming.shared.revision };
  const acceptOwn =
    incoming.own.nextSequence > current.own.nextSequence ||
    (incoming.own.nextSequence === current.own.nextSequence &&
      incoming.shared.revision >= current.ownRevision);
  return {
    shared: incoming.shared.revision >= current.shared.revision ? incoming.shared : current.shared,
    own: acceptOwn ? incoming.own : current.own,
    ownRevision: acceptOwn ? incoming.shared.revision : current.ownRevision,
  };
}
/**
 * A room snapshot from a list read (the account's rooms) into a room's cache: shown at once when the room opens, never
 * trusted for commands. Its own part counts commands per participant, not per session (a room read counts this
 * session's), so it goes in with sequence 0: the room's own read replaces it whatever it says, and the list's next read
 * never goes over a room read (only over its own earlier seed).
 */
export const SEEDED_SEQUENCE = 0;
export function seedRoom(current: CachedRoom | undefined, incoming: RoomSnapshot): CachedRoom | undefined {
  if (current && current.shared.roomId === incoming.shared.roomId && current.own.nextSequence !== SEEDED_SEQUENCE) return current;
  return mergeRoom(current, { ...incoming, own: { ...incoming.own, nextSequence: SEEDED_SEQUENCE } });
}
export function mergePublic(
  current: CachedRoom | undefined,
  shared: SharedRoomSnapshot
): CachedRoom | undefined {
  return !current ||
    shared.roomId !== current.shared.roomId ||
    shared.revision < current.shared.revision
    ? current
    : { ...current, shared };
}
/**
 * A room read's answer as a whole room: as it came, or its own part with the shared room this phone holds at the
 * revision the answer names. Null when that shared room is no longer the one held (a newer update came meanwhile):
 * read the whole room then.
 */
export function withShared(answer: RoomSnapshot | OwnRead, held: CachedRoom | undefined): RoomSnapshot | null {
  if ('shared' in answer) return answer;
  return held && held.shared.revision === answer.sharedRevision ? { shared: held.shared, own: answer.own } : null;
}
export function ownCard(snapshot: RoomSnapshot, pendingId?: string) {
  const unanswered = (id: string) =>
    id !== pendingId && !snapshot.own.votes.some((v) => v.candidateId === id && v.value !== null);
  return (
    snapshot.shared.candidates.find(
      (c) => c.id === snapshot.own.nextCandidateId && unanswered(c.id)
    ) ?? snapshot.shared.candidates.find((c) => unanswered(c.id))
  );
}
/** Own votes are ordered oldest-to-newest mutation by the server, including null/undo entries.
 * Reconstruct from retained authoritative history so replay/reload and retirement need no local stack.
 */
export function latestRetainedVote(snapshot: RoomSnapshot) {
  if (snapshot.shared.phase !== 'choosing') return undefined;
  const retained = new Set(snapshot.shared.candidates.map((candidate) => candidate.id));
  return [...snapshot.own.votes].reverse().find((vote) => vote.value !== null && retained.has(vote.candidateId));
}
export interface QueueStorage {
  write: (envelope: CommandEnvelope | null, retryAt?: number) => Promise<void>;
  /**
   * The same save, done by the time it returns (throws when it can't save). With it, a command goes in
   * the tap's own task: waiting for even an already-finished save lets the screen's render run first.
   */
  writeNow?: (envelope: CommandEnvelope) => void;
}
/** Persist before sending. Reload/reconnect can retry the identical command rather than guessing its outcome. */
export class PersistentCommands {
  pending: CommandEnvelope | null = null;
  busy = false;
  retryAt = 0;
  /** The pending command's last try got no answer at all (offline, network down): no server deadline to keep. */
  unanswered = false;
  constructor(private readonly id: () => string, private readonly storage: QueueStorage) {}
  async send(
    command: RoomCommand | undefined,
    snapshot: RoomSnapshot,
    submit: (body: CommandEnvelope) => Promise<{ snapshot: RoomSnapshot }>,
    /** Known ahead when the screen already shows the command (a new idea's id is its command id). */
    commandId?: string
  ) {
    if (Date.now() < this.retryAt) throw new Error('Wait before retrying this action.');
    if (this.busy || (this.pending && command))
      throw new Error('Reconcile the pending action first.');
    const envelope =
      this.pending ??
      (command ? { commandId: commandId ?? this.id(), sequence: snapshot.own.nextSequence, command } : null);
    if (!envelope) throw new Error('No action to retry.');
    this.busy = true;
    try {
      if (!this.pending) {
        if (this.storage.writeNow) this.storage.writeNow(envelope);
        else await this.storage.write(envelope);
        this.pending = envelope;
      }
      const result = await submit(envelope);
      await this.storage.write(null);
      this.pending = null;
      this.retryAt = 0;
      this.unanswered = false;
      return result.snapshot;
    } catch (error) {
      if (!retainRequest(error)) {
        await this.storage.write(null);
        this.pending = null;
        this.retryAt = 0;
      } else if (this.pending) {
        this.retryAt = retryDeadline(error);
        this.unanswered = error instanceof Error && (error as Error & { status?: unknown }).status === undefined;
        await this.storage.write(this.pending, this.retryAt);
      }
      throw error;
    } finally {
      this.busy = false;
    }
  }
}
