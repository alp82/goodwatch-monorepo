/**
 * The voting stage: the card with its drag and swipe, the card behind it, the friends' live
 * pointers, and the card's YEP / NOPE look around it.
 *
 * One drag core drives everything: `x` and `y` move the card (it follows the pointer and tilts),
 * `v` (−1…1) drives the stage looks. A release past a third of the card width, or a flick, flies
 * the card off; anything less springs it back. Nothing shows at rest; a look builds in with the drag,
 * reaches full strength at the threshold, plays fully on commit, and lingers a beat after the card
 * left while the next card's look waits unseen. Transform and opacity only.
 */
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, Image, PanResponder, View } from 'react-native';
import type { ActivityPointer } from '@goodwatch/yepwatch-contracts/proposal';
import { playFeedback } from '../../feedback/sounds';
import { PeerStage } from '../../glow/Peers';
import { PointerSurface } from '../../glow/PointerSurface';
import { Poster } from '../../glow/Poster';
import type { GesturePhase, GlowTitle } from '../../glow/model';
import type { PeerActivity } from '../../../core/continuous/activity';
import { CardGlow, CardOver, CardUnder, type CardLayerProps } from './card-looks';
import type { StageGeometry } from './geometry';
import { BackLayer, FrontLayer } from './layers';
import { LOOPING, type Look } from './looks';
import { Moment } from './moments';
import { clampI, driver, fill, hidden, same, web, type A, type Kind, type LayerProps } from './paint';

export interface StageCard {
  /** Stable for one card in one round (Undo brings the same key back). */
  key: string;
  title: GlowTitle;
  look: Look;
}
export interface MatchMoment {
  key: string;
  title: GlowTitle;
  look: Look;
}
export interface VoteStageControls {
  /** Fly the card as the buttons and arrow keys do: lean past the threshold, hold, fly. */
  commit: (yes: boolean) => void;
}
/** An answered card still flying off the stage. The answer went out when it was pressed. */
interface Flight {
  id: number;
  card: StageCard;
  answer: boolean;
  fromDrag: boolean;
  /** Its streaming logos, as they were when it was answered. */
  services?: ReactNode;
}

