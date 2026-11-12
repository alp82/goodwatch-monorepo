/**
 * Building blocks of the room screens (direction D): the room screen in the shared frame, buttons,
 * labels, switches, agreement dots, icons and service logos. YepWatch look: Gabarito, amber, warm
 * darks, 10-14 px corners (faces and switches stay round), plain labels; sizes scale with the window.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused, useNavigation } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { continuousApi } from '../../core/continuous/api';
import { useReducedMotion } from '../../components/ui';
import { AppFrame, type AppFrameProps, type FrameRooms } from '../shell/Frame';
import type { HeaderMe, HeaderPill } from '../shell/Header';
import { useLayout } from '../shell/layout';
import { useSheetsHoldNavigation } from '../shell/sheet-back';
import { useFreshSurface } from '../shell/fresh-surface';
import { closeTopSheet, useSheetOpen } from '../shell/sheet-stack';
import { warm } from '../shell/tokens';
import { GText, Press, glow, grow, spaceToggles } from '../glow/theme';
import { useOptionalRoom } from './RoomProvider';
import type { Kind } from './model';
import { rankServices, type ServiceChoice } from './services';

export const T = { hero: 40, title: 28, body: 16, small: 13 } as const;
export const card = { borderRadius: 10, backgroundColor: '#ffffff08', borderWidth: 1, borderColor: '#ffffff12' } as const;
/** Screens keep a phone column on big windows. */
export const SCREEN_WIDTH = 560;

export function Small({ children, color = glow.muted, bold = false, lines }: { children: ReactNode; color?: string; bold?: boolean; lines?: number }) {
  return <GText size={T.small} color={color} bold={bold} lines={lines}>{children}</GText>;
}
/** A small spaced uppercase label (YOUR ROOM, SOMEONE PROPOSES, TONIGHT, IDEAS). */
export function Label({ children, color = glow.muted }: { children: string; color?: string }) {
  const { z } = useLayout();
  return <GText bold size={z(12)} color={color} style={{ letterSpacing: 1.4 }}>{children.toUpperCase()}</GText>;
}

/**
 * A room screen in the shared frame: the sticky app header (wordmark, Back, the room switcher pill,
 * avatar) and the body in the centered column. Inside a room the pill, Your rooms and the avatar come
 * from the room itself; pass `pill`, `rooms` or `me` to say otherwise (null hides the pill). The main
 * action (`footer`) is pinned on phones and sits in the content on bigger windows. The room's open
 * sheet (Room, Your services …) shows over the screen that is in front; leaving that screen closes it.
 */
export function Screen({ back, right, children, footer, footerPlacement, overlay, sheet, backdrop, testID, scroll = true, covered = false, pill, rooms, me, onProfile, width = SCREEN_WIDTH, gap, noteTop }: {
  back?: () => void;
  /** A row above the content (voting's Undo and room bar). */
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  footerPlacement?: AppFrameProps['footerPlacement'];
  overlay?: ReactNode;
  /** A Sheet over the body (header stays usable); defaults to the room's open sheet. */
  sheet?: ReactNode;
  /** Paints behind the header and the body (Tonight's poster glow). */
  backdrop?: ReactNode;
  testID?: string;
  /** Voting fills the body instead of scrolling it. */
  scroll?: boolean;
  /** A page over this one (overlay): the screen underneath stays laid out but is inert. */
  covered?: boolean;
  /** The header pill; derived from the room when absent, hidden when null. */
  pill?: HeaderPill | null;
  rooms?: FrameRooms;
  me?: HeaderMe;
  onProfile?: () => void;
  /** The content column's widest size ('page' is the shared container). */
  width?: number | 'page';
  gap?: number;
  /** Where the room's note floats below the header (under a top bar of the screen's own). */
  noteTop?: number;
}) {
  const room = useOptionalRoom();
  const view = room?.view ?? null;
  const roomId = room?.id;
  // The room's next view (Keep swiping back to voting, Matches, Tonight) ignores the rest of the tap that opened it.
  useFreshSurface(testID);
  const focused = useIsFocused();
  const navigation = useNavigation();
  const closeSheets = room?.closeSheets;
  // Another page in front (Mood, Matches) or this one gone back: the sheet doesn't follow.
  useEffect(() => (closeSheets ? navigation.addListener('blur', closeSheets) : undefined), [navigation, closeSheets]);
  // A sheet open over this screen (the room's or Your rooms): browser Back, the router's back and the iOS swipe close it first.
  const sheetOpen = useSheetOpen();
  useSheetsHoldNavigation(focused && sheetOpen, () => { closeSheets?.(); closeTopSheet(); });
  const derived: HeaderPill | null = view ? { label: view.label, state: view.phase === 'decided' ? 'decided' : 'live', fresh: view.newSuggestions, beat: focused && !covered ? room?.liveBeat : null } : null;
  const current = view && roomId && room ? { roomId, label: view.label, decided: view.phase === 'decided', openRoomPage: () => room.openSheet('room') } : undefined;
  const roomSheet = room && view && focused && room.sheet ? room.renderSheet(room.sheet) : null;
  const scrollGap = gap ?? (scroll ? 22 : 12);
  return (
    <AppFrame testID={testID} scroll={scroll} covered={covered} overlay={overlay} sheet={sheet ?? roomSheet} backdrop={backdrop} width={width} gap={scrollGap} noteTop={noteTop}
      header={{ back, pill: pill === undefined ? derived : pill, me: me ?? (view ? { name: view.me.nickname || null, member: view.member } : undefined), onProfile }}
      rooms={rooms ?? (room ? { current, actions: { open: room.openRoom } } : undefined)}
      footer={footer} footerPlacement={footerPlacement}>
      {right ? <View testID="screen-bar" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{right}</View> : null}
      {children}
    </AppFrame>
  );
}

