import type {
  RoomCommand,
  RoomSnapshot,
  ScreenContext,
} from '@goodwatch/yepwatch-contracts/proposal';

export function usableScreen(screen: ScreenContext | undefined) {
  return Boolean(screen?.confirmed && screen.country && screen.serviceIds.length);
}
/** No services or screen are inferred from account preferences. Multiple screens require a choice. */
export function lobbyEntryPlan(
  snapshot: RoomSnapshot
): { key: string; command: RoomCommand } | null {
  const { shared, own } = snapshot;
  if (own.canHost || !['setup', 'choosing'].includes(shared.phase)) return null;
  const me = shared.participants.find((p) => p.participantId === own.participantId);
  if (!me || me.ready) return null;
  const screen = me.screenId
    ? shared.screens.find((s) => s.id === me.screenId)
    : shared.screens.length === 1
      ? shared.screens[0]
      : undefined;
  if (!screen || !usableScreen(screen)) return null;
  const type = me.screenId ? 'ready' : 'assign_screen';
  const key = JSON.stringify([
    shared.roomId,
    shared.generation,
    shared.contextVersion,
    shared.rosterVersion,
    own.participantId,
    me.screenId,
    screen.id,
    type,
  ]);
  return {
    key,
    command:
      type === 'ready'
        ? { type: 'ready', expectedContextVersion: shared.contextVersion, ready: true }
        : {
            type: 'assign_screen',
            expectedContextVersion: shared.contextVersion,
            screenId: screen.id,
          },
  };
}
