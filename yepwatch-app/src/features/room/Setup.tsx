/**
 * The couch before Start is an invite screen (YepWatch rethink): who's here and Invite in the header
 * strip, the title, and the console where everyone adds one idea (a friend's is a wish). The host starts;
 * friends wait for the host.
 */
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Keyboard, TextInput, View } from 'react-native';
import { guestOnly } from '../../core/config';
import { GoodWatchButton, RECONNECTED_DETAIL, RECONNECT_GOODWATCH } from '../home/Landing';
import { Or } from '../home/start-parts';
import { useLayout } from '../shell/layout';
import { noun } from '../shell/noun';
import { warm } from '../shell/tokens';
import { GText, glow } from '../glow/theme';
import { NAME_MAX } from './model';
import { toRooms } from './nav';
import { HowLink } from './HowItWorks';
import { WhoStrip, setupWidth } from './invite';
import { fieldStyleFor, useAcknowledgeShownIdeas } from './parts';
import { roomPart } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { ConsoleCard, DeckPreview, DeckStrip, IdeaField, IdeasPanel, IdeasTray, KindSwitch, StreamingRow } from './SetupConsole';
import { START_FAILED_NOTE, hostStartPhase, type StartPhase } from './start-progress';
import { StartButton, StartStatus, useEased } from './StartProgress';
import { Actions, Note, RoomButton, Screen, Small, usePinnedActions } from './ui';

const HOST_TITLE = 'Pick something to watch with friends';
const friendTitle = (host: string) => `${host} wants to pick something to watch with you`;

/** The couch's title: whose couch it is over what it's for, with How it works beside it. Fixed height. */
function TitleBlock({ over, title, onHow }: { over: string; title: string; onHow: () => void }) {
  const { phone, z } = useLayout();
  const size = phone ? 24 : z(30);
  const lines = phone ? 2 : 1;
  return (
    <View testID="head-title" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ height: phone ? 48 : z(22), flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <GText bold size={phone ? 14 : z(14)} color={glow.amber} lines={1} style={{ flex: 1 }}>{over}</GText>
          {phone ? <HowLink onPress={onHow} /> : null}
        </View>
        <View style={{ height: Math.ceil(size * 1.12 * lines) }}>
          <GText bold size={size} lines={lines} style={{ letterSpacing: -size * 0.025, lineHeight: size * 1.12 }}>{title}</GText>
        </View>
      </View>
      {phone ? null : <HowLink onPress={onHow} />}
    </View>
  );
}

/**
 * The couch before Start, as an invite screen: the header strip (Who's here, Invite), the title with How
 * it works, then the console (the describe field, Movies or shows, Streaming, the preview, Ideas) with the
 * main action. Wide windows: one card with two panes, the action under Ideas. Phones: one column, Ideas as
 * a tray in the dock above the action. While the round starts (`start`) the console rests, dimmed and inert.
 */
function CouchBefore({ testID, over, title, actions, extra, start = 'idle', onHow }: { testID: string; over: string; title: string; actions: ReactNode; extra?: ReactNode; start?: StartPhase; onHow: () => void }) {
  const { phone, max, z } = useLayout();
  const pinned = usePinnedActions();
  const W = setupWidth(max, z);
  const split = !phone && W >= z(700);
  const resting = start === 'starting';
  const room = useEased(resting ? 0.55 : 1, 360);
  const left = (
    <>
      <IdeaField />
      <KindSwitch />
      <StreamingRow />
      {split ? <DeckPreview /> : null}
    </>
  );
  const body = split ? (
    <ConsoleCard left={left} right={<IdeasPanel />} foot={pinned ? undefined : actions} />
  ) : (
    <View testID="console" style={{ gap: phone ? 16 : z(18) }}>
      {left}
      {pinned ? null : <IdeasTray />}
      <DeckStrip />
    </View>
  );
  const dock = pinned ? (split ? actions : <View style={{ gap: 10 }}><IdeasTray />{actions}</View>) : split ? undefined : actions;
  return (
    <Screen testID={testID} strip={<WhoStrip />} back={toRooms} width={W} gap={phone ? 16 : z(20)} footer={dock}>
      <RoomNotes />
      <TitleBlock over={over} title={title} onHow={onHow} />
      <Animated.View pointerEvents={resting ? 'none' : 'auto'} style={{ opacity: room }}>{body}</Animated.View>
      {extra ? <Animated.View pointerEvents={resting ? 'none' : 'auto'} style={{ opacity: room }}>{extra}</Animated.View> : null}
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

export const RoomSetup = roomPart('RoomSetup', (r) => ({
  view: r.view, cmd: r.cmd, latest: r.latest, disabled: r.disabled, signin: r.signin, memberBusy: r.memberBusy, memberLapsed: r.memberLapsed, openSheet: r.openSheet,
  acknowledgeIdeas: r.acknowledgeIdeas, pending: r.state.pending, privateError: r.state.privateError, retrySeconds: r.state.retrySeconds, send: r.state.send,
}), function RoomSetup({ view, cmd, latest, disabled, signin, memberBusy, memberLapsed, openSheet, acknowledgeIdeas, pending, privateError, retrySeconds, send }) {
  const { z } = useLayout();
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
  useAcknowledgeShownIdeas(view, acknowledgeIdeas);
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
  const pendingStart = pending?.command.type === 'start';
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
    else if (pendingStart) run(() => send());
    else run(start);
  };
  const blocked = !view.country || privateError || retrySeconds > 0 || (Boolean(pending) && !pendingStart);
  const actions = (
    <View style={{ gap: 10 }}>
      {phase === 'failed' ? <Note>{START_FAILED_NOTE}</Note> : null}
      <Actions>
        <RoomButton onPress={() => openSheet('room')} />
        <StartButton phase={phase} disabled={blocked} onPress={onStart} people={view.people.length} />
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
  return <CouchBefore testID="room-setup" over={view.me.nickname ? noun.of(view.me.nickname) : noun.yourOne} title={HOST_TITLE} actions={actions} extra={nameField ?? reconnect} start={phase} onHow={() => openSheet('how')} />;
});

/**
 * A friend's couch before Start (or while joining a running round): the same screen, waiting for the
 * host. The server says nothing while the host's start builds the deck; voting takes over the moment
 * the round arrives.
 */
export const Waiting = roomPart('Waiting', (r) => ({ view: r.view, entryWorking: r.entry.working, openSheet: r.openSheet }), function Waiting({ view, entryWorking, openSheet }) {
  if (!view) return null;
  const owner = view.hostName || 'Your friend';
  const joining = view.phase === 'setup' ? null : entryWorking ? 'Joining…' : 'Joining the round…';
  const actions = (
    <View style={{ gap: 10 }}>
      <Actions>
        <RoomButton onPress={() => openSheet('room')} />
        <StartStatus host={view.hostName || 'the host'} joining={joining} />
      </Actions>
    </View>
  );
  return <CouchBefore testID="waiting" over={noun.of(owner)} title={friendTitle(owner)} actions={actions} start={joining ? 'starting' : 'idle'} onHow={() => openSheet('how')} />;
});
