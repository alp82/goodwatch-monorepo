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
import { memo, startTransition, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, Image, PanResponder, View, type GestureResponderHandlers } from 'react-native';
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
import { FxView } from './fx-view';
import { clampI, driver, fill, hidden, same, web, type A, type LayerProps, type Node } from './paint';

export interface StageCard {
  /** Stable for one card in one round (Undo brings the same key back). */
  key: string;
  title: GlowTitle;
  look: Look;
}
export interface MatchMoment {
  key: string;
  /** The key of the card whose Yep made it (`StageCard.key`). */
  cardKey: string;
  title: GlowTitle;
  look: Look;
}
/**
 * A match moment built ahead, hidden, for a card a Yep may still make a match of: the live card, and the card
 * of the latest Yep until its answer is in. MATCH then only has to show it (opacity and transforms), not build
 * and paint it in its first frame.
 */
interface Seat {
  id: number;
  cardKey: string;
  look: Look;
  posterUrl: string | null;
  /** Its own drive: 1 (fully in, so it is painted at full size) while it waits; the moment's run when it plays. */
  a: Animated.Value;
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
/**
 * One card's stage look (its layers behind and in front of the card) with drives of its own. While the
 * card is live they follow the drag (`gate` 1: drive = v, lit = the drag's neon); once the card is
 * answered the same layers play the look out (`gate` 0: drive = fadeV, lit = fadeLit, punch knocks).
 * So an answer mounts nothing for the look: the live card's layers simply become the fade, and the next
 * card's layers are built in the background (a transition) while nothing depends on them yet.
 */
interface LookSet {
  /** This set's own identity (Undo brings a card back with a fresh set while its old one still plays out). */
  id: number;
  /** The card's key. */
  key: string;
  look: Look;
  posterUrl: string | null;
  gate: Animated.Value;
  fadeV: Animated.Value;
  punch: Animated.Value;
  fadeLit: Animated.Value;
  drive: Node;
  kick: A;
  lit: { yep: A; nope: A };
  /** Answered: playing out; never live again. */
  fading: boolean;
}
/** The answered card's stage look, playing out on its set's own drive while the next card is live. */
interface Fade {
  id: number;
  set: LookSet;
}

/** The first card of a round that just started rises in this long (it is live from its first frame). */
export const ENTRY_MS = 140;
/**
 * Where the rise is when the card's first frame paints: one 60 fps frame into the eased curve, so that
 * frame already shows the card (at 0 the stage would show nothing for a frame) and the rest plays as designed.
 */
const ENTRY_FIRST_FRAME = 1 - (1 - 16 / ENTRY_MS) ** 3;
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
const Departing = memo(function Departing({ d, geo, onDone }: { d: Departure; geo: StageGeometry; onDone: (id: number) => void }) {
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
        leaving onDetails={noop}
        halo={<CardGlow {...side} />} under={<CardUnder {...side} />} over={<CardOver {...side} />} />
    </View>
  );
});

/**
 * One answer's stage layers for one look on one drive. Invisible (and skipped by the compositor) until its
 * drive moves. Memoized: the stage re-renders on every vote, a look's layers only when their look or drive do.
 */
const StageSide = memo(function StageSide({ layer: Layer, kind, look, g, drive, kick, lit, loop, x, posterUrl, reduced, stacked }: {
  layer: ComponentType<LayerProps>;
  kind: 'yep' | 'nope';
  look: Look;
  g: StageGeometry;
  drive: Node;
  kick: A;
  lit: A;
  loop: Animated.Value;
  x: Animated.Value;
  posterUrl: string | null;
  reduced: boolean;
  stacked: boolean;
}) {
  const { p, on } = useMemo(() => ({ p: sideDrive(drive, kind), on: sideOn(drive, kind) }), [drive, kind]);
  return <Animated.View style={[fill, { opacity: on }]}><Layer look={look} g={g} kind={kind} p={p} loop={loop} punch={kick} lit={lit} x={x} posterUrl={posterUrl} reduced={reduced} stacked={stacked} /></Animated.View>;
});
/** A side's strength (0…1) on a stage drive (−1…1). */
const sideDrive = (drive: Node, kind: 'yep' | 'nope') => (drive as Animated.Value).interpolate(kind === 'yep' ? { inputRange: [0.03, 1], outputRange: [0, 1], ...clampI } : { inputRange: [-1, -0.03], outputRange: [1, 0], ...clampI });
/** A side's visibility: off at rest, on as soon as its drive moves. */
const sideOn = (drive: Node, kind: 'yep' | 'nope') => (drive as Animated.Value).interpolate(kind === 'yep' ? { inputRange: [0.03, 0.031], outputRange: [0, 1], ...clampI } : { inputRange: [-0.031, -0.03], outputRange: [1, 0], ...clampI });

