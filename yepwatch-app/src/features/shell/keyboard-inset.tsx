/**
 * Android draws edge to edge (Android 15 enforces it, Expo turns it on everywhere), so the window no longer shrinks
 * for the soft keyboard: `adjustResize` has no effect and the keyboard covers the bottom of the page, the pinned
 * main action included. A view that must stay above the keyboard pads its bottom by how far the keyboard reaches
 * into it. iOS keeps KeyboardAvoidingView; the web has no soft keyboard events.
 */
import { useCallback, useEffect, useRef, useState, type ElementRef, type ReactNode } from 'react';
import { keyboardOverlap } from './keyboard-overlap';
import { Keyboard, KeyboardAvoidingView, Platform, View, type KeyboardMetrics, type StyleProp, type ViewStyle } from 'react-native';

export const keyboardInsetActive = Platform.OS === 'android';


/**
 * `attach` (a callback ref) goes on the view to keep clear of the keyboard, `onLayout` on the same view; pad its bottom by `inset`.
 * Always 0 off Android.
 */
export function useKeyboardInset() {
  const node = useRef<ElementRef<typeof View> | null>(null);
  const attach = useCallback((view: ElementRef<typeof View> | null) => { node.current = view; }, []);
  const keyboard = useRef<KeyboardMetrics | null>(null);
  const [inset, setInset] = useState(0);
  const measure = useCallback(() => {
    const metrics = keyboard.current;
    if (!metrics) { setInset(0); return; }
    node.current?.measureInWindow((_x, y, _width, height) => {
      if (keyboard.current === metrics) setInset(keyboardOverlap(y, height, metrics));
    });
  }, []);
  useEffect(() => {
    if (!keyboardInsetActive) return;
    // Opened with the keyboard already up (a field kept focus across the navigation).
    if (Keyboard.isVisible()) { keyboard.current = Keyboard.metrics() ?? null; measure(); }
    const shown = Keyboard.addListener('keyboardDidShow', (e) => { keyboard.current = e.endCoordinates; measure(); });
    const hidden = Keyboard.addListener('keyboardDidHide', () => { keyboard.current = null; setInset(0); });
    return () => { shown.remove(); hidden.remove(); };
  }, [measure]);
  // The padding sits inside the view, so its frame (and this measurement) doesn't move with it.
  const onLayout = useCallback(() => { if (keyboard.current) measure(); }, [measure]);
  return { attach, inset, onLayout };
}

/**
 * The part of a page that keeps clear of the keyboard: on Android a view padded by `keyboard.inset`
 * (useKeyboardInset), on iOS KeyboardAvoidingView (padding), elsewhere a plain view.
 */
export function KeyboardRoom({ attach, onLayout, inset, style, children }: ReturnType<typeof useKeyboardInset> & { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  if (keyboardInsetActive) return <View ref={attach} onLayout={onLayout} style={[style, { paddingBottom: inset }]}>{children}</View>;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={style}>{children}</KeyboardAvoidingView>;
}
