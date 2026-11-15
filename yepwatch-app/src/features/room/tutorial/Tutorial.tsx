/**
 * The first-round how-to (a person's first round on this device): a finger (touch) or cursor (mouse)
 * grabs the real first card and drags it right, holds so the Yep glow and word settle, brings it back,
 * then drags it left for Nope and back. It lets go, taps Yep (the card leans to preview it, the button
 * lights), then taps Nope. A rest, then again, until the person acts (any touch, a vote, a key) or presses
 * Skip. The tips above the buttons say what each answer means while the card leans their way.
 *
 * Reduced motion: no hand and no drag; both tips stay up until the person acts.
 *
 * Everything here is transform and opacity on values mounted once; the layer takes no input but Skip.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GText, glow, native } from '../../glow/theme';
import { warm } from '../../shell/tokens';
import { HoverPress } from '../hover';
import type { DragValues } from '../vote/VoteStage';

export interface Rect { x: number; y: number; w: number; h: number }
const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const clamp = { extrapolate: 'clamp' } as const;
const noop = () => undefined;

/** What the how-to gets: where things are (in its layer's coordinates) and the drives it may move. */
export interface Tutor {
  /** Show a finger instead of a mouse cursor, and say Swipe instead of Drag. */
  touch: boolean;
  card: Rect;
  yes: Rect;
  no: Rect;
  /** The real card's drag core (x, y in px; v = x / threshold drives the stage). */
  drag: DragValues;
  /** Drag distance where a release would answer (a third of the card width). */
  threshold: number;
  /** Mount the real card's look layers, as a grab does. */
  engage: (on: boolean) => void;
  /** A press flash on each answer button, 0 to 1 (dragging lights them on its own). */
  keys: { yes: Animated.Value; no: Animated.Value };
  /** Keeps an answer's tip up, 0 to 1. */
  pins: { yes: Animated.Value; no: Animated.Value };
  reduced: boolean;
  /** Ends the how-to (Skip). */
  stop: () => void;
}

/** The drag's easing: slow out of rest, slow into the hold, no corners in between. */
const GLIDE = Easing.bezier(0.45, 0, 0.25, 1);
const ease = (v: Animated.Value | Animated.ValueXY, toValue: number | { x: number; y: number }, duration: number) =>
  Animated.timing(v as Animated.Value, { toValue: toValue as number, duration, easing: GLIDE, useNativeDriver: native });
/** A zero-length step that runs `fn` (sets values where nothing visible changes). */
const call = (fn: () => void): Animated.CompositeAnimation => ({ start: (cb) => { fn(); cb?.({ finished: true }); }, stop: noop, reset: noop });

/** Plays `build()` while mounted, again and again; rebuilt when `key` changes. */
function useTimeline(build: () => Animated.CompositeAnimation, key: string, on: boolean) {
  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    let cur: Animated.CompositeAnimation | null = null;
    const go = () => {
      if (cancelled) return;
      cur = build();
      cur.start(({ finished }) => { if (finished && !cancelled) go(); });
    };
    go();
    return () => { cancelled = true; cur?.stop(); };
  }, [key, on]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * The ghost hand: grabs the real card and drags it, or taps an answer button while the card leans to
 * preview it. While it holds the card it rides on the card's x and y, so hand and card never drift apart.
 */
function useGhost(t: Tutor) {
  const [v] = useState(() => ({ xy: new Animated.ValueXY({ x: 0, y: 0 }), press: new Animated.Value(0), show: new Animated.Value(0), hold: new Animated.Value(0) }));
  const c = t.card;
  const T = t.threshold;
  const grip = { x: c.x + c.w / 2, y: c.y + c.h * 0.56 };
  const lean = T * 0.8;
  const dragTo = (dx: number, ms: number) => Animated.parallel([ease(t.drag.x, dx, ms), ease(t.drag.y, -Math.abs(dx) * 0.05, ms), ease(t.drag.v, dx / T, ms)]);
  const b = {
    appear: () => Animated.sequence([
      call(() => { v.xy.setValue({ x: grip.x + c.w * 0.32, y: grip.y + c.h * 0.26 }); v.hold.setValue(0); v.press.setValue(0); }),
      Animated.parallel([ease(v.show, 1, 320), ease(v.xy, grip, 760)]),
    ]),
    grab: () => Animated.sequence([call(() => { v.xy.setValue(grip); t.engage(true); }), ease(v.press, 1, 200), call(() => v.hold.setValue(1))]),
    /** One answer by drag: that way, hold, back to rest. */
    drag: (yes: boolean) => {
      const d = c.w * 0.42;
      return Animated.sequence([dragTo(yes ? d : -d, 1000), Animated.delay(900), dragTo(0, 700)]);
    },
    lift: () => Animated.sequence([call(() => v.hold.setValue(0)), ease(v.press, 0, 220)]),
    /** Moves to an answer button and taps it; the card leans that way (its preview) and comes back. */
    tap: (yes: boolean) => Animated.sequence([
      ease(v.xy, center(yes ? t.yes : t.no), 720),
      call(() => t.engage(true)),
      Animated.parallel([ease(v.press, 1, 150), ease(yes ? t.keys.yes : t.keys.no, 1, 150), dragTo((yes ? 1 : -1) * lean, 460)]),
      ease(v.press, 0, 240),
      Animated.delay(950),
      Animated.parallel([ease(yes ? t.keys.yes : t.keys.no, 0, 380), dragTo(0, 520)]),
      Animated.delay(200),
    ]),
    vanish: () => ease(v.show, 0, 320),
  };
  return { v, b };
}

