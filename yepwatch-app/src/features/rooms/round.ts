import type {
  RoomCommand,
  RoomConstraints,
  RoomSnapshot,
} from '@goodwatch/yepwatch-contracts/proposal';

export interface RoomSettingsValue {
  country: string;
  serviceIds: number[];
  constraints: RoomConstraints;
  prompt: string;
}

const sorted = <T>(list: readonly T[]) => JSON.stringify([...list].sort());

/** Settings differ from the room's current ones (then Start again saves them before starting). */
export function changedSettings(snapshot: RoomSnapshot, v: RoomSettingsValue) {
  const screen = snapshot.shared.screens[0];
  const c = snapshot.shared.constraints;
  return (
    screen?.country !== v.country ||
    sorted(
      snapshot.shared.participants.find(
        (p) => p.participantId === snapshot.own.participantId
      )?.serviceIds ?? []
    ) !== sorted(v.serviceIds) ||
    (snapshot.shared.ideas.find(i => i.authorId === snapshot.own.participantId)?.text ?? '') !== v.prompt ||
    sorted(c.kinds) !== sorted(v.constraints.kinds) ||
    c.maxMinutes !== v.constraints.maxMinutes
  );
}

/** Compatibility for the current single-field settings screen; the redesigned UI sends these commands directly. */
export async function saveRoomSettings(
  room: {
    latest: () => RoomSnapshot | undefined;
    send: (c: RoomCommand) => Promise<boolean>;
  },
  v: RoomSettingsValue
) {
  let s = room.latest();
  if (!s) return false;
  if (
    s.shared.screens[0]?.country !== v.country ||
    JSON.stringify(s.shared.constraints) !== JSON.stringify(v.constraints)
  ) {
    if (
      !(await room.send({
        type: 'configure',
        expectedContextVersion: s.shared.contextVersion,
        country: v.country,
        constraints: v.constraints,
      }))
    )
      return false;
  }
  s = room.latest();
  if (!s) return false;
  const participantId = s.own.participantId;
  const person = s.shared.participants.find(
    (p) => p.participantId === participantId
  );
  if (
    sorted(person?.serviceIds ?? []) !== sorted(v.serviceIds) &&
    !(await room.send({ type: 'set_services', serviceIds: v.serviceIds }))
  )
    return false;
  s = room.latest();
  if (!s) return false;
  const idea = s.shared.ideas.find((i) => i.authorId === participantId);
  const text = v.prompt.trim();
  if (idea && !text) return room.send({ type: 'remove_idea', ideaId: idea.id });
  if (idea && idea.text !== text)
    return room.send({ type: 'edit_idea', ideaId: idea.id, text });
  if (!idea && text) return room.send({ type: 'add_idea', text });
  return true;
}

/**
 * Start again, run only when the host confirms the prefilled settings: restart (the next
 * generation), save changed settings, then start. Each step uses the latest confirmed room
 * versions and stops at the first failure, so nothing changes before the confirm and a failed
 * restart keeps the decision.
 */
export async function startAgain(
  room: {
    latest: () => RoomSnapshot | undefined;
    send: (c: RoomCommand) => Promise<boolean>;
  },
  v: RoomSettingsValue
) {
  let s = room.latest();
  if (!s) return false;
  if (
    s.shared.phase !== 'setup' &&
    !(await room.send({ type: 'restart', expectedRevision: s.shared.revision }))
  )
    return false;
  s = room.latest();
  if (!s) return false;
  if (changedSettings(s, v) && !(await saveRoomSettings(room, v))) return false;
  s = room.latest();
  if (!s) return false;
  return room.send({
    type: 'start',
    expectedRosterVersion: s.shared.rosterVersion,
    expectedContextVersion: s.shared.contextVersion,
    hostReady: true,
  });
}

/**
 * Readiness: the shuffle stands in for the first card only while cards are actually on their way
 * (a start in flight, or a ready stream still filling an empty deck). No minimum duration.
 */
export function showShuffle(s: {
  starting: boolean;
  phase: RoomSnapshot['shared']['phase'];
  hasCard: boolean;
  voting: boolean;
  stream: RoomSnapshot['shared']['stream'];
  failed: boolean;
}) {
  if (s.starting) return true;
  return (
    s.phase === 'choosing' &&
    s.voting &&
    !s.hasCard &&
    s.stream.state === 'ready' &&
    s.stream.reason !== 'awaiting_answers' &&
    !s.failed
  );
}
