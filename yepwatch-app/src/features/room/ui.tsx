/**
 * Building blocks of the room screens (owner-approved prototype 9a2241e3e): the phone screen with a
 * quiet top bar and pinned footer, buttons, switches, heroicons and service logos. GoodWatch look:
 * Gabarito, amber, 6-12 px corners (faces and switches stay round), plain labels.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { continuousApi } from '../../core/continuous/api';
import { useReducedMotion } from '../../components/ui';
import { Backdrop } from '../glow/Backdrop';
import { EdgeBack } from '../glow/EdgeBack';
import { CoveredBody } from '../shell/parts';
import { GText, Icon, Press, Wordmark, glow } from '../glow/theme';
import type { Kind } from './model';
import { rankServices, type ServiceChoice } from './services';

export const T = { hero: 40, title: 28, body: 16, small: 13 } as const;
export const card = { borderRadius: 10, backgroundColor: '#ffffff08', borderWidth: 1, borderColor: '#ffffff12' } as const;
export const fieldStyle = { color: glow.ink, backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: '#ffffff1f', borderRadius: 8, paddingHorizontal: 14, height: 48, fontFamily: 'Gabarito', fontSize: 16 } as const;
/** Screens keep a phone column on big windows. */
export const SCREEN_WIDTH = 560;

export function Hero({ children, color = glow.ink, size = T.hero }: { children: ReactNode; color?: string; size?: number }) {
  return <GText bold size={size} color={color} style={{ letterSpacing: -size * 0.035, lineHeight: size * 1.05 }}>{children}</GText>;
}
export function Small({ children, color = glow.muted, bold = false, lines }: { children: ReactNode; color?: string; bold?: boolean; lines?: number }) {
  return <GText size={T.small} color={color} bold={bold} lines={lines}>{children}</GText>;
}
/** A small uppercase section label (MOOD, IDEAS, PEOPLE, YOURS). */
export function Section({ children }: { children: string }) {
  return <GText size={T.small} bold color={glow.muted}>{children.toUpperCase()}</GText>;
}

/** The phone screen: backdrop, one top bar (Back or the wordmark, then the right side), a scrolling body and a pinned footer. */
export function Screen({ back, right, children, footer, overlay, testID, scroll = true, wordmark = true, covered = false }: {
  back?: () => void;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  testID?: string;
  /** Voting fills the body instead of scrolling it. */
  scroll?: boolean;
  wordmark?: boolean;
  /** A page over this one (overlay): the screen underneath stays laid out but is inert. */
  covered?: boolean;
}) {
  const body = { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 22 } as const;
  return (
    <SafeAreaView testID={testID} edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: glow.bg }}>
      <Backdrop />
      <CoveredBody covered={covered}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%', maxWidth: SCREEN_WIDTH, alignSelf: 'center' }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
          {back ? (
            <Press label="Back" onPress={back} style={{ width: 40, height: 44, borderRadius: 10, backgroundColor: '#ffffff0d' }}><Icon name="left" size={18} color={glow.soft} /></Press>
          ) : wordmark ? <Wordmark size={20} /> : <View />}
          {right ? <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginLeft: 10 }}>{right}</View> : null}
        </View>
        {scroll ? (
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={body}>{children}</ScrollView>
        ) : <View style={{ flex: 1, minHeight: 0, paddingHorizontal: 20, paddingTop: 8, gap: 12 }}>{children}</View>}
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, gap: 10 }}>{footer}</View> : null}
      </KeyboardAvoidingView>
      </CoveredBody>
      {overlay}
      {back && !covered ? <EdgeBack back={back} /> : null}
    </SafeAreaView>
  );
}

export function Button({ label, onPress, disabled, quiet, secondary, icon, name }: { label: string; onPress: () => void; disabled?: boolean; quiet?: boolean; secondary?: boolean; icon?: ReactNode; /** Accessible name when it differs. */ name?: string }) {
  return (
    <Press label={name ?? label} onPress={onPress} disabled={disabled} quiet={quiet} style={{ height: 56, borderRadius: 10, flexDirection: 'row', gap: 10, backgroundColor: secondary ? '#ffffff0f' : glow.amber, borderWidth: secondary ? 1 : 0, borderColor: '#ffffff1f' }}>
      {icon}
      <GText bold size={17} color={secondary ? glow.ink : '#201400'}>{label}</GText>
    </Press>
  );
}
export function TextLink({ label, onPress, color = glow.amber, disabled }: { label: string; onPress: () => void; color?: string; disabled?: boolean }) {
  return <Press label={label} onPress={onPress} disabled={disabled} style={{ alignSelf: 'flex-start', minHeight: 32 }}><GText size={T.small} bold color={color}>{label}</GText></Press>;
}
export function Or() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: '#ffffff14' }} /><Small>or</Small><View style={{ flex: 1, height: 1, backgroundColor: '#ffffff14' }} />
    </View>
  );
}
/** One quiet message where something else would be: errors, connection, saved actions. */
export function Note({ children, action, busy = false }: { children: ReactNode; action?: { label: string; onPress: () => void; disabled?: boolean }; busy?: boolean }) {
  return (
    <View accessibilityLiveRegion="polite" aria-busy={busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#201c13' }}>
      {busy ? <ActivityIndicator testID="note-spinner" size="small" color={glow.amber} /> : null}
      <GText size={12} lines={2} style={{ flex: 1 }}>{children}</GText>
      {action ? <Press label={action.label} onPress={action.onPress} disabled={action.disabled} style={{ minHeight: 32 }}><GText size={12} bold>{action.label}</GText></Press> : null}
    </View>
  );
}

/** Round switch. Disabled switches stay visible (the host decides) and are announced as disabled. */
export function Switch({ on, label, onPress, disabled = false }: { on: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on, disabled }} aria-checked={on} aria-disabled={disabled} disabled={disabled} onPress={onPress}
      style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: on ? glow.amber : '#ffffff26', alignItems: on ? 'flex-end' : 'flex-start', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer' } as ViewStyle}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? '#201400' : glow.soft }} />
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
