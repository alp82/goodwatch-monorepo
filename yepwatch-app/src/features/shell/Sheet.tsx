/**
 * A sheet over the page, below the app header (the header stays visible and usable): a bottom sheet
 * on phones, a centered panel on bigger windows. Its action sits inside the sheet. Close, a tap on
 * the shade, Escape (web), Android back and the iOS edge swipe close it. Announced as a modal dialog.
 *
 * Render it in a frame's `sheet` slot (AppFrame or the room Screen), which places it over the body
 * and makes the page underneath inert.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../components/ui';
import { EdgeBack } from '../glow/EdgeBack';
import { GText, Icon, Press, glow, native } from '../glow/theme';
import { useLayout } from './layout';
import { closeTopSheet, isTopSheet, registerSheet } from './sheet-stack';
import { R, warm } from './tokens';

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

export function Sheet({ title, onClose, children, actions, testID, width = 680 }: SheetProps) {
  const { width: windowWidth, phone, z } = useLayout();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [enter] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: reduced ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [enter, reduced]);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  // Open over the screen in front: the screen knows it's covered (voting holds its answers and clock).
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
  const panelWidth = phone ? windowWidth : Math.min(z(width), windowWidth - 64);
  const rise = enter.interpolate({ inputRange: [0, 1], outputRange: [phone ? 60 : 16, 0] });
  return (
    <View testID={testID ? `${testID}-layer` : undefined} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, justifyContent: phone ? 'flex-end' : 'flex-start', alignItems: 'center', paddingTop: phone ? 0 : z(40), paddingBottom: phone ? 0 : z(32) }}>
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000000b3', opacity: enter }}>
        <Pressable accessible={false} importantForAccessibility="no" onPress={onClose} style={[{ flex: 1 }, Platform.OS === 'web' ? ({ cursor: 'default' } as unknown as ViewStyle) : null]} />
      </Animated.View>
      <Animated.View testID={testID} role="dialog" aria-modal aria-label={title} accessibilityViewIsModal
        style={{ width: panelWidth, maxHeight: phone ? '92%' : '100%', flexShrink: 1, backgroundColor: warm.panel, borderColor: warm.lineStrong, borderWidth: 1, ...(phone ? { borderBottomWidth: 0, borderTopLeftRadius: R.card, borderTopRightRadius: R.card } : { borderRadius: R.card }), opacity: enter, transform: [{ translateY: rise }], overflow: 'hidden' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flexShrink: 1 }}>
          {phone ? <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#ffffff26' }} /></View> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: z(20), paddingRight: 8, paddingTop: phone ? 4 : 10, minHeight: 52 }}>
            <GText bold size={z(22)} lines={1} style={{ flex: 1, letterSpacing: -0.5 }}>{title}</GText>
            <Press label="Close" onPress={onClose} style={{ width: 44, height: 44, borderRadius: R.control }}><Icon name="close" size={20} color={glow.soft} /></Press>
          </View>
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss}
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
