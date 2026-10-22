import type {
  CommandEnvelope,
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
  write: (envelope: CommandEnvelope | null) => Promise<void>;
}
/** Persist before sending. Reload/reconnect can retry the identical command rather than guessing its outcome. */
export class PersistentCommands {
  pending: CommandEnvelope | null = null;
  busy = false;
  constructor(private readonly id: () => string, private readonly storage: QueueStorage) {}
  async send(
    command: RoomCommand | undefined,
    snapshot: RoomSnapshot,
    submit: (body: CommandEnvelope) => Promise<{ snapshot: RoomSnapshot }>
  ) {
    if (this.busy || (this.pending && command))
      throw new Error('Reconcile the pending action first.');
    const envelope =
      this.pending ??
      (command ? { commandId: this.id(), sequence: snapshot.own.nextSequence, command } : null);
    if (!envelope) throw new Error('No action to retry.');
    this.busy = true;
    try {
      if (!this.pending) {
        await this.storage.write(envelope);
        this.pending = envelope;
      }
      const result = await submit(envelope);
      await this.storage.write(null);
      this.pending = null;
      return result.snapshot;
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? error.code : null;
      if (code && code !== 'outcome_unknown' && code !== 'busy') {
        await this.storage.write(null);
        this.pending = null;
      }
      throw error;
    } finally {
      this.busy = false;
    }
  }
}
