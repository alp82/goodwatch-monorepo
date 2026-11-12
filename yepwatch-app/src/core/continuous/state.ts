import { retainRequest, retryDeadline } from './retry';
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
  write: (envelope: CommandEnvelope | null, retryAt?: number) => Promise<void>;
}
/** Persist alongside sending. Reload/reconnect can retry the identical command rather than guessing its outcome. */
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
      // Sent first, saved right after: on Android the save is a keystore write (40-130 ms per vote, more
      // than the request itself), and waiting for it, or issuing it first, held the request back. A reload
      // still retries the identical command once the save is done; a command that reached the server
      // applies once (same id) whether or not it was saved, and one lost together with the app within
      // those milliseconds is like a tap that never happened.
      const fresh = !this.pending;
      this.pending = envelope;
      const request = submit(envelope);
      const saved = fresh ? this.storage.write(envelope).catch(() => undefined) : Promise.resolve();
      // The save settles before anything else is written for this command (cleared or kept for a retry).
      const result = await request.finally(() => saved);
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