/** The live card's `stamp-yep` / `stamp-nope`: empty, but visible exactly when that side of its look is (checks read them). */
const StampMarks = memo(function StampMarks({ v }: { v: Animated.Value }) {
  const on = useMemo(() => ({ nope: sideOn(v, 'nope'), yep: sideOn(v, 'yep') }), [v]);
  return <>{(['nope', 'yep'] as const).map((kind) => <Animated.View key={kind} {...hidden} testID={`stamp-${kind}`} style={[fill, { opacity: on[kind] }]} />)}</>;
});

/** The card underneath, seen while the top card moves. */
const UnderCard = memo(function UnderCard({ title, box, rise, x, lean }: { title: GlowTitle; box: object; rise: Animated.Value; x: Animated.Value; lean: number }) {
  const style = useMemo(() => [box, { opacity: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }), transform: [{ scale: x.interpolate({ inputRange: [-lean, 0, lean], outputRange: [1, 0.94, 1], ...clampI }) }, { translateY: x.interpolate({ inputRange: [-lean, 0, lean], outputRange: [0, 14, 0], ...clampI }) }] }], [box, rise, x, lean]);
  return (
    <Animated.View {...hidden} testID="card-under" style={style}>
      <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a1610' }}>
        {title.posterUrl ? <Image source={{ uri: title.posterUrl }} accessible={false} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> : null}
      </View>
    </Animated.View>
  );
});

/** The live card: its friends' pointers behind and in front, the pointer surface, the poster with its drag. */
const LiveCard = memo(function LiveCard({ card, geo, box, entry, x, y, pan, services, engaged, drives, activity, onPointer, onDetails }: {
  card: StageCard;
  geo: StageGeometry;
  box: object;
  entry: object;
  x: Animated.Value;
  y: Animated.Value;
  pan: GestureResponderHandlers;
  services?: ReactNode;
  engaged: boolean;
  drives: { yepP: A; nopeP: A; still: A; litY: A; litN: A };
  activity: Map<string, PeerActivity>;
  onPointer: (pointer: ActivityPointer | null) => void;
  onDetails: () => void;
}) {
  const { w, h, phone } = geo;
  const side = (kind: 'yep' | 'nope'): CardLayerProps => ({ look: card.look, kind, w, h, phone, x, p: kind === 'yep' ? drives.yepP : drives.nopeP, punch: drives.still, lit: kind === 'yep' ? drives.litY : drives.litN, posterUrl: card.title.posterUrl });
  const yepCard = side('yep');
  const nopeCard = side('nope');
  return (
    <Animated.View style={[box, entry]}>
      <PeerStage layer="back" activity={activity} width={w} height={h} desktop={false} />
      <PointerSurface width={w} height={h} onPointer={onPointer}>
        <Poster title={card.title} width={w} height={h} phone={phone} z={geo.z} showText={h >= 300} x={x} y={y} pan={pan} look={card.look} services={services}
          onDetails={onDetails}
          halo={engaged ? <><CardGlow {...nopeCard} /><CardGlow {...yepCard} /></> : null}
          under={engaged ? <><CardUnder {...nopeCard} /><CardUnder {...yepCard} /></> : null}
          over={engaged ? <><CardOver {...nopeCard} /><CardOver {...yepCard} /></> : null} />
      </PointerSurface>
      <PeerStage layer="front" activity={activity} width={w} height={h} desktop={false} />
    </Animated.View>
  );
});

const MemoMoment = memo(Moment);
/** A seat's moment: hidden while it waits (painted already, on layers of its own), shown as it plays. */
const SeatMoment = memo(function SeatMoment({ seat, active, g, loop, reduced }: { seat: Seat; active: boolean; g: StageGeometry; loop: Animated.Value; reduced: boolean }) {
  return (
    <FxView {...hidden} testID={active ? 'match-moment' : undefined} style={[fill, { opacity: active ? 1 : 0 }]}>
      <MemoMoment look={seat.look} g={g} posterUrl={seat.posterUrl} a={seat.a} loop={loop} reduced={reduced} testID="" />
    </FxView>
  );
});

