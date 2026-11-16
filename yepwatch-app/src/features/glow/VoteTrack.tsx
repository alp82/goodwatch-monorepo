/**
 * The voting bar's progress track: everyone's face rides a rail at the share of the dealt cards they've
 * answered ("Card 5 of 20" puts you a quarter along), with your stretch of the rail filled in amber that
 * fades in from the start, a finish post and the deck's size after it. The deck refills, so the size grows
 * and every face steps back a little.
 *
 * A face travels on a spring and stretches while it moves, squashing back round when it arrives (the move
 * is the answer, so the face's own answer hop stays off); pointer reactions (reach, handle) stay as in the
 * faces row. Transform and opacity only; the rail and faces never change layout. Mirrored in RTL.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { PeerActivity } from '../../core/continuous/activity';
import { useReducedMotion } from '../../components/ui';
import { useInlineSign } from './direction';
import type { GlowPerson } from './model';
import { Avatar } from './Peers';
import { GText, glow, native } from './theme';
import { placeRiders, trackLabelWidth } from './vote-track';

const RAIL = 4;
const SPRING = { restDisplacementThreshold: 0.1, restSpeedThreshold: 2 } as const;
const SETTLED_SCALE = { restDisplacementThreshold: 0.003, restSpeedThreshold: 0.05 } as const;
let gradients = 0;

export type TrackPerson = GlowPerson & { answered: number };

export const VoteTrack = memo(function VoteTrack({
  people,
  dealt,
  activity,
  localReaction,
  width,
  size,
  fontScale = 1,
}: {
  people: TrackPerson[];
  /** Cards dealt so far (the room's candidates). */
  dealt: number;
  activity: Map<string, PeerActivity>;
  localReaction: { at: number; gesture?: string; answer?: boolean };
  width: number;
  size: number;
  fontScale?: number;
}) {
  const sign = useInlineSign();
  const labelW = trackLabelWidth(fontScale);
  // A face stretches to 1.4× while it travels: keep that inside the track at both ends.
  const pad = Math.ceil(size * 0.2);
  const span = Math.max(0, width - size - labelW - pad * 2);
  const { at, order } = placeRiders(people, dealt, span, size);
  const me = people.find((p) => p.self);
  // Faces present when the track first shows are simply there; only later arrivals fade in.
  const [first] = useState(() => new Set(people.map((p) => p.id)));
  const h = size + 8;
  const railTop = (h - RAIL) / 2;
  return (
    <View testID="vote-track" accessible accessibilityLabel={people.map((p) => `${p.self ? 'You' : p.nickname}: ${Math.min(p.answered, dealt)} of ${dealt}`).join(', ')} style={{ width, height: h }}>
      <View style={{ position: 'absolute', start: pad + size / 2, width: span, top: railTop, height: RAIL }}>
        <View style={{ position: 'absolute', start: 0, end: 0, top: 0, height: RAIL, borderRadius: RAIL, backgroundColor: glow.line }} />
        {me ? <Fill share={span ? (at.get(me.id) ?? 0) / span : 0} width={span} sign={sign} /> : null}
        <View style={{ position: 'absolute', start: span - 1, top: RAIL / 2 - size * 0.35, width: 2, height: size * 0.7, borderRadius: 1, backgroundColor: '#ffffff40' }} />
      </View>
      <View style={{ position: 'absolute', start: pad, top: 4, width: width - labelW - pad * 2, height: size }}>
        {order.map((p, i) => {
          const a = activity.get(p.id);
          return (
            <Rider key={p.id} person={p} x={sign * (at.get(p.id) ?? 0)} size={size} z={p.self ? 99 : i} arriving={!first.has(p.id)}
              pulse={p.self ? localReaction.at : a?.pointer?.serverTime ?? a?.pulse?.serverTime ?? 0}
              action={p.self ? (localReaction.answer !== undefined ? undefined : localReaction.gesture) : a?.pointer?.pointer ? (a.pointer.pointer.pressed ? 'reach' : 'handle') : a?.pulse?.beat ? undefined : a?.pulse?.gesture}
              moving={!!a?.pointer?.pointer} active={Boolean(a)} />
          );
        })}
      </View>
      <View accessible={false} style={{ position: 'absolute', end: 0, width: labelW, top: 0, height: h, alignItems: 'flex-end', justifyContent: 'center' }}>
        <GText size={12} color={glow.muted}>{String(dealt)}</GText>
      </View>
    </View>
  );
}, (a, b) =>
  // The voting screen re-renders on every room update; the track only when someone moves or reacts.
  a.dealt === b.dealt && a.activity === b.activity && a.localReaction === b.localReaction && a.width === b.width && a.size === b.size && a.fontScale === b.fontScale &&
  a.people.length === b.people.length && a.people.every((p, i) => { const q = b.people[i]; return p.id === q.id && p.nickname === q.nickname && p.self === q.self && p.answered === q.answered; }));

