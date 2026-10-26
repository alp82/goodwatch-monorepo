import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform } from 'react-native';
import { newCheerSeed } from './random';
import {
  CHEER_TIMING,
  idleGesture,
  nextTickDelay,
  pressGesture,
  releaseGesture,
  tickGesture,
  type CheerSignal,
  type GestureState,
} from './timing';

const native = Platform.OS !== 'web';

/** True only after everyone has held for `dwellMs`; false immediately when anyone lets go. */
export function useAllHoldBonus(allHold: boolean, dwellMs: number = CHEER_TIMING.bonusDwellMs) {
  const [bonus, setBonus] = useState(false);
  useEffect(() => {
    if (!allHold) {
      setBonus(false); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const timer = setTimeout(() => setBonus(true), dwellMs);
    return () => clearTimeout(timer);
  }, [allHold, dwellMs]);
  return allHold && bonus;
}

/**
 * The poster's only scale owner: a damped spring that always continues from the current value
 * (and, between springs, its velocity), so presses, releases and nudges never jump. Reduced motion: still.
 */
export function usePosterSpring(reduced: boolean) {
  const [scale] = useState(() => new Animated.Value(1));
  const target = useRef(1);
  const spring = useCallback((toValue: number, done?: () => void) => {
    Animated.spring(scale, { toValue, stiffness: 320, damping: 24, mass: 1, useNativeDriver: native }).start(({ finished }) => {
      if (finished) done?.();
    });
  }, [scale]);
  const press = useCallback((down: boolean) => {
    if (reduced) return;
    target.current = down ? 0.988 : 1;
    spring(target.current);
  }, [reduced, spring]);
  const kick = useCallback((amount: number) => {
    if (reduced) return;
    spring(target.current + Math.min(0.01, Math.max(0, amount)), () => spring(target.current));
  }, [reduced, spring]);
  useEffect(() => {
    if (reduced) { scale.stopAnimation(); scale.setValue(1); target.current = 1; }
  }, [reduced, scale]);
  return { scale, press, kick };
}

/** Gesture timing outside React: one timer, only while pressed or holding. */
class CheerGesture {
  private state: GestureState = idleGesture;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private io: { emit: (s: CheerSignal[]) => void; holding: (on: boolean) => void; seed: (seed: number) => void } = { emit: () => undefined, holding: () => undefined, seed: () => undefined };
  connect(io: CheerGesture['io']) { this.io = io; }
  press(seed: number) {
    const r = pressGesture(this.state, Date.now(), seed);
    this.state = r.state;
    if (r.emit.length) this.io.seed(seed);
    this.io.emit(r.emit);
    this.schedule();
  }
  release() {
    this.clear();
    const wasHolding = this.state.phase === 'holding';
    const r = releaseGesture(this.state);
    this.state = r.state;
    this.io.emit(r.emit);
    if (wasHolding) this.io.holding(false);
  }
  private clear() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
  private schedule() {
    this.clear();
    const delay = nextTickDelay(this.state, Date.now());
    if (delay === null) return;
    this.timer = setTimeout(() => {
      const wasHolding = this.state.phase === 'holding';
      const r = tickGesture(this.state, Date.now());
      this.state = r.state;
      this.io.emit(r.emit);
      if (!wasHolding && r.state.phase === 'holding') this.io.holding(true);
      this.schedule();
    }, delay);
  }
}

/**
 * Poster gesture: press sends a tap at once (fresh seed, local burst); still pressed after 300 ms it
 * becomes a hold, sent immediately and renewed every 500 ms with the same seed; up/cancel sends release.
 * Background, `enabled` turning false (phase change, navigation, disconnect) and unmount release too.
 */
export function usePosterCheer({ enabled, send, onLocalBurst, spring }: {
  enabled: boolean;
  send: (kind: CheerSignal['kind'], seed: number) => void;
  onLocalBurst?: (seed: number) => void;
  spring?: { press: (down: boolean) => void };
}) {
  const [holding, setHolding] = useState(false);
  const [seed, setSeed] = useState(0);
  const [gesture] = useState(() => new CheerGesture());
  useEffect(() => {
    gesture.connect({
      emit: (signals) => {
        for (const s of signals) {
          send(s.kind, s.seed);
          if (s.kind === 'tap') onLocalBurst?.(s.seed);
        }
      },
      holding: setHolding,
      seed: setSeed,
    });
  }, [gesture, send, onLocalBurst]);
  const pressedViaPressIn = useRef(false);
  const onPressIn = useCallback(() => {
    if (!enabled) return;
    pressedViaPressIn.current = true;
    spring?.press(true);
    gesture.press(newCheerSeed());
  }, [enabled, spring, gesture]);
  const onPressOut = useCallback(() => {
    spring?.press(false);
    gesture.release();
  }, [spring, gesture]);
  /** Keyboard / accessibility activation without a press-in still produces one tap. */
  const onPress = useCallback(() => {
    if (pressedViaPressIn.current) { pressedViaPressIn.current = false; return; }
    if (!enabled) return;
    gesture.press(newCheerSeed());
    gesture.release();
  }, [enabled, gesture]);
  useEffect(() => { if (!enabled) gesture.release(); }, [enabled, gesture]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => { if (next !== 'active') gesture.release(); });
    return () => { sub.remove(); gesture.release(); };
  }, [gesture]);
  return { pressHandlers: { onPressIn, onPressOut, onPress }, holding: holding && enabled, seed };
}
