/**
 * A sheet over the page, below the app header (the header stays visible and usable): a bottom sheet
 * on phones, a centered panel on bigger windows. Its action sits inside the sheet. Close, a tap on
 * the shade, Escape (web), Android back and the iOS edge swipe close it. Announced as a modal dialog.
 *
 * Render it in a frame's `sheet` slot (AppFrame or the room Screen), which places it over the body
 * and makes the page underneath inert.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../components/ui';
import { EdgeBack } from '../glow/EdgeBack';
import { GText, Icon, Press, glow, native, onePress } from '../glow/theme';
import { keyboardDismissMode, useLayout } from './layout';
import { closeTopSheet, isTopSheet, registerSheet } from './sheet-stack';
import { R, warm } from './tokens';
import { useFreshSurface } from './fresh-surface';

export interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** The sheet's action row (Save, New room …), inside the sheet under its content. */
  actions?: ReactNode;
  testID?: string;
  /** Widest the desktop panel gets before scaling (default 680). */
  width?: number;
}

/**
 * Puts a layer that covers the screen (a Sheet, or a page over the screen such as title details) on the
 * sheet stack while its screen is focused: every kind of Back (header, Android, browser history, the
 * edge swipe) and Escape (web) close it before going anywhere, and the screen knows it's covered.
 */
export function useSheetEntry(onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    const { entry, remove } = registerSheet(() => close.current());
    if (Platform.OS === 'android') {
      // The sheet on top closes (a screen's back handler registered after this one does the same).
      const sub = BackHandler.addEventListener('hardwareBackPress', closeTopSheet);
      return () => { sub.remove(); remove(); };
    }
    if (Platform.OS !== 'web') return remove;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && isTopSheet(entry)) close.current(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); remove(); };
  }, [focused]);
}

/**
 * The tap-to-close area around a sheet: a plain touch surface, not a button, so it adds no unnamed
 * control for screen readers or keyboards (the sheet's Close is the accessible way out).
 */
export function Shade({ onPress, style }: { onPress: () => void; style?: ViewStyle }) {
  return (
    Platform.OS === 'web'
      // Out of the tab order and the accessibility tree; still a normal press target for the pointer.
      ? <Pressable accessible={false} focusable={false} aria-hidden onPress={onPress} style={[{ flex: 1, cursor: 'default' } as unknown as ViewStyle, style]} />
      : <View accessible={false} importantForAccessibility="no" onStartShouldSetResponder={() => true} onResponderRelease={onPress} style={[{ flex: 1 }, style]} />
  );
}

/** How long after a pointerdown or keydown its answer may change the layout: inside the 500 ms the browser leaves out of layout shift. */
const INPUT_ANSWER_MS = 400;

