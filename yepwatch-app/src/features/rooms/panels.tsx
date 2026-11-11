/**
 * The start page's sheets (New room retry, Profile, History) and the Join screen, in the shared
 * layout (direction D).
 */
import { useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, TextInput, View, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { guestOnly } from '../../core/config';
import { useAccount } from '../../core/continuous/account';
import { parseInvite } from '../../core/invites';
import type { DecisionRecord } from '../../core/continuous/room-registry-state';
import type { InvitePreview } from '@goodwatch/yepwatch-contracts/proposal';
import { GoodWatchButton, RECONNECTED_DETAIL, RECONNECT_GOODWATCH } from '../home/Landing';
import { Or } from '../home/start-parts';
import { fitSize, type Kind } from '../room/model';
import { KindIcons, Screen, kindsLabel } from '../room/ui';
import { GText, Icon, Press, glow } from '../glow/theme';
import type { HeaderMe } from '../shell/Header';
import { Action, Avatar, FaceStack } from '../shell/parts';
import { GoodWatchMark } from '../shell/marks';
import { Sheet } from '../shell/Sheet';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';
import { posterAt, timeAgo, type HomeRoom } from './home-model';
import { useHome } from './useHome';

const MAX_NAME = 40;
/** Browsers draw their own focus outline and caret; the amber border and caret replace them. */
const webField = (Platform.OS === 'web' ? { outlineStyle: 'none', caretColor: glow.amber } : {}) as TextStyle;

function Label({ children, color = glow.muted }: { children: string; color?: string }) {
  const { z } = useLayout();
  return <GText bold size={z(12)} color={color} style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}>{children}</GText>;
}
/** A warm text field: amber caret and focus line. */
function Field({ label, value, onChange, placeholder, big = false, code = false, autoFocus, onSubmit, returnKey = 'go', autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; big?: boolean; code?: boolean; autoFocus?: boolean; onSubmit?: () => void;
  returnKey?: 'go' | 'next' | 'done'; autoComplete?: 'nickname';
}) {
  const { z } = useLayout();
  const [focus, setFocus] = useState(false);
  return (
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={warm.placeholder} autoFocus={autoFocus}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} autoCapitalize={code ? 'characters' : 'words'} autoCorrect={false} autoComplete={autoComplete}
      maxLength={code ? undefined : MAX_NAME} returnKeyType={returnKey} submitBehavior="blurAndSubmit" onSubmitEditing={onSubmit} selectionColor={glow.amber}
      style={{ height: z(big ? 64 : 52), borderRadius: 12, paddingHorizontal: 16, backgroundColor: warm.faint, borderWidth: 1, borderColor: focus ? glow.amber : warm.lineStrong, color: glow.ink, fontFamily: code ? 'GabaritoBold' : 'Gabarito', fontSize: z(big ? 26 : 17), letterSpacing: code ? 6 : 0, textAlign: code ? 'center' : 'left', ...webField } as TextStyle} />
  );
}
function ErrorText({ children }: { children?: string }) {
  return children ? <GText size={14} color="#fca5a5">{children}</GText> : null;
}

/** Room label, ideas and people take this much before the preview arrives, so the form doesn't move. */
const HEAD_HEIGHT = 150;
/** The host's possessive for the room label: "ALP’S ROOM", or "YOUR FRIEND’S ROOM" without a name. */
export const roomLabel = (hostName: string | null) => `${(hostName || 'Your friend').toUpperCase()}’S ROOM`;

/**
 * What a friend sees before joining: whose room it is, the switched-on ideas as the headline (one
 * idea big, several stacked and fitted, none "Anything"), then the people and the kinds. `undefined`
 * is still loading: the space is kept.
 */
