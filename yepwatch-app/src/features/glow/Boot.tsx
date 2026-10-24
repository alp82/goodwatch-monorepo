import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Text, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { glow, s } from './theme';

/** GoodWatch TV's boot rhythm: initial pops in, remaining letters reveal outward.
 * Runs once per app launch, independent of network/room loading; reduced motion fades only.
 */
export function Boot({ ready, done, onLayout }: { ready: boolean; done: () => void; onLayout: () => void }) {
  const size = useWindowDimensions().width < 360 ? 52 : 64;
  const reduced = useReducedMotion();
  const [lettersWidth, setLettersWidth] = useState(0);
  const [pop] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!ready || !lettersWidth) return;
    pop.setValue(reduced ? 1 : 0);
    reveal.setValue(reduced ? 1 : 0);
    opacity.setValue(reduced ? 0 : 1);
    const easing = Easing.bezier(0.16, 1, 0.3, 1);
    const animation = reduced
      ? Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: false })
      : Animated.parallel([
          Animated.sequence([Animated.delay(200), Animated.timing(pop, { toValue: 1, duration: 700, easing, useNativeDriver: false })]),
          Animated.sequence([Animated.delay(600), Animated.timing(reveal, { toValue: 1, duration: 600, easing, useNativeDriver: false })]),
        ]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    animation.start(({ finished }) => { if (finished) timer = setTimeout(done, reduced ? 0 : 300); });
    return () => { animation.stop(); if (timer) clearTimeout(timer); };
  }, [ready, lettersWidth, reduced, done, pop, reveal, opacity]);
  const type = { fontFamily: 'GabaritoBold', fontSize: size, lineHeight: size * 1.2, color: glow.ink, letterSpacing: -0.8 };
  const letters = <Text numberOfLines={1} style={type}>ep<Text style={{ color: glow.amber }}>Watch</Text></Text>;
  return <View testID="yepwatch-boot" accessibilityLabel="YepWatch is starting" onLayout={onLayout}
    style={[s.absolute, { zIndex: 100, backgroundColor: glow.bg, alignItems: 'center', justifyContent: 'center' }]}>
    {ready ? <>
      <View pointerEvents="none" accessibilityElementsHidden aria-hidden style={{ position: 'absolute', opacity: 0 }}
        onLayout={event => setLettersWidth(Math.ceil(event.nativeEvent.layout.width) + 4)}>{letters}</View>
      <Animated.View accessible accessibilityLabel="YepWatch" style={{ flexDirection: 'row', alignItems: 'center', opacity }}>
        <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
          <Text style={type}>Y</Text>
        </Animated.View>
        <Animated.View style={{ width: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, lettersWidth] }), overflow: 'hidden', opacity: reveal }}>
          <View style={{ width: lettersWidth }}>{letters}</View>
        </Animated.View>
      </Animated.View>
    </> : <Image source={require('../../../assets/splash-y.png')} style={{ width: 44, height: 44 }} />}
  </View>;
}
