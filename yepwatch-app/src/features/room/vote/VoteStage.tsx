/**
 * The voting stage: the card with its drag and swipe, the card behind it, the friends' live
 * pointers, and the card's YEP / NOPE look around it.
 *
 * One drag core drives the live card: `x` and `y` move it (it follows the pointer and tilts), `v`
 * (−1…1) drives the stage looks. A release past a third of the card width, or a flick, answers it;
 * anything less springs it back. Nothing shows at rest; a look builds in with the drag and reaches
 * full strength at the threshold. An answer makes the next card live on the next frame: the answered
 * card flies off over it, taking no input, and its look plays out and fades on its own drive.
 * Transform and opacity only.
 */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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
import { clampI, driver, fill, hidden, same, web, type A, type LayerProps } from './paint';

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
/** The answered card flying off over the next one. Its answer went out when it was pressed. */
interface Departure {
  id: number;
  card: StageCard;
  answer: boolean;
  /** Where the drag left it (0 for a button or key). */
  x0: number;
  y0: number;
  /** Its streaming logos, as they were when it was answered. */
  services?: ReactNode;
}
/** The answered card's stage look, playing out on its own drive while the next card is live. */
interface Fade {
  id: number;
  look: Look;
  posterUrl: string | null;
  v: Animated.Value;
  punch: Animated.Value;
  lit: Animated.Value;
}

/** The first card of a round that just started rises in this long (it is live from its first frame). */
export const ENTRY_MS = 140;
/** The answered card flies off in this long. */
export const FLY_MS = 250;
/** The answered card's stage look builds in and fades in about 450 ms. */
const FADE_IN_MS = 120;
const FADE_OUT_MS = 330;

function flicker(a: Animated.Value) {
  return Animated.sequence([
    Animated.timing(a, { toValue: 1, duration: 40, useNativeDriver: driver }),
    Animated.timing(a, { toValue: 0.15, duration: 60, useNativeDriver: driver }),
    Animated.timing(a, { toValue: 0.9, duration: 40, useNativeDriver: driver }),
    Animated.timing(a, { toValue: 0.35, duration: 80, useNativeDriver: driver }),
    Animated.timing(a, { toValue: 1, duration: 60, useNativeDriver: driver }),
  ]);
}

const noop = () => undefined;

