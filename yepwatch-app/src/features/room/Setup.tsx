/**
 * The room before Start (direction D): the ideas are the headline (left column on wide windows),
 * the share row, people, movies and shows, streaming and the action beside them (below on phones).
 * The host starts; friends wait for the host.
 */
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Keyboard, TextInput, View } from 'react-native';
import { guestOnly } from '../../core/config';
import { GoodWatchButton, RECONNECTED_DETAIL, RECONNECT_GOODWATCH } from '../home/Landing';
import { Or } from '../home/start-parts';
import { useGlide } from '../shell/glide';
import { useLayout } from '../shell/layout';
import { warm } from '../shell/tokens';
import { GText, glow } from '../glow/theme';
import { NAME_MAX } from './model';
import { toRooms } from './nav';
import { Chip, IdeaStack, PeopleRow, ShareRow, fieldStyleFor, useAcknowledgeShownIdeas } from './parts';
import { useRoom } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { namesLine, servicesIn } from './services';
import { START_FAILED_NOTE, hostStartPhase, type StartPhase } from './start-progress';
import { StartButton, StartStatus, useEased } from './StartProgress';
import { Actions, Button, Glyph, KindIcons, Label, Logos, Note, RoomButton, Screen, Small, kindsLabel, usePinnedActions, useServices } from './ui';

/** Share, people, movies and shows, streaming: whole-row controls that open the room's sheets. */
function RoomDetails() {
  const { view, inviteUrl, openSheet } = useRoom();
  const { z } = useLayout();
  const { all } = useServices(view?.country);
  // A friend's services join the line: the names glide over as the logos widen.
  const names = useGlide({ axis: 'x' });
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
        <Chip key="streaming" label={`${on.length ? namesLine(on) : 'Streaming'}, change`} action="Change" onPress={() => openSheet('streaming')}>
          <Logos services={on} size={z(24)} />
          <View ref={names} style={{ flex: 1, minWidth: 0 }}><GText size={z(15)} color={glow.soft} lines={1}>{on.length ? namesLine(on) : 'Streaming'}</GText></View>
        </Chip>
      ) : (
        <Chip key="add-services" warn label="Streaming services, add" action="Add" onPress={() => openSheet('services')}>
          <Glyph name="plus" size={z(18)} color={glow.amber} />
          <GText bold size={z(15)} color={glow.amber} style={{ flex: 1 }}>Streaming services</GText>
        </Chip>
      )}
    </View>
  );
}

/**
 * The shared layout: headline (room label and ideas) and the details with the actions, side by side
 * from 900 px. `actions` sit in the side column, or in the phone dock when `pinned`. While the round
 * starts (`start`) the ideas and details rest, dimmed and inert.
 */
function RoomBefore({ testID, label, actions, pinned, extra, start = 'idle' }: { testID: string; label: string; actions: ReactNode; pinned: boolean; extra?: ReactNode; start?: StartPhase }) {
  const { phone, wide, max, z } = useLayout();
  const gap = z(56);
  const side = Math.min(z(420), max * 0.4);
  const resting = start === 'starting';
  const room = useEased(resting ? 0.55 : 1, 360);
  // Stacked (phones): a friend's idea arriving above glides the details down instead of pushing them.
  const details = useGlide({ enabled: !wide });
  const headline = (
    <Animated.View pointerEvents={resting ? 'none' : 'auto'} style={{ gap: z(16), opacity: room }}>
      <Label color={glow.amber}>{label}</Label>
      <IdeaStack />
    </Animated.View>
  );
  const column = (
    <View style={{ gap: z(20) }}>
      <Animated.View pointerEvents={resting ? 'none' : 'auto'} style={{ opacity: room }}><RoomDetails /></Animated.View>
      {extra ? <Animated.View pointerEvents={resting ? 'none' : 'auto'} style={{ opacity: room }}>{extra}</Animated.View> : null}
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
          <View ref={details}>{column}</View>
        </View>
      )}
    </Screen>
  );
}

/**
 * The host's room before Start: one action, Start, beside the Room button. A guest host names
 * themselves first. Start carries the wait: the server builds the first deck inside the Start command,
 * so the button works until the command comes back, and voting takes over the moment the round
 * arrives. A start that fails reads Try again.
 */
/** How long after the last keystroke the host's name saves. */
const NAME_SAVE_MS = 600;

