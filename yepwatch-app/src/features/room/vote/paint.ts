/**
 * Shared paint for the voting looks: colors, animated-value helpers that run on the native driver,
 * and the few style keys that only the web understands (kept off native).
 */
import { Animated, Easing, Platform, type TextStyle, type ViewStyle } from 'react-native';
import { glow } from '../../glow/theme';
import type { Look } from './looks';
import type { Geo, VoteWord } from './geometry';

export const web = Platform.OS === 'web';
/** Transform and opacity only, so every look runs on the native driver off the web. */
export const driver = !web;

export const ink = '#201400';
export const red = glow.red;
export const cream = '#fff7ec';
export const amber = glow.amber;

export type A = Animated.AnimatedInterpolation<number>;
export type Node = Animated.Value | A | Animated.AnimatedMultiplication | Animated.AnimatedAddition;
export const clampI = { extrapolate: 'clamp' as const };
/** Every node interpolates the same way; TypeScript can't call the union's overloads. */
const asValue = (p: Node) => p as Animated.Value;
export const fill = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;
/** Effect layers never take the pointer and stay out of the accessibility tree. */
export const hidden = { pointerEvents: 'none', accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants', 'aria-hidden': true } as const;

/** Styles only the web understands (CSS filters, masks, blend modes, text shadows); nothing on native. */
export function webStyle(style: Record<string, unknown>): ViewStyle {
  return (web ? style : {}) as ViewStyle;
}
export function webText(style: Record<string, unknown>): TextStyle {
  return (web ? style : {}) as TextStyle;
}

/**
 * A text glow: the web gets the full layered `text-shadow`; native has one shadow, so it gets the
 * strongest part of it.
 */
export function textGlow(css: string, nativeShadow: { color: string; radius: number; dx?: number; dy?: number }): TextStyle {
  if (web) return { textShadow: css } as unknown as TextStyle;
  return { textShadowColor: nativeShadow.color, textShadowRadius: nativeShadow.radius, textShadowOffset: { width: nativeShadow.dx ?? 0, height: nativeShadow.dy ?? 0 } };
}

const SAMPLES = 12;
/**
 * `p` mapped from [i0, i1] to [o0, o1], clamped, optionally eased. The native driver has no easing
 * in interpolations, so an easing is sampled into a piecewise-linear curve.
 */
export function span(p: Node, i0: number, i1: number, o0: number, o1: number, easing?: (t: number) => number): A {
  if (!easing) return asValue(p).interpolate({ inputRange: [i0, i1], outputRange: [o0, o1], ...clampI });
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let k = 0; k <= SAMPLES; k++) {
    const t = k / SAMPLES;
    inputRange.push(i0 + (i1 - i0) * t);
    outputRange.push(o0 + (o1 - o0) * easing(t));
  }
  return asValue(p).interpolate({ inputRange, outputRange, ...clampI });
}
/** 0…1 → a…b. */
export const range = (p: Node, a: number, b: number, easing?: (t: number) => number) => span(p, 0, 1, a, b, easing);
/** 0…1 eased in and out. */
export const ease = (p: Node) => span(p, 0, 1, 0, 1, Easing.inOut(Easing.quad));
/** Passes the value through as an interpolation (for layers that want one type). */
export const same = (p: Node): A => asValue(p).interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

// Deterministic jitter: a stepped curve over the loop (each step ~100 ms on a 5 s loop).
function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}
function stepped(seed: number, amp: number, sparse = 0, n = 50) {
  const r = rng(seed);
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let k = 0; k < n; k++) {
    const v = r() < sparse ? 0 : (r() * 2 - 1) * amp;
    inputRange.push(k / n, (k + 1) / n - 0.0001);
    outputRange.push(v, v);
  }
  return { inputRange, outputRange };
}
/** A jitter that grows with `p`; still under reduced motion. */
export const jitter = (loop: Animated.Value, p: Node, reduced: boolean, seed: number, amp: number, sparse = 0): Node | number =>
  reduced ? 0 : Animated.multiply(loop.interpolate(stepped(seed, amp, sparse)), p);

export type Kind = 'yep' | 'nope' | 'match';
export const wordOf = (kind: Kind): VoteWord => (kind === 'nope' ? 'NOPE' : kind === 'match' ? 'MATCH' : 'YEP');
/** A look's colors for one answer. */
export const pal = (kind: Kind) => kind === 'nope'
  ? { text: wordOf(kind), main: red, hi: cream, deep: '#7f1d1d', soft: '#ef444433' }
  : { text: wordOf(kind), main: amber, hi: '#fff8e6', deep: '#b45309', soft: '#fbbf2433' };

/** Everything a look layer gets. Every drive is 0 at rest. */
export interface LayerProps {
  look: Look;
  g: Geo;
  kind: Kind;
  /** 0 at rest → 1 at the threshold (and on commit). */
  p: A;
  /** The slow shared loop, 0 → 1 over five seconds. */
  loop: Animated.Value;
  /** The commit knock, 0 → 1 → 0. */
  punch: A;
  /** Neon: the sign is lit (flickers on at the threshold). */
  lit: A;
  /** The card's moves (card layers only). */
  x: Animated.Value;
  posterUrl: string | null;
  reduced: boolean;
  /** Back layers: another look's back layer is still playing out under this one (the previous card's). */
  stacked?: boolean;
}