/** One answered card leaving: drawn over the live card, out of the accessibility tree, taking no input. */
function Departing({ d, geo, onDone }: { d: Departure; geo: StageGeometry; onDone: (id: number) => void }) {
  const { w, h, aw, cardTop, threshold, off, phone } = geo;
  const [values] = useState(() => ({ x: new Animated.Value(d.x0), y: new Animated.Value(d.y0), zero: new Animated.Value(0), one: new Animated.Value(1) }));
  const { x, y } = values;
  useEffect(() => {
    const run = Animated.timing(x, { toValue: (d.answer ? 1 : -1) * off, duration: FLY_MS, easing: Easing.in(Easing.quad), useNativeDriver: driver });
    run.start(({ finished }) => { if (finished) onDone(d.id); });
    return () => run.stop();
    // Plays once, from the press.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The card's own look follows its own move.
  const p: A = d.answer
    ? x.interpolate({ inputRange: [8, Math.max(9, threshold)], outputRange: [0, 1], ...clampI })
    : x.interpolate({ inputRange: [-Math.max(9, threshold), -8], outputRange: [1, 0], ...clampI });
  const side: CardLayerProps = { look: d.card.look, kind: d.answer ? 'yep' : 'nope', w, h, phone, x, p, punch: same(values.zero), lit: same(values.one), posterUrl: d.card.title.posterUrl };
  return (
    <View {...hidden} style={{ position: 'absolute', left: (aw - w) / 2, top: cardTop, width: w, height: h }}>
      <Poster title={d.card.title} width={w} height={h} phone={phone} z={geo.z} showText={h >= 300} x={x} y={y} pan={{}} look={d.card.look} services={d.services}
        leaving onDetails={noop} onTrailer={noop}
        halo={<CardGlow {...side} />} under={<CardUnder {...side} />} over={<CardOver {...side} />} />
    </View>
  );
}

export function VoteStage({ geo, card, next, empty, disabled, keys, reduced, enter, onEntered, activity, services, moment, controls, onVote, onDetails, onTrailer, onGesture, onPointer, onMomentEnd }: {
  geo: StageGeometry;
  /** The live card: the next unanswered one, what every press answers. */
  card: StageCard | null;
  /** The card underneath, seen while the top card moves. */
  next: GlowTitle | null;
  /** Where the card would be while there is none. */
  empty?: ReactNode;
  disabled: boolean;
  /** ←/→ answer (web). */
  keys: boolean;
  reduced: boolean;
  /** The round just started: the first card rises in (read once, when the stage mounts). */
  enter?: boolean;
  /** The entry has been taken (so voting coming back later doesn't play it again). */
  onEntered?: () => void;
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
  const { w, h, aw, cardTop, threshold, lean, phone } = geo;
  const [values] = useState(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    v: new Animated.Value(0),
    /** The live card never takes a knock; its layers get a resting punch. */
    still: new Animated.Value(0),
    litYep: new Animated.Value(0),
    litNope: new Animated.Value(0),
    moment: new Animated.Value(0),
    loop: new Animated.Value(0),
    /** The round's first card rising in (1 at rest). */
    rise: new Animated.Value(enter && !reduced ? 0 : 1),
  }));
  const { x, y, v, litYep, litNope, loop, rise } = values;
  /** The live card is being dragged: its look layers mount only then; at rest the card is just the card. */
  const [engaged, setEngaged] = useState(false);
  /**
   * The answered card flying off on top. Its answer went out at the press, so `card` is already the
   * next one, live underneath it from the next frame. A new press ends this flight and starts its own.
   */
  const [departure, setDeparture] = useState<Departure | null>(null);
  const [fade, setFade] = useState<Fade | null>(null);
  const fadeRun = useRef<Animated.CompositeAnimation | null>(null);
  const serial = useRef(0);
  /** The card a press already answered, until the next card takes its place (a repeat never answers it twice). */
  const answered = useRef<string | null>(null);
  /** Which neon side the live drag has lit. */
  const litSide = useRef(0);
  /** The live drag's last position and drive, written by the gesture as it moves the card. */
  const dragAt = useRef({ x: 0, y: 0, v: 0 });
  const topKey = card?.key ?? '';

  // The first card of a round that just started rises in; it takes presses and drags all along.
  useLayoutEffect(() => {
    if (!enter) return;
    onEntered?.();
    if (reduced) return;
    rise.setValue(0);
    const run = Animated.timing(rise, { toValue: 1, duration: ENTRY_MS, easing: Easing.out(Easing.cubic), useNativeDriver: driver });
    run.start();
    return () => { run.stop(); rise.setValue(1); };
    // Once, for the round that just started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loops = !reduced && ((engaged && card !== null && LOOPING.includes(card.look)) || (fade !== null && LOOPING.includes(fade.look)) || (moment !== null && LOOPING.includes(moment.look)));
  useEffect(() => {
    if (!loops) return;
    loop.setValue(0);
    const run = Animated.loop(Animated.timing(loop, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: driver }));
    run.start();
    return () => run.stop();
  }, [loops, loop]);

  // Neon: the side flickers on when the drag crosses the threshold and fades when it drops back.
  useEffect(() => {
    const id = v.addListener(({ value }) => {
      const now = value >= 0.98 ? 1 : value <= -0.98 ? -1 : Math.abs(value) < 0.9 ? 0 : litSide.current;
      if (now === litSide.current) return;
      const was = litSide.current;
      litSide.current = now;
      if (was === 1) Animated.timing(litYep, { toValue: 0, duration: 160, useNativeDriver: driver }).start();
      if (was === -1) Animated.timing(litNope, { toValue: 0, duration: 160, useNativeDriver: driver }).start();
      if (now === 1) { if (reduced) litYep.setValue(1); else flicker(litYep).start(); }
      if (now === -1) { if (reduced) litNope.setValue(1); else flicker(litNope).start(); }
    });
    return () => v.removeListener(id);
  }, [v, litYep, litNope, reduced]);

  // The match moment: in, hold, out; the stage's looks step aside meanwhile.
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

  useEffect(() => () => fadeRun.current?.stop(), []);

  const engage = () => setEngaged(true);
  const settle = () => {
    Animated.parallel([
      Animated.spring(x, { toValue: 0, friction: 6, tension: 90, useNativeDriver: driver }),
      Animated.spring(y, { toValue: 0, friction: 6, tension: 90, useNativeDriver: driver }),
      // No overshoot past rest: the other answer's look must not flash.
      Animated.spring(v, { toValue: 0, friction: 7, tension: 90, overshootClamping: true, useNativeDriver: driver }),
    ]).start(({ finished }) => { if (finished) setEngaged(false); });
  };
  const departed = useCallback((id: number) => setDeparture((d) => (d?.id === id ? null : d)), []);

  /** The answered card's stage look on its own drive: from where the drag left it to full, then fading. */
  const playFade = (look: Look, posterUrl: string | null, answer: boolean, v0: number, wasLit: boolean) => {
    fadeRun.current?.stop();
    const f: Fade = { id: ++serial.current, look, posterUrl, v: new Animated.Value(v0), punch: new Animated.Value(0), lit: new Animated.Value(wasLit ? 1 : 0) };
    setFade(f);
    const run = Animated.parallel([
      ...(wasLit ? [] : [flicker(f.lit)]),
      Animated.sequence([
        Animated.timing(f.v, { toValue: answer ? 1 : -1, duration: FADE_IN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: driver }),
        Animated.timing(f.v, { toValue: 0, duration: FADE_OUT_MS, easing: Easing.out(Easing.quad), useNativeDriver: driver }),
      ]),
      // Stamp: the stage takes a short knock as the stamp lands.
      Animated.sequence([
        Animated.delay(40),
        Animated.timing(f.punch, { toValue: 1, duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: driver }),
        Animated.timing(f.punch, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.quad), useNativeDriver: driver }),
      ]),
    ]);
    fadeRun.current = run;
    run.start(() => {
      if (fadeRun.current === run) fadeRun.current = null;
      setFade((cur) => (cur?.id === f.id ? null : cur));
    });
  };

  const commit = (answer: boolean, fromDrag = false) => {
    // Always the live card: the one in place, the one the person sees and can touch.
    const target = card;
    if (disabled || !target || answered.current === target.key) {
      if (fromDrag) settle();
      return;
    }
    answered.current = target.key;
    // Where the released drag left the card, as the gesture set it: a native-driven stopAnimation reports
    // its value only later, so the departing copy would start at the center.
    const at = fromDrag ? dragAt.current : { x: 0, y: 0, v: 0 };
    const x0 = at.x;
    const y0 = at.y;
    const v0 = Math.max(-1, Math.min(1, at.v));
    x.stopAnimation();
    y.stopAnimation();
    v.stopAnimation();
    const wasLit = litSide.current === (answer ? 1 : -1);
    // The next card starts clean, in place, this frame (neon first, so the drive's reset lights nothing).
    litSide.current = 0;
    litYep.setValue(0);
    litNope.setValue(0);
    x.setValue(0);
    y.setValue(0);
    v.setValue(0);
    setEngaged(false);
    playFeedback('swipe');
    if (reduced) setDeparture(null);
    else {
      setDeparture({ id: ++serial.current, card: target, answer, x0, y0, services });
      playFade(target.look, target.title.posterUrl, answer, v0, wasLit);
    }
    // The answer goes out now; the fly-off is only its picture.
    void onVote(answer, target.key).then((sent) => {
      // A vote that didn't go out leaves the card answerable.
      if (!sent && answered.current === target.key) answered.current = null;
    });
  };

  // A new live card starts clean and answerable (a vote, Undo, a refill, a new round).
  useLayoutEffect(() => {
    answered.current = null;
    x.stopAnimation();
    y.stopAnimation();
    v.stopAnimation();
    x.setValue(0);
    y.setValue(0);
    v.setValue(0);
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
      // A card flying off never blocks the live one.
      onStartShouldSetPanResponder: () => !live.current.disabled,
      onMoveShouldSetPanResponder: (_, g) => !live.current.disabled && Math.abs(g.dx) + Math.abs(g.dy) > 3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        x.stopAnimation((value) => { base.x = value; });
        y.stopAnimation((value) => { base.y = value; });
        v.stopAnimation();
        dragAt.current = { x: base.x, y: base.y, v: 0 };
        handling = false;
        moved = false;
        live.current.engage();
        live.current.onGesture('reach');
      },
      onPanResponderMove: (_, g) => {
        const dx = base.x + g.dx;
        dragAt.current = { x: dx, y: base.y + g.dy * 0.35, v: Math.max(-1.3, Math.min(1.3, dx / live.current.threshold)) };
        x.setValue(dragAt.current.x);
        y.setValue(dragAt.current.y);
        v.setValue(dragAt.current.v);
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
        dragAt.current = { x: dx, y: base.y + g.dy * 0.35, v: Math.max(-1.3, Math.min(1.3, dx / L.threshold)) };
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

  // Drives, all 0 at rest. The card's own layers follow the card; the stage's follow `v` (or a fade's own drive).
  const yepP = x.interpolate({ inputRange: [8, Math.max(9, threshold)], outputRange: [0, 1], ...clampI });
  const nopeP = x.interpolate({ inputRange: [-Math.max(9, threshold), -8], outputRange: [1, 0], ...clampI });
  const stillI = same(values.still);
  const litY = same(litYep);
  const litN = same(litNope);
  const quiet = values.moment.interpolate({ inputRange: [0, 0.4, 1.6, 2], outputRange: [1, 0, 0, 1], ...clampI });
  /** One look's stage layers on one drive; each answer's side is invisible (and skipped by the compositor) until its drive moves. */
  const stageLayers = (layer: typeof BackLayer, look: Look, drive: Animated.Value, kick: A, lit: { yep: A; nope: A }, posterUrl: string | null, ids: boolean) => {
    const side = (kind: 'yep' | 'nope') => {
      const p = kind === 'yep' ? drive.interpolate({ inputRange: [0.03, 1], outputRange: [0, 1], ...clampI }) : drive.interpolate({ inputRange: [-1, -0.03], outputRange: [1, 0], ...clampI });
      const on = kind === 'yep' ? drive.interpolate({ inputRange: [0.03, 0.031], outputRange: [0, 1], ...clampI }) : drive.interpolate({ inputRange: [-0.031, -0.03], outputRange: [1, 0], ...clampI });
      const props: LayerProps = { look, g: geo, kind, p, loop, punch: kick, lit: lit[kind], x, posterUrl, reduced };
      const Layer = layer;
      return <Animated.View key={kind} testID={ids ? `stamp-${kind}` : undefined} style={[fill, { opacity: on }]}><Layer {...props} /></Animated.View>;
    };
    return <>{side('nope')}{side('yep')}</>;
  };
  const fadeKick = fade ? same(fade.punch) : null;
  const fadeLit = fade ? same(fade.lit) : null;
  // Stamp: the stage takes a short knock when the stamp lands.
  const knock = fade && fadeKick && fade.look === 'stamp' && !reduced ? fadeKick.interpolate({ inputRange: [0, 1], outputRange: [0, phone ? 6 : geo.z(9)] }) : 0;
  const cardSide = (kind: 'yep' | 'nope'): CardLayerProps | null => card
    ? { look: card.look, kind, w, h, phone, x, p: kind === 'yep' ? yepP : nopeP, punch: stillI, lit: kind === 'yep' ? litY : litN, posterUrl: card.title.posterUrl }
    : null;
  const yepCard = cardSide('yep');
  const nopeCard = cardSide('nope');
  const box = { position: 'absolute', left: (aw - w) / 2, top: cardTop, width: w, height: h } as const;
  const under = card ? next : null;
  /** The round's first card rising in (identity at rest). */
  const entry = { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] };

  return (
    <View style={{ width: aw, height: geo.stageH }}>
      {fade && fadeKick && fadeLit ? (
        <Animated.View {...hidden} style={[fill, { opacity: quiet, transform: [{ translateY: knock }] }]}>
          {stageLayers(BackLayer, fade.look, fade.v, fadeKick, { yep: fadeLit, nope: fadeLit }, fade.posterUrl, false)}
        </Animated.View>
      ) : null}
      {card ? (
        <Animated.View {...hidden} style={[fill, { opacity: quiet }]}>
          {stageLayers(BackLayer, card.look, v, stillI, { yep: litY, nope: litN }, card.title.posterUrl, false)}
        </Animated.View>
      ) : null}
      {under ? (
        <Animated.View {...hidden} testID="card-under" style={[box, { opacity: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }), transform: [{ scale: x.interpolate({ inputRange: [-lean, 0, lean], outputRange: [1, 0.94, 1], ...clampI }) }, { translateY: x.interpolate({ inputRange: [-lean, 0, lean], outputRange: [0, 14, 0], ...clampI }) }] }]}>
          <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a1610' }}>
            {under.posterUrl ? <Image source={{ uri: under.posterUrl }} accessible={false} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> : null}
          </View>
        </Animated.View>
      ) : null}
      {card && yepCard && nopeCard ? (
        <Animated.View style={[box, entry]}>
          <PeerStage layer="back" activity={activity} width={w} height={h} desktop={false} />
          <PointerSurface width={w} height={h} onPointer={onPointer}>
            <Poster title={card.title} width={w} height={h} phone={phone} z={geo.z} showText={h >= 300} x={x} y={y} pan={pan.panHandlers} look={card.look} services={services}
              onDetails={onDetails} onTrailer={onTrailer}
              halo={engaged ? <><CardGlow {...nopeCard} /><CardGlow {...yepCard} /></> : null}
              under={engaged ? <><CardUnder {...nopeCard} /><CardUnder {...yepCard} /></> : null}
              over={engaged ? <><CardOver {...nopeCard} /><CardOver {...yepCard} /></> : null} />
          </PointerSurface>
          <PeerStage layer="front" activity={activity} width={w} height={h} desktop={false} />
        </Animated.View>
      ) : <View style={box}>{empty}</View>}
      {departure ? <Departing key={departure.id} d={departure} geo={geo} onDone={departed} /> : null}
      {card ? (
        <Animated.View {...hidden} style={[fill, { opacity: quiet }]}>
          {stageLayers(FrontLayer, card.look, v, stillI, { yep: litY, nope: litN }, card.title.posterUrl, true)}
        </Animated.View>
      ) : null}
      {fade && fadeKick && fadeLit ? (
        <Animated.View {...hidden} style={[fill, { opacity: quiet }]}>
          {stageLayers(FrontLayer, fade.look, fade.v, fadeKick, { yep: fadeLit, nope: fadeLit }, fade.posterUrl, false)}
        </Animated.View>
      ) : null}
      {moment ? <Moment key={moment.key} look={moment.look} g={geo} posterUrl={moment.title.posterUrl} a={values.moment} loop={loop} reduced={reduced} /> : null}
    </View>
  );
}