/** The phone dock holds the main action; bigger windows put it in the content. */
export function usePinnedActions() {
  const { phone, short } = useLayout();
  return phone || short;
}

/** Amber primary or outlined secondary action; it grows to fill its row unless `fixed`. */
export function Button({ label, onPress, disabled, quiet, secondary, icon, name, fixed, testID }: { label: string; onPress: () => void; disabled?: boolean; quiet?: boolean; secondary?: boolean; icon?: ReactNode; /** Accessible name when it differs. */ name?: string; /** A set width instead of growing. */ fixed?: number; testID?: string }) {
  const { z } = useLayout();
  const size = fixed ? { width: fixed } : { flexGrow: 1, flexShrink: 1, flexBasis: 0 };
  return (
    <Press label={name ?? label} onPress={onPress} disabled={disabled} quiet={quiet}
      style={{ ...size, minHeight: z(54), borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 9, backgroundColor: secondary ? warm.faint : glow.amber, borderWidth: 1, borderColor: secondary ? warm.lineStrong : glow.amber }}>
      {icon}
      <GText bold size={z(17)} color={secondary ? glow.ink : warm.ink} lines={1}>{label}</GText>
      {testID ? <View testID={testID} /> : null}
    </Press>
  );
}
/** Buttons side by side. */
export function Actions({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>;
}
/** The square Room button (three dots) beside a screen's main action: opens the Room sheet. */
export function RoomButton({ onPress }: { onPress: () => void }) {
  const { z } = useLayout();
  return (
    <Press label="Room" onPress={onPress} style={{ width: z(54), height: z(54), borderRadius: 12, backgroundColor: warm.faint, borderWidth: 1, borderColor: warm.lineStrong }}>
      <Glyph name="dots" size={z(22)} color={glow.soft} />
    </Press>
  );
}
/** Agreement as dots: one per person needed, amber for each who agrees. Counts only, never names. */
export function Dots({ n, of }: { n: number; of: number }) {
  const { z } = useLayout();
  return (
    <View accessible={false} style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: Math.max(0, of) }, (_, k) => <View key={k} style={{ width: z(26), height: 6, borderRadius: 3, backgroundColor: k < n ? glow.amber : '#ffffff1f' }} />)}
    </View>
  );
}

const GLYPHS = {
  link: 'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5',
  plus: 'M12 5v14M5 12h14',
  down: 'm7 10 5 5 5-5',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  share: 'M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
} as const;
/** Small stroke glyphs the icon sets don't have. */
export function Glyph({ name, size = 18, color = glow.soft }: { name: keyof typeof GLYPHS; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={name === 'dots' ? 3.2 : 2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      <Path d={GLYPHS[name]} />
    </Svg>
  );
}

export function TextLink({ label, onPress, color = glow.amber, disabled }: { label: string; onPress: () => void; color?: string; disabled?: boolean }) {
  return <Press label={label} onPress={onPress} disabled={disabled} style={{ alignSelf: 'flex-start', ...grow(32) }}><GText size={T.small} bold color={color}>{label}</GText></Press>;
}
/** One quiet message where something else would be: errors, connection, saved actions. */
export function Note({ children, action, busy = false }: { children: ReactNode; action?: { label: string; onPress: () => void; disabled?: boolean }; busy?: boolean }) {
  return (
    <View accessibilityLiveRegion="polite" aria-busy={busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#201c13' }}>
      {busy ? <ActivityIndicator testID="note-spinner" size="small" color={glow.amber} /> : null}
      <GText size={12} lines={2} style={{ flex: 1 }}>{children}</GText>
      {action ? <Press label={action.label} onPress={action.onPress} disabled={action.disabled} style={grow(32)}><GText size={12} bold>{action.label}</GText></Press> : null}
    </View>
  );
}

/** Round switch. Disabled switches stay visible (the host decides) and are announced as disabled. */
export function Switch({ on, label, onPress, disabled = false }: { on: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    // The track stays 48 × 28; the press area around it is the full 48 × 48 touch target.
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on, disabled }} aria-checked={on} aria-disabled={disabled} disabled={disabled} onPress={onPress} {...spaceToggles(onPress, disabled)}
      style={{ ...grow(28, 48), justifyContent: 'center', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer' } as ViewStyle}>
      {/* The knob moves by transform: a switch turned on from another phone moves nothing in the layout. */}
      <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: on ? glow.amber : '#ffffff26', alignItems: 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? '#201400' : glow.soft, transform: [{ translateX: on ? 20 : 0 }] }} />
      </View>
    </Pressable>
  );
}