export function RoomSetup() {
  const { view, cmd, state, latest, disabled, signin, memberBusy, memberLapsed, openSheet } = useRoom();
  const { z } = useLayout();
  const pinned = usePinnedActions();
  const [name, setName] = useState('');
  const [focus, setFocus] = useState(false);
  // A name being saved may still be in flight when Start is pressed: Start waits for it.
  const renaming = useRef<Promise<boolean> | null>(null);
  // The name saves as it's typed (shortly after typing stops), when the keyboard goes away (Android back
  // hides it without leaving the field), on Enter, on blur, and when the screen goes: never a draft only
  // this phone knows. The field stays while you're in it, even once the first save gives you a name.
  const typedName = useRef('');
  const nameInput = useRef<ComponentRef<typeof TextInput>>(null);
  const commands = useRef({ cmd, latest });
  useEffect(() => { commands.current = { cmd, latest }; });
  const saveName = useCallback(function save() {
    const want = typedName.current.trim();
    if (!want || renaming.current) return;
    const s = commands.current.latest();
    if (want === s?.shared.participants.find((p) => p.participantId === s.own.participantId)?.nickname.trim()) return;
    renaming.current = commands.current.cmd.rename(want).finally(() => {
      renaming.current = null;
      // Typed on while that save was out: save the newer name too.
      if (typedName.current.trim() !== want) save();
    });
  }, []);
  useEffect(() => {
    if (!name.trim()) return;
    const timer = setTimeout(saveName, NAME_SAVE_MS);
    return () => clearTimeout(timer);
  }, [name, saveName]);
  useEffect(() => {
    // Hiding the keyboard (Android back) ends editing: the field lets go, which saves the name.
    const sub = Keyboard.addListener('keyboardDidHide', () => { if (nameInput.current?.isFocused()) nameInput.current.blur(); else saveName(); });
    return () => { sub.remove(); saveName(); };
  }, [saveName]);
  const [attempt, setAttempt] = useState<'starting' | 'failed' | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useAcknowledgeShownIdeas();
  if (!view) return null;
  const typed = name.trim();
  const named = Boolean(view.me.nickname || typed);
  const typeName = (text: string) => { typedName.current = text; setName(text); };
  const start = async () => {
    if (renaming.current) await renaming.current;
    const s = latest();
    const current = s?.shared.participants.find((p) => p.participantId === s.own.participantId)?.nickname.trim();
    if (typed && typed !== current && !(await cmd.rename(typed))) return false;
    return cmd.start();
  };
  // A start the server hasn't confirmed (the answer got lost, the server restarting) is saved and goes out
  // again by itself: Start keeps its words meanwhile, never a failure. A long outage gets the room's one
  // connection line, whose Retry sends that same start.
  const pendingStart = state.pending?.command.type === 'start';
  const phase = hostStartPhase({ attempt, retrying: pendingStart });
  const run = (go: () => Promise<boolean>) => {
    setAttempt('starting');
    void go().catch(() => false).then((ok) => { if (mounted.current) setAttempt(ok ? null : 'failed'); });
  };
  // Start stays tappable while a step is missing and opens that step, so it never looks dead.
  const missing = !view.enabledServiceIds.length ? 'services' : !view.kinds.length ? 'kinds' : !named ? 'name' : null;
  const onStart = () => {
    if (missing === 'services' || missing === 'kinds') openSheet(missing);
    else if (missing === 'name') nameInput.current?.focus();
    else if (pendingStart) run(() => state.send());
    else run(start);
  };
  const blocked = !view.country || state.privateError || state.retrySeconds > 0 || (Boolean(state.pending) && !pendingStart);
  const actions = (
    <View style={{ gap: 10 }}>
      {phase === 'failed' ? <Note>{START_FAILED_NOTE}</Note> : null}
      <Actions>
        <RoomButton onPress={() => openSheet('room')} />
        <StartButton phase={phase} disabled={blocked} onPress={onStart} />
      </Actions>
    </View>
  );
  const nameField = view.needName || focus ? (
    <View style={{ gap: z(10) }}>
      <Small>Your name</Small>
      <TextInput ref={nameInput} accessibilityLabel="Your name" value={name} onChangeText={typeName} onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); saveName(); }} onSubmitEditing={saveName}
        maxLength={NAME_MAX} autoCapitalize="words" autoComplete="nickname" placeholder="Your name" placeholderTextColor={warm.placeholder} returnKeyType="done" selectionColor={glow.amber}
        style={fieldStyleFor(z, focus)} />
      {!guestOnly && <><Or /><GoodWatchButton {...(memberLapsed ? { label: RECONNECT_GOODWATCH, detail: RECONNECTED_DETAIL } : { detail: 'Brings your name and streaming services' })} disabled={memberBusy || disabled} onPress={() => void signin()} /></>}
    </View>
  ) : null;
  // A lapsed member kept their name, so there's no name field: Reconnect GoodWatch sits under the details.
  const reconnect = !nameField && memberLapsed && !guestOnly && !view.member
    ? <GoodWatchButton label={RECONNECT_GOODWATCH} detail={RECONNECTED_DETAIL} disabled={memberBusy || disabled} onPress={() => void signin()} />
    : null;
  return <RoomBefore testID="room-setup" label="Your room" pinned={pinned} actions={actions} extra={nameField ?? reconnect} start={phase} />;
}

/**
 * A friend's room before Start (or while joining a running round): the same room, waiting for the
 * host. The server says nothing while the host's start builds the deck; voting takes over the moment
 * the round arrives.
 */
export function Waiting() {
  const { view, entry, openSheet } = useRoom();
  if (!view) return null;
  const owner = view.hostName || 'Your friend';
  const joining = view.phase === 'setup' ? null : entry.working ? 'Joining…' : 'Joining the round…';
  const actions = (
    <View style={{ gap: 10 }}>
      <Actions>
        <RoomButton onPress={() => openSheet('room')} />
        <StartStatus host={view.hostName || 'the host'} joining={joining} />
      </Actions>
      <Actions><Button secondary label="Your services" onPress={() => openSheet('services')} /></Actions>
    </View>
  );
  return <RoomBefore testID="waiting" label={`${owner}’s room`} pinned={false} actions={actions} start={joining ? 'starting' : 'idle'} />;
}
