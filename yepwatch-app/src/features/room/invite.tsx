/**
 * Bringing people to the couch: the header strip (everyone's face, "Only you" or the names beside them,
 * Invite at the end of the row) and what Invite opens: on wide windows a popover under the button (QR code, the link
 * with Copy link, who joined last; the page stays as it is behind it), on phones a bottom sheet that adds
 * Share link. Every piece has one size in every state, so nothing moves when people arrive or it opens.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../../components/ui';
import { qrModules, qrPath } from '../../core/qr';
import { shareInvitation } from '../../core/share-invitation';
import { usePeerColor } from '../glow/peer-colors';
import { GText, Icon, glow, native, onePress } from '../glow/theme';
import { HoverPress, Nudge, webOnly } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { noun } from '../shell/noun';
import { Sheet, Shade, useSheetEntry } from '../shell/Sheet';
import { useFreshSurface } from '../shell/fresh-surface';
import { R, warm } from '../shell/tokens';
import type { RoomPerson } from './model';
import { roomPart, useRoom } from './RoomProvider';

/** The couch setup's column before scaling: the strip, the title and the console share it. */
export const SETUP_COLUMN = 920;
export const setupWidth = (max: number, z: (n: number) => number) => Math.min(max, z(SETUP_COLUMN));

type Sizes = { phone: boolean; z: (n: number) => number };
const faceOf = ({ phone, z }: Sizes) => (phone ? 32 : Math.min(40, z(32)));
const inviteW = ({ phone, z }: Sizes) => (phone ? 112 : z(120));
const inviteH = ({ phone, z }: Sizes) => (phone ? 48 : Math.max(48, z(44)));
/** The strip's height: one row of faces and Invite. */
const stripHeight = ({ phone, z }: Sizes) => (phone ? 64 : Math.max(64, z(64)));
/** Faces the strip shows before it ends the stack with +N. */
const STRIP_FACES = 5;

/** A face in the person's color (you: amber). */
export function Face({ person, size }: { person: { id: string; nickname: string; self?: boolean }; size: number }) {
  const colorOf = usePeerColor();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: person.self ? glow.amber : colorOf(person.id), alignItems: 'center', justifyContent: 'center' }}>
      <GText bold size={size * 0.44} color="#141008">{(person.nickname || '?')[0].toUpperCase()}</GText>
    </View>
  );
}
const shownName = (p: Pick<RoomPerson, 'nickname' | 'self'>) => (p.self ? 'You' : p.nickname || 'Someone');
/** Beside the faces: "Only you" while you're alone, then everyone's names. */
const namesWords = (people: readonly Pick<RoomPerson, 'nickname' | 'self'>[]) => (people.length < 2 ? 'Only you' : people.map(shownName).join(', '));

/** Fades in once on mount (opacity only): a face arriving in the strip. */
function Arrive({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) return;
    const a = Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [v, reduced]);
  return <Animated.View style={[style, { opacity: v }]}>{children}</Animated.View>;
}

/**
 * Under the app header, one row: everyone's face in an overlapping stack with "Only you" (or the names)
 * in gray beside it, and Invite at the end. The faces open People. Invite is amber while the host is
 * alone; Start takes the amber after that.
 */
