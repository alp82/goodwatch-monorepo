import { useCallback, useEffect, useState, type ReactNode, type ComponentRef } from 'react';
import { Animated, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { peerColor } from '../glow/model';
import { GText, Icon, Press, glow, native, type IconName } from '../glow/theme';
import { COLUMN, R } from './tokens';

export function Chip({ children, gold = false }: { children: ReactNode; gold?: boolean }) {
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: gold ? '#fbbf241f' : '#ffffff0d', borderWidth: 1, borderColor: gold ? '#fbbf2440' : '#ffffff14' }}>
      <GText size={12} color={gold ? glow.amber : glow.soft} lines={1}>{children}</GText>
    </View>
  );
}
export function RoundButton({ label, icon, onPress, dot = false, disabled }: { label: string; icon: IconName; onPress: () => void; dot?: boolean; disabled?: boolean }) {
  return (
    <Press label={label} onPress={onPress} disabled={disabled} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff0d', borderWidth: 1, borderColor: '#ffffff14' }}>
      <Icon name={icon} size={20} color={glow.soft} />
      {dot && <View style={{ position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: glow.amber, borderWidth: 2, borderColor: glow.bg }} />}
    </Press>
  );
}
/** Your own avatar: amber initial once a nickname is known, a quiet outline before. */
export function Avatar({ name, size = 36 }: { name: string | null; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: name ? glow.amber : 'transparent', borderWidth: name ? 0 : 1, borderColor: '#ffffff40', alignItems: 'center', justifyContent: 'center' }}>
      {name ? <GText bold size={size * 0.42} color="#141008">{name[0].toUpperCase()}</GText> : <Icon name="people" size={size * 0.48} color={glow.soft} />}
    </View>
  );
}
/** Overlapping initials in each person's room colour; people who left are dimmed. */
export function FaceStack({ people, size = 24, max = 4 }: { people: { id: string; nickname: string; dropped?: boolean; self?: boolean }[]; size?: number; max?: number }) {
  return (
    <View accessibilityLabel={`${people.filter((p) => !p.dropped).length} people`} style={{ flexDirection: 'row', alignItems: 'center' }}>
      {people.slice(0, max).map((p, i) => (
        <View key={p.id} style={{ width: size, height: size, borderRadius: size / 2, marginLeft: i ? -size * 0.28 : 0, backgroundColor: p.self ? glow.amber : peerColor(p.id), borderWidth: 2, borderColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center', opacity: p.dropped ? 0.35 : 1 }}>
          <GText bold size={size * 0.42} color="#141008">{(p.nickname || '?')[0].toUpperCase()}</GText>
        </View>
      ))}
      {people.length > max && <GText size={12} color={glow.muted} style={{ marginLeft: 5 }}>+{people.length - max}</GText>}
    </View>
  );
}
export function Thumb({ uri, width = 34, style }: { uri: string; width?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width, height: width * 1.5, borderRadius: 6, overflow: 'hidden', backgroundColor: '#262626', borderWidth: 1, borderColor: '#ffffff1f' }, style]}>
      <Image source={{ uri: uri.replace('/w500/', '/w185/') }} accessible={false} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
/** Primary (amber) and secondary (outlined) actions; flat, 10 px corners. */
export function Action({ label, name, onPress, gold = false, icon, style, disabled, small = false, testID }: { label: string; /** Accessible name when it differs from the visible label. */ name?: string; onPress: () => void; gold?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; disabled?: boolean; small?: boolean; testID?: string }) {
  return (
    <Press label={name ?? label} onPress={onPress} disabled={disabled} style={[{ minHeight: small ? 44 : 54, borderRadius: R.control, paddingHorizontal: 18, flexDirection: 'row', gap: 8, backgroundColor: gold ? glow.amber : '#ffffff0f', borderWidth: 1, borderColor: gold ? glow.amber : '#ffffff1f' }, style]}>
      {icon && <Icon name={icon} size={18} color={gold ? '#201400' : glow.ink} />}
      <GText bold size={small ? 15 : 17} color={gold ? '#201400' : glow.ink}>{label}</GText>
      {testID ? <View testID={testID} /> : null}
    </Press>
  );
}
export function Label({ children }: { children: string }) {
  return <GText bold size={13} color={glow.muted} style={{ letterSpacing: 1.2 }}>{children.toUpperCase()}</GText>;
}

/**
 * A panel takes over the body below the subheader (the view underneath stays mounted), so the
 * header and Back stay usable. The footer never scrolls away. Drag the list, tap outside a field,
 * or press the keyboard's Done to dismiss the keyboard.
 */
export function Panel({ children, footer, testID }: { children: ReactNode; footer?: ReactNode; testID?: string }) {
  const reduced = useReducedMotion();
  const [y] = useState(() => new Animated.Value(reduced ? 0 : 1));
  useEffect(() => { Animated.timing(y, { toValue: 0, duration: reduced ? 0 : 180, useNativeDriver: native }).start(); }, [y, reduced]);
  return (
    <Animated.View testID={testID} role="dialog" accessibilityViewIsModal style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, backgroundColor: glow.bg, opacity: y.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) }] }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%', maxWidth: COLUMN.maxWidth, alignSelf: 'center', borderTopWidth: 1, borderTopColor: glow.line }}>
        <Pressable
          accessible={false}
          onPress={(e) => {
            // Web clicks inside a field bubble here; only taps outside fields dismiss.
            const target = e.nativeEvent.target as unknown as { closest?: (q: string) => unknown };
            if (Platform.OS === 'web' && target?.closest?.('input,textarea,button,a,[role=button],[role=checkbox],[role=link]')) return;
            Keyboard.dismiss();
          }}
          style={{ flex: 1, minHeight: 0, cursor: 'auto' } as ViewStyle}
        >
          <ScrollView style={{ flex: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: COLUMN.inset, paddingTop: 16, paddingBottom: 20, gap: 16 }}>
            {children}
          </ScrollView>
        </Pressable>
        {footer && <View style={{ flexShrink: 0, paddingHorizontal: COLUMN.inset, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: glow.line, gap: 8 }}>{footer}</View>}
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

/** Preserve layout under panels, while excluding covered controls from focus and touches. */
export function CoveredBody({ covered, children }: { covered: boolean; children: ReactNode }) {
  const attach = useCallback((node: ComponentRef<typeof View> | null) => {
    if (Platform.OS === 'web' && node) (node as unknown as HTMLElement).inert = covered;
  }, [covered]);
  return <View ref={attach} testID="covered-body" pointerEvents={covered ? 'none' : 'auto'} aria-hidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={covered} style={{ flex: 1, minHeight: 0 }}>{children}</View>;
}