/** Memoized: the voting screen re-renders on every room update; the stage only when what it shows changes. */
export const VoteStage = memo(function VoteStage({ geo, card, next, empty, disabled, keys, reduced, enter, onEntered, activity, services, moment, controls, onVote, onDetails, onGesture, onPointer, onMomentEnd }: {
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
    rise: new Animated.Value(enter && !reduced ? ENTRY_FIRST_FRAME : 1),
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
  /** The look layer sets: the live card's (once built) and the answered card's while it plays out. */
  const [sets, setSets] = useState<LookSet[]>([]);
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
    if (!enter || reduced) return;
    rise.setValue(ENTRY_FIRST_FRAME);
    const run = Animated.timing(rise, { toValue: 1, duration: ENTRY_MS - 16, easing: Easing.out(Easing.cubic), useNativeDriver: driver });
    run.start();
    return () => { run.stop(); rise.setValue(1); };
    // Once, for the round that just started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The entry is taken: told in the background, not in the commit that mounted the stage (the screen above it
  // re-rendering there made the first card's frame one long task). `enter` is only read as the stage mounts.
  useEffect(() => {
    if (enter) startTransition(() => onEntered?.());
    // Once, for the round that just started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loops = !reduced && ((engaged && card !== null && LOOPING.includes(card.look)) || (fade !== null && LOOPING.includes(fade.set.look)) || (moment !== null && LOOPING.includes(moment.look)));
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

  // The match moment: in, hold, out; the stage's looks step aside meanwhile. A seat built for its card plays it
  // (web); otherwise it is built now.
  const momentKey = moment?.key;
  const [seats, setSeats] = useState<Seat[]>([]);
  // Chosen once per moment: a seat built while a moment plays without one never takes it over, and the chosen seat
  // stays drawn until its moment ends, even if a deferred build pruned it from the list meanwhile.
  const playing = useMemo(() => (moment ? seats.find((s) => s.cardKey === moment.cardKey && s.look === moment.look && s.posterUrl === moment.title.posterUrl) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [momentKey]);
  const playingSeat = useRef(playing);
  useLayoutEffect(() => { playingSeat.current = playing; });
  // Before paint: a seat waits fully in (a = 1), so it starts from 0 in the very frame it shows. Its drive leads
  // and the stage's follows it: with no look on the stage nothing holds the stage's drive, and a held-less drive
  // stops its own run.
  useLayoutEffect(() => {
    if (!momentKey) return;
    const seat = playingSeat.current;
    const a = seat ? seat.a : values.moment;
    const follow = seat ? seat.a.addListener(({ value }) => values.moment.setValue(value)) : null;
    const end = () => {
      a.setValue(0);
      if (follow) seat!.a.removeListener(follow);
      values.moment.setValue(0);
      if (seat) setSeats((list) => list.filter((s) => s !== seat));
      onMomentEnd(momentKey);
    };
    if (reduced) {
      a.setValue(1);
      const id = setTimeout(end, 900);
      return () => { clearTimeout(id); if (follow) seat!.a.removeListener(follow); };
    }
    a.setValue(0);
    const run = Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(1.6)), useNativeDriver: driver }),
      Animated.delay(700),
      Animated.timing(a, { toValue: 2, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: driver }),
    ]);
    run.start(({ finished }) => { if (finished) end(); });
    return () => { run.stop(); if (follow) seat!.a.removeListener(follow); };
  }, [momentKey, reduced, values.moment, onMomentEnd]);

  useEffect(() => () => fadeRun.current?.stop(), []);

  const setSerial = useRef(0);
  const makeSet = useCallback((c: StageCard): LookSet => {
    const gate = new Animated.Value(1);
    const fadeV = new Animated.Value(0);
    const punch = new Animated.Value(0);
    const fadeLit = new Animated.Value(0);
    const gated = (lit: Animated.Value) => same(Animated.add(Animated.multiply(lit, gate), fadeLit));
    return {
      id: ++setSerial.current, key: c.key, look: c.look, posterUrl: c.title.posterUrl, gate, fadeV, punch, fadeLit, fading: false,
      drive: Animated.add(Animated.multiply(v, gate), fadeV), kick: same(punch), lit: { yep: gated(litYep), nope: gated(litNope) },
    };
  }, [v, litYep, litNope]);
  /** The live card's set, added unless it's there (answered sets stay until they finish). */
  const withLive = useCallback((list: LookSet[], c: StageCard) => (list.some((s) => s.key === c.key && !s.fading) ? list : [...list.filter((s) => s.fading), makeSet(c)]), [makeSet]);
  // A new live card's look layers are built in the background once the answered card has flown and its
  // look played out (nothing animates then): they show nothing until the card is dragged or answered, and
  // building them in the press, or during the fly-off, would cost frames of the next card's arrival.
  const liveCard = useRef(card);
  useLayoutEffect(() => { liveCard.current = card; });
  const settled = departure === null && fade === null;
  useEffect(() => {
    const c = liveCard.current;
    if (!c || !settled) return;
    // A set built for a card answered meanwhile is harmless: it isn't drawn, and the next build drops it.
    startTransition(() => setSets((list) => withLive(list, c)));
    // Per live card: its key names its look.
  }, [topKey, withLive, settled]);
  // The live card's seat is built the same way, once no moment plays either (its first paint would cost one of
  // that moment's frames). It keeps the latest Yep's seat, which waits for that Yep's answer.
  const seatSerial = useRef(0);
  const yepSeat = useRef<string | null>(null);
  const idle = settled && !momentKey;
  useEffect(() => {
    const c = liveCard.current;
    if (!c || !idle || !web) return;
    startTransition(() => setSeats((list) => {
      if (list.some((s) => s.cardKey === c.key && s.look === c.look && s.posterUrl === c.title.posterUrl)) return list;
      const kept = list.filter((s) => s.cardKey === yepSeat.current || s === playingSeat.current);
      return [...kept, { id: ++seatSerial.current, cardKey: c.key, look: c.look, posterUrl: c.title.posterUrl, a: new Animated.Value(1) }];
    }));
  }, [topKey, idle]);
  // A drag shows the live look at once: its set is built now if the background hasn't yet.
  const engage = () => {
    setEngaged(true);
    const c = liveCard.current;
    if (c) setSets((list) => withLive(list, c));
  };
  const settle = () => {
    Animated.parallel([
      Animated.spring(x, { toValue: 0, friction: 6, tension: 90, useNativeDriver: driver }),
      Animated.spring(y, { toValue: 0, friction: 6, tension: 90, useNativeDriver: driver }),
      // No overshoot past rest: the other answer's look must not flash.
      Animated.spring(v, { toValue: 0, friction: 7, tension: 90, overshootClamping: true, useNativeDriver: driver }),
    ]).start(({ finished }) => { if (finished) setEngaged(false); });
  };
  const departed = useCallback((id: number) => setDeparture((d) => (d?.id === id ? null : d)), []);

  /**
   * The answered card's stage look on its own drive: from where the drag left it to full, then fading.
   * Its live set (when built) turns into the fade; otherwise one is made for it now.
   */
  const playFade = (target: StageCard, answer: boolean, v0: number, wasLit: boolean) => {
    fadeRun.current?.stop();
    const existing = sets.find((s) => s.key === target.key && !s.fading);
    const set = existing ?? makeSet(target);
    set.fading = true;
    set.gate.setValue(0);
    set.fadeV.setValue(v0);
    set.punch.setValue(0);
    set.fadeLit.setValue(wasLit ? 1 : 0);
    // Any other unanswered set of this card goes (a background build that raced the press).
    // The fading set is kept exactly once, read from the list itself (React may replay this on another base).
    setSets((list) => {
      const kept = list.filter((s) => s === set || s.fading || s.key !== target.key);
      return kept.includes(set) ? kept : [...kept, set];
    });
    const f: Fade = { id: ++serial.current, set };
    setFade(f);
    const run = Animated.parallel([
      ...(wasLit ? [] : [flicker(set.fadeLit)]),
      Animated.sequence([
        Animated.timing(set.fadeV, { toValue: answer ? 1 : -1, duration: FADE_IN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: driver }),
        Animated.timing(set.fadeV, { toValue: 0, duration: FADE_OUT_MS, easing: Easing.out(Easing.quad), useNativeDriver: driver }),
      ]),
      // Stamp: the stage takes a short knock as the stamp lands.
      Animated.sequence([
        Animated.delay(40),
        Animated.timing(set.punch, { toValue: 1, duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: driver }),
        Animated.timing(set.punch, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.quad), useNativeDriver: driver }),
      ]),
    ]);
    fadeRun.current = run;
    run.start(() => {
      if (fadeRun.current === run) fadeRun.current = null;
      setFade((cur) => (cur?.id === f.id ? null : cur));
      setSets((list) => list.filter((s) => s !== set));
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
    if (answer) yepSeat.current = target.key;
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
      playFade(target, answer, v0, wasLit);
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

  // The card's own layers' drives, all 0 at rest, following the card. Made once per stage, so the memoized
  // card keeps the same nodes from vote to vote.
  const drives = useMemo(() => ({
    yepP: x.interpolate({ inputRange: [8, Math.max(9, threshold)], outputRange: [0, 1], ...clampI }),
    nopeP: x.interpolate({ inputRange: [-Math.max(9, threshold), -8], outputRange: [1, 0], ...clampI }),
    still: same(values.still),
    litY: same(litYep),
    litN: same(litNope),
  }), [x, threshold, values.still, litYep, litNope]);
  const quietFill = useMemo(() => [fill, { opacity: values.moment.interpolate({ inputRange: [0, 0.4, 1.6, 2], outputRange: [1, 0, 0, 1], ...clampI }) }], [values.moment]);
  const quiet = (quietFill[1] as { opacity: A }).opacity;
  // Stamp: the stage takes a short knock when the stamp lands.
  const knock = useMemo(() => (fade && fade.set.look === 'stamp' && !reduced ? fade.set.kick.interpolate({ inputRange: [0, 1], outputRange: [0, phone ? 6 : geo.z(9)] }) : 0), [fade, reduced, phone, geo]);
  const fadeBack = useMemo(() => [fill, { opacity: quiet, transform: [{ translateY: knock }] }], [quiet, knock]);
  /** A set's layers, behind or in front of the card: the live card's follow the drag, an answered one plays out. */
  const lookSet = (set: LookSet, layer: typeof BackLayer, style: object, stacked = false) => (
    <Animated.View key={set.id} {...hidden} style={style}>
      {(['nope', 'yep'] as const).map((kind) => (
        <StageSide key={kind} layer={layer} kind={kind} look={set.look} g={geo} drive={set.drive} kick={set.kick} lit={set.lit[kind]} loop={loop} x={x} posterUrl={set.posterUrl} reduced={reduced} stacked={stacked} />
      ))}
    </Animated.View>
  );
  const fading = fade ? sets.find((s) => s === fade.set) : undefined;
  const liveSet = card ? sets.find((s) => s.key === card.key && !s.fading) : undefined;
  // Behind: the answered look under the live one; in front: the live look under the answered one.
  const backSets = sets.filter((s) => s === fading || s === liveSet);
  const frontSets = [...backSets].sort((a, b) => Number(a === fading) - Number(b === fading));
  const box = useMemo(() => ({ position: 'absolute', left: (aw - w) / 2, top: cardTop, width: w, height: h } as const), [aw, w, cardTop, h]);
  const under = card ? next : null;
  /** The round's first card rising in (identity at rest). */
  const entry = useMemo(() => ({ opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }), [rise]);

  return (
    <View style={{ width: aw, height: geo.stageH }}>
      {backSets.map((set) => lookSet(set, BackLayer, set === fading ? fadeBack : quietFill, set !== fading && fading !== undefined))}
      {under ? <UnderCard title={under} box={box} rise={rise} x={x} lean={lean} /> : null}
      {card ? (
        <LiveCard card={card} geo={geo} box={box} entry={entry} x={x} y={y} pan={pan.panHandlers} services={services} engaged={engaged} drives={drives} activity={activity} onPointer={onPointer} onDetails={onDetails} />
      ) : <View style={box}>{empty}</View>}
      {departure ? <Departing key={departure.id} d={departure} geo={geo} onDone={departed} /> : null}
      {frontSets.map((set) => lookSet(set, FrontLayer, quietFill))}
      {card ? <StampMarks v={v} /> : null}
      {(playing && !seats.includes(playing) ? [...seats, playing] : seats).map((seat) => <SeatMoment key={seat.id} seat={seat} active={seat === playing} g={geo} loop={loop} reduced={reduced} />)}
      {moment && !playing ? <MemoMoment key={moment.key} look={moment.look} g={geo} posterUrl={moment.title.posterUrl} a={values.moment} loop={loop} reduced={reduced} /> : null}
    </View>
  );
});