const HAND_D = 'M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z';
const CURSOR_D = 'M5 2.5v17.2l4.6-4.4 3 6.9 3.1-1.3-3-6.8h6.3z';

/** The ghost finger or cursor, its tip at the hand's point plus the card's drag while it holds; `press` dips it and spreads a ring. */
function Pointer({ t, g }: { t: Tutor; g: ReturnType<typeof useGhost>['v'] }) {
  const { touch } = t;
  const size = touch ? 72 : 46;
  // The tip in the glyph's 24-unit box: the finger's pad, or the arrow's point.
  const tip = touch ? { x: 11.5, y: 6.5 } : { x: 5, y: 2.5 };
  const k = size / 24;
  const ring = touch ? 78 : 62;
  const [at] = useState(() => ({
    x: Animated.add(g.xy.x, Animated.multiply(t.drag.x, g.hold)),
    y: Animated.add(g.xy.y, Animated.multiply(t.drag.y, g.hold)),
  }));
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, zIndex: 60, opacity: g.show, transform: [{ translateX: at.x }, { translateY: at.y }] }}>
      <Animated.View style={{ position: 'absolute', left: -ring / 2, top: -ring / 2, width: ring, height: ring, borderRadius: ring / 2, borderWidth: 3, borderColor: glow.amber, backgroundColor: '#fbbf2440',
        opacity: g.press, transform: [{ scale: g.press.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }} />
      <Animated.View style={{ position: 'absolute', left: -tip.x * k, top: -tip.y * k, transform: [{ scale: g.press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }] }}>
        <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
          <Path d={touch ? HAND_D : CURSOR_D} fill="#fff" stroke="#151515" strokeWidth={touch ? 0.8 : 1.2} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** A short caption pill. */
function Caption({ children, size = 15, tone = 'dark' }: { children: ReactNode; size?: number; tone?: 'dark' | 'amber' }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: tone === 'amber' ? glow.amber : 'rgba(10,9,8,0.9)', borderWidth: 1, borderColor: tone === 'amber' ? glow.amber : '#ffffff2e' }}>
      <GText bold size={size} color={tone === 'amber' ? warm.ink : glow.ink} style={{ textAlign: 'center' }}>{children}</GText>
    </View>
  );
}

/** Above each button, what its answer means: up as the card leans its way, or while its pin is up. */
function AnswerTips({ t }: { t: Tutor }) {
  const T = t.threshold;
  const tip = (yes: boolean) => {
    const r = yes ? t.yes : t.no;
    const lean = t.drag.x.interpolate(yes ? { inputRange: [T * 0.2, T * 0.6], outputRange: [0, 1], ...clamp } : { inputRange: [-T * 0.6, -T * 0.2], outputRange: [1, 0], ...clamp });
    const o = Animated.add(lean, yes ? t.pins.yes : t.pins.no).interpolate({ inputRange: [0, 1], outputRange: [0, 1], ...clamp });
    return (
      <Animated.View key={yes ? 'tip-yes' : 'tip-no'} pointerEvents="none" style={{ position: 'absolute', left: r.x - 6, width: r.w + 12, top: r.y - 48, alignItems: 'center', opacity: o, transform: [{ translateY: o.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
        <Caption tone={yes ? 'amber' : 'dark'} size={t.touch ? 14 : 15}>{yes ? 'You’d watch it tonight' : 'Not tonight'}</Caption>
      </Animated.View>
    );
  };
  return <>{tip(false)}{tip(true)}</>;
}

/** Skip: the only part of the how-to that takes a press. */
function Skip({ t }: { t: Tutor }) {
  return (
    <View style={{ position: 'absolute', left: t.card.x + t.card.w - 72, top: t.card.y + 4 }}>
      <HoverPress label="Skip the how-to" onPress={t.stop} hover={{ backgroundColor: 'rgba(36,32,28,0.95)', borderColor: '#ffffff4d' }}
        visual={{ height: 30, paddingHorizontal: 11, borderRadius: 8, backgroundColor: 'rgba(10,9,8,0.82)', borderWidth: 1, borderColor: '#ffffff2e', justifyContent: 'center' }}>
        <GText bold size={12} color={glow.soft}>Skip</GText>
      </HoverPress>
    </View>
  );
}

const tutorKey = (t: Tutor) => [t.card.x, t.card.y, t.card.w, t.yes.x, t.yes.y, t.no.x, t.no.y, t.threshold].map(Math.round).join('|');

export function Tutorial({ t }: { t: Tutor }) {
  const { v, b } = useGhost(t);
  useEffect(() => {
    if (!t.reduced) return;
    t.pins.yes.setValue(1);
    t.pins.no.setValue(1);
  }, [t.reduced, t.pins]);
  useTimeline(() => Animated.sequence([
    b.appear(), Animated.delay(120),
    b.grab(),
    b.drag(true), Animated.delay(260),
    b.drag(false),
    b.lift(),
    b.tap(true),
    b.tap(false),
    b.vanish(), Animated.delay(1000),
  ]), tutorKey(t), !t.reduced);
  return (
    <>
      <AnswerTips t={t} />
      {t.reduced ? null : <Pointer t={t} g={v} />}
      <Skip t={t} />
    </>
  );
}
