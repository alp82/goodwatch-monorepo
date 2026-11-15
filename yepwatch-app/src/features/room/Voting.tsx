/**
 * Voting (Tonight mode): every card asks "Would you watch this tonight?". Phones keep one column: the
 * faces and Undo over the stage, the card with its YEP / NOPE look, then the question, Nope / Yep and the
 * matches peek pinned under it. Wide windows put the card's column on the left and the question column on
 * the right ("Card 3 of 20", the question, "Why this …" when the card says why, Details and Trailer,
 * Nope / Yep, the matches peek). No idea label; the deck refills in the background, and an empty deck
 * shows "Finding more…", never an end.
 *
 * A person's first round on this device starts with the how-to (tutorial/): a ghost hand shows a drag
 * Yep, a drag Nope, a tap Yep and a tap Nope on the real first card, looping until they act. The card's
 * random looks are off while it runs.
 */
import { memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Platform, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { ActivityPointer, Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { fixturesEnabled } from '../../core/config';
import { useReducedMotion } from '../../components/ui';
import { readTutorialSeen, tutorialSeenNow, writeTutorialSeen } from '../../core/continuous/tutorial-seen';
import { BootPhase } from '../home/boot-phase';
import { useRoomFeedback } from '../feedback/RoomFeedback';
import { groupActivity, type PeerActivity } from '../../core/continuous/activity';
import { latestRetainedVote, ownCard } from '../../core/continuous/state';
import { titlePresentation } from '../glow/adapter';
import type { GesturePhase } from '../glow/model';
import { LiveFaces } from '../glow/Peers';
import { votingBarFit } from '../glow/faces-row';
import { useActiveTime } from '../glow/useActiveTime';
import { TrailerLink } from '../glow/TrailerLink';
import { GText, Icon, Press, glow, native } from '../glow/theme';
import { HoverPress } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { useBackAction } from '../shell/sheet-back';
import { useSheetEntry } from '../shell/Sheet';
import { useSheetOpen } from '../shell/sheet-stack';
import { useStableCallback, useSteady } from '../shell/steady';
import { warm } from '../shell/tokens';
import { MatchesPeek } from './MatchesPeek';
import { toRooms } from './nav';
import { useRoom, useRoomLive } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { servicesIn } from './services';
import { TitleDetails } from './TitleDetails';
import { EdgeGlow } from './tutorial/EdgeGlow';
import { Tutorial, type Rect } from './tutorial/Tutorial';
import { FindingMore, Label, Logos, Screen, useServices } from './ui';
import { stageGeometry, stageRim, type Rim } from './vote/geometry';
import { LookDealer, harnessLooksFrom, pinnedLookFrom } from './vote/looks';
import { answerYep, matchKey, nextCandidate, settleYeps, undoYeps, yepRecord, type YepRecord } from './vote/match';
import { VoteStage, type DragValues, type MatchMoment, type StageFrame, type VoteStageControls } from './vote/VoteStage';

/** The one question every Tonight card asks. */
export const TONIGHT_QUESTION = 'Would you watch this tonight?';

/** Service ids a candidate is offered on among the room's switched-on services. */
export function offeredOn(c: { availability: { offers: { serviceId: number }[] }[] }, enabled: number[]) {
  return [...new Set(c.availability.flatMap((a) => a.offers.map((o) => o.serviceId)))].filter((id) => enabled.includes(id));
}

type Reaction = { at: number; gesture?: 'reach' | 'handle' | 'release'; answer?: boolean };
/** Your own face reacts at once (friends see it through activity). */
const reaction = (r: Omit<Reaction, 'at'>): Reaction => ({ at: Date.now(), ...r });

/** Pinned looks, for diagnosis only: the E2E harness's `E2E_LOOK`, or `?look=<name>` in a fixture build. */
const pinnedLook = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return harnessLooksFrom((window as { __YEPWATCH_LOOKS__?: unknown }).__YEPWATCH_LOOKS__) ?? (fixturesEnabled ? pinnedLookFrom(window.location.search) : null);
};

/** The same people, each with the same name and the same "you". */
const samePeople = (a: { id: string; nickname: string; self: boolean }[], b: typeof a) =>
  a.length === b.length && a.every((p, i) => p.id === b[i].id && p.nickname === b[i].nickname && p.self === b[i].self);
/** The same activity: per person the same frame, pointer and pulse (pruning wraps them in new objects). */
const sameActivity = (a: Map<string, PeerActivity>, b: Map<string, PeerActivity>) =>
  a.size === b.size && [...a].every(([id, x]) => { const y = b.get(id); return y !== undefined && x.frame === y.frame && x.pointer === y.pointer && x.pulse === y.pulse; });
const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((id, i) => id === b[i]);
type ViewNode = ComponentRef<typeof View>;
const clampI = { extrapolate: 'clamp' } as const;
/** A view's box in the window (null before it's laid out). */
const measure = (ref: { current: ViewNode | null }) => new Promise<Rect | null>((resolve) => {
  const node = ref.current;
  if (!node) { resolve(null); return; }
  node.measureInWindow((x: number, y: number, w: number, h: number) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
});
/** A touch screen: the how-to shows a finger and says Swipe; a mouse gets a cursor and Drag. */
const touchScreen = () => native || (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);

/** The card's "why this" line, when the server sends one for it (read defensively: the field is new). */
export function cardReason(c: Candidate | undefined): string | null {
  const reason = (c as { reason?: unknown } | undefined)?.reason;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

/**
 * Nope (a slight red hint) and Yep (amber). `lit` (0…1) lights it as the card leans its way or the how-to
 * taps it: a ring glows around it and it grows a little (transform and opacity only).
 */
const VoteKey = memo(function VoteKey({ yes, disabled, onPress, lit, box }: { yes: boolean; disabled: boolean; onPress: () => void; lit: Animated.AnimatedInterpolation<number>; box: { current: ViewNode | null } }) {
  const { z } = useLayout();
  return (
    <View ref={box} collapsable={false} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, flexDirection: 'row' }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -5, right: -5, top: -5, bottom: -5, borderRadius: 16, borderWidth: 2, borderColor: yes ? glow.amber : '#f87171', backgroundColor: yes ? '#fbbf2422' : '#f8717122',
        opacity: lit, transform: [{ scale: lit.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.02] }) }] }} />
      <Animated.View style={{ flex: 1, flexDirection: 'row', transform: [{ scale: lit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] }}>
        <HoverPress label={yes ? 'Yep' : 'Nope'} disabled={disabled} onPress={onPress} repeatable
          style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: z(54), borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 9, backgroundColor: yes ? glow.amber : '#ef44440f', borderWidth: 1, borderColor: yes ? glow.amber : '#ef444440' }}>
          <Icon name={yes ? 'check' : 'close'} size={18} color={yes ? warm.ink : '#f87171'} />
          <GText bold size={z(17)} color={yes ? warm.ink : glow.ink} lines={1}>{yes ? 'Yep' : 'Nope'}</GText>
        </HoverPress>
      </Animated.View>
    </View>
  );
});

