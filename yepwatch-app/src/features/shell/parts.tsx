import { useCallback, useEffect, useState, type ReactNode, type ComponentRef } from 'react';
import { Animated, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { peerColor } from '../glow/model';
import { GText, Icon, Press, glow, grow, native, type IconName } from '../glow/theme';
import { claimLiveBeat, releaseLiveBeat } from './live-beat';
import { playLivePulse } from './live-pulse';
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
  const here = people.filter((p) => !p.dropped).length;
  // One picture with one name: a label on a plain group is not allowed on the web (axe aria-prohibited-attr).
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={here === 1 ? '1 person' : `${here} people`} style={{ flexDirection: 'row', alignItems: 'center' }}>
      {people.slice(0, max).map((p, i) => (
        <View key={p.id} style={{ width: size, height: size, borderRadius: size / 2, marginLeft: i ? -size * 0.28 : 0, backgroundColor: p.self ? glow.amber : peerColor(p.id), borderWidth: 2, borderColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center', opacity: p.dropped ? 0.35 : 1 }}>
          <GText bold size={size * 0.42} color="#141008">{(p.nickname || '?')[0].toUpperCase()}</GText>
        </View>
      ))}
      {people.length > max && <GText size={12} color={glow.muted} style={{ marginLeft: 5 }}>+{people.length - max}</GText>}
    </View>
  );
}
/**
 * The green dot of an open room. It rings three times when it appears, or when `beat` changes (the
 * room's opening and each join), then stays solid: nothing animates in between. A `beat` rings once
 * across every header showing it; null never rings (a header under another page). Reduced motion:
 * never rings.
 */
export function LiveDot({ size = 8, beat }: { size?: number; beat?: string | null }) {
  const reduced = useReducedMotion();
  // 0 is also where a JS-driven loop (the web) resets each ring to. At 0 the ring sits exactly under
  // the dot and at 1 it's transparent: both read as a solid dot.
  const [ring] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced || beat === null || (beat !== undefined && !claimLiveBeat(beat))) {
      ring.setValue(0); // a ring cut short here (this page went under another) doesn't stay half grown
      return;
    }
    // Ended, the ring rests at scale 2.8 and opacity 0: drawn once, then nothing changes.
    const stop = playLivePulse(ring, native);
    return () => {
      const ended = stop();
      // Cut short (the header went away or went under another page): the next header may ring it.
      if (!ended && beat !== undefined) releaseLiveBeat(beat);
    };
  }, [ring, reduced, beat]);
  return (
    <View accessible={false} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {!reduced && beat !== null && <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: glow.green, opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }] }} />}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: glow.green }} />
    </View>
  );
}
/** Primary (amber) and secondary (outlined) actions; flat, 10 px corners. */
export function Action({ label, name, onPress, gold = false, icon, style, disabled, small = false, testID }: { label: string; /** Accessible name when it differs from the visible label. */ name?: string; onPress: () => void; gold?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; disabled?: boolean; small?: boolean; testID?: string }) {
  return (
    <Press label={name ?? label} onPress={onPress} disabled={disabled} style={[{ alignItems: 'stretch' }, small ? grow(44) : null, style]}
      visual={{ minHeight: small ? 44 : 54, borderRadius: R.control, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: gold ? glow.amber : '#ffffff0f', borderWidth: 1, borderColor: gold ? glow.amber : '#ffffff1f' }}>
      {icon && <Icon name={icon} size={18} color={gold ? '#201400' : glow.ink} />}
      <GText bold size={small ? 15 : 17} color={gold ? '#201400' : glow.ink}>{label}</GText>
      {testID ? <View testID={testID} /> : null}
    </Press>
  );
}
/**
 * Preserve layout under panels, while excluding covered controls from focus and touches.
 * `keepView`: always its own native view. Uncovered it has no props that need one, so Fabric flattens it
 * away and moves its children to the parent in the same commit. A screen's sheets close right before
 * the screen leaves (Leave room, Archive room), and that move on a screen the stack is taking away made
 * Android's mounting fail ("view already has a parent"), which tore React Native down: a black window.
 */
export function CoveredBody({ covered, children, style, testID = 'covered-body', keepView = false }: { covered: boolean; children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string; keepView?: boolean }) {
  const attach = useCallback((node: ComponentRef<typeof View> | null) => {
    if (Platform.OS === 'web' && node) (node as unknown as HTMLElement).inert = covered;
  }, [covered]);
  return <View ref={attach} testID={testID} collapsable={!keepView} pointerEvents={covered ? 'none' : 'auto'} aria-hidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={covered} style={style ?? { flex: 1, minHeight: 0 }}>{children}</View>;
}
