import type { CommandEnvelope, RoomCommand, RoomSnapshot, SharedRoomSnapshot } from '@goodwatch/yepwatch-contracts';
import { ApiFailure } from './errors';

export type CachedRoomSnapshot = RoomSnapshot & { ownRevision?: number };
/** Other actors can reset own state without advancing this participant's sequence. Track its HTTP revision separately. */
export function mergeSnapshot(current: CachedRoomSnapshot | undefined, incoming: RoomSnapshot): CachedRoomSnapshot {
  if (!current || current.shared.roomId !== incoming.shared.roomId) return { ...incoming, ownRevision: incoming.shared.revision };
  const ownRevision = current.ownRevision ?? current.shared.revision;
  const acceptOwn = incoming.own.nextSequence > current.own.nextSequence || (incoming.own.nextSequence === current.own.nextSequence && incoming.shared.revision >= ownRevision);
  return { shared: incoming.shared.revision >= current.shared.revision ? incoming.shared : current.shared, own: acceptOwn ? incoming.own : current.own, ownRevision: acceptOwn ? incoming.shared.revision : ownRevision };
}
export function mergeShared(current: CachedRoomSnapshot | undefined, shared: SharedRoomSnapshot): CachedRoomSnapshot | undefined {
  if (!current || current.shared.roomId !== shared.roomId || shared.revision < current.shared.revision) return current;
  return { shared, own: current.own, ownRevision: current.ownRevision ?? current.shared.revision };
}
/** One in flight; uncertain writes retain their exact ID, body and sequence for retry. */
export class CommandQueue {
  pending: CommandEnvelope | null = null;
  busy = false;
  constructor(private readonly id: () => string) {}
  async send(command: RoomCommand | undefined, snapshot: RoomSnapshot, submit: (body: CommandEnvelope) => Promise<{ snapshot: RoomSnapshot }>): Promise<RoomSnapshot> {
    if (this.busy) throw new Error('Wait for the current action.');
    if (this.pending && command) throw new Error('Reconcile the pending action before choosing again.');
    const envelope = this.pending ?? (command ? { commandId: this.id(), sequence: snapshot.own.nextSequence, command } : null);
    if (!envelope) throw new Error('There is no pending action.');
    this.pending = envelope; this.busy = true;
    try { const result = await submit(envelope); this.pending = null; return result.snapshot; }
    catch (error) {
      if (error instanceof ApiFailure && !['outcome_unknown', 'busy'].includes(error.code)) this.pending = null;
      throw error;
    } finally { this.busy = false; }
  }
}
export function nextCandidate(snapshot: RoomSnapshot, pendingId?: string) {
  return snapshot.shared.candidates.find(c => c.id !== pendingId && !snapshot.own.votes.some(v => v.candidateId === c.id && v.value !== null));
}
