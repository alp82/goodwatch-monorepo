/**
 * All-hold bonus: theatre bulbs around the poster frame. Invisible at rest; while `active` they fade
 * in (300 ms) and chase on one looping value; when anyone lets go they fade out (600 ms) and the loop
 * stops. Reduced motion: statically lit bulbs, switched on and off without animation.
 */
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { chaseRange, marqueeBulbs } from './marquee-geometry';
import type { PosterRect } from './popcorn-path';

const native = Platform.OS !== 'web';
const BULB = 6;

export function MarqueeLayer({ poster, active, reduced }: { poster: PosterRect; active: boolean; reduced: boolean }) {
  const [shown] = useState(() => new Animated.Value(0));
  const [loop] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(active);
  const bulbs = useMemo(() => marqueeBulbs(poster), [poster]);
  useEffect(() => {
    if (active) setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
    if (reduced) { shown.setValue(active ? 1 : 0); if (!active) setMounted(false); return; }
    const fade = Animated.timing(shown, { toValue: active ? 1 : 0, duration: active ? 300 : 600, easing: Easing.out(Easing.quad), useNativeDriver: native });
    let chase: Animated.CompositeAnimation | null = null;
    if (active) {
      loop.setValue(0);
      chase = Animated.loop(Animated.timing(loop, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: native }));
      chase.start();
    }
    fade.start(({ finished }) => { if (finished && !active) { loop.stopAnimation(); setMounted(false); } });
    return () => { fade.stop(); chase?.stop(); };
  }, [active, reduced, shown, loop]);
  if (!mounted) return null;
  return (
    <Animated.View testID="cheer-marquee" pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: shown }}>
      {bulbs.map((b, k) => (
        <Animated.View key={k} style={{
          position: 'absolute', left: b.x - BULB / 2, top: b.y - BULB / 2, width: BULB, height: BULB, borderRadius: BULB / 2,
          backgroundColor: '#ffe9a8', shadowColor: '#fbbf24', shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
          opacity: reduced ? 0.9 : loop.interpolate(chaseRange(k, bulbs.length)),
        }} />
      ))}
      <View />
    </Animated.View>
  );
}
