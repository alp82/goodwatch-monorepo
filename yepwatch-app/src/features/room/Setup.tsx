/** Before Start: the host's room page, and the friends' waiting screen. */
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { guestOnly } from '../../core/config';
import { GoodWatchButton } from '../home/Landing';
import { GoodWatchMark } from '../shell/marks';
import { FaceStack } from '../shell/parts';
import { GText, glow } from '../glow/theme';
import { NAME_MAX } from './model';
import { openPage, toRooms } from './nav';
import { ChangeRow, IdeaList, RoomBar, RoomLink } from './parts';
import { useRoom } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { namesLine, servicesIn } from './services';
import { Button, KindIcons, Logos, Or, Section, Small, Screen, fieldStyle, kindsLabel, useServices } from './ui';

/** Movies and shows, and the room's streaming, as quiet rows. */
export function RoomRows({ kindsEditable }: { kindsEditable: boolean }) {
  const { id, view } = useRoom();
  const { all } = useServices(view?.country);
  if (!view) return null;
  const on = servicesIn(all, view.enabledServiceIds);
  return (
    <View style={{ gap: 2 }}>
      <ChangeRow label={`${kindsLabel(view.kinds)}, change`} onPress={kindsEditable ? () => openPage(id, 'kinds') : undefined}>
        <KindIcons kinds={view.kinds} size={20} /><GText color={glow.soft}>{kindsLabel(view.kinds)}</GText>
      </ChangeRow>
      {on.length || !view.isHost ? (
        <ChangeRow label={`${on.length ? namesLine(on) : 'Streaming'}, change`} onPress={() => openPage(id, 'streaming')}>
          <Logos services={on} /><GText color={glow.soft} lines={1} style={{ flex: 1 }}>{on.length ? namesLine(on) : 'Streaming'}</GText>
        </ChangeRow>
      ) : (
        <ChangeRow label="Streaming services, add" warn onPress={() => openPage(id, 'services')}>
          <GText color={glow.amber}>Streaming services</GText>
        </ChangeRow>
      )}
    </View>
  );
}

/** The host's room before Start: share card, the ideas (MOOD), quiet rows, the host's name. One action: Start. */
export function RoomSetup() {
  const { view, cmd, state, latest, disabled, signin, memberBusy } = useRoom();
  const [name, setName] = useState('');
  // A name sent on blur may still be in flight when Start is pressed: Start waits for it.
  const renaming = useRef<Promise<boolean> | null>(null);
  if (!view) return null;
  const typed = name.trim();
  const named = Boolean(view.me.nickname || typed);
  const rename = () => {
    if (!typed || typed === view.me.nickname || renaming.current) return;
    renaming.current = cmd.rename(typed).finally(() => { renaming.current = null; });
  };
  const start = async () => {
    if (renaming.current) await renaming.current;
    const s = latest();
    const current = s?.shared.participants.find((p) => p.participantId === s.own.participantId)?.nickname.trim();
    if (!current && typed && !(await cmd.rename(typed))) return;
    await cmd.start();
  };
  const ready = named && view.enabledServiceIds.length > 0 && view.kinds.length > 0 && Boolean(view.country);
  return (
    <Screen testID="room-setup" back={toRooms} footer={<Button label="Start" disabled={!ready || Boolean(state.pending) || state.privateError} onPress={() => void start()} />}>
      <RoomNotes />
      <RoomLink />
      <View style={{ gap: 8, paddingVertical: 12 }}>
        <Section>Mood</Section>
        <IdeaList />
      </View>
      <RoomRows kindsEditable />
      {view.needName && (
        <View style={{ gap: 6 }}>
          <Small>Your name</Small>
          <TextInput accessibilityLabel="Your name" value={name} onChangeText={setName} onBlur={rename} onSubmitEditing={rename} maxLength={NAME_MAX} autoCapitalize="words" autoComplete="nickname"
            placeholder="Your name" placeholderTextColor={glow.muted} returnKeyType="done" style={fieldStyle} />
          {!guestOnly && <><Or /><GoodWatchButton disabled={memberBusy || disabled} onPress={() => void signin()} /></>}
        </View>
      )}
    </Screen>
  );
}

/** A friend's room before Start (or while joining a running round): the ideas, their services, waiting for the host. */
export function Waiting() {
  const { id, view, entry } = useRoom();
  const { all } = useServices(view?.country);
  if (!view) return null;
  const owner = view.hostName || 'Your friend';
  const mine = view.myServiceIds ?? [];
  const list = servicesIn(all, mine);
  return (
    <Screen testID="waiting" back={toRooms} right={<RoomBar />}
      footer={<View style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}><Small>{view.phase === 'setup' ? `Waiting for ${view.hostName || 'the host'} to start` : entry.working ? 'Joining…' : 'Joining the round…'}</Small></View>}>
      <RoomNotes />
      <View style={{ gap: 10, paddingTop: 40 }}>
        <Small bold>{`${owner.toUpperCase()}’S ROOM`}</Small>
        <IdeaList />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FaceStack people={view.faces} size={24} max={6} /><KindIcons kinds={view.kinds} size={16} color={glow.muted} /><Small>{kindsLabel(view.kinds)}</Small>
        </View>
      </View>
      <ChangeRow label={`${list.length ? namesLine(list) : 'Your services'}, change`} onPress={() => openPage(id, 'services')}>
        {list.length ? <><Logos services={list} /><GText color={glow.soft} lines={1} style={{ flex: 1 }}>{namesLine(list)}</GText></> : <GText color={glow.amber} style={{ flex: 1 }}>Your services</GText>}
        {view.member ? <GoodWatchMark size={16} /> : null}
      </ChangeRow>
    </Screen>
  );
}
