import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { native } from './theme';
import type { GesturePhase } from './model';
/** Stable for this surface's lifetime. Incoming snapshots cannot replace a responder mid-gesture. */
export function useDrag({
  onRelease,
  onTap,
  disabled,
  onGesture,
}: {
  onRelease: (dx: number, velocity: number) => void;
  onTap: () => void;
  disabled: boolean;
  onGesture?: (phase: GesturePhase) => void;
}) {
  const reduced = useReducedMotion();
  const [x] = useState(() => new Animated.Value(0));
  const live = useRef({ onRelease, onTap, disabled, onGesture });
  useEffect(() => {
    live.current = { onRelease, onTap, disabled, onGesture };
  }, [onRelease, onTap, disabled, onGesture]);
  const [dragging, setDragging] = useState(false);
  const base = useRef(0);
  const sequence = useRef(0);
  const handling = useRef(false);
  // PanResponder only invokes these closures for events; it never reads the refs during construction.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.disabled,
      onMoveShouldSetPanResponder: (_, g) => !live.current.disabled && Math.abs(g.dx) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        sequence.current++;
        x.stopAnimation((value) => {
          base.current = value;
        });
        setDragging(true);
        handling.current = false;
        live.current.onGesture?.('reach');
      },
      onPanResponderMove: (_, g) => {
        x.setValue(base.current + g.dx);
        if (!handling.current && Math.abs(g.dx) > 15) {
          handling.current = true;
          live.current.onGesture?.('handle');
        }
      },
      onPanResponderRelease: (_, g) => {
        setDragging(false);
        live.current.onGesture?.('release');
        if (live.current.disabled) return;
        if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) live.current.onTap();
        else live.current.onRelease(g.dx, g.vx);
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        live.current.onGesture?.('release');
        Animated.spring(x, { toValue: 0, useNativeDriver: native }).start();
      },
    })
  );
  function recenter() {
    sequence.current++;
    if (reduced) x.setValue(0);
    else
      Animated.spring(x, {
        toValue: 0,
        friction: 7,
        tension: 85,
        useNativeDriver: native,
      }).start();
  }
  function transition(direction: number, width: number, apply: () => void) {
    const seq = ++sequence.current;
    if (reduced) {
      // Keep the old title hidden until the new title's layout resets the card.
      x.setValue(direction * width * 1.2);
      apply();
      return;
    }
    Animated.timing(x, {
      toValue: direction * width * 1.2,
      duration: 170,
      useNativeDriver: native,
    }).start(({ finished }) => {
      if (!finished || seq !== sequence.current) return;
      apply();
      // Keep the outgoing card offscreen. Only a new title may reset this surface.
      // Re-entering here reuses the old artwork and activates the opposite vote stamp.
    });
  }
  function reset() {
    sequence.current++;
    x.stopAnimation();
    x.setValue(0);
  }
  return { x, pan: pan.panHandlers, dragging, recenter, transition, reset };
}
