import { useContext, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Easing } from 'react-native';
import { useMotionPreference } from '../../components/ui';
import { BootPhase } from './boot-phase';
import { EASE_OUT, revealTiming, type RevealRole } from './boot-timing';

export type BootRevealProps = ComponentProps<typeof Animated.View> & { part?: RevealRole; index?: number };

/**
 * A page part that is hidden while the boot word covers the app and appears, in order, while the word
 * dissolves. Parts that mount after the boot are shown as they are. Opacity and translate only.
 */
export function BootReveal({ part = 'block', index = 0, style, ...rest }: BootRevealProps) {
  const phase = useContext(BootPhase);
  const quiet = useMotionPreference() === true;
  const [value] = useState(() => new Animated.Value(phase === 'ready' ? 1 : 0));
  const started = useRef(phase === 'ready');
  const running = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => () => running.current?.stop(), []);
  useEffect(() => {
    if (started.current || phase === 'boot') return;
    started.current = true;
    if (phase === 'ready') { value.setValue(1); return; }
    const t = revealTiming(part, index, quiet);
    running.current = Animated.timing(value, { toValue: 1, delay: t.delayMs, duration: t.durationMs, easing: Easing.bezier(...EASE_OUT), useNativeDriver: true });
    running.current.start();
  }, [phase, part, index, quiet, value]);
  const rise = revealTiming(part, index, quiet).rise;
  return <Animated.View {...rest} style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }] }]} />;
}
