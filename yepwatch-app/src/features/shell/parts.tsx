import { useCallback, useEffect, useState, type ReactNode, type ComponentRef } from 'react';
import { Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { peerColor } from '../glow/model';
import { GText, Icon, Press, glow, native, type IconName } from '../glow/theme';
import { R } from './tokens';

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
/** The pulsing green dot of an open room. */
export function LiveDot({ size = 8 }: { size?: number }) {
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return (
    <View accessible={false} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {!reduced && <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: glow.green, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }] }} />}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: glow.green }} />
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
/** Preserve layout under panels, while excluding covered controls from focus and touches. */
export function CoveredBody({ covered, children, style, testID = 'covered-body' }: { covered: boolean; children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const attach = useCallback((node: ComponentRef<typeof View> | null) => {
    if (Platform.OS === 'web' && node) (node as unknown as HTMLElement).inert = covered;
  }, [covered]);
  return <View ref={attach} testID={testID} pointerEvents={covered ? 'none' : 'auto'} aria-hidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={covered} style={style ?? { flex: 1, minHeight: 0 }}>{children}</View>;
}