export function VoteStage({ geo, card, next, empty, disabled, keys, reduced, activity, services, moment, controls, onVote, onDetails, onTrailer, onGesture, onPointer, onMomentEnd }: {
  geo: StageGeometry;
  card: StageCard | null;
  /** The card underneath, seen while the top card moves. */
  next: GlowTitle | null;
  /** Where the card would be while there is none. */
  empty?: ReactNode;
  disabled: boolean;
  /** ←/→ answer (web). */
  keys: boolean;
  reduced: boolean;
  activity: Map<string, PeerActivity>;
  services?: ReactNode;
  moment: MatchMoment | null;
  controls: RefObject<VoteStageControls | null>;
  /** Sends the vote on the card with this key at once; false when it didn't go out. */
  onVote: (yes: boolean, key: string) => Promise<boolean>;
  onDetails: () => void;
  onTrailer: () => void;
  onGesture: (phase: GesturePhase) => void;
  onPointer: (pointer: ActivityPointer | null) => void;
  onMomentEnd: (key: string) => void;
}) {
  const { w, h, aw, cardTop, threshold, off, lean, phone } = geo;
  const [values] = useState(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    v: new Animated.Value(0),
    punch: new Animated.Value(0),
    litYep: new Animated.Value(0),
    litNope: new Animated.Value(0),
    moment: new Animated.Value(0),
    loop: new Animated.Value(0),
  }));
  const { x, y, v, punch, litYep, litNope, loop } = values;
  /** The committed card's look and poster, kept on the stage while its effect fades. */
  const [fading, setFading] = useState<{ look: Look; posterUrl: string | null } | null>(null);
  /**
   * The stage is moving (a drag, a commit, its fade). The card's look layers mount and the slow loop
   * runs only then; at rest the card is just the card.
   */
  const [engaged, setEngaged] = useState(false);
  /**
   * Answered cards flying off, in the order they were answered. Each answer is sent the moment it is
   * pressed; the stage plays one fly-off after another, and `card` (the next unanswered one) becomes
   * the top card once they are done. A press during a fly-off answers the card underneath.
   */
  const [flights, setFlights] = useState<readonly Flight[]>([]);
  const flightsRef = useRef<readonly Flight[]>([]);
  const flightSerial = useRef(0);
  /** The flight whose animation runs (started from the press, or after the one before it). */
  const flying = useRef<number | null>(null);
  /** The last flight just left: its look keeps fading over the next card. */
  const landed = useRef(false);
  /** A fly-off is playing (no drags meanwhile; presses queue up behind it). */
  const busy = useRef(false);
  const setQueue = (next: readonly Flight[]) => {
    flightsRef.current = next;
    busy.current = next.length > 0;
    setFlights(next);
  };

  const head = flights[0] ?? null;
  const top: StageCard | null = head ? head.card : card;
  const under: GlowTitle | null = head ? (flights[1]?.card.title ?? card?.title ?? null) : next;
  const topKey = head ? `f:${head.id}` : `c:${card?.key ?? ''}`;
  const stageLook = fading?.look ?? top?.look ?? null;
  const stagePoster = fading ? fading.posterUrl : top?.title.posterUrl ?? null;

  const loops = !reduced && ((engaged && stageLook !== null && LOOPING.includes(stageLook)) || (moment !== null && LOOPING.includes(moment.look)));
  useEffect(() => {
    if (!loops) return;
    loop.setValue(0);
    const run = Animated.loop(Animated.timing(loop, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: driver }));
    run.start();
    return () => run.stop();
  }, [loops, loop]);

  // Neon: the side flickers on when the drive crosses the threshold and fades when it drops back.
  useEffect(() => {
    let side = 0;
    const flicker = (a: Animated.Value) => Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 40, useNativeDriver: driver }),
      Animated.timing(a, { toValue: 0.15, duration: 60, useNativeDriver: driver }),
      Animated.timing(a, { toValue: 0.9, duration: 40, useNativeDriver: driver }),
      Animated.timing(a, { toValue: 0.35, duration: 80, useNativeDriver: driver }),
      Animated.timing(a, { toValue: 1, duration: 60, useNativeDriver: driver }),
    ]).start();
    const id = v.addListener(({ value }) => {
      const now = value >= 0.98 ? 1 : value <= -0.98 ? -1 : Math.abs(value) < 0.9 ? 0 : side;
      if (now === side) return;
      const was = side;
      side = now;
      if (was === 1) Animated.timing(litYep, { toValue: 0, duration: 160, useNativeDriver: driver }).start();
      if (was === -1) Animated.timing(litNope, { toValue: 0, duration: 160, useNativeDriver: driver }).start();
      if (now === 1) { if (reduced) litYep.setValue(1); else flicker(litYep); }
      if (now === -1) { if (reduced) litNope.setValue(1); else flicker(litNope); }
    });
    return () => v.removeListener(id);
  }, [v, litYep, litNope, reduced]);

  // The match moment: in, hold, out; the stage's own look steps aside meanwhile.
  const momentKey = moment?.key;
  useEffect(() => {
    if (!momentKey) return;
    const a = values.moment;
    const end = () => { a.setValue(0); onMomentEnd(momentKey); };
    if (reduced) {
      a.setValue(1);
      const id = setTimeout(end, 900);
      return () => clearTimeout(id);
    }
    a.setValue(0);
    const run = Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(1.6)), useNativeDriver: driver }),
      Animated.delay(700),
      Animated.timing(a, { toValue: 2, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: driver }),
    ]);
    run.start(({ finished }) => { if (finished) end(); });
    return () => run.stop();
  }, [momentKey, reduced, values.moment, onMomentEnd]);

  const engage = () => setEngaged(true);
  const rest = () => { if (!busy.current) setEngaged(false); };
  const settle = () => {
    Animated.parallel([
      Animated.spring(x, { toValue: 0, friction: 6, tension: 90, useNativeDriver: driver }),
      Animated.spring(y, { toValue: 0, friction: 6, tension: 90, useNativeDriver: driver }),
      // No overshoot past rest: the other answer's look must not flash.
      Animated.spring(v, { toValue: 0, friction: 7, tension: 90, overshootClamping: true, useNativeDriver: driver }),
    ]).start(({ finished }) => { if (finished) rest(); });
  };
  /** The flight left the stage: the next one (or the current card) takes its place, its look fades. */
  const land = (f: Flight) => {
    if (flightsRef.current[0]?.id !== f.id) return;
    flying.current = null;
    landed.current = true;
    setFading({ look: f.card.look, posterUrl: f.card.title.posterUrl });
    setQueue(flightsRef.current.slice(1));
    if (reduced) {
      v.setValue(0);
      setFading(null);
      if (!busy.current) setEngaged(false);
      return;
    }
    Animated.sequence([
      Animated.delay(260),
      Animated.timing(v, { toValue: 0, duration: 340, easing: Easing.out(Easing.quad), useNativeDriver: driver }),
    ]).start(() => { setFading(null); rest(); });
  };
  const fly = (f: Flight) => {
    flying.current = f.id;
    engage();
    playFeedback('swipe');
    const s = f.answer ? 1 : -1;
    if (reduced) {
      // Keep the answered card out of sight until the next one replaces it.
      x.setValue(s * off);
      v.setValue(s);
      land(f);
      return;
    }
    const out = (ms: number) => Animated.timing(x, { toValue: s * off, duration: ms, easing: Easing.in(Easing.quad), useNativeDriver: driver });
    const move = f.fromDrag ? out(300) : Animated.sequence([
      Animated.timing(x, { toValue: s * threshold * 1.25, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: driver }),
      Animated.delay(200),
      out(260),
    ]);
    Animated.parallel([
      move,
      Animated.timing(v, { toValue: s, duration: f.fromDrag ? 80 : 160, easing: Easing.out(Easing.cubic), useNativeDriver: driver }),
      Animated.sequence([
        Animated.delay(f.fromDrag ? 0 : 140),
        Animated.timing(punch, { toValue: 1, duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: driver }),
        Animated.timing(punch, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.quad), useNativeDriver: driver }),
      ]),
    ]).start(() => land(f));
  };
  const commit = (answer: boolean, fromDrag = false) => {
    // The card a press is aimed at: the top card, or during a fly-off the one underneath.
    const target = card;
    if (disabled || !target || flightsRef.current.some((f) => f.card.key === target.key)) {
      if (fromDrag) settle();
      return;
    }
    const f: Flight = { id: ++flightSerial.current, card: target, answer, fromDrag, services };
    const idle = flightsRef.current.length === 0;
    setQueue([...flightsRef.current, f]);
    // The answer goes out now; the fly-off is only its picture.
    void onVote(answer, target.key).then((sent) => {
      // Never sent: a fly-off still waiting its turn is dropped (the card stays unanswered).
      if (!sent && flying.current !== f.id && flightsRef.current.some((q) => q.id === f.id)) setQueue(flightsRef.current.filter((q) => q.id !== f.id));
    });
    // From where the drag left the card (or from rest).
    if (idle) fly(f);
  };

  // A new top card starts clean; a flight queued behind the one that just left starts its fly-off.
  // The look of a card this device just answered keeps fading on the stage.
  useLayoutEffect(() => {
    const f = flightsRef.current[0];
    if (f && flying.current === f.id) return;
    x.stopAnimation();
    y.stopAnimation();
    x.setValue(0);
    y.setValue(0);
    if (!landed.current) {
      v.stopAnimation();
      v.setValue(0);
    }
    landed.current = false;
    if (f) fly(f);
    // fly reads the current props; only a change of top card matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topKey, x, y, v]);

  // The responder lives as long as the stage; it reads the current props through `live`.
  const live = useRef({ commit, settle, threshold, disabled, onDetails, onGesture, engage });
  useLayoutEffect(() => {
    live.current = { commit, settle, threshold, disabled, onDetails, onGesture, engage };
  });
  useImperativeHandle(controls, () => ({ commit: (yes: boolean) => live.current.commit(yes) }), []);
  // PanResponder only invokes these closures for events; it never reads the refs during construction.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const base = { x: 0, y: 0 };
    let handling = false;
    /** The pointer went somewhere: coming back to the start is a cancelled swipe, not a tap. */
    let moved = false;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !busy.current && !live.current.disabled,
      onMoveShouldSetPanResponder: (_, g) => !busy.current && !live.current.disabled && Math.abs(g.dx) + Math.abs(g.dy) > 3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        x.stopAnimation((value) => { base.x = value; });
        y.stopAnimation((value) => { base.y = value; });
        v.stopAnimation();
        handling = false;
        moved = false;
        live.current.engage();
        live.current.onGesture('reach');
      },
      onPanResponderMove: (_, g) => {
        const dx = base.x + g.dx;
        x.setValue(dx);
        y.setValue(base.y + g.dy * 0.35);
        v.setValue(Math.max(-1.3, Math.min(1.3, dx / live.current.threshold)));
        if (Math.abs(g.dx) >= 6 || Math.abs(g.dy) >= 6) moved = true;
        if (!handling && Math.abs(g.dx) > 15) {
          handling = true;
          live.current.onGesture('handle');
        }
      },
      onPanResponderRelease: (_, g) => {
        const L = live.current;
        L.onGesture('release');
        const dx = base.x + g.dx;
        if (!moved && Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
          L.settle();
          if (!L.disabled) L.onDetails();
        } else if (dx > L.threshold || g.vx > 0.75) L.commit(true, true);
        else if (dx < -L.threshold || g.vx < -0.75) L.commit(false, true);
        else L.settle();
      },
      onPanResponderTerminate: () => {
        live.current.onGesture('release');
        live.current.settle();
      },
    });
  });

  // ←/→ answer like the buttons (web; never while typing).
  useEffect(() => {
    if (!web || !keys || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      live.current.commit(e.key === 'ArrowRight');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys]);

  // Drives, all 0 at rest. The card's own layers follow the card; the stage's follow `v`.
  const yepP = x.interpolate({ inputRange: [8, Math.max(9, threshold)], outputRange: [0, 1], ...clampI });
  const nopeP = x.interpolate({ inputRange: [-Math.max(9, threshold), -8], outputRange: [1, 0], ...clampI });
  const vYep = v.interpolate({ inputRange: [0.03, 1], outputRange: [0, 1], ...clampI });
  const vNope = v.interpolate({ inputRange: [-1, -0.03], outputRange: [1, 0], ...clampI });
  const punchI = same(punch);
  const litY = same(litYep);
  const litN = same(litNope);
  const quiet = values.moment.interpolate({ inputRange: [0, 0.4, 1.6, 2], outputRange: [1, 0, 0, 1], ...clampI });
  // Stamp: the stage takes a short knock when the stamp lands.
  const knock = stageLook === 'stamp' && !reduced ? (phone ? 6 : geo.z(9)) : 0;
  const stageProps = (kind: Kind, p: A): LayerProps | null => stageLook
    ? { look: stageLook, g: geo, kind, p, loop, punch: punchI, lit: kind === 'yep' ? litY : litN, x, posterUrl: stagePoster, reduced }
    : null;
  /** One answer's stage layers, invisible (and skipped by the compositor) until its drive moves. */
  const stageSide = (kind: 'yep' | 'nope', p: A, layer: typeof BackLayer, testID?: string) => {
    const props = stageProps(kind, p);
    const on = kind === 'yep' ? v.interpolate({ inputRange: [0.03, 0.031], outputRange: [0, 1], ...clampI }) : v.interpolate({ inputRange: [-0.031, -0.03], outputRange: [1, 0], ...clampI });
    const Layer = layer;
    return <Animated.View testID={testID} style={[fill, { opacity: on }]}>{props ? <Layer {...props} /> : null}</Animated.View>;
  };
  const cardSide = (kind: 'yep' | 'nope'): CardLayerProps | null => top
    ? { look: top.look, kind, w, h, phone, x, p: kind === 'yep' ? yepP : nopeP, punch: punchI, lit: kind === 'yep' ? litY : litN, posterUrl: top.title.posterUrl }
    : null;
  const yepCard = cardSide('yep');
  const nopeCard = cardSide('nope');
  const box = { position: 'absolute', left: (aw - w) / 2, top: cardTop, width: w, height: h } as const;

  return (
    <View style={{ width: aw, height: geo.stageH }}>
      <Animated.View {...hidden} style={[fill, { opacity: quiet, transform: [{ translateY: punch.interpolate({ inputRange: [0, 1], outputRange: [0, knock] }) }] }]}>
        {stageSide('nope', vNope, BackLayer)}
        {stageSide('yep', vYep, BackLayer)}
      </Animated.View>
      {under && top ? (
        <Animated.View {...hidden} style={[box, { opacity: 0.85, transform: [{ scale: x.interpolate({ inputRange: [-lean, 0, lean], outputRange: [1, 0.94, 1], ...clampI }) }, { translateY: x.interpolate({ inputRange: [-lean, 0, lean], outputRange: [0, 14, 0], ...clampI }) }] }]}>
          <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a1610' }}>
            {under.posterUrl ? <Image source={{ uri: under.posterUrl }} accessible={false} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> : null}
          </View>
        </Animated.View>
      ) : null}
      {top && yepCard && nopeCard ? (
        <View style={box}>
          <PeerStage layer="back" activity={activity} width={w} height={h} desktop={false} />
          <PointerSurface width={w} height={h} onPointer={onPointer}>
            <Poster title={top.title} width={w} height={h} phone={phone} z={geo.z} showText={h >= 300} x={x} y={y} pan={pan.panHandlers} look={top.look} services={head ? head.services : services}
              onDetails={onDetails} onTrailer={onTrailer}
              halo={engaged ? <><CardGlow {...nopeCard} /><CardGlow {...yepCard} /></> : null}
              under={engaged ? <><CardUnder {...nopeCard} /><CardUnder {...yepCard} /></> : null}
              over={engaged ? <><CardOver {...nopeCard} /><CardOver {...yepCard} /></> : null} />
          </PointerSurface>
          <PeerStage layer="front" activity={activity} width={w} height={h} desktop={false} />
        </View>
      ) : <View style={box}>{empty}</View>}
      <Animated.View {...hidden} style={[fill, { opacity: quiet }]}>
        {stageSide('nope', vNope, FrontLayer, 'stamp-nope')}
        {stageSide('yep', vYep, FrontLayer, 'stamp-yep')}
      </Animated.View>
      {moment ? <Moment key={moment.key} look={moment.look} g={geo} posterUrl={moment.title.posterUrl} a={values.moment} loop={loop} reduced={reduced} /> : null}
    </View>
  );
}
