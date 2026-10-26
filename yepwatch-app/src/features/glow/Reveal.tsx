/**
 * The end-of-selection moment, once per decision: the chosen poster is pulled into a film gate
 * (sprockets), the clapper snaps shut on TONIGHT, the dark screen lights up with one projector sweep,
 * and a soft amber glow settles. About 1.5 s; provider links and Start again work from the first frame.
 * Reduced motion renders the settled frame only. Local Animated views, no assets.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GText, glow, native } from '../glow/theme';
import { useMotionPreference } from '../../components/ui';
import { R } from '../shell/tokens';

const STICK = 11;
const BOARD = 22;
export const CLAPPER_HEIGHT = STICK + BOARD + 8;

export function FilmReveal({ width, height, play, onPlay, children }: { width: number; height: number; play: boolean; onPlay: () => void; children: ReactNode }) {
  // The platform preference arrives asynchronously (null until known); decide only once it is known.
  const system = useMotionPreference();
  const off = system;
  const [fresh] = useState(play);
  const [t] = useState(() => new Animated.Value(fresh ? 0 : 1));
  const started = useRef(false);
  useEffect(() => { if (fresh) onPlay(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (off === null || started.current) return;
    started.current = true;
    if (!fresh || off) { t.setValue(1); return; }
    Animated.timing(t, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: native }).start();
  }, [off, fresh, t]);
  const clamp = 'clamp' as const;
  const holes = Math.max(4, Math.floor(height / 18));
  const strip = (side: 'left' | 'right') => (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, [side]: -15, width: 10, height, borderRadius: 3, backgroundColor: '#14110b', borderWidth: 1, borderColor: '#fbbf2426', alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 4,
      opacity: t.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 1, 0.5], extrapolate: clamp }),
      transform: [{ translateY: t.interpolate({ inputRange: [0, 0.55], outputRange: [-26, 0], extrapolate: clamp }) }] }}>
      {Array.from({ length: holes }, (_, i) => <View key={i} style={{ width: 5, height: 7, borderRadius: 1.5, backgroundColor: glow.bg }} />)}
    </Animated.View>
  );
  return (
    <View accessibilityLabel="Tonight’s pick" style={{ width, alignItems: 'center' }}>
      {/* Clapper: the striped stick snaps shut on the TONIGHT board. */}
      <Animated.View style={{ width: Math.max(150, width * 0.8), height: CLAPPER_HEIGHT, justifyContent: 'flex-end', paddingBottom: 8, opacity: t.interpolate({ inputRange: [0, 0.08], outputRange: [0, 1], extrapolate: clamp }) }}>
        <Animated.View nativeID="tonight-clapper" style={{ height: STICK, borderRadius: 2, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: '#000', flexDirection: 'row', transformOrigin: 'left bottom',
          transform: [{ rotate: t.interpolate({ inputRange: [0, 0.18, 0.27, 0.33, 0.4], outputRange: ['-24deg', '-24deg', '0deg', '-3deg', '0deg'], extrapolate: clamp }) }] }}>
          {Array.from({ length: 14 }, (_, i) => <View key={i} style={{ width: 9, height: STICK * 2, marginLeft: 9, marginTop: -STICK / 2, backgroundColor: glow.amber, transform: [{ rotate: '-35deg' }] }} />)}
        </Animated.View>
        <View style={{ height: BOARD, borderRadius: 3, backgroundColor: '#111', borderWidth: 1, borderColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          <GText bold size={12} color={glow.amber} style={{ letterSpacing: 3 }}>TONIGHT</GText>
        </View>
      </Animated.View>
      <View style={{ width, height }}>
        {/* Projector glow settles behind the screen. */}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -10, right: -10, top: -10, bottom: -10, borderRadius: R.card + 8, backgroundColor: '#fbbf2410', shadowColor: glow.amber, shadowRadius: 36, shadowOpacity: 0.55, shadowOffset: { width: 0, height: 0 },
          opacity: t.interpolate({ inputRange: [0.25, 0.6, 1], outputRange: [0, 1, 0.45], extrapolate: clamp }) }} />
        {strip('left')}
        {strip('right')}
        <Animated.View style={{ width, height, borderRadius: R.card, overflow: 'hidden', borderWidth: 1, borderColor: '#fbbf2466', backgroundColor: '#222',
          transform: [{ scale: t.interpolate({ inputRange: [0, 0.3, 0.75, 1], outputRange: [0.95, 0.95, 1.015, 1], extrapolate: clamp }) }] }}>
          {children}
          {/* Dark screen until the projector lights it. */}
          <Animated.View nativeID="tonight-dark" pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#050403', opacity: t.interpolate({ inputRange: [0, 0.28, 0.62], outputRange: [0.92, 0.92, 0], extrapolate: clamp }) }} />
          {/* One projector sweep across the screen. */}
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -height * 0.2, height: height * 1.4, width: width * 0.5,
            opacity: t.interpolate({ inputRange: [0.34, 0.44, 0.72, 0.84], outputRange: [0, 0.75, 0.75, 0], extrapolate: clamp }),
            transform: [{ translateX: t.interpolate({ inputRange: [0.34, 0.84], outputRange: [-width * 0.6, width * 1.1], extrapolate: clamp }) }, { rotate: '14deg' }] }}>
            <LinearGradient colors={['#fff4d600', '#fff4d6aa', '#fff4d600']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}