export const WhoStrip = roomPart('WhoStrip', (r) => ({ view: r.view, inviteUrl: r.inviteUrl, openSheet: r.openSheet }), function WhoStrip({ view, inviteUrl, openSheet }) {
  const l = useLayout();
  const { phone, max, z } = l;
  const width = setupWidth(max, z);
  if (!view) return null;
  const people = view.people;
  const n = people.length;
  const face = faceOf(l);
  const canInvite = Boolean(inviteUrl) || view.isHost;
  const hot = view.isHost && n < 2;
  const slots = phone ? 3 : STRIP_FACES;
  const shown = n > slots ? people.slice(0, slots - 1) : people;
  const extra = n - shown.length;
  const ink = hot ? warm.ink : glow.ink;
  const ring = { marginLeft: 0, borderRadius: face / 2 + 2, borderWidth: 2, borderColor: warm.bar };
  return (
    <View testID="who-strip" style={{ borderBottomWidth: 1, borderBottomColor: warm.line, backgroundColor: warm.bar, paddingHorizontal: l.gutter }}>
      <View style={{ width, maxWidth: '100%', alignSelf: 'center', height: stripHeight(l), flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <HoverPress label={`Who’s here: ${n} ${n === 1 ? 'person' : 'people'}`} hint={`Shows everyone on the ${noun.one}`} hover="tint" repeatable onPress={() => openSheet('people')}
          style={{ flex: 1, minWidth: 0, height: 48, marginLeft: -4, paddingHorizontal: 4, borderRadius: R.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10 }}>
          <View style={{ flexDirection: 'row', width: (face + 4) + (slots - 1) * (face * 0.72 + 4), flexShrink: 0 }}>
            {shown.map((p, i) => (
              <Arrive key={p.id} style={{ ...ring, marginLeft: i ? -face * 0.28 : 0 }}>
                <Face person={{ id: p.id, nickname: p.nickname || shownName(p), self: p.self }} size={face} />
              </Arrive>
            ))}
            {extra ? (
              <View style={{ ...ring, marginLeft: -face * 0.28 }}>
                <View style={{ width: face, height: face, borderRadius: face / 2, backgroundColor: '#2a2520', alignItems: 'center', justifyContent: 'center' }}><GText bold size={face * 0.38}>{`+${extra}`}</GText></View>
              </View>
            ) : null}
          </View>
          <GText size={phone ? 14 : z(14)} color={glow.muted} lines={1} style={{ flexShrink: 1 }}>{namesWords(people)}</GText>
        </HoverPress>
        <View testID="share-row" style={{ width: inviteW(l), height: inviteH(l) }}>
          {canInvite ? (
            <HoverPress label="Invite friends, show QR code and link" hover="lighten" repeatable onPress={() => openSheet('invite')}
              style={{ width: inviteW(l), height: inviteH(l), borderRadius: 12, flexDirection: 'row', gap: 8, backgroundColor: hot ? glow.amber : warm.faint, borderWidth: 1, borderColor: hot ? glow.amber : warm.lineStrong }}>
              <Nudge dx={0} dy={-1}><Icon name="qr" size={phone ? 18 : z(18)} color={ink} /></Nudge>
              <GText bold size={phone ? 16 : z(16)} color={ink} lines={1}>Invite</GText>
            </HoverPress>
          ) : null}
        </View>
      </View>
    </View>
  );
});

/** A QR code for `value` on a light tile, readable by any phone camera. */
export function QrCode({ value, size }: { value: string; size: number }) {
  const modules = useMemo(() => { try { return qrModules(value); } catch { return null; } }, [value]);
  const pad = Math.round(size * 0.07);
  if (!modules) return null;
  const n = modules.length;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`QR code for ${value.replace(/^https?:\/\//, '')}`} style={{ width: size, height: size, borderRadius: R.card, backgroundColor: '#fffaf0', padding: pad }}>
      <Svg width={size - pad * 2} height={size - pad * 2} viewBox={`0 0 ${n} ${n}`} accessible={false}>
        <Path d={qrPath(modules)} fill="#1a1206" />
      </Svg>
    </View>
  );
}