/** Details and Trailer beside "Why this" (wide windows; the poster's own buttons are off there). Trailer keeps its place when a card has none. */
function CardTools({ title, trailerUrl, disabled, onDetails }: { title: string; trailerUrl: string | null; disabled: boolean; onDetails: () => void }) {
  const { z } = useLayout();
  const look = { height: z(34), paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: warm.line } as const;
  const trailer = (
    <>
      <Icon name="play" size={z(12)} color={glow.muted} />
      <GText bold size={z(13)} color={glow.muted}>Trailer</GText>
    </>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <HoverPress label={title ? `Details about ${title}` : 'Details'} disabled={disabled} onPress={onDetails} visual={look}>
        <Icon name="external" size={z(12)} color={glow.muted} /><GText bold size={z(13)} color={glow.muted}>Details</GText>
      </HoverPress>
      {trailerUrl && !disabled
        ? <TrailerLink url={trailerUrl} style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }} visual={look}>{trailer}</TrailerLink>
        : <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ minHeight: 48, justifyContent: 'center', opacity: 0 }}><View style={look}>{trailer}</View></View>}
    </View>
  );
}

/** A full-screen page over the voting screen (the card underneath keeps its place); `page` uses the whole container. */
function Sheet({ close, children, testID, page = false }: { close: () => void; children: ReactNode; testID: string; page?: boolean }) {
  // On the sheet stack: browser Back, Android back, Escape and the header's Back close it, never the room.
  useSheetEntry(close);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <Screen testID={testID} back={close} {...(page ? { width: 'page' as const, gap: 0 } : {})}>{children}</Screen>
    </View>
  );
}

