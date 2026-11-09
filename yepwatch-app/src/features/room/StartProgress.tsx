/**
 * The control you're looking at carries the start: the host's Start and a friend's waiting box fill
 * with a progress line (easing toward the end, filling only when the round is there) and a light
 * sweep, their words change over a long wait, and Ready shows a check as voting takes over.
 * Transform and opacity only, on the native driver; reduced motion keeps the sweep still and the
 * fades short.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedMotion } from '../../components/ui';
import { LiveDot } from '../shell/parts';
import { useLayout } from '../shell/layout';
import { warm } from '../shell/tokens';
import { GText, Icon, Press, glow, native } from '../glow/theme';
import { START_BEATS_MS, START_PROGRESS_CAP, START_PROGRESS_MS, hostStartLabel, startBeat, startWords, type StartPhase } from './start-progress';

/** 0→1 on repeat while `active`. */
function useLoop(active: boolean, duration: number) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    v.setValue(0);
    if (!active) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [active, duration, v]);
  return v;
}

/** A value that eases to `target` whenever it changes (shorter under reduced motion). */
export function useEased(target: number, duration = 320, delay = 0) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(target));
  useEffect(() => {
    const a = Animated.timing(v, { toValue: target, duration: reduced ? Math.min(duration, 180) : duration, delay: reduced ? 0 : delay, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [target, duration, delay, reduced, v]);
  return v;
}

/** Which beat of a long start this is: 0 at first, 1 after 2.6 s, 2 after 5 s. Restarts with `active`. */
export function useStartBeat(active: boolean) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!active) return;
    const at = Date.now();
    const timers = START_BEATS_MS.map((ms) => setTimeout(() => setBeat(startBeat(Date.now() - at)), ms));
    return () => { timers.forEach(clearTimeout); setBeat(0); };
  }, [active]);
  return active ? beat : 0;
}

/** Three dots taking turns (still dots under reduced motion). */
export function LoadingDots({ color, size = 6 }: { color: string; size?: number }) {
  const reduced = useReducedMotion();
  const t = useLoop(!reduced, 1050);
  return (
    <View accessible={false} style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.7, height: size * 3 }}>
      {[0, 1, 2].map((i) => {
        const a = i / 3;
        const b = a + 0.33;
        const bump = t.interpolate({ inputRange: [0, a, (a + b) / 2, b, 1], outputRange: [0, 0, 1, 0, 0] });
        return (
          <Animated.View key={i} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color,
            opacity: reduced ? 0.8 : bump.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [{ translateY: reduced ? 0 : bump.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.6] }) }] }} />
        );
      })}
    </View>
  );
}

/**
 * Says its words politely and that the area is busy. iOS has no live regions: the words are
 * announced there instead (only while something is happening, not the resting words).
 */
function Live({ busy, announce, children, style }: { busy: boolean; announce: string | null; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useEffect(() => {
    if (Platform.OS === 'ios' && announce) AccessibilityInfo.announceForAccessibility(announce);
  }, [announce]);
  return <View accessibilityLiveRegion="polite" accessibilityState={{ busy }} aria-busy={busy} style={style}>{children}</View>;
}

/** The fill inside a working control: the progress line along the bottom edge and the sweep passing over. */
function Working({ phase, width, tone }: { phase: StartPhase; width: number; tone: 'amber' | 'quiet' }) {
  const reduced = useReducedMotion();
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (phase === 'starting') {
      p.setValue(0);
      // Never claims the end before the round is there.
      const a = Animated.timing(p, { toValue: START_PROGRESS_CAP, duration: START_PROGRESS_MS, easing: Easing.out(Easing.cubic), useNativeDriver: native });
      a.start();
      return () => a.stop();
    }
    if (phase === 'ready') {
      const a = Animated.timing(p, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: native });
      a.start();
      return () => a.stop();
    }
    p.setValue(0);
  }, [phase, p]);
  const sweep = useLoop(phase === 'starting' && !reduced, 1500);
  if (phase === 'idle' || phase === 'failed') return null;
  const band = Math.max(80, width * 0.45);
  const amber = tone === 'amber';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 12, overflow: 'hidden' }}>
      {phase === 'starting' && !reduced ? (
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: band, transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-band, width] }) }] }}>
          <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={amber ? ['#fff7e000', '#fff7e066', '#fff7e000'] : ['#fbbf2400', '#fbbf2426', '#fbbf2400']} style={{ flex: 1 }} />
        </Animated.View>
      ) : null}
      <Animated.View style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width, backgroundColor: amber ? warm.ink : glow.amber, opacity: amber ? 0.38 : 0.9,
        transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }] }} />
    </View>
  );
}