const canCopy = Platform.OS === 'web';
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** The link with Copy link in one row (web). Both words keep their place, so it's one size while it says Copied. */
function CopyLink({ url }: { url: string }) {
  const { z } = useLayout();
  const [state, setState] = useState<'' | 'copied' | 'manual'>('');
  useEffect(() => {
    if (state !== 'copied') return;
    const t = setTimeout(() => setState(''), 2000);
    return () => clearTimeout(t);
  }, [state]);
  const link = url.replace(/^https?:\/\//, '');
  const copied = state === 'copied';
  return (
    <View style={{ gap: 6 }}>
      <HoverPress label={`Copy link ${link}`} hover="lighten" repeatable onPress={() => void copyText(url).then((ok) => setState(ok ? 'copied' : 'manual'))}
        style={{ alignSelf: 'stretch', height: Math.max(48, z(50)), borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'flex-start', gap: 10, backgroundColor: warm.faint, borderWidth: 1, borderColor: copied ? warm.amberLine : warm.lineStrong }}>
        <GText size={z(15)} color={glow.soft} lines={1} style={{ flex: 1 }}>{link}</GText>
        {copied ? <Icon name="check" size={z(16)} color={glow.amber} /> : <Icon name="copy" size={z(16)} color={glow.ink} />}
        <View>
          <GText bold size={z(15)} color={glow.ink} style={{ opacity: copied ? 0 : 1 }}>Copy link</GText>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center' }}><GText bold size={z(15)} color={glow.amber} style={{ opacity: copied ? 1 : 0 }}>Copied</GText></View>
        </View>
      </HoverPress>
      {state === 'manual' ? <GText size={13} color={glow.muted} selectable>{`Select and copy the link: ${url}`}</GText> : null}
    </View>
  );
}

/** The system share sheet (phones), or a copy where there's none; when neither works, the link to select. */
function ShareLink({ url }: { url: string }) {
  const [said, setSaid] = useState<'' | 'copied' | 'shared' | 'manual'>('');
  useEffect(() => {
    if (said !== 'copied' && said !== 'shared') return;
    const t = setTimeout(() => setSaid(''), 2000);
    return () => clearTimeout(t);
  }, [said]);
  const done = said === 'copied' || said === 'shared';
  return (
    <View style={{ gap: 6 }}>
      <HoverPress label="Share link" hint="Opens your phone's share options" hover="lighten" repeatable onPress={() => void shareInvitation(url).then((r) => setSaid(r === 'cancelled' ? '' : r))}
        style={{ alignSelf: 'stretch', height: 50, borderRadius: 12, flexDirection: 'row', gap: 9, backgroundColor: warm.faint, borderWidth: 1, borderColor: done ? warm.amberLine : warm.lineStrong }}>
        {done ? <Icon name="check" size={18} color={glow.amber} /> : <Icon name="share" size={18} color={glow.ink} />}
        <GText bold size={16} color={done ? glow.amber : glow.ink}>{said === 'copied' ? 'Copied' : said === 'shared' ? 'Shared' : 'Share link'}</GText>
      </HoverPress>
      {said === 'manual' ? <GText size={13} color={glow.muted} selectable>{`Select and copy the link: ${url}`}</GText> : null}
    </View>
  );
}

/** Who came in last, in a line of fixed height: people landing are visible while the invite is open. */
function Arrived({ people }: { people: RoomPerson[] }) {
  const { z } = useLayout();
  const others = people.filter((p) => !p.self);
  const last = others.at(-1);
  return (
    <View testID="invite-arrived" accessibilityLiveRegion="polite" style={{ height: z(26), alignItems: 'center', justifyContent: 'center' }}>
      {last ? (
        <Arrive key={last.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Face person={last} size={z(22)} />
          <GText size={z(14)} color={glow.soft} lines={1}>{others.length === 1 ? `${last.nickname || 'Someone'} is here` : `${last.nickname || 'Someone'} is here. ${people.length} people so far.`}</GText>
        </Arrive>
      ) : <GText size={z(14)} color={glow.muted} lines={1}>Friends show up here as they join.</GText>}
    </View>
  );
}

const SCAN = 'Scan with a phone camera, or send the link.';

/** The popover under Invite (wide windows): the page stays as it is behind it; a click outside closes it. */
function InvitePopover({ url, people, onClose }: { url: string; people: RoomPerson[]; onClose: () => void }) {
  const l = useLayout();
  const { z, width, max } = l;
  useSheetEntry(onClose);
  useFreshSurface();
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: reduced ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [v, reduced]);
  const column = setupWidth(max, z);
  const right = Math.max(l.gutter, (width - column) / 2);
  const w = z(340);
  return (
    <View testID="invite-layer" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50 }}>
      <Shade onPress={onePress(onClose)} />
      <Animated.View testID="invite-surface" role="dialog" aria-label="Invite friends" accessibilityViewIsModal
        style={[{ position: 'absolute', top: 10, right, width: w, padding: z(18), gap: z(14), borderRadius: R.card + 4, backgroundColor: warm.raised, borderWidth: 1, borderColor: warm.lineStrong },
          webOnly({ boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }), { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -7, right: inviteW(l) / 2 - 7, width: 13, height: 13, backgroundColor: warm.raised, borderLeftWidth: 1, borderTopWidth: 1, borderColor: warm.lineStrong, transform: [{ rotate: '45deg' }] }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <GText bold size={z(18)} lines={1} style={{ flex: 1 }}>Invite friends</GText>
          <HoverPress label="Close" hover="tint" repeatable onPress={onClose} style={{ width: 48, height: 48, borderRadius: 24 }}><Icon name="close" size={18} color={glow.soft} /></HoverPress>
        </View>
        <View style={{ alignItems: 'center', gap: z(10) }}>
          <QrCode value={url} size={z(196)} />
          <GText size={z(14)} color={glow.muted} style={{ textAlign: 'center' }}>{SCAN}</GText>
        </View>
        {canCopy ? <CopyLink url={url} /> : <ShareLink url={url} />}
        <Arrived people={people} />
      </Animated.View>
    </View>
  );
}

/** Invite friends: the popover on wide windows, a sheet with Share link on phones. */
export function InviteSurface() {
  const { view, inviteUrl, closeSheet } = useRoom();
  const { phone, width, height } = useLayout();
  if (!view) return null;
  const url = inviteUrl;
  // The popover hangs under the setup strip's Invite; elsewhere (the Room sheet during a round) it's a sheet.
  const setup = view.phase === 'setup' || (view.phase === 'choosing' && !view.me.inRound);
  if (!phone && url && setup) return <InvitePopover url={url} people={view.people} onClose={closeSheet} />;
  const qr = Math.max(140, Math.min(200, height - 460, width - 80));
  return (
    <Sheet testID="invite-sheet" title="Invite friends" onClose={closeSheet}>
      {url ? (
        <>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <QrCode value={url} size={qr} />
            <GText size={14} color={glow.muted} style={{ textAlign: 'center' }}>{SCAN}</GText>
          </View>
          <View style={{ gap: 10 }}>
            {canCopy ? <CopyLink url={url} /> : null}
            <ShareLink url={url} />
          </View>
        </>
      ) : <GText color={glow.muted}>{view.isHost ? 'The link isn’t available on this device.' : `Ask ${view.hostName || 'the host'} for the link to ${noun.this}.`}</GText>}
      <Arrived people={view.people} />
    </Sheet>
  );
}
