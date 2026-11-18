/**
 * Taste mode (rethink.md screen 3): one layer over every screen, opened from the profile. It grows out of the control
 * that opened it and shrinks back into it on Done. Amber bar, warm backdrop, the profile's strength (or, for members,
 * "Using your GoodWatch taste"), then one live Taste card at a time. Answers stay in YepWatch; they go to the profile
 * as they're given and the rest on Done.
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Easing, Platform, ScrollView, View, findNodeHandle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../components/ui';
import { useAccount } from '../../core/continuous/account';
import { tasteProfile, useTasteProfile } from '../../core/continuous/taste-profile';
import { ErrorText, GText, Icon, glow, native } from '../glow/theme';
import { HoverPress } from '../shell/hover';
import { GoodWatchG } from '../shell/marks';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';
import { TASTE_ANSWERS } from './answers';
import { StrengthMeter } from './StrengthMeter';
import { LiveDeck, useTasteCards, type DrawCard } from './TasteDeck';
import { TasteCard } from './TasteCard';
import { tasteMode, useTasteMode, type Origin } from './taste-mode';

const drawCard: DrawCard = (t, o) => <TasteCard t={t} w={o.w} answers={TASTE_ANSWERS} onAnswer={o.onAnswer} disabled={o.disabled} dragPicture={!o.disabled} />;

export function TasteModeLayer() {
  const { open } = useTasteMode();
  // Mounted only while open: every opening deals a fresh deck.
  return open ? <TasteMode /> : null;
}

/** A link-styled action (Undo, Done on the end card). */
export function TextAction({ label, onPress, color = glow.muted }: { label: string; onPress: () => void; color?: string }) {
  const { z } = useLayout();
  return <HoverPress label={label} hover="tint" onPress={onPress} style={{ minHeight: 48, paddingHorizontal: 12, borderRadius: R.control }}><GText bold size={z(14)} color={color}>{label}</GText></HoverPress>;
}

function TasteMode() {
  const { origin } = useTasteMode();
  const { phone, z, gutter, header, width, height } = useLayout();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const account = useAccount();
  const profile = useTasteProfile();
  const deck = useTasteCards(10);
  const [v] = useState(() => new Animated.Value(0));
  const closing = useRef(false);
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: reduced ? 160 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [v, reduced]);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    void tasteProfile.flush();
    Animated.timing(v, { toValue: 0, duration: reduced ? 140 : 300, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(() => tasteMode.close());
  };
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => { closeRef.current(); return true; });
      return () => sub.remove();
    }
    if (Platform.OS !== 'web') return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, []);
  // A modal dialog (the navigator under it is inert, _layout.tsx): focus moves into it on open and back to the control
  // that opened it on close. Tab stays inside, since nothing else on the page takes focus.
  const dialog = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    const node = dialog.current;
    if (Platform.OS !== 'web') {
      const handle = node ? findNodeHandle(node) : null;
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      return;
    }
    const el = node as unknown as HTMLElement | null;
    const opener = document.activeElement instanceof HTMLElement && !el?.contains(document.activeElement) ? document.activeElement : null;
    if (el) { el.tabIndex = -1; el.style.outline = 'none'; el.focus({ preventScroll: true }); }
    return () => {
      // After this commit: the page under it stops being inert in the same commit, then the opener can take focus.
      requestAnimationFrame(() => { if (opener?.isConnected && (!document.activeElement || document.activeElement === document.body)) opener.focus({ preventScroll: true }); });
    };
  }, []);
  const grow = growFrom(origin, width, height, v, reduced);
  const rated = profile.rated ?? 0;
  const content = (
    <>
      <View style={{ minHeight: 56, padding: 10, paddingLeft: 12, borderRadius: 12, backgroundColor: '#00000055', borderWidth: 1, borderColor: warm.line, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {account.member ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <GoodWatchG size={z(18)} />
            <GText bold size={z(15)}>Using your GoodWatch taste</GText>
          </View>
        ) : <View style={{ flex: 1 }}><StrengthMeter rated={rated} compact /></View>}
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
        {deck.loading ? <View style={{ minHeight: phone ? 380 : z(520) }} /> : deck.failed ? (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 40 }}>
            <ErrorText bold size={z(18)}>Cards didn’t load</ErrorText>
            <TextAction label="Try again" color={glow.amber} onPress={deck.retry} />
          </View>
        ) : (
          <LiveDeck current={deck.current} index={deck.index} answered={deck.answered} onAnswer={deck.answer} draw={drawCard}
            end={(
              <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
                <Icon name="check" size={30} color={glow.amber} />
                <GText bold size={z(20)}>That’s all for now</GText>
                <TextAction label="Done" color={glow.amber} onPress={close} />
              </View>
            )} />
        )}
        {/* Fixed height: Undo coming and going moves nothing. */}
        <View style={{ height: 48, alignItems: 'center' }}>{deck.answered.length && !deck.done ? <TextAction label="Undo" onPress={deck.undo} /> : null}</View>
      </View>
    </>
  );
  return (
    <View ref={dialog} testID="taste-mode" role="dialog" aria-modal aria-label="Taste mode" accessibilityViewIsModal style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 80 }}>
      <Animated.View style={{ flex: 1, overflow: 'hidden', backgroundColor: glow.bg, opacity: grow.shell, transform: grow.transform }}>
        <LinearGradient colors={['#3a2a0e', '#1a140a', '#0a0907']} locations={[0, 0.45, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
        <Animated.View style={{ flex: 1, opacity: grow.content, paddingTop: insets.top }}>
          <View style={{ height: header, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: phone ? gutter - 4 : gutter, borderBottomWidth: 1, borderBottomColor: warm.amberLine }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: z(28), paddingHorizontal: 10, borderRadius: 8, backgroundColor: glow.amber }}>
              <Icon name="heartFilled" size={z(14)} color={warm.ink} />
              {/* The approved amber tab shows in capitals; the text itself (what screen readers say) is sentence case. */}
              <GText bold size={z(13)} color={warm.ink} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>Taste mode</GText>
            </View>
            <GText bold size={z(16)} lines={1} style={{ flex: 1 }}>Tune your taste</GText>
            <HoverPress label="Done" hint="Your answers are kept" onPress={close} style={{ minHeight: 48, paddingHorizontal: 8, borderRadius: R.control, flexDirection: 'row', gap: 6 }}>
              {phone ? null : <GText bold size={z(14)} color={glow.soft}>Done</GText>}
              <Icon name="close" size={20} color={glow.soft} />
            </HoverPress>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: gutter, paddingTop: 10, paddingBottom: (phone ? 16 : z(28)) + insets.bottom }}>
            <View style={{ flex: 1, width: '100%', maxWidth: z(620), alignSelf: 'center', gap: phone ? 14 : z(20) }}>{content}</View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Grows out of `origin` (scale and move, transform only); the content shows once the shape has mostly opened. */
function growFrom(origin: Origin | null, w: number, h: number, v: Animated.Value, reduced: boolean) {
  if (reduced || !origin || !w || !h) return { transform: [], shell: v, content: 1 as const };
  const dx = origin.x + origin.w / 2 - w / 2;
  const dy = origin.y + origin.h / 2 - h / 2;
  return {
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
      { scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [Math.max(0.05, origin.w / w), 1] }) },
      { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [Math.max(0.05, origin.h / h), 1] }) },
    ],
    shell: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
    content: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }),
  };
}