/** Words that change with a short cross-fade (and a little rise, unless motion is reduced). */
function Words({ text, color, size }: { text: string; color: string; size: number }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(1));
  const first = useRef(true);
  // Before paint, so new words never flash at full strength first. The first words just show.
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    v.setValue(0);
    const a = Animated.timing(v, { toValue: 1, duration: reduced ? 120 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={{ flexShrink: 1, opacity: v, transform: [{ translateY: reduced ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
      <GText bold size={size} color={color} lines={1}>{text}</GText>
    </Animated.View>
  );
}

/** The host's Start: Start, the start's words while it works, Ready with a check, Try again after a failure. */
export function StartButton({ phase, onPress, disabled }: { phase: StartPhase; onPress: () => void; disabled?: boolean }) {
  const { z } = useLayout();
  const [width, setWidth] = useState(240);
  const busy = phase === 'starting' || phase === 'ready';
  const label = hostStartLabel(phase, useStartBeat(phase === 'starting'));
  const icon = phase === 'ready' ? <Icon name="check" size={18} color={warm.ink} /> : busy ? <LoadingDots color={warm.ink} /> : <Icon name="play" size={16} color={warm.ink} />;
  return (
    <Live busy={busy} announce={phase === 'idle' ? null : label} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Press label={label} onPress={onPress} disabled={disabled && !busy} quiet={busy}
          style={{ minHeight: z(54), borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 10, backgroundColor: glow.amber, borderWidth: 1, borderColor: glow.amber }}>
          <Working phase={phase} width={width} tone="amber" />
          {icon}
          <Words text={label} color={warm.ink} size={z(17)} />
        </Press>
      </View>
    </Live>
  );
}

/** A main action that's already working (Making your room): the Start look, nothing to press. */
export function WorkingButton({ label }: { label: string }) {
  const { z } = useLayout();
  const [width, setWidth] = useState(240);
  return (
    <Live busy announce={label} style={{ flexGrow: 1, flexShrink: 1 }}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="progressbar" accessibilityLabel={label}
        style={{ minHeight: z(54), borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: glow.amber, borderWidth: 1, borderColor: glow.amber }}>
        <Working phase="starting" width={width} tone="amber" />
        <LoadingDots color={warm.ink} />
        <Words text={label} color={warm.ink} size={z(17)} />
      </View>
    </Live>
  );
}

/**
 * A friend's waiting box: "Waiting for <host> to start" at rest. When the round arrives it turns
 * amber with "<host> started", fills and shows a check (`ready`); while this friend is still being
 * let into a running round (`joining`) it works with the same line and sweep.
 */
export function StartStatus({ host, ready, joining }: { host: string; ready: boolean; joining: string | null }) {
  const { z } = useLayout();
  const [width, setWidth] = useState(240);
  const phase: StartPhase = ready ? 'ready' : joining ? 'starting' : 'idle';
  const busy = phase !== 'idle';
  const lit = useEased(busy ? 1 : 0, 360);
  const text = ready ? startWords(0, host.charAt(0).toUpperCase() + host.slice(1)) : joining ?? `Waiting for ${host} to start`;
  const icon = ready ? <Icon name="check" size={16} color={glow.amber} /> : joining ? <LoadingDots color={glow.amber} /> : <LiveDot />;
  return (
    <Live busy={busy} announce={busy ? text : null} style={{ flex: 1 }}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ minHeight: z(54), borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, backgroundColor: warm.faint, overflow: 'hidden' }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 12, backgroundColor: warm.amberSoft, borderWidth: 1, borderColor: warm.amberLine, opacity: lit }} />
        <Working phase={phase} width={width} tone="quiet" />
        {icon}
        <Words text={text} color={busy ? glow.ink : glow.soft} size={z(15)} />
      </View>
    </Live>
  );
}
