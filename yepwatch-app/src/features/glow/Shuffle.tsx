import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { Wordmark, native } from './theme';

/**
 * Original riffle-and-deal shuffle (inspired by card-shuffle effects in general, no third-party source).
 * Runs only while prepared cards are pending and unmounts the moment they are ready.
 */
export function Shuffle({ width, height }: { width: number; height: number }) {
  const off = useReducedMotion();
  const [t] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: off ? 160 : 120, useNativeDriver: native }).start();
    if (off) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [off, t, fade]);
  const w = width * 0.82, h = height * 0.82;
  const cards = [0, 1, 2, 3, 4, 5];
  return (
    <Animated.View accessibilityLabel="Shuffling cards" accessibilityRole="progressbar" style={{ width, height, alignItems: 'center', justifyContent: 'center', opacity: fade }}>
      {cards.map((i) => {
        const side = i % 2 ? 1 : -1;
        const lift = (i % 3) * 6;
        const transform = off
          ? [{ rotate: `${(i - 2.5) * 2}deg` }, { translateY: -i * 2 }]
          : [
              { translateX: t.interpolate({ inputRange: [0, 0.3, 0.55, 0.8, 1], outputRange: [0, side * w * 0.42, side * w * 0.16, 0, 0] }) },
              { translateY: t.interpolate({ inputRange: [0, 0.3, 0.55, 0.8, 1], outputRange: [-i * 2, -i * 2 - lift, -18 - i * 3, -i * 2, -i * 2] }) },
              { rotate: t.interpolate({ inputRange: [0, 0.3, 0.55, 0.8, 1], outputRange: ['0deg', `${side * (8 + i)}deg`, `${-side * 4}deg`, '0deg', '0deg'] }) },
              { scale: t.interpolate({ inputRange: [0, 0.3, 0.8, 1], outputRange: [1, 0.96, 1, 1] }) },
            ];
        return (
          <Animated.View key={i} style={{ position: 'absolute', width: w, height: h, borderRadius: 22, backgroundColor: '#17140f', borderWidth: 1, borderColor: i === cards.length - 1 ? '#fbbf2499' : '#fbbf2433', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, transform }}>
            <View style={{ position: 'absolute', left: 10, right: 10, top: 10, bottom: 10, borderRadius: 16, borderWidth: 1, borderColor: '#fbbf241f' }} />
            {i === cards.length - 1 && <Wordmark size={Math.min(30, w * 0.13)} />}
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}