/** Wide windows: the question column's width and the space between it and the card's column (looks may paint into it). */
const ASIDE_W = 420;
const ASIDE_GAP = 40;

/**
 * Whether the how-to runs: a person's first round on this device, until they act. Web knows at once; native
 * reads the device first (nothing shows meanwhile). Someone who already answered cards in this round
 * (an app from before the how-to, a reload) never gets it.
 */
function useTutorialGate(answeredBefore: boolean) {
  const [state, setState] = useState<'unknown' | 'teach' | 'done'>(() => {
    const now = tutorialSeenNow();
    return now === null ? 'unknown' : now || answeredBefore ? 'done' : 'teach';
  });
  useEffect(() => {
    if (state !== 'unknown') return;
    let live = true;
    void readTutorialSeen().then((seen) => { if (live) setState(seen || answeredBefore ? 'done' : 'teach'); });
    return () => { live = false; };
  }, [state, answeredBefore]);
  useEffect(() => { if (state === 'teach' && answeredBefore) setState('done'); }, [state, answeredBefore]); // eslint-disable-line react-hooks/set-state-in-effect
  const finish = useCallback(() => {
    setState((s) => {
      if (s === 'teach') void writeTutorialSeen();
      return 'done';
    });
  }, []);
  return { teach: state === 'teach', finish };
}