export function InviteHead({ preview }: { preview: InvitePreview | undefined }) {
  const { phone, z } = useLayout();
  const [width, setWidth] = useState(330);
  if (!preview) return <View testID="invite-head-pending" style={{ minHeight: HEAD_HEIGHT }} />;
  const kinds = preview.kinds.filter((k): k is Kind => k === 'movie' || k === 'show_start');
  const many = preview.ideas.length > 1;
  const hero = phone ? 52 : z(80);
  // Only the host has a name here; everyone else is a plain face.
  const faces = Array.from({ length: Math.min(preview.people, 50) }, (_, i) => ({ id: `p${i}`, nickname: i === 0 && preview.hostName ? preview.hostName : ' ' }));
  return (
    <View testID="invite-head" onLayout={(e) => { if (e.nativeEvent.layout.width > 0) setWidth(e.nativeEvent.layout.width); }} style={{ minHeight: HEAD_HEIGHT, justifyContent: 'flex-end', alignItems: 'center', gap: z(12) }}>
      <Label color={glow.amber}>{roomLabel(preview.hostName)}</Label>
      <View testID="invite-ideas" style={{ gap: 6, alignItems: 'center' }}>
        {!preview.ideas.length ? <GText bold size={hero} color={glow.soft} style={{ letterSpacing: -1.5, lineHeight: hero * 1.04 }}>Anything</GText> : preview.ideas.map((idea, i) => {
          const fs = fitSize(idea.text, width, many ? hero * 0.6 : hero);
          return <GText key={i} bold size={fs} style={{ textAlign: 'center', letterSpacing: -fs * 0.03, lineHeight: fs * 1.04 }}>{idea.text}</GText>;
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {faces.length ? <FaceStack people={faces} size={z(26)} max={6} /> : null}
        {kinds.length ? <><KindIcons kinds={kinds} size={z(16)} color={glow.muted} /><GText size={z(14)} color={glow.muted}>{kindsLabel(kinds)}</GText></> : null}
      </View>
    </View>
  );
}

/**
 * Join by link or code: by invitation, the room's head is the headline; by code, a big spaced code
 * field. Guests type their name (or Continue with GoodWatch); members join as their GoodWatch name.
 * A saved, unconfirmed request keeps its name (Change name edits it in Profile).
 */
export function JoinScreen({ invite, checking = false, nickname, nameLocked = false, member = false, lapsed = false, initialCode = '', action, busy, error, back, editName, submit, signIn, extra, head, me }: {
  invite: boolean;
  /** Still finding out whether you're already in this room: the room shows, the form waits unseen in its place. */
  checking?: boolean;
  /** The remembered name: members join with it, guests start with it in the field. */
  nickname: string | null;
  /** A saved request's name: it can't change in the form. */
  nameLocked?: boolean;
  member?: boolean;
  /** Signed in here before and the session ran out: the GoodWatch button reads Reconnect GoodWatch. */
  lapsed?: boolean;
  initialCode?: string; action: string; busy: boolean; error?: string;
  back: () => void; editName: () => void; submit: (code: string, nickname: string) => void; signIn?: (code: string) => void; extra?: ReactNode;
  /** The invited room's head (InviteHead); without it the screen says what it is. */
  head?: ReactNode;
  me?: HeaderMe;
}) {
  const { phone, z } = useLayout();
  const [code, setCode] = useState(initialCode);
  const [typed, setTyped] = useState(nickname ?? '');
  const fixedName = (member || nameLocked) && nickname ? nickname : null;
  const name = (fixedName ?? typed).trim();
  const validCode = Boolean(parseInvite(code));
  const filled = validCode && name.length > 0;
  const go = () => { if (filled && !busy) submit(code, name); };
  const label = fixedName && action === 'Join' ? `Join as ${fixedName}` : action;
  const showCode = !invite || !initialCode;
  const join = (
    <View style={{ flexDirection: 'row' }}>
      <Press label={label} onPress={go} disabled={!filled} quiet={busy} style={{ flex: 1, minHeight: z(54), borderRadius: 12, flexDirection: 'row', gap: 9, backgroundColor: glow.amber }}>
        {member ? <GoodWatchMark size={22} /> : null}
        <GText bold size={z(17)} color={warm.ink}>{label}</GText>
      </Press>
    </View>
  );
  return (
    <Screen testID="join-screen" back={back} pill={null} me={me} onProfile={editName} width={z(640)} gap={phone ? 28 : z(36)}>
      {head ?? (
        <GText bold size={phone ? 40 : z(56)} style={{ textAlign: 'center', letterSpacing: -1.4 }}>{invite ? 'Join the room' : 'Join a room'}</GText>
      )}
      <View style={{ gap: z(18), opacity: checking ? 0 : 1 }} pointerEvents={checking ? 'none' : 'auto'}>
        {showCode ? (
          <Field big code autoFocus={!initialCode} label="Room code or invitation" value={code} onChange={setCode} placeholder="Code or link" returnKey={fixedName ? 'go' : 'next'} onSubmit={go} />
        ) : null}
        {fixedName ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Avatar name={fixedName} size={z(28)} /><GText size={z(16)} color={glow.soft}>{fixedName}</GText>{member ? <GoodWatchMark size={z(16)} /> : null}
            </View>
            {join}
            {nameLocked && !member ? <Press label="Change name" onPress={editName} style={{ alignSelf: 'center', minHeight: 36 }}><GText size={13} bold color={glow.muted}>Change name</GText></Press> : null}
          </>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <Label>Your name</Label>
              <Field label="Your name" value={typed} onChange={setTyped} placeholder="Your name" autoFocus={Boolean(initialCode)} autoComplete="nickname" onSubmit={go} />
            </View>
            {join}
            {signIn ? <>
              <Or />
              <GoodWatchButton height={z(50)} {...(lapsed ? { label: RECONNECT_GOODWATCH, detail: RECONNECTED_DETAIL } : { detail: 'Brings your name and streaming services' })} disabled={busy || !validCode} onPress={() => signIn(code)} />
            </> : null}
          </>
        )}
      </View>
      <ErrorText>{error}</ErrorText>
      {extra}
    </Screen>
  );
}

/**
 * Edits the remembered name for future rooms (names inside existing rooms don't change), and signs this
 * device in or out of GoodWatch. Log out ends the GoodWatch link for YepWatch on this device only.
 */
/**
 * Your name and this device's GoodWatch sign-in. A lapsed sign-in (the session ran out) keeps the
 * GoodWatch look with a small Reconnect GoodWatch instead of the big guest button.
 */
export function ProfileSheet({ nickname, save, member = false, lapsed = false, signIn, logOut, busy, error, onClose }: { nickname: string | null; save: (name: string) => void; member?: boolean; lapsed?: boolean; signIn?: () => void; logOut?: () => void; busy?: boolean; error?: string; onClose: () => void }) {
  const { z } = useLayout();
  const [value, setValue] = useState(nickname ?? '');
  const ok = value.trim().length > 0;
  const go = () => { if (ok) save(value.trim()); };
  return (
    <Sheet testID="profile-panel" title="Profile" onClose={onClose} actions={<Action gold label="Save" onPress={go} disabled={!ok} style={{ flex: 1 }} />}>
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 4 }}>
        <Avatar name={value.trim() || null} size={z(72)} />
        {member ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><GoodWatchMark size={18} /><GText size={14} color={glow.soft}>Signed in with GoodWatch</GText></View> : null}
        {lapsed ? (
          <View testID="profile-lapsed" style={{ alignItems: 'center', gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><GoodWatchMark size={18} /><GText size={14} color={glow.muted}>GoodWatch needs a quick reconnect</GText></View>
            {signIn ? <Press label={RECONNECT_GOODWATCH} hint={RECONNECTED_DETAIL} onPress={signIn} disabled={busy} style={{ minHeight: 40, paddingHorizontal: 8 }}><GText size={14} bold color={glow.amber}>{RECONNECT_GOODWATCH}</GText></Press> : null}
            {signIn ? <GText size={13} color={glow.muted}>{RECONNECTED_DETAIL}</GText> : null}
          </View>
        ) : null}
      </View>
      <View style={{ gap: 8 }}>
        <Label>Your name</Label>
        <Field label="Your name" value={value} onChange={setValue} placeholder="Your name" returnKey="done" onSubmit={go} />
        <GText size={13} color={glow.muted}>Used for new rooms</GText>
      </View>
      {!member && !lapsed && signIn ? <View style={{ gap: 14 }}><Or /><GoodWatchButton detail="Brings your streaming services to new rooms" onPress={signIn} disabled={busy} /></View> : null}
      {(member || lapsed) && logOut ? (
        <View style={{ gap: 8 }}>
          <Action label="Log out" onPress={logOut} disabled={busy} small />
          <GText size={13} color={glow.muted}>Your rooms stay as they are. GoodWatch stays signed in.</GText>
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

/**
 * Profile over whatever screen the avatar was pressed on (a room, its Mood page): the page underneath
 * never changes. Signing in comes back to `returnTo`, the page it was opened from.
 */
export function HomeProfileSheet({ returnTo, onClose }: { returnTo: string; onClose: () => void }) {
  const home = useHome();
  const account = useAccount();
  const known = home.nickname ?? (account.member || account.lapsed ? account.name : null);
  const signIn = guestOnly || account.member ? undefined : () => void account.signIn(returnTo);
  return (
    // The name arrives a moment after the sheet opens on a cold start: the field starts from it then.
    <ProfileSheet key={known ?? ''} nickname={known} member={account.member} lapsed={account.lapsed} signIn={signIn}
      logOut={account.member || account.lapsed ? () => void account.logOut() : undefined}
      busy={account.busy} error={account.error} onClose={onClose}
      save={(name) => { void home.setNickname(name).then(onClose); }} />
  );
}

/** A decided room: Tonight's poster, large, with when, the title, the room and its people. */
function DecidedCard({ record, width, now, open }: { record: DecisionRecord; width: number; now: number; open?: () => void }) {
  const { z } = useLayout();
  const name = `${record.title}, ${record.roomLabel}`;
  const body = (
    <>
      <View style={{ width, height: width * 1.5, backgroundColor: warm.well, alignItems: 'center', justifyContent: 'center' }}>
        {record.posterUrl ? <Image source={{ uri: posterAt(record.posterUrl, width > 200 ? 500 : 342) }} accessible={false} style={{ width: '100%', height: '100%' }} /> : <Icon name="tickets" size={32} color={glow.amber} />}
      </View>
      <LinearGradient pointerEvents="none" colors={['#07070700', '#070707e6', '#070707']} locations={[0, 0.6, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: width * 0.9 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: z(12), gap: 3 }}>
        <GText bold size={z(12)} color={glow.amber} style={{ letterSpacing: 0.4 }}>{`Tonight · ${timeAgo(record.decidedAt, now)}`}</GText>
        <GText bold size={width > 200 ? z(20) : 16} lines={2} style={{ letterSpacing: -0.4 }}>{record.title}{record.year ? ` (${record.year})` : ''}</GText>
        <GText size={z(13)} color={glow.soft} lines={1}>{record.roomLabel}</GText>
        {record.people.length ? <GText size={z(12)} color={glow.muted} lines={1}>{record.people.join(', ')}</GText> : null}
      </View>
    </>
  );
  const box = { width, borderRadius: R.card, overflow: 'hidden', backgroundColor: warm.panel } as const;
  return open
    ? <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={open} style={({ pressed }) => ({ ...box, opacity: pressed ? 0.85 : 1 })}>{body}</Pressable>
    : <View accessible accessibilityLabel={name} style={box}>{body}</View>;
}

/** Past decisions as poster cards; archived rooms can be restored, rooms you left returned to. */
export function HistorySheet({ decisions, left, archived, restore, openRoom, canOpen, returnTo, busy, onClose }: { decisions: readonly DecisionRecord[]; left: readonly HomeRoom[]; archived: readonly HomeRoom[]; restore: (roomId: string) => void; openRoom: (roomId: string) => void; canOpen: (roomId: string) => boolean; returnTo: (room: HomeRoom) => void; busy: boolean; onClose: () => void }) {
  const { phone, width, z } = useLayout();
  const [now] = useState(() => Date.now());
  const inner = (phone ? width : Math.min(z(680), width - 64)) - z(20) * 2 - 2;
  const cols = phone ? 2 : 3;
  const gap = phone ? 12 : z(16);
  const cardWidth = Math.floor((inner - gap * (cols - 1)) / cols);
  const row = { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.card, backgroundColor: warm.faint, borderWidth: 1, borderColor: warm.line } as const;
  return (
    <Sheet testID="history-panel" title="History" onClose={onClose}>
      {decisions.length > 0 || (!archived.length && !left.length) ? (
        <View style={{ gap: 12 }}>
          <Label>Decided</Label>
          {!decisions.length ? <GText color={glow.muted}>Nothing decided yet</GText> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {decisions.map((d) => <DecidedCard key={d.id} record={d} width={cardWidth} now={now} open={canOpen(d.roomId) ? () => openRoom(d.roomId) : undefined} />)}
          </View>
        </View>
      ) : null}
      {archived.length > 0 && (
        <View style={{ gap: 8 }}>
          <Label>Archived rooms</Label>
          {archived.map((r) => (
            <View key={r.roomId} style={row}>
              <Press label={r.label} onPress={() => openRoom(r.roomId)} style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 4 }}>
                <GText bold lines={1}>{r.label}</GText>
                <GText size={13} color={glow.muted} lines={1}>{r.status}</GText>
              </Press>
              <Action small label="Restore" onPress={() => restore(r.roomId)} />
            </View>
          ))}
        </View>
      )}
      {left.length > 0 && (
        <View style={{ gap: 8 }}>
          <Label>Left rooms</Label>
          {left.map((r) => (
            <View key={r.roomId} style={row}>
              <View style={{ flex: 1, gap: 4 }}>
                <GText bold lines={1}>{r.label}</GText>
                <FaceStack people={r.people} size={22} />
              </View>
              <Action small label="Return" onPress={() => returnTo(r)} disabled={busy} />
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}
