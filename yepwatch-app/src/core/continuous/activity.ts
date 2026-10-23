import { ACTIVITY_LIMITS, type ServerActivity } from '@goodwatch/yepwatch-contracts/proposal';
export interface PeerActivity {
  frame: ServerActivity;
  pulse: ServerActivity | null;
  pointer?: ServerActivity | null;
}
/** Sessions stay independent: closing one device must not erase another device's live view. */
export function applyActivity(
  current: Map<string, PeerActivity>,
  incoming: ServerActivity,
  ownId: string,
  now: number
) {
  if (
    incoming.participantId === ownId ||
    incoming.expiresAt <= now ||
    incoming.serverTime > now + 5000
  )
    return current;
  const old = current.get(incoming.sessionId);
  if (
    old &&
    (old.frame.participantId !== incoming.participantId ||
      incoming.sequence <= old.frame.sequence ||
      incoming.serverTime < old.frame.serverTime)
  )
    return current;
  const next = new Map(current);
  if (incoming.view === 'away') {
    next.delete(incoming.sessionId);
    return next;
  }
  const pulse =
    (incoming.gesture || incoming.beat || incoming.inspection) &&
    incoming.serverTime + ACTIVITY_LIMITS.pulseTtlMs > now
      ? incoming
      : old?.pulse && old.pulse.serverTime + ACTIVITY_LIMITS.pulseTtlMs > now
      ? old.pulse
      : null;
  const pointer =
    incoming.view !== 'voting' || incoming.pointer === null
      ? null
      : incoming.pointer
      ? incoming
      : old?.pointer && old.pointer.serverTime + ACTIVITY_LIMITS.pulseTtlMs > now
      ? old.pointer
      : null;
  next.set(incoming.sessionId, { frame: incoming, pulse, pointer });
  return next;
}
export function pruneActivity(current: Map<string, PeerActivity>, now: number) {
  return new Map(
    [...current]
      .filter(([, a]) => a.frame.expiresAt > now)
      .map(([id, a]) => [
        id,
        {
          frame: a.frame,
          pointer:
            a.pointer && a.pointer.serverTime + ACTIVITY_LIMITS.pulseTtlMs > now ? a.pointer : null,
          pulse: a.pulse && a.pulse.serverTime + ACTIVITY_LIMITS.pulseTtlMs > now ? a.pulse : null,
        },
      ])
  );
}
export function groupActivity(current: Map<string, PeerActivity>, now: number) {
  const people = new Map<string, PeerActivity>();
  for (const a of pruneActivity(current, now).values()) {
    const old = people.get(a.frame.participantId);
    if (!old || a.frame.serverTime > old.frame.serverTime) people.set(a.frame.participantId, a);
  }
  return people;
}
