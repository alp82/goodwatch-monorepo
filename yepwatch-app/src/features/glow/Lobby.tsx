import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { RoomCommand, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousApi } from '../../core/continuous/api';
import { flag } from '../rooms/RoomSettings';
import { Action } from '../shell/parts';
import { column } from '../shell/tokens';
import { ReadAs } from './ReadAs';
import { GText, glow } from './theme';
import { useFrameSize } from '../shell/Frame';

/** Before the first round: the room's mood and services, and the host's Start. Settings open as a panel. */
export function Lobby({ snapshot, disabled, send, invite, edit }: {
  snapshot: RoomSnapshot;
  disabled: boolean;
  send: (c: RoomCommand) => Promise<boolean>;
  invite: () => void;
  edit: () => void;
}) {
  const { shared, own } = snapshot;
  const size = useFrameSize();
  const current = shared.screens[0]; // Compatibility projection; there is one room selection.
  const setup = Boolean(current?.confirmed && current.country && current.serviceIds.length);
  const metadata = useQuery({
    queryKey: ['continuous-metadata', current?.country],
    queryFn: () => continuousApi.metadata(current?.country || undefined),
    enabled: setup,
  });
  const groups = metadata.data?.providerGroups ?? [];
  const providerCount = groups.filter((p) => p.selectionIds.some((id) => current?.serviceIds.includes(id))).length || (current?.serviceIds.length ?? 0);
  return (
    <View testID="lobby" style={{ flex: 1, minHeight: 0, justifyContent: 'center', ...column }}>
      <View style={{ gap: size.compact ? 12 : 22, flexDirection: size.compact ? 'row' : 'column', alignItems: size.compact ? 'center' : undefined }}>
        <View style={{ flex: size.compact ? 1 : undefined, gap: 10 }}>
          <GText size={size.compact ? 26 : size.big ? 42 : 34} bold style={{ letterSpacing: -0.8 }}>What are we watching?</GText>
          <GText size={size.compact ? 13 : 16} color={glow.muted}>{shared.description?.prompt || 'A little inspiration. A choice for everyone.'}</GText>
          {shared.description?.attributes.length ? <ReadAs attributes={shared.description.attributes} /> : null}
          {setup && (
            <GText size={14} color={glow.muted}>
              {flag(current!.country!)} {current!.country} · {providerCount} streaming {providerCount === 1 ? 'service' : 'services'}
            </GText>
          )}
        </View>
        <View style={{ flex: size.compact ? 1 : undefined, gap: 10 }}>
          {own.canHost ? (
            <>
              <Action gold label={setup ? 'Start choosing' : 'Set up our room'} disabled={disabled}
                onPress={() => setup
                  ? void send({ type: 'start', expectedRosterVersion: shared.rosterVersion, expectedContextVersion: shared.contextVersion, hostReady: true })
                  : edit()} />
              {setup && <Action label="Mood & services" icon="tickets" onPress={edit} disabled={disabled} />}
            </>
          ) : (
            <GText color={glow.muted}>{setup ? 'Waiting for the host to start.' : 'The host is setting up the room.'}</GText>
          )}
          <Action label="Invite friends" icon="people" onPress={invite} />
        </View>
      </View>
    </View>
  );
}
