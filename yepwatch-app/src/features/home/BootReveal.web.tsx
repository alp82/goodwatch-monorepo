import { useContext, useLayoutEffect, useRef, type ComponentProps, type ComponentRef } from 'react';
import { View } from 'react-native';
import { BootPhase } from './boot-phase';
import { EASE_OUT, revealTiming, type RevealRole } from './boot-timing';

export type BootRevealProps = ComponentProps<typeof View> & { part?: RevealRole; index?: number };

/**
 * Web: the same reveal as native, run by the browser's compositor (Web Animations). The part is hidden
 * while the boot covers the app; at the dissolve the animation is attached before the next paint and
 * holds the hidden start state through its delay, so nothing flashes.
 */
export function BootReveal({ part = 'block', index = 0, style, ...rest }: BootRevealProps) {
  const phase = useContext(BootPhase);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const started = useRef(phase === 'ready');
  useLayoutEffect(() => {
    if (started.current || phase === 'boot') return;
    started.current = true;
    const node = ref.current as unknown as HTMLElement | null;
    if (phase === 'ready' || !node?.animate) return;
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = revealTiming(part, index, quiet);
    node.animate(
      [{ opacity: 0, transform: `translateY(${t.rise}px)` }, { opacity: 1, transform: 'none' }],
      { delay: t.delayMs, duration: t.durationMs, easing: `cubic-bezier(${EASE_OUT.join(',')})`, fill: 'backwards' },
    );
  }, [phase, part, index]);
  return <View ref={ref} {...rest} style={[style, phase === 'boot' ? { opacity: 0 } : null]} />;
}