const HERO_PATHS = {
  film: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5',
  tv: 'M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125Z',
  archive: 'm20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  pencil: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125',
};
/** Heroicons outline (GoodWatch's icon set). */
export function HeroIcon({ name, size = 20, color = glow.soft }: { name: keyof typeof HERO_PATHS; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" accessible={false}><Path d={HERO_PATHS[name]} /></Svg>;
}
export function KindIcons({ kinds, size = 18, color = glow.soft }: { kinds: Kind[]; size?: number; color?: string }) {
  return <View style={{ flexDirection: 'row', gap: 4 }}>{kinds.includes('movie') && <HeroIcon name="film" size={size} color={color} />}{kinds.includes('show_start') && <HeroIcon name="tv" size={size} color={color} />}</View>;
}
export const kindsLabel = (k: Kind[]) => (k.length === 2 ? 'Movies and shows' : k[0] === 'movie' ? 'Movies' : k.length ? 'Shows' : 'Nothing');

/** The room's catalog for one country: service tiles in the order people look for them. */
export function useServices(country: string | null | undefined) {
  const metadata = useQuery({ queryKey: ['continuous-metadata', country ?? undefined], queryFn: () => continuousApi.metadata(country || undefined), staleTime: 300_000 });
  const all = useMemo(() => rankServices(metadata.data), [metadata.data]);
  return { all, metadata };
}

/** Overlapping service logos (first four). */
export function Logos({ services, size = 24 }: { services: ServiceChoice[]; size?: number }) {
  return (
    <View accessible={false} style={{ flexDirection: 'row', alignItems: 'center' }}>
      {services.slice(0, 4).map((s, i) => s.logoUrl
        ? <Image key={s.id} source={{ uri: s.logoUrl }} style={{ width: size, height: size, borderRadius: size * 0.2, marginLeft: i ? -size * 0.22 : 0, borderWidth: 2, borderColor: glow.bg }} />
        : <View key={s.id} style={{ width: size, height: size, borderRadius: size * 0.2, marginLeft: i ? -size * 0.22 : 0, borderWidth: 2, borderColor: glow.bg, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}><GText bold size={size * 0.4}>{s.name.slice(0, 1)}</GText></View>)}
    </View>
  );
}

/** LIVE with a pulsing green dot: the room is open right now. */
export function LiveBadge() {
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return (
    <View accessibilityLabel="Live" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 22, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#22c55e1f', borderWidth: 1, borderColor: '#22c55e55' }}>
      <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
        {!reduced && <Animated.View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: glow.green, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }} />}
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: glow.green }} />
      </View>
      <GText bold size={11} color="#4ade80" style={{ letterSpacing: 0.8 }}>LIVE</GText>
    </View>
  );
}
/** The amber NEW badge: inline, the same height as the row's text, so nothing moves when it goes. */
export function NewBadge() {
  return <View style={{ height: 20, paddingHorizontal: 6, borderRadius: 5, backgroundColor: '#fbbf2426', justifyContent: 'center' }}><GText bold size={11} color={glow.amber}>NEW</GText></View>;
}
/** Where a card would be while the deck refills: never an end state. */
export function FindingMore({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View testID="finding-more" style={[{ borderRadius: 12, backgroundColor: '#ffffff08', borderWidth: 1, borderColor: '#ffffff12', alignItems: 'center', justifyContent: 'center', gap: 14 }, style]}>
      <ActivityIndicator color={glow.amber} />
      <Small>Finding more…</Small>
    </View>
  );
}
