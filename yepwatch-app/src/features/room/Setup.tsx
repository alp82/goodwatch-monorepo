/**
 * The room before Start (direction D): the ideas are the headline (left column on wide windows),
 * the share row, people, movies and shows, streaming and the action beside them (below on phones).
 * The host starts; friends wait for the host.
 */
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { TextInput, View } from 'react-native';
import { guestOnly } from '../../core/config';
import { GoodWatchButton } from '../home/Landing';
import { Or } from '../home/start-parts';
import { LiveDot } from '../shell/parts';
import { useLayout } from '../shell/layout';
import { warm } from '../shell/tokens';
import { GText, Icon, glow } from '../glow/theme';
import { NAME_MAX } from './model';
import { toRooms } from './nav';
import { Chip, IdeaStack, PeopleRow, ShareRow, fieldStyleFor, useAcknowledgeShownIdeas } from './parts';
import { useRoom } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { namesLine, servicesIn } from './services';
import { Actions, Button, Glyph, KindIcons, Label, Logos, RoomButton, Screen, Small, kindsLabel, usePinnedActions, useServices } from './ui';

/** Share, people, movies and shows, streaming: whole-row controls that open the room's sheets. */
function RoomDetails() {
  const { view, inviteUrl, openSheet } = useRoom();
  const { z } = useLayout();
  const { all } = useServices(view?.country);
  if (!view) return null;
  const on = servicesIn(all, view.enabledServiceIds);
  const kinds = kindsLabel(view.kinds);
  return (
    <View style={{ gap: z(10) }}>
      {inviteUrl || view.isHost ? <ShareRow /> : null}
      <PeopleRow onPress={() => openSheet('people')} />
      <Chip label={`${kinds}, ${view.isHost ? 'change' : 'view'}`} action={view.isHost ? 'Change' : undefined} onPress={() => openSheet('kinds')}>
        <KindIcons kinds={view.kinds} size={z(20)} color={glow.soft} />
        <GText size={z(15)} color={glow.soft} style={{ flex: 1 }}>{kinds}</GText>
      </Chip>
      {on.length || !view.isHost ? (
        <Chip label={`${on.length ? namesLine(on) : 'Streaming'}, change`} action="Change" onPress={() => openSheet('streaming')}>
          <Logos services={on} size={z(24)} />
          <GText size={z(15)} color={glow.soft} lines={1} style={{ flex: 1 }}>{on.length ? namesLine(on) : 'Streaming'}</GText>
        </Chip>
      ) : (
        <Chip warn label="Streaming services, add" action="Add" onPress={() => openSheet('services')}>
          <Glyph name="plus" size={z(18)} color={glow.amber} />
          <GText bold size={z(15)} color={glow.amber} style={{ flex: 1 }}>Streaming services</GText>
        </Chip>
      )}
    </View>
  );
}

/**
 * The shared layout: headline (room label and ideas) and the details with the actions, side by side
 * from 900 px. `actions` sit in the side column, or in the phone dock when `pinned`.
 */
function RoomBefore({ testID, label, actions, pinned, extra }: { testID: string; label: string; actions: ReactNode; pinned: boolean; extra?: ReactNode }) {
  const { phone, wide, max, z } = useLayout();
  const gap = z(56);
  const side = Math.min(z(420), max * 0.4);
  const headline = (
    <View style={{ gap: z(16) }}>
      <Label color={glow.amber}>{label}</Label>
      <IdeaStack />
    </View>
  );
  const column = (
    <View style={{ gap: z(20) }}>
      <RoomDetails />
      {extra}
      {pinned ? null : actions}
    </View>
  );
  return (
    <Screen testID={testID} back={toRooms} width="page" gap={0} footer={pinned ? actions : undefined}>
      <RoomNotes />
      {wide ? (
        <View style={{ flexDirection: 'row', gap, alignItems: 'flex-start', paddingTop: 4 }}>
          <View style={{ flex: 1, minWidth: 0 }}>{headline}</View>
          <View style={{ width: side }}>{column}</View>
        </View>
      ) : (
        <View style={{ gap: phone ? 30 : z(36), paddingTop: 4 }}>
          {headline}
          {column}
        </View>
      )}
    </Screen>
  );
}

/** The host's room before Start: one action, Start, beside the Room button. A guest host names themselves first. */
export function RoomSetup() {
  const { view, cmd, state, latest, disabled, signin, memberBusy, openSheet } = useRoom();
  const { z } = useLayout();
  const pinned = usePinnedActions();
  const [name, setName] = useState('');
  const [focus, setFocus] = useState(false);
  // A name sent on blur may still be in flight when Start is pressed: Start waits for it.
  const renaming = useRef<Promise<boolean> | null>(null);
  const nameInput = useRef<ComponentRef<typeof TextInput>>(null);
  useAcknowledgeShownIdeas();
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
  // Start stays tappable while a step is missing and opens that step, so it never looks dead.
  const missing = !view.enabledServiceIds.length ? 'services' : !view.kinds.length ? 'kinds' : !named ? 'name' : null;
  const onStart = () => {
    if (missing === 'services' || missing === 'kinds') openSheet(missing);
    else if (missing === 'name') nameInput.current?.focus();
    else void start();
  };
  const actions = (
    <Actions>
      <RoomButton onPress={() => openSheet('room')} />
      <Button label="Start" icon={<Icon name="play" size={16} color={warm.ink} />} disabled={!view.country || Boolean(state.pending) || state.privateError} onPress={onStart} />
    </Actions>
  );
  const nameField = view.needName ? (
    <View style={{ gap: z(10) }}>
      <Small>Your name</Small>
      <TextInput ref={nameInput} accessibilityLabel="Your name" value={name} onChangeText={setName} onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); rename(); }} onSubmitEditing={rename}
        maxLength={NAME_MAX} autoCapitalize="words" autoComplete="nickname" placeholder="Your name" placeholderTextColor={warm.placeholder} returnKeyType="done" selectionColor={glow.amber}
        style={fieldStyleFor(z, focus)} />
      {!guestOnly && <><Or /><GoodWatchButton disabled={memberBusy || disabled} onPress={() => void signin()} /></>}
    </View>
  ) : null;
  return <RoomBefore testID="room-setup" label="Your room" pinned={pinned} actions={actions} extra={nameField} />;
}

/** A friend's room before Start (or while joining a running round): the same room, waiting for the host. */
export function Waiting() {
  const { view, entry, openSheet } = useRoom();
  const { z } = useLayout();
  if (!view) return null;
  const owner = view.hostName || 'Your friend';
  const waiting = view.phase === 'setup' ? `Waiting for ${view.hostName || 'the host'} to start` : entry.working ? 'Joining…' : 'Joining the round…';
  const actions = (
    <View style={{ gap: 10 }}>
      <Actions>
        <RoomButton onPress={() => openSheet('room')} />
        <View accessibilityLiveRegion="polite" style={{ flex: 1, minHeight: z(54), borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, backgroundColor: warm.faint }}>
          <LiveDot /><GText size={z(15)} color={glow.soft} lines={1}>{waiting}</GText>
        </View>
      </Actions>
      <Actions><Button secondary label="Your services" onPress={() => openSheet('services')} /></Actions>
    </View>
  );
  return <RoomBefore testID="waiting" label={`${owner}’s room`} pinned={false} actions={actions} />;
}
