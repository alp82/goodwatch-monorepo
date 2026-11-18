/**
 * The couch before Start is an invite screen (YepWatch rethink): who's here and Invite in the header
 * strip, the title, and the Ideas card where everyone adds one idea (a friend's is a wish). Settings and
 * Start share the dock. The host starts; friends wait for the host.
 */
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Keyboard, TextInput, View } from 'react-native';
import { guestOnly } from '../../core/config';
import { GoodWatchButton, RECONNECTED_DETAIL, RECONNECT_GOODWATCH } from '../home/Landing';
import { Or } from '../home/start-parts';
import { HoverPress } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { noun } from '../shell/noun';
import { warm } from '../shell/tokens';
import { GText, Icon, glow } from '../glow/theme';
import { NAME_MAX } from './model';
import { toRooms } from './nav';
import { HowLink } from './HowItWorks';
import { WhoStrip, setupWidth } from './invite';
import { fieldStyleFor, useAcknowledgeShownIdeas } from './parts';
import { roomPart } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { IdeasCard } from './SetupConsole';
import { servicesIn } from './services';
import { START_FAILED_NOTE, hostStartPhase, type StartPhase } from './start-progress';
import { StartButton, StartStatus, useEased } from './StartProgress';
import { Actions, Note, Screen, Small, useServices } from './ui';

const HOST_TITLE = 'Pick something to watch with friends';
const friendTitle = (host: string) => `${host} wants to pick something to watch with you`;

/** The couch's title: whose couch it is with How it works beside it, then what it's for. */
function TitleBlock({ over, title, onHow }: { over: string; title: string; onHow: () => void }) {
  const { phone, z } = useLayout();
  const size = phone ? 24 : z(30);
  return (
    <View testID="head-title" style={{ gap: 2 }}>
      <View style={{ height: phone ? 40 : Math.max(40, z(36)), flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <GText bold size={phone ? 14 : z(14)} color={glow.amber} lines={1} style={{ flex: 1 }}>{over}</GText>
        <HowLink onPress={onHow} />
      </View>
      <GText bold size={size} style={{ letterSpacing: -size * 0.025, lineHeight: size * 1.15 }}>{title}</GText>
    </View>
  );
}

/**
 * The dock's Settings: what the page doesn't show (Movies or shows, Streaming, seen titles, sound,
 * archive, leave). An amber dot while the host's couch has no services yet.
 */
const SettingsButton = roomPart('SettingsButton', (r) => ({ view: r.view, openSheet: r.openSheet }), function SettingsButton({ view, openSheet }) {
  const { phone, z } = useLayout();
  const { all } = useServices(view?.country);
  const loading = !all.length && (view?.enabledServiceIds.length ?? 0) > 0;
  const missing = Boolean(view?.isHost) && !loading && !(view ? servicesIn(all, view.enabledServiceIds) : []).length;
  const icon = phone ? 20 : z(20);
  return (
    <HoverPress label={missing ? 'Settings, services missing' : 'Settings'} hover="lighten" repeatable onPress={() => openSheet('settings')}
      style={{ height: z(54), paddingHorizontal: phone ? 14 : z(16), borderRadius: 12, flexDirection: 'row', gap: 8, backgroundColor: warm.faint, borderWidth: 1, borderColor: warm.lineStrong }}>
      <View>
        <Icon name="sliders" size={icon} color={glow.soft} />
        {missing ? <View testID="settings-missing" style={{ position: 'absolute', right: -3, top: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: glow.amber, borderWidth: 1.5, borderColor: warm.bar }} /> : null}
      </View>
      <GText bold size={phone ? 15 : z(15)} color={glow.soft}>Settings</GText>
    </HoverPress>
  );
});

/**
 * The couch before Start, as an invite screen: the header strip (faces, Invite), the title with How it
 * works, then the Ideas card (the fan of cards on its top edge, the describe field, one row per idea), with
 * Settings and the main action in the dock. One column at every size. While the round starts (`start`)
 * the card rests, dimmed and inert.
 */
function CouchBefore({ testID, over, title, actions, extra, start = 'idle', onHow }: { testID: string; over: string; title: string; actions: ReactNode; extra?: ReactNode; start?: StartPhase; onHow: () => void }) {
  const { phone, max, z } = useLayout();
  const resting = start === 'starting';
  const room = useEased(resting ? 0.55 : 1, 360);
  const rest = (node: ReactNode) => <Animated.View pointerEvents={resting ? 'none' : 'auto'} style={{ opacity: room }}>{node}</Animated.View>;
  return (
    <Screen testID={testID} strip={<WhoStrip />} back={toRooms} width={setupWidth(max, z)} gap={phone ? 14 : z(18)} footer={actions}>
      <RoomNotes />
      <TitleBlock over={over} title={title} onHow={onHow} />
      {rest(<IdeasCard />)}
      {extra ? rest(extra) : null}
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
        <SettingsButton />
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
        <SettingsButton />
        <StartStatus host={view.hostName || 'the host'} joining={joining} />
      </Actions>
    </View>
  );
  return <CouchBefore testID="waiting" over={noun.of(owner)} title={friendTitle(owner)} actions={actions} start={joining ? 'starting' : 'idle'} onHow={() => openSheet('how')} />;
});