/** Your stretch of the rail: amber fading in from the start, scaled from the start edge (never relayouts). */
function Fill({ share, width, sign }: { share: number; width: number; sign: number }) {
  const reduced = useReducedMotion();
  const [s] = useState(() => new Animated.Value(Math.max(0.0001, share)));
  const [id] = useState(() => `vote-track-fill-${++gradients}`);
  useEffect(() => {
    const to = Math.max(0.0001, share);
    if (reduced) { s.setValue(to); return; }
    const a = Animated.timing(s, { toValue: to, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [share, s, reduced]);
  const half = (sign * width) / 2;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', start: 0, top: 0, width, height: RAIL, borderRadius: RAIL, overflow: 'hidden',
      transform: [{ translateX: -half }, { scaleX: s }, { translateX: half }] }}>
      <Svg width={width} height={RAIL}>
        <Defs>
          <LinearGradient id={id} x1={sign > 0 ? '0' : '1'} y1="0" x2={sign > 0 ? '1' : '0'} y2="0">
            <Stop offset="0" stopColor={glow.amber} stopOpacity={0} />
            <Stop offset="1" stopColor={glow.amber} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={RAIL} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** One face on the track: springs to `x`, stretching on the way and squashing back round on arrival. */
const Rider = memo(function Rider({ person, x, size, z, arriving, pulse, action, moving, active }: {
  person: GlowPerson; x: number; size: number; z: number; arriving: boolean; pulse: number; action?: string; moving: boolean; active: boolean;
}) {
  const reduced = useReducedMotion();
  const last = useRef(x);
  const [tx] = useState(() => new Animated.Value(x));
  const [sx] = useState(() => new Animated.Value(1));
  const [sy] = useState(() => new Animated.Value(1));
  const [fade] = useState(() => new Animated.Value(arriving && !reduced ? 0 : 1));
  useEffect(() => {
    if (reduced) { fade.setValue(1); return; }
    const a = Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [fade, reduced]);
  useEffect(() => {
    const from = last.current;
    last.current = x;
    // Reduced motion (also when it turns on mid-move, which stops the move): settle at once, round.
    if (reduced) { tx.setValue(x); sx.setValue(1); sy.setValue(1); return; }
    if (from === x) return;
    const back = (v: Animated.Value) => Animated.spring(v, { toValue: 1, friction: 4, tension: 110, useNativeDriver: native, ...SETTLED_SCALE });
    const squash = (v: Animated.Value, toValue: number) => Animated.timing(v, { toValue, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: native });
    const a = Animated.parallel([
      Animated.spring(tx, { toValue: x, friction: 9, tension: 40, useNativeDriver: native, ...SPRING }),
      Animated.sequence([Animated.parallel([squash(sx, 1.4), squash(sy, 0.78)]), Animated.parallel([back(sx), back(sy)])]),
    ]);
    a.start();
    return () => a.stop();
  }, [x, tx, sx, sy, reduced]);
  return (
    <Animated.View style={{ position: 'absolute', start: 0, top: 0, zIndex: z, opacity: fade, transform: [{ translateX: tx }, { scaleX: sx }, { scaleY: sy }] }}>
      <Avatar size={size} person={person} pulse={pulse} action={action} moving={moving} active={active} />
    </Animated.View>
  );
});
