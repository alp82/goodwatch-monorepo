/**
 * The Mood page while a new room is on its way: the same page, laid out where it will be, still.
 * The placeholder breathes, a light runs along the underline, the "or try" ideas wait faded, and the
 * main action carries the wait (the Start look). When the room is there, the Mood page takes over in
 * place. Transform and opacity only; reduced motion keeps everything still.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { useLayout } from '../shell/layout';
import { warm } from '../shell/tokens';
import { GText, glow, native } from '../glow/theme';
import { PRESETS, placeholderFit } from './MoodPage';
import { WorkingButton } from './StartProgress';
import { Actions, Screen, usePinnedActions } from './ui';

/** 0→1 on repeat. */
function useLoop(active: boolean, duration: number, reverse = false) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    v.setValue(0);
    if (!active) return;
    const ease = Easing.inOut(Easing.quad);
    const loop = reverse
      ? Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: ease, useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration, easing: ease, useNativeDriver: native }),
      ]))
      : Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: ease, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [active, duration, reverse, v]);
  return v;
}

export function MoodArriving({ label = 'Making your room', back }: { label?: string; back?: () => void }) {
  const { phone, max, z } = useLayout();
  const pinned = usePinnedActions();
  const reduced = useReducedMotion();
  const breathe = useLoop(!reduced, 1100, true);
  const run = useLoop(!reduced, 1400);
  const [rise] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) return;
    const a = Animated.timing(rise, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [rise, reduced]);
  const col = Math.min(max, z(980));
  const placeholder = placeholderFit(col, phone, z);
  const size = placeholder.size;
  const font = { fontFamily: 'GabaritoBold', fontSize: size, lineHeight: size * 1.2, letterSpacing: -size * 0.03 } as const;
  const [wordsWidth, setWordsWidth] = useState(0);
  const underline = Math.min(col, Math.max(wordsWidth, z(240)) + z(24));
  const light = Math.max(60, underline * 0.3);
  const action = <WorkingButton label={label} />;
  const chip = (preset: string) => (
    <View key={preset} style={{ minHeight: z(44), paddingHorizontal: z(17), borderRadius: 14, justifyContent: 'center', backgroundColor: '#ffffff07', borderWidth: 1, borderColor: warm.line }}>
      <GText size={phone ? 15 : z(17)} color={glow.soft}>{preset}</GText>
    </View>
  );
  return (
    <Screen testID="mood-arriving" back={back} pill={{ label: 'New room', state: 'new' }} width={col} gap={0} footer={pinned ? action : undefined}>
      <Animated.View style={{ gap: phone ? 30 : z(44), alignItems: 'center', opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
        <View style={{ width: '100%', alignItems: 'center' }}>
          <Animated.View style={{ paddingVertical: 8, alignItems: 'center', opacity: reduced ? 0.8 : breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }}>
            {placeholder.lines.map((l) => (
              <View key={l} onLayout={(e) => { const w = e.nativeEvent.layout.width; setWordsWidth((m) => Math.max(m, w)); }}>
                <GText bold size={size} color={warm.placeholder} lines={1} style={{ ...font, textAlign: 'center' }}>{l}</GText>
              </View>
            ))}
          </Animated.View>
          <View style={{ width: underline, height: 3, borderRadius: 1.5, marginTop: 8, backgroundColor: '#ffffff1f', overflow: 'hidden' }}>
            <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: light, borderRadius: 1.5, backgroundColor: glow.amber,
              opacity: reduced ? 0.6 : 1,
              transform: [{ translateX: reduced ? (underline - light) / 2 : run.interpolate({ inputRange: [0, 1], outputRange: [-light, underline] }) }] }} />
          </View>
        </View>
        <View style={{ gap: z(14), alignItems: 'center', alignSelf: 'stretch', opacity: 0.45 }} accessible={false} importantForAccessibility="no-hide-descendants">
          <GText size={z(14)} color={glow.muted}>or try</GText>
          {phone
            ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>{PRESETS.map(chip)}</View>
            : [PRESETS.slice(0, 4), PRESETS.slice(4)].map((row) => <View key={row[0]} style={{ flexDirection: 'row', justifyContent: 'center', gap: z(10) }}>{row.map(chip)}</View>)}
        </View>
        {!pinned ? <Actions style={{ width: Math.min(col, z(340)) }}>{action}</Actions> : null}
      </Animated.View>
    </Screen>
  );
}
