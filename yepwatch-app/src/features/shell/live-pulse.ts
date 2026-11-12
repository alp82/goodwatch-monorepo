/**
 * The live dot's pulse (owner Q41): three rings when the room opens or someone joins, then a solid dot.
 * A ring that never stopped kept the room screen animating, and on Android every running frame delays
 * what the room shows next (a match on a friend's phone reached ~105 ms against a 100 ms budget).
 */
import { Animated, Easing } from 'react-native';

export const LIVE_PULSE = { rings: 3, ms: 1500 } as const;

/**
 * Plays the rings on `ring` (0 → 1 per ring, transform and opacity only) as one finite loop: with the
 * native driver the loop runs on the UI thread and ends there, nothing keeps ticking after the third.
 * `done` runs once the third ring ends. Returns stop (no `done` then).
 */
export function playLivePulse(ring: Animated.Value, useNativeDriver: boolean, done: () => void): () => void {
  ring.setValue(0);
  const rings = Animated.loop(
    Animated.timing(ring, { toValue: 1, duration: LIVE_PULSE.ms, easing: Easing.out(Easing.quad), useNativeDriver }),
    { iterations: LIVE_PULSE.rings },
  );
  rings.start(({ finished }) => { if (finished) done(); });
  return () => rings.stop();
}
