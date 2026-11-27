/** Small motion drivers for Matches: a 0 → 1 value that follows a switch, and desktop hover as one. Opacity and transform only. */
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { native } from '../glow/theme';

/** 0 → 1 as `on` turns true (`duration` ms; at once with reduced motion). */
export function useOn(on: boolean, duration = 180) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    const a = Animated.timing(v, { toValue: on ? 1 : 0, duration: reduced ? 0 : duration, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

/** How long Matches waits on you before your empty I'm in boxes start to pulse. */
export const NUDGE_AFTER_MS = 8000;

/**
 * A gentle nudge while Matches waits on you: after `NUDGE_AFTER_MS`, a 0 → 1 → 0 loop (1.6 s) that drives the
 * empty I'm in boxes' scale. Rest (0) when `active` ends and with reduced motion.
 */
export function useNudge(active: boolean) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active || reduced) { v.setValue(0); return; }
    let loop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      loop = Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: native }),
        Animated.delay(600),
      ]));
      loop.start();
    }, NUDGE_AFTER_MS);
    return () => { clearTimeout(timer); loop?.stop(); v.setValue(0); };
  }, [active, reduced, v]);
  return v;
}

/** Desktop hover as a 0 → 1 driver (180 ms) and the Pressable handlers that feed it. Touch never hovers. */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  const v = useOn(hovered, 180);
  const handlers = useMemo(() => ({ onHoverIn: () => setHovered(true), onHoverOut: () => setHovered(false) }), []);
  return { hovered, v, handlers };
}