export function Sheet({ title, onClose, children, actions, testID, width = 680 }: SheetProps) {
  const { width: windowWidth, height: windowHeight, phone, z } = useLayout();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [enter] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: reduced ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [enter, reduced]);
  useSheetEntry(onClose);
  useFreshSurface();
  const panelWidth = phone ? windowWidth : Math.min(z(width), windowWidth - 64);
  // A bottom sheet stands on the bottom edge, so content that gets shorter by itself while it's open (a GoodWatch
  // link landing takes the Continue with GoodWatch choice away) would pull its top edge down under the reader's
  // eyes. On the web it keeps the tallest height it had at this window size, the room left under its content,
  // unless it got shorter in answer to the person's own press (Fewer services).
  const [floor, setFloor] = useState({ at: '', height: 0 });
  const windowKey = `${windowWidth}x${windowHeight}`;
  const keepsHeight = phone && Platform.OS === 'web';
  // Once a press or key has done its work (click, keyup: the control pressed never moves before it acts), the sheet
  // takes its own height again for a moment and the floor is measured anew from it.
  const [answering, setAnswering] = useState(false);
  const answeringNow = useRef(false);
  useEffect(() => {
    if (!keepsHeight || typeof document === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The browser's window starts at the pointerdown or keydown; the release ends with it, however long the press.
    let downAt = -Infinity;
    const down = () => { downAt = performance.now(); };
    const input = () => {
      const left = INPUT_ANSWER_MS - (performance.now() - downAt);
      if (left <= 0) return;
      answeringNow.current = true;
      setAnswering(true);
      clearTimeout(timer);
      timer = setTimeout(() => { answeringNow.current = false; setAnswering(false); }, left);
    };
    const options = { capture: true, passive: true };
    document.addEventListener('pointerdown', down, options);
    document.addEventListener('keydown', down, options);
    document.addEventListener('click', input, options);
    document.addEventListener('keyup', input, options);
    return () => {
      clearTimeout(timer);
      answeringNow.current = false;
      setAnswering(false);
      document.removeEventListener('pointerdown', down, options);
      document.removeEventListener('keydown', down, options);
      document.removeEventListener('click', input, options);
      document.removeEventListener('keyup', input, options);
    };
  }, [keepsHeight]);
  const minHeight = keepsHeight && !answering && floor.at === windowKey ? floor.height : undefined;
  // Always attached (the web's layout observer is set up once, when the sheet mounts), even while it isn't used.
  const onPanelLayout = (e: LayoutChangeEvent) => {
    if (!keepsHeight) return;
    const height = e.nativeEvent.layout.height;
    setFloor((old) => (old.at === windowKey && old.height >= height && !answeringNow.current ? old : { at: windowKey, height }));
  };
  const rise = enter.interpolate({ inputRange: [0, 1], outputRange: [phone ? 60 : 16, 0] });
  return (
    <View testID={testID ? `${testID}-layer` : undefined} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, justifyContent: phone ? 'flex-end' : 'flex-start', alignItems: 'center', paddingTop: phone ? 0 : z(40), paddingBottom: phone ? 0 : z(32) }}>
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000000b3', opacity: enter }}>
        {/* A tap on the shade closes the sheet. Not a control of its own (screen readers have Close). */}
        <Shade onPress={onePress(onClose)} />
      </Animated.View>
      <Animated.View testID={testID} role="dialog" aria-modal aria-label={title} accessibilityViewIsModal onLayout={onPanelLayout}
        style={{ width: panelWidth, maxHeight: phone ? '92%' : '100%', minHeight, flexShrink: 1, backgroundColor: warm.panel, borderColor: warm.lineStrong, borderWidth: 1, ...(phone ? { borderBottomWidth: 0, borderTopLeftRadius: R.card, borderTopRightRadius: R.card } : { borderRadius: R.card }), opacity: enter, transform: [{ translateY: rise }], overflow: 'hidden' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flexShrink: 1, flexGrow: minHeight ? 1 : 0 }}>
          {phone ? <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#ffffff26' }} /></View> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: z(20), paddingRight: 8, paddingTop: phone ? 4 : 10, minHeight: 52 }}>
            <GText bold size={z(22)} lines={1} style={{ flex: 1, letterSpacing: -0.5 }}>{title}</GText>
            <Press label="Close" onPress={onClose} style={{ width: 48, height: 48, borderRadius: R.control }}><Icon name="close" size={20} color={glow.soft} /></Press>
          </View>
          <ScrollView style={{ flexGrow: minHeight ? 1 : 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode={keyboardDismissMode} onScrollBeginDrag={Keyboard.dismiss}
            contentContainerStyle={{ paddingHorizontal: z(20), paddingTop: 8, paddingBottom: actions ? 16 : 20 + (phone ? insets.bottom : 0), gap: 18 }}>
            {children}
          </ScrollView>
          {actions ? (
            <View style={{ paddingHorizontal: z(20), paddingTop: 12, paddingBottom: 16 + (phone ? insets.bottom : 0), borderTopWidth: 1, borderTopColor: warm.line, flexDirection: 'row', gap: 10 }}>{actions}</View>
          ) : null}
        </KeyboardAvoidingView>
      </Animated.View>
      <EdgeBack back={onClose} />
    </View>
  );
}