/** `entering`: the round just started, so the first card rises in; `onEntered` once the stage has played that. */
export function Voting({ entering = false, onEntered }: { entering?: boolean; onEntered?: () => void }) {
  const room = useRoom();
  const { id, state, view, cmd, entry } = room;
  const { snapshot, activities, confirmed } = useRoomLive();
  const layout = useLayout();
  const { fontScale, height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { phone, wide, z } = layout;
  /** The row over the stage holds the 48 × 48 touch targets of the faces and Undo. */
  const barHeight = Math.max(48, z(44));
  const reduced = useReducedMotion();
  const [panel, setPanel] = useState<'details' | null>(null);
  // The card is placed from the stage's measured size; it isn't drawn before that (a guess would move it).
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const stageBox = useRef<ViewNode>(null);
  const frameBox = useRef<ViewNode>(null);
  const asideBox = useRef<ViewNode>(null);
  const rootBox = useRef<ViewNode>(null);
  const yesBox = useRef<ViewNode>(null);
  const noBox = useRef<ViewNode>(null);
  /** Web: the backdrop's colors at the stage's edges (where it sits in the frame the backdrop spans). */
  const [rim, setRim] = useState<Rim | null>(null);
  /** Web: the stage's left edge in the window, so looks can reach both screen edges from a stage off center. */
  const [stageLeft, setStageLeft] = useState<number | null>(null);
  const placeStage = useStableCallback(() => {
    const el = stageBox.current as unknown as HTMLElement | null;
    const frame = frameBox.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !el || !frame || typeof el.offsetTop !== 'number') return;
    // Layout offsets, not client rects: a screen sliding or scaling in doesn't move the stage in its frame.
    let top = 0;
    let at: HTMLElement | null = el;
    while (at && at !== frame) {
      top += at.offsetTop;
      at = at.offsetParent as HTMLElement | null;
    }
    const next = at ? stageRim(top, el.offsetHeight, frame.offsetHeight) : null;
    setRim((r) => (JSON.stringify(r) === JSON.stringify(next) ? r : next));
    let left = 0;
    for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) left += node.offsetLeft;
    setStageLeft(left);
  });
  const ready = Boolean(snapshot && view);
  // The web measures before the first paint, so the first card is drawn where it stays.
  useLayoutEffect(() => {
    const el = stageBox.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !el || typeof el.offsetWidth !== 'number') return;
    if (el.offsetWidth > 0 && el.offsetHeight > 0) setArea((a) => (a && a.width === el.offsetWidth && a.height === el.offsetHeight ? a : { width: el.offsetWidth, height: el.offsetHeight }));
    placeStage();
    // The window's height too: a stage held at its least height doesn't resize while the frame (and its backdrop) does.
  }, [ready, placeStage, windowHeight, wide]);
  const [focused, setFocused] = useState(true);
  const [localReaction, setLocalReaction] = useState<Reaction>({ at: 0 });
  const [dealer] = useState(() => new LookDealer(Math.random, pinnedLook()));
  /** Your Yeps the room hasn't confirmed yet. */
  const [yeps, setYeps] = useState<readonly YepRecord[]>([]);
  const yepSerial = useRef(0);
  const [moment, setMoment] = useState<MatchMoment | null>(null);
  const controls = useRef<VoteStageControls>(null);
  const pointerAt = useRef(0);
  /**
   * The card's drag core lives here, so Nope and Yep light up as the card leans their way, and the how-to can
   * move the real card. The flash and pin values are the how-to's taps and tips. The question column's veil
   * is the looks' to drive (VoteStage `asideVeil`).
   */
  const [drives] = useState(() => ({
    drag: { x: new Animated.Value(0), y: new Animated.Value(0), v: new Animated.Value(0) } as DragValues,
    yes: new Animated.Value(0), no: new Animated.Value(0), pinYes: new Animated.Value(0), pinNo: new Animated.Value(0),
    veil: new Animated.Value(1),
  }));
  const { all } = useServices(view?.country);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useBackAction(() => { if (panel) setPanel(null); else toRooms(); });
  const setActivityView = room.setActivityView;
  useEffect(() => { if (focused) setActivityView('voting'); }, [focused, setActivityView]);
  // A confirmed restart discards the previous round's local state.
  const generation = snapshot?.shared.generation;
  useEffect(() => { setPanel(null); }, [generation]); // eslint-disable-line react-hooks/set-state-in-effect
  useRoomFeedback(snapshot, false);
  const card = snapshot ? ownCard(snapshot) : undefined;
  const vote = card ? snapshot?.own.votes.find((v) => v.candidateId === card.id) : undefined;
  // Answers queue behind commands still on their way (the Start that dealt this card, the previous vote,
  // a saved one waiting for the network): the card is live the moment it shows. Only a room that can't
  // be read or an entry still running holds the answers.
  const disabled = state.privateError || entry.working || entry.required;
  // A sheet over the card (the room's or the header's Your rooms): no answers, and the time doesn't count as seeing the title.
  const covered = useSheetOpen();
  const answering = !disabled && !covered;
  // Under the startup cover the page is built but unseen: its time doesn't count as seeing a card, and the
  // arrow keys (window-wide, so the cover's inert and pointer blocking don't stop them) wait until the
  // page takes input like taps do.
  const boot = useContext(BootPhase);
  const activeTime = useActiveTime(id, snapshot && card ? `${snapshot.shared.generation}:${card.id}:${vote?.revision ?? 0}` : null,
    Boolean(card) && focused && !panel && answering && boot !== 'boot' && !state.terminal && snapshot?.shared.phase === 'choosing');
  const endMoment = useCallback((key: string) => setMoment((m) => (m?.key === key ? null : m)), []);
  // The how-to: a person's first round on this device. It runs while the card takes answers and nothing covers it.
  const [answeredBefore] = useState(() => Boolean(snapshot?.own.votes.some((v) => v.value !== null)));
  const tutorial = useTutorialGate(answeredBefore);
  const teaching = tutorial.teach && Boolean(card) && answering && focused && !panel && boot === 'ready';
  /** The person took hold of the card: the how-to's drag is theirs now, so it isn't eased back. */
  const grabbed = useRef(false);
  const finishTutorial = tutorial.finish;
  // The how-to ends: unless the person holds the card, it eases back to rest and the buttons go dark.
  const wasTeaching = useRef(false);
  useEffect(() => {
    if (teaching) { wasTeaching.current = true; return; }
    if (!wasTeaching.current) return;
    wasTeaching.current = false;
    const d = drives.drag;
    const to0 = (a: Animated.Value, ms: number) => Animated.timing(a, { toValue: 0, duration: ms, useNativeDriver: native });
    const back = grabbed.current ? [] : [to0(d.x, 280), to0(d.y, 280), to0(d.v, 280)];
    const run = Animated.parallel([...back, to0(drives.yes, 200), to0(drives.no, 200), to0(drives.pinYes, 200), to0(drives.pinNo, 200)]);
    run.start(({ finished }) => { if (finished && !grabbed.current) controls.current?.engage(false); });
    return () => run.stop();
  }, [teaching, drives]);
  // What the stage and the bar take, kept steady across renders that don't change them (a vote, a
  // confirmation, a friend's activity re-render this screen; the stage and the faces then skip theirs).
  const cardKey = snapshot && card ? `${snapshot.shared.generation}:${card.id}` : null;
  const title = useMemo(() => (card ? titlePresentation(card) : null), [card]);
  const look = cardKey ? dealer.lookFor(cardKey) : null;
  const stageCard = useMemo(() => (cardKey && title && look ? { key: cardKey, title, look } : null), [cardKey, title, look]);
  const nextCard = snapshot ? nextCandidate(snapshot, card?.id) : undefined;
  const next = useMemo(() => (nextCard ? titlePresentation(nextCard) : null), [nextCard]);
  const participants = snapshot?.shared.participants;
  const activityNow = state.activityNow;
  const freshActivity = state.connection === 'live' && participants
    ? groupActivity(new Map([...activities].filter(([, a]) => participants.some((p) => p.participantId === a.frame.participantId && !p.dropped))), activityNow())
    : new Map<string, PeerActivity>();
  const activity = useSteady(freshActivity, sameActivity);
  const people = useSteady((view?.people ?? []).map((p) => ({ id: p.id, nickname: p.nickname || '?', self: p.self })), samePeople);
  const offeredIds = useSteady(card && view ? offeredOn(card, view.enabledServiceIds) : [], sameIds);
  const services = useMemo(() => {
    const offered = servicesIn(all, offeredIds);
    return offered.length ? <Logos services={offered} size={z(22)} /> : undefined;
  }, [all, offeredIds, z]);
  const geo = useMemo(() => (area ? stageGeometry({ aw: area.width, stageH: area.height, vw: layout.width, phone, z, rim, place: stageLeft === null ? null : { left: stageLeft } }) : null), [area, layout.width, phone, z, rim, stageLeft]);
  const empty = useMemo(() => <FindingMore style={{ flex: 1 }} />, []);
  const nope = useCallback(() => controls.current?.commit(false), []);
  const yep = useCallback(() => controls.current?.commit(true), []);
  const onDetails = useCallback(() => setPanel('details'), []);
  const onGesture = useStableCallback((gesture: GesturePhase) => {
    if (gesture === 'reach') grabbed.current = true;
    setLocalReaction(reaction({ gesture }));
    state.activity(gesture);
  });
  const onPointer = useStableCallback((pointer: ActivityPointer | null) => {
    state.pointer(pointer);
    if (pointer && Date.now() - pointerAt.current > 280) {
      pointerAt.current = Date.now();
      setLocalReaction(reaction({ gesture: pointer.pressed ? 'reach' : 'handle' }));
    }
  });
  /** Sent the moment it's pressed, for the card it was aimed at; the fly-off plays meanwhile. */
  const choose = (yes: boolean, key: string): Promise<boolean> => {
    if (!card || !answering || !look || !snapshot || key !== `${snapshot.shared.generation}:${card.id}`) return Promise.resolve(false);
    finishTutorial();
    setLocalReaction(reaction({ answer: yes }));
    state.activity(undefined, 'answer');
    const sent = cmd.vote(card.id, yes, activeTime());
    if (!yes) return sent;
    // Remembered until the room confirms it; a refused one is forgotten.
    const record = yepRecord(++yepSerial.current, snapshot, card.id, look);
    setYeps((list) => [...list, record]);
    void sent.then((ok) => setYeps((list) => answerYep(list, record.serial, ok, room.latest())));
    return sent;
  };
  const onVote = useStableCallback(choose);

  // The buttons light as the card leans their way (a drag, the how-to's taps).
  const T = geo ? geo.threshold : 120;
  const lit = useMemo(() => {
    const x = drives.drag.x;
    const on = (a: Animated.Value, b: Animated.AnimatedInterpolation<number>) => Animated.add(a, b).interpolate({ inputRange: [0, 1], outputRange: [0, 1], ...clampI });
    return {
      yes: on(drives.yes, x.interpolate({ inputRange: [8, Math.max(9, T)], outputRange: [0, 1], ...clampI })),
      no: on(drives.no, x.interpolate({ inputRange: [-Math.max(9, T), -8], outputRange: [1, 0], ...clampI })),
    };
  }, [drives, T]);
  const touch = useMemo(() => phone || touchScreen(), [phone]);
  const cardOver = useMemo(() => (teaching && geo ? (x: Animated.Value) => <EdgeGlow x={x} T={geo.threshold} w={geo.w} h={geo.h} touch={touch} /> : undefined), [teaching, geo, touch]);

  // Where the card, the buttons and (wide) the question column are. The how-to's layer and the looks read them.
  const [rects, setRects] = useState<{ card: Rect; yes: Rect; no: Rect } | null>(null);
  const [frame, setFrame] = useState<StageFrame | null>(null);
  const [tick, setTick] = useState(0);
  const relayout = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (!geo || (!teaching && !wide)) return;
    const t = setTimeout(() => {
      void Promise.all([measure(rootBox), measure(stageBox), measure(yesBox), measure(noBox), measure(asideBox)]).then(([root, stage, yes, no, aside]) => {
        if (!stage) return;
        if (wide) {
          const next: StageFrame = {
            window: { x: -stage.x, y: -stage.y, width: windowWidth, height: windowHeight },
            aside: aside ? { x: aside.x - stage.x, y: aside.y - stage.y, width: aside.w, height: aside.h } : null,
          };
          setFrame((cur) => (cur && JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
        }
        if (!teaching || !root || !yes || !no) return;
        const rel = (r: Rect) => ({ x: r.x - root.x, y: r.y - root.y, w: r.w, h: r.h });
        const next = { card: { x: stage.x - root.x + (geo.aw - geo.w) / 2, y: stage.y - root.y + geo.cardTop, w: geo.w, h: geo.h }, yes: rel(yes), no: rel(no) };
        // Measuring again with nothing moved keeps the same rects, so the how-to isn't restarted.
        setRects((cur) => (cur && JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
      });
    }, 60);
    return () => clearTimeout(t);
  }, [teaching, wide, geo, tick, windowWidth, windowHeight]);
  const engage = useCallback((on: boolean) => controls.current?.engage(on), []);
  const stopTutorial = useCallback(() => finishTutorial(), [finishTutorial]);

  if (!snapshot || !view) return null;
  const { shared } = snapshot;
  // A Yep of yours made a match once the confirmed room lists it: MATCH plays in that card's look.
  const settled = confirmed && yeps.length ? settleYeps(yeps, confirmed) : null;
  if (settled?.changed) {
    setYeps(settled.pending);
    const made = settled.matched[0];
    const matched = made ? shared.candidates.find((c) => c.id === made.candidateId) : undefined;
    if (made && matched && view.people.length > 1) setMoment({ key: matchKey(made), cardKey: `${made.generation}:${made.candidateId}`, title: titlePresentation(matched), look: made.look });
  }
  const rowWidth = wide ? layout.max : area && geo ? Math.min(area.width, Math.max(geo.w, 320)) : phone ? layout.width - 32 : layout.max;
  const undoTarget = latestRetainedVote(snapshot);
  // The bar's split depends on its width and the font scale only: people coming and going move nothing.
  const fit = votingBarFit({ rowWidth, size: z(26), fontScale, z, undo: Math.max(48, z(40)), gap: 10 });
  const answered = new Set(snapshot.own.votes.filter((v) => v.value !== null).map((v) => v.candidateId));
  const done = shared.candidates.filter((c) => answered.has(c.id)).length;
  const countLine = card ? `Card ${Math.min(done + 1, shared.candidates.length)} of ${shared.candidates.length}` : 'Finding more';
  const reason = cardReason(card);
  // The why line keeps its row for the whole round once the deck carries reasons at all: a card without one moves nothing.
  const reasons = shared.candidates.some((c) => cardReason(c) !== null);
  const why = reason ? (
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <GText bold size={z(13)} color={glow.muted}>Why this</GText>
      <GText size={z(14)} color={glow.amber} lines={wide ? 2 : 1} style={{ flexShrink: 1 }}>{reason}</GText>
    </View>
  ) : <View style={{ flex: 1 }} />;
  const keyRow = (
    <View style={{ flexDirection: 'row', gap: 12, width: '100%', alignSelf: 'center' }}>
      <VoteKey yes={false} disabled={!answering || !card} onPress={nope} lit={lit.no} box={noBox} />
      <VoteKey yes disabled={!answering || !card} onPress={yep} lit={lit.yes} box={yesBox} />
    </View>
  );
  const peek = <MatchesPeek roomId={id} matches={view.matches} proposal={Boolean(view.proposal)} />;
  const bar = (
    <View testID="voting-bar" style={{ height: barHeight, flexDirection: 'row', alignItems: 'center', gap: 10, width: rowWidth, alignSelf: 'center', zIndex: 3 }}>
      {/* Always the same width: the second person arriving moves nothing. */}
      {people.length > 1 ? <LiveFaces people={people} activity={activity} localReaction={localReaction} size={z(26)} slots={fit.slots} fontScale={fontScale} /> : <View style={{ width: fit.facesWidth }} />}
      <View style={{ flex: 1 }} />
      <Press label="Undo" disabled={disabled || !undoTarget} onPress={() => { if (!undoTarget) return; setYeps((list) => undoYeps(list, undoTarget.candidateId)); void cmd.undo(undoTarget.candidateId); }}
        visual={{ width: z(40), height: z(36), borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff0a' }}>
        <Icon name="undo" size={z(17)} color={glow.soft} />
      </Press>
    </View>
  );
  const stage = (
    // A page on top hides this one (zero size on the web): keep the last real size.
    <View ref={stageBox} collapsable={false} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (width > 0 && height > 0) { setArea((a) => (a && a.width === width && a.height === height ? a : { width, height })); placeStage(); relayout(); } }}
      style={{ flex: 1, minHeight: 80, zIndex: 2 }}>
      {geo ? <VoteStage geo={geo} controls={controls} reduced={reduced} enter={entering} onEntered={onEntered} disabled={!answering} keys={focused && !panel && answering && boot === 'ready'}
        card={stageCard}
        next={next}
        empty={empty}
        activity={activity}
        services={services}
        moment={view.people.length > 1 ? moment : null} onMomentEnd={endMoment}
        onVote={onVote}
        onDetails={onDetails}
        onGesture={onGesture}
        onPointer={onPointer}
        drag={drives.drag}
        plain={teaching}
        cardOver={cardOver}
        cardTools={!wide}
        frame={wide ? frame : null}
        asideVeil={wide ? drives.veil : undefined} /> : null}
    </View>
  );
  const details = panel === 'details' && title && card ? (
    <Sheet testID="details-panel" page close={() => setPanel(null)}>
      <TitleDetails key={card.id} c={card} />
    </Sheet>
  ) : null;
  const howTo = teaching && rects ? (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50 }}>
      <Tutorial t={{ touch, card: rects.card, yes: rects.yes, no: rects.no, drag: drives.drag, threshold: T, engage, keys: { yes: drives.yes, no: drives.no }, pins: { yes: drives.pinYes, no: drives.pinNo }, reduced, stop: stopTutorial }} />
    </View>
  ) : null;
  const overlay = (
    <>
      {/* The how-to's layer: its coordinates are this box's (the whole frame). */}
      <View ref={rootBox} collapsable={false} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      {howTo}
      {details}
    </>
  );
  // Any touch on the screen ends the how-to (the person acts); it doesn't take the touch.
  const onTouchCapture = () => { if (teaching) finishTutorial(); return false; };
  if (wide) {
    return (
      <View style={{ flex: 1 }} onStartShouldSetResponderCapture={onTouchCapture}>
        <Screen testID="voting" frameRef={frameBox} scroll={false} back={toRooms} covered={Boolean(panel)} width="page" noteTop={z(24) + barHeight + 8} overlay={overlay}>
          <RoomNotes />
          {bar}
          <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: z(ASIDE_GAP), alignItems: 'stretch' }}>
            {/* Above the question column: a look (or a card flying off) paints over it, veiling it when it crosses it. */}
            <View style={{ flex: 1, minWidth: 0, zIndex: 2 }}>{stage}</View>
            <Animated.View ref={asideBox} collapsable={false} onLayout={relayout} testID="tonight-question"
              style={{ width: z(ASIDE_W), justifyContent: 'center', gap: z(18), zIndex: 1, opacity: drives.veil }}>
              <Label>{countLine}</Label>
              <GText bold size={z(40)} style={{ letterSpacing: -1, lineHeight: z(40) * 1.12 }}>{TONIGHT_QUESTION}</GText>
              <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {reasons ? why : null}
                <CardTools title={card?.title ?? ''} trailerUrl={card?.trailerUrl ?? null} disabled={!card || !answering} onDetails={onDetails} />
              </View>
              {keyRow}
              {peek}
            </Animated.View>
          </View>
        </Screen>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }} onStartShouldSetResponderCapture={onTouchCapture}>
      <Screen testID="voting" frameRef={frameBox} scroll={false} back={toRooms} covered={Boolean(panel)} width="page" noteTop={(phone ? 12 : z(24)) + barHeight + 8} overlay={overlay}
        footer={
          <View onLayout={relayout} style={{ gap: 10, width: phone ? '100%' : rowWidth, alignSelf: 'center' }}>
            <GText bold size={phone ? 20 : z(24)} style={{ letterSpacing: -0.5 }}>{TONIGHT_QUESTION}</GText>
            {reasons ? <View style={{ minHeight: 24, flexDirection: 'row', alignItems: 'center' }}>{why}</View> : null}
            {keyRow}
            {peek}
          </View>
        }>
        <RoomNotes />
        {bar}
        {stage}
      </Screen>
    </View>
  );
}
