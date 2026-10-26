import type { RoomCommand, RoomConstraints, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';

export interface RoomSettingsValue { country: string; serviceIds: number[]; constraints: RoomConstraints; prompt: string }

const sorted = <T,>(list: readonly T[]) => JSON.stringify([...list].sort());

/** Settings differ from the room's current ones (then Start again saves them before starting). */
export function changedSettings(snapshot: RoomSnapshot, v: RoomSettingsValue) {
  const screen = snapshot.shared.screens[0];
  const c = snapshot.shared.constraints;
  return (
    screen?.country !== v.country ||
    sorted(screen?.serviceIds ?? []) !== sorted(v.serviceIds) ||
    (snapshot.shared.description?.prompt ?? '') !== v.prompt ||
    sorted(c.kinds) !== sorted(v.constraints.kinds) ||
    c.maxMinutes !== v.constraints.maxMinutes
  );
}

/**
 * Start again, run only when the host confirms the prefilled settings: restart (the next
 * generation), save changed settings, then start. Each step uses the latest confirmed room
 * versions and stops at the first failure, so nothing changes before the confirm and a failed
 * restart keeps the decision.
 */
export async function startAgain(room: { latest: () => RoomSnapshot | undefined; send: (c: RoomCommand) => Promise<boolean> }, v: RoomSettingsValue) {
  let s = room.latest();
  if (!s) return false;
  if (s.shared.phase !== 'setup' && !(await room.send({ type: 'restart', expectedRevision: s.shared.revision }))) return false;
  s = room.latest();
  if (!s) return false;
  if (changedSettings(s, v) && !(await room.send({ type: 'configure', expectedContextVersion: s.shared.contextVersion, country: v.country, serviceIds: v.serviceIds, constraints: v.constraints, prompt: v.prompt }))) return false;
  s = room.latest();
  if (!s) return false;
  return room.send({ type: 'start', expectedRosterVersion: s.shared.rosterVersion, expectedContextVersion: s.shared.contextVersion, hostReady: true });
}

/**
 * Readiness: the shuffle stands in for the first card only while cards are actually on their way
 * (a start in flight, or a ready stream still filling an empty deck). No minimum duration.
 */
export function showShuffle(s: { starting: boolean; phase: RoomSnapshot['shared']['phase']; hasCard: boolean; voting: boolean; stream: RoomSnapshot['shared']['stream']; failed: boolean }) {
  if (s.starting) return true;
  return s.phase === 'choosing' && s.voting && !s.hasCard && s.stream.state === 'ready' && s.stream.reason !== 'awaiting_answers' && !s.failed;
}
